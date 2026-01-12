const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Get all contact lists for user
router.get('/lists', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contact_lists')
      .select('*, contacts(count)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Update total_contacts count
    const listsWithCounts = data.map(list => ({
      ...list,
      total_contacts: list.contacts?.[0]?.count || 0
    }));
    
    res.json(listsWithCounts);
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new contact list
router.post('/lists', authenticateUser, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }
    
    const { data, error } = await supabase
      .from('contact_lists')
      .insert({
        user_id: req.user.id,
        name,
        description: description || '',
        total_contacts: 0
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get contacts in a list
router.get('/lists/:listId/contacts', authenticateUser, async (req, res) => {
  try {
    const { listId } = req.params;
    const { search, status, limit = 100, offset = 0 } = req.query;
    
    // Verify list belongs to user
    const { data: list } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('user_id', req.user.id)
      .single();
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('list_id', listId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });
    
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    res.json({
      contacts: data,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add single contact
router.post('/lists/:listId/contacts', authenticateUser, async (req, res) => {
  try {
    const { listId } = req.params;
    const { email, first_name, last_name, company, custom_fields } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Verify list belongs to user
    const { data: list } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('user_id', req.user.id)
      .single();
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        list_id: listId,
        email: email.toLowerCase().trim(),
        first_name: first_name || '',
        last_name: last_name || '',
        company: company || '',
        custom_fields: custom_fields || {},
        status: 'active'
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Duplicate key
        return res.status(400).json({ error: 'Contact already exists in this list' });
      }
      throw error;
    }
    
    // Update list count
    await supabase.rpc('increment_list_count', { list_id: listId });
    
    res.json(data);
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import contacts from CSV
router.post('/lists/:listId/import', authenticateUser, upload.single('file'), async (req, res) => {
  try {
    const { listId } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Verify list belongs to user
    const { data: list } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('user_id', req.user.id)
      .single();
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    const contacts = [];
    const errors = [];
    
    // Parse CSV
    const stream = Readable.from(file.buffer);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          // Try different column name variations
          const email = row.email || row.Email || row.EMAIL || row['Email Address'];
          const firstName = row.first_name || row.First_Name || row.firstName || row['First Name'] || '';
          const lastName = row.last_name || row.Last_Name || row.lastName || row['Last Name'] || '';
          const company = row.company || row.Company || row.COMPANY || '';
          
          if (email && email.includes('@')) {
            contacts.push({
              list_id: listId,
              email: email.toLowerCase().trim(),
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              company: company.trim(),
              custom_fields: {},
              status: 'active'
            });
          } else {
            errors.push({ row, reason: 'Invalid or missing email' });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    if (contacts.length === 0) {
      return res.status(400).json({ error: 'No valid contacts found in CSV' });
    }
    
    // Batch insert with duplicate handling
    const { data, error } = await supabase
      .from('contacts')
      .upsert(contacts, { 
        onConflict: 'list_id,email',
        ignoreDuplicates: true 
      })
      .select();
    
    if (error) throw error;
    
    const imported = data?.length || 0;
    const skipped = contacts.length - imported;
    
    // Update list count
    if (imported > 0) {
      await supabase.rpc('increment_list_count', { list_id: listId, increment_by: imported });
    }
    
    res.json({
      success: true,
      imported,
      skipped,
      total: contacts.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Return first 10 errors
    });
  } catch (error) {
    console.error('Error importing contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update contact
router.put('/contacts/:contactId', authenticateUser, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { email, first_name, last_name, company, custom_fields, status } = req.body;
    
    // Verify contact belongs to user's list
    const { data: contact } = await supabase
      .from('contacts')
      .select('list_id, contact_lists!inner(user_id)')
      .eq('id', contactId)
      .single();
    
    if (!contact || contact.contact_lists.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const updates = {};
    if (email) updates.email = email.toLowerCase().trim();
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (company !== undefined) updates.company = company;
    if (custom_fields) updates.custom_fields = custom_fields;
    if (status) updates.status = status;
    
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete contact
router.delete('/contacts/:contactId', authenticateUser, async (req, res) => {
  try {
    const { contactId } = req.params;
    
    // Get contact to verify ownership and get list_id
    const { data: contact } = await supabase
      .from('contacts')
      .select('list_id, contact_lists!inner(user_id)')
      .eq('id', contactId)
      .single();
    
    if (!contact || contact.contact_lists.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);
    
    if (error) throw error;
    
    // Decrement list count
    await supabase.rpc('increment_list_count', { list_id: contact.list_id, increment_by: -1 });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete contact list
router.delete('/lists/:listId', authenticateUser, async (req, res) => {
  try {
    const { listId } = req.params;
    
    // Verify list belongs to user
    const { data: list } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('user_id', req.user.id)
      .single();
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    const { error } = await supabase
      .from('contact_lists')
      .delete()
      .eq('id', listId);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
