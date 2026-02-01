const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const Imap = require('node-imap');
const nodemailer = require('nodemailer');

// Get all email accounts for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_accounts')
      .select('id, email_address, account_type, sender_name, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at, smtp_host, smtp_port, smtp_username, imap_host, imap_port, imap_username')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new email account
router.post('/', authenticateUser, async (req, res) => {
  try {
    const {
      email_address,
      account_type,
      sender_name, // Display name for From header
      imap_host,
      imap_port,
      imap_username,
      imap_password,
      smtp_host,
      smtp_port,
      smtp_username,
      smtp_password,
      daily_send_limit
    } = req.body;

    // Validate required fields
    if (!email_address || !account_type) {
      return res.status(400).json({ error: 'Email address and account type are required' });
    }

    // Check if account already exists
    const { data: existing } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('email_address', email_address.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email account already exists' });
    }

    // Insert new account
    const { data, error } = await supabase
      .from('email_accounts')
      .insert({
        user_id: req.user.id,
        email_address: email_address.toLowerCase(),
        account_type,
        sender_name: sender_name || null, // Display name for better deliverability
        imap_host,
        imap_port: imap_port || 993,
        imap_username: imap_username || email_address,
        imap_password: encrypt(imap_password),
        smtp_host,
        smtp_port: smtp_port || 587,
        smtp_username: smtp_username || email_address,
        smtp_password: encrypt(smtp_password),
        daily_send_limit: daily_send_limit || 10000,
        is_active: true,
        health_score: 100
      })
      .select('id, email_address, account_type, sender_name, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at')
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error adding email account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test IMAP connection
router.post('/:id/test-imap', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Test IMAP connection
    const imap = new Imap({
      user: account.imap_username,
      password: decrypt(account.imap_password),
      host: account.imap_host,
      port: account.imap_port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    return new Promise((resolve) => {
      let timeout = setTimeout(() => {
        imap.end();
        resolve(res.status(400).json({ 
          success: false, 
          error: 'Connection timeout - please check your credentials and server settings' 
        }));
      }, 10000);

      imap.once('ready', () => {
        clearTimeout(timeout);
        imap.end();
        resolve(res.json({ 
          success: true, 
          message: 'IMAP connection successful' 
        }));
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        console.error('IMAP error:', err);
        resolve(res.status(400).json({ 
          success: false, 
          error: `IMAP connection failed: ${err.message}` 
        }));
      });

      imap.connect();
    });
  } catch (error) {
    console.error('Error testing IMAP:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test SMTP connection
router.post('/:id/test-smtp', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Test SMTP connection
    const transporter = nodemailer.createTransporter({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_port === 465,
      auth: {
        user: account.smtp_username,
        pass: decrypt(account.smtp_password)
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'SMTP connection successful' 
    });
  } catch (error) {
    console.error('Error testing SMTP:', error);
    res.status(400).json({ 
      success: false, 
      error: `SMTP connection failed: ${error.message}` 
    });
  }
});

// Update email account - supports all account fields
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const {
      email_address,
      sender_name,
      daily_send_limit,
      is_active,
      imap_password,
      smtp_password,
      account_type,
      imap_host,
      imap_port,
      imap_username,
      smtp_host,
      smtp_port,
      smtp_username
    } = req.body;

    const updates = {};
    if (email_address) updates.email_address = email_address.toLowerCase();
    if (sender_name !== undefined) updates.sender_name = sender_name || null;
    if (daily_send_limit !== undefined) updates.daily_send_limit = daily_send_limit;
    if (is_active !== undefined) updates.is_active = is_active;
    if (imap_password) updates.imap_password = encrypt(imap_password);
    if (smtp_password) updates.smtp_password = encrypt(smtp_password);

    // Expanded fields
    if (account_type) updates.account_type = account_type;
    if (imap_host) updates.imap_host = imap_host;
    if (imap_port) updates.imap_port = imap_port;
    if (imap_username) updates.imap_username = imap_username;
    if (smtp_host) updates.smtp_host = smtp_host;
    if (smtp_port) updates.smtp_port = smtp_port;
    if (smtp_username) updates.smtp_username = smtp_username;

    const { data, error } = await supabase
      .from('email_accounts')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, email_address, account_type, sender_name, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at, smtp_host, smtp_port, smtp_username, imap_host, imap_port, imap_username')
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating email account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete email account
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
