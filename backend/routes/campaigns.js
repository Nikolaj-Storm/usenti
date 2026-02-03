const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

// Get all campaigns for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts),
        campaign_email_accounts(
          id,
          email_account_id,
          is_active,
          email_accounts(id, email_address)
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single campaign
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts),
        campaign_email_accounts(
          id,
          email_account_id,
          is_active,
          email_accounts(id, email_address)
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new campaign
// Supports both legacy single email_account_id and new email_account_ids array
router.post('/', authenticateUser, async (req, res) => {
  try {
    const {
      name,
      email_account_id,      // Legacy: single account
      email_account_ids,     // New: array of accounts for rotation
      contact_list_id,
      send_schedule,
      daily_limit
    } = req.body;

    // Determine which accounts to use
    const accountIds = email_account_ids && email_account_ids.length > 0
      ? email_account_ids
      : (email_account_id ? [email_account_id] : []);

    // Validate required fields
    if (!name || accountIds.length === 0 || !contact_list_id) {
      return res.status(400).json({
        error: 'Name, at least one email account, and contact list are required'
      });
    }

    // Verify all email accounts belong to user
    const { data: emailAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id')
      .in('id', accountIds)
      .eq('user_id', req.user.id);

    if (accountsError) throw accountsError;

    if (!emailAccounts || emailAccounts.length !== accountIds.length) {
      return res.status(400).json({ error: 'One or more email accounts are invalid' });
    }

    // Verify contact list belongs to user
    const { data: contactList } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', contact_list_id)
      .eq('user_id', req.user.id)
      .single();

    if (!contactList) {
      return res.status(400).json({ error: 'Invalid contact list' });
    }

    // Create campaign
    // For multi-account campaigns, email_account_id is set to the first account for backward compatibility
    // The actual rotation uses the campaign_email_accounts junction table
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: req.user.id,
        name,
        email_account_id: accountIds[0], // First account for backward compatibility
        contact_list_id,
        status: 'draft',
        send_schedule: send_schedule || {
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start_hour: 9,
          end_hour: 17
        },
        daily_limit: daily_limit || 500
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // If multiple accounts, create junction table entries
    if (accountIds.length > 0) {
      const junctionEntries = accountIds.map(accountId => ({
        campaign_id: campaign.id,
        email_account_id: accountId,
        is_active: true
      }));

      const { error: junctionError } = await supabase
        .from('campaign_email_accounts')
        .insert(junctionEntries);

      if (junctionError) {
        console.error('Error creating campaign_email_accounts:', junctionError);
        // Don't fail the whole request, campaign is still usable with legacy single account
      }
    }

    // Fetch the complete campaign with all relations
    const { data: fullCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts),
        campaign_email_accounts(
          id,
          email_account_id,
          is_active,
          email_accounts(id, email_address)
        )
      `)
      .eq('id', campaign.id)
      .single();

    if (fetchError) throw fetchError;

    res.json(fullCampaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update campaign
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { name, send_schedule, daily_limit, status } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (send_schedule) updates.send_schedule = send_schedule;
    if (daily_limit !== undefined) updates.daily_limit = daily_limit;
    if (status) updates.status = status;

    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts)
      `)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete campaign
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CAMPAIGN EMAIL ACCOUNTS (Multi-Account Rotation)
// ============================================================================

// Get email accounts for a campaign
router.get('/:id/email-accounts', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data, error } = await supabase
      .from('campaign_email_accounts')
      .select(`
        id,
        email_account_id,
        emails_sent_today,
        last_used_at,
        is_active,
        email_accounts(id, email_address, daily_send_limit)
      `)
      .eq('campaign_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching campaign email accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add email account(s) to a campaign
router.post('/:id/email-accounts', authenticateUser, async (req, res) => {
  try {
    const { email_account_ids } = req.body;

    if (!email_account_ids || !Array.isArray(email_account_ids) || email_account_ids.length === 0) {
      return res.status(400).json({ error: 'email_account_ids array is required' });
    }

    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Verify all email accounts belong to user
    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('id')
      .in('id', email_account_ids)
      .eq('user_id', req.user.id);

    if (!emailAccounts || emailAccounts.length !== email_account_ids.length) {
      return res.status(400).json({ error: 'One or more email accounts are invalid' });
    }

    // Insert new associations (ignore duplicates)
    const entries = email_account_ids.map(accountId => ({
      campaign_id: req.params.id,
      email_account_id: accountId,
      is_active: true
    }));

    const { error } = await supabase
      .from('campaign_email_accounts')
      .upsert(entries, { onConflict: 'campaign_id,email_account_id' });

    if (error) throw error;

    // Return updated list
    const { data: updatedList } = await supabase
      .from('campaign_email_accounts')
      .select(`
        id,
        email_account_id,
        emails_sent_today,
        last_used_at,
        is_active,
        email_accounts(id, email_address, daily_send_limit)
      `)
      .eq('campaign_id', req.params.id);

    res.json(updatedList || []);
  } catch (error) {
    console.error('Error adding campaign email accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove email account from a campaign
router.delete('/:campaignId/email-accounts/:accountId', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { error } = await supabase
      .from('campaign_email_accounts')
      .delete()
      .eq('campaign_id', req.params.campaignId)
      .eq('email_account_id', req.params.accountId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing campaign email account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle email account active status for a campaign
router.patch('/:campaignId/email-accounts/:accountId', authenticateUser, async (req, res) => {
  try {
    const { is_active } = req.body;

    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data, error } = await supabase
      .from('campaign_email_accounts')
      .update({ is_active })
      .eq('campaign_id', req.params.campaignId)
      .eq('email_account_id', req.params.accountId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating campaign email account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign steps
router.get('/:id/steps', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('step_order');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching campaign steps:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add campaign step
router.post('/:id/steps', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const {
      step_type,
      subject,
      body,
      // Wait step fields
      wait_days,
      wait_hours,
      wait_minutes,
      // Condition step fields (legacy + new)
      condition_type,
      condition_branches,
      next_step_if_true,
      next_step_if_false,
      step_order
    } = req.body;

    // DEBUG: Log what we received for step creation
    if (step_type === 'wait') {
      console.log('[WAIT DEBUG] Creating new wait step');
      console.log('[WAIT DEBUG] Raw req.body:', JSON.stringify(req.body));
      console.log('[WAIT DEBUG] Received wait fields - days:', wait_days, 'hours:', wait_hours, 'minutes:', wait_minutes);
      console.log('[WAIT DEBUG] Will store - days:', wait_days || 0, 'hours:', wait_hours || 0, 'minutes:', wait_minutes || 0);
    }

    // Validate step type
    if (!['email', 'wait', 'condition'].includes(step_type)) {
      return res.status(400).json({ error: 'Invalid step type' });
    }

    const { data, error } = await supabase
      .from('campaign_steps')
      .insert({
        campaign_id: req.params.id,
        step_type,
        subject: step_type === 'email' ? subject : null,
        body: step_type === 'email' ? body : null,
        // Wait step fields
        wait_days: step_type === 'wait' ? (wait_days || 0) : null,
        wait_hours: step_type === 'wait' ? (wait_hours || 0) : null,
        wait_minutes: step_type === 'wait' ? (wait_minutes || 0) : null,
        // Condition step fields
        condition_type: step_type === 'condition' ? condition_type : null,
        condition_branches: step_type === 'condition' ? (condition_branches || null) : null,
        next_step_if_true: step_type === 'condition' ? next_step_if_true : null,
        next_step_if_false: step_type === 'condition' ? next_step_if_false : null,
        step_order: step_order || 1
      })
      .select()
      .single();

    if (error) throw error;

    if (step_type === 'wait') {
      console.log('[WAIT DEBUG] Created step in DB:', JSON.stringify({ id: data.id, wait_days: data.wait_days, wait_hours: data.wait_hours, wait_minutes: data.wait_minutes }));
    }

    res.json(data);
  } catch (error) {
    console.error('Error adding campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update campaign step
router.put('/:campaignId/steps/:stepId', authenticateUser, async (req, res) => {
  try {
    // 1. Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const {
      subject, body, wait_days, wait_hours, wait_minutes,
      condition_type, condition_branches, step_order
    } = req.body;

    // DEBUG: Log what we received from the frontend
    console.log('[WAIT DEBUG] Backend received update for step', req.params.stepId);
    console.log('[WAIT DEBUG] Raw req.body:', JSON.stringify(req.body));
    console.log('[WAIT DEBUG] Extracted wait fields - days:', wait_days, 'hours:', wait_hours, 'minutes:', wait_minutes);

    const updates = {};
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (wait_days !== undefined) updates.wait_days = wait_days;
    if (wait_hours !== undefined) updates.wait_hours = wait_hours;
    if (wait_minutes !== undefined) updates.wait_minutes = wait_minutes;
    if (condition_type !== undefined) updates.condition_type = condition_type;
    if (condition_branches !== undefined) updates.condition_branches = condition_branches;
    if (step_order !== undefined) updates.step_order = step_order;

    console.log('[WAIT DEBUG] Updates object to save:', JSON.stringify(updates));

    if (Object.keys(updates).length === 0) {
      return res.json({ message: 'No updates provided' });
    }

    // 2. Perform Update without .single() to avoid coercion errors
    const { error: updateError } = await supabase
      .from('campaign_steps')
      .update(updates)
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId);

    if (updateError) throw updateError;

    // 3. Fetch the updated record explicitly for the response
    const { data: updatedStep, error: fetchError } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('id', req.params.stepId)
      .single();

    if (fetchError) throw fetchError;

    console.log('[WAIT DEBUG] After save, DB has:', JSON.stringify({ wait_days: updatedStep.wait_days, wait_hours: updatedStep.wait_hours, wait_minutes: updatedStep.wait_minutes }));

    res.json(updatedStep);
  } catch (error) {
    console.error('Error updating campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete campaign step
router.delete('/:campaignId/steps/:stepId', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { error } = await supabase
      .from('campaign_steps')
      .delete()
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start campaign
router.post('/:id/start', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, contact_list_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get first step
    const { data: firstStep } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', req.params.id)
      .eq('step_order', 1)
      .single();

    if (!firstStep) {
      return res.status(400).json({ error: 'Campaign has no steps' });
    }

    // Get all contacts from list
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('list_id', campaign.contact_list_id)
      .eq('status', 'active');

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ error: 'No active contacts in list' });
    }

    // Delete existing campaign_contacts entries to allow restart
    // This ensures the campaign starts fresh when restarted
    const { error: deleteError } = await supabase
      .from('campaign_contacts')
      .delete()
      .eq('campaign_id', req.params.id);

    if (deleteError) {
      console.error('Error deleting existing campaign_contacts:', deleteError);
      throw deleteError;
    }

    // Create campaign_contacts entries
    const campaignContacts = contacts.map(contact => ({
      campaign_id: req.params.id,
      contact_id: contact.id,
      current_step_id: firstStep.id,
      status: 'in_progress',
      next_send_time: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('campaign_contacts')
      .insert(campaignContacts);

    if (insertError) throw insertError;

    // Update campaign status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ 
        status: 'running', 
        started_at: new Date().toISOString() 
      })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      message: `Campaign started with ${contacts.length} contacts` 
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause campaign
router.post('/:id/pause', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign stats
router.get('/:id/stats', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, contact_list_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get total contacts
    const { count: totalContacts } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', req.params.id);

    // Get event counts
    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('campaign_id', req.params.id);

    const sentCount = events?.filter(e => e.event_type === 'sent').length || 0;
    const openedCount = events?.filter(e => e.event_type === 'opened').length || 0;
    const clickedCount = events?.filter(e => e.event_type === 'clicked').length || 0;
    const repliedCount = events?.filter(e => e.event_type === 'replied').length || 0;

    const stats = {
      total_contacts: totalContacts || 0,
      sent_count: sentCount,
      opened_count: openedCount,
      clicked_count: clickedCount,
      replied_count: repliedCount,
      open_rate: sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(1) : 0,
      click_rate: sentCount > 0 ? ((clickedCount / sentCount) * 100).toFixed(1) : 0,
      reply_rate: sentCount > 0 ? ((repliedCount / sentCount) * 100).toFixed(1) : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
