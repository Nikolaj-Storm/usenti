// backend/server.js - Mr. Snowman Complete Backend
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Encryption utilities
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Auth Middleware
async function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============================================================================
// AUTH ROUTES
// ============================================================================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    res.json({ success: true, user: data.user, session: data.session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({ success: true, session: data.session, user: data.user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    await supabase.auth.signOut(token);
  }
  res.json({ success: true });
});

// ============================================================================
// EMAIL ACCOUNTS ROUTES
// ============================================================================

app.get('/api/email-accounts', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_accounts')
      .select('id, email_address, account_type, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email-accounts', authenticateUser, async (req, res) => {
  try {
    const { email_address, account_type, imap_host, imap_port, imap_username, imap_password,
            smtp_host, smtp_port, smtp_username, smtp_password, daily_send_limit } = req.body;
    
    const { data, error } = await supabase
      .from('email_accounts')
      .insert({
        user_id: req.user.id,
        email_address,
        account_type,
        imap_host,
        imap_port,
        imap_username,
        imap_password: encrypt(imap_password),
        smtp_host,
        smtp_port,
        smtp_username: smtp_username || email_address,
        smtp_password: encrypt(smtp_password),
        daily_send_limit: daily_send_limit || 10000,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Remove passwords from response
    delete data.imap_password;
    delete data.smtp_password;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email-accounts/:id/test', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    
    if (!account) return res.status(404).json({ error: 'Account not found' });
    
    // Test IMAP connection
    const imap = new Imap({
      user: account.imap_username,
      password: decrypt(account.imap_password),
      host: account.imap_host,
      port: account.imap_port,
      tls: true
    });
    
    return new Promise((resolve) => {
      imap.once('ready', () => {
        imap.end();
        resolve(res.json({ success: true, message: 'Connection successful' }));
      });
      imap.once('error', (err) => {
        resolve(res.status(400).json({ error: 'Connection failed: ' + err.message }));
      });
      imap.connect();
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CONTACT LISTS ROUTES
// ============================================================================

app.get('/api/contact-lists', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contact_lists')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contact-lists', authenticateUser, async (req, res) => {
  try {
    const { name, description } = req.body;
    const { data, error } = await supabase
      .from('contact_lists')
      .insert({ user_id: req.user.id, name, description, total_contacts: 0 })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contact-lists/:id/import', authenticateUser, async (req, res) => {
  try {
    const { contacts } = req.body; // Array of {email, first_name, last_name, company}
    
    const contactsToInsert = contacts.map(c => ({
      list_id: req.params.id,
      email: c.email,
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      company: c.company || '',
      custom_fields: c.custom_fields || {},
      status: 'active'
    }));
    
    const { data, error } = await supabase
      .from('contacts')
      .insert(contactsToInsert)
      .select();
    
    if (error) throw error;
    res.json({ success: true, imported: data.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CAMPAIGNS ROUTES
// ============================================================================

app.get('/api/campaigns', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(email_address),
        contact_lists(name, total_contacts)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', authenticateUser, async (req, res) => {
  try {
    const { name, email_account_id, contact_list_id, send_schedule, daily_limit } = req.body;
    
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: req.user.id,
        name,
        email_account_id,
        contact_list_id,
        status: 'draft',
        send_schedule,
        daily_limit: daily_limit || 500
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/campaigns/:id/steps', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('step_order');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/steps', authenticateUser, async (req, res) => {
  try {
    const { step_type, subject, body, wait_days, condition_type, step_order } = req.body;
    
    const { data, error } = await supabase
      .from('campaign_steps')
      .insert({
        campaign_id: req.params.id,
        step_type,
        subject,
        body,
        wait_days,
        condition_type,
        step_order
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/start', authenticateUser, async (req, res) => {
  try {
    // Update campaign status
    const { error: campaignError } = await supabase
      .from('campaigns')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (campaignError) throw campaignError;
    
    // Get campaign details
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*, contact_lists(id)')
      .eq('id', req.params.id)
      .single();
    
    // Get all contacts from list
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('list_id', campaign.contact_list_id)
      .eq('status', 'active');
    
    // Get first step
    const { data: firstStep } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', req.params.id)
      .eq('step_order', 1)
      .single();
    
    // Create campaign_contacts entries
    const campaignContacts = contacts.map(contact => ({
      campaign_id: req.params.id,
      contact_id: contact.id,
      current_step_id: firstStep.id,
      status: 'in_progress',
      next_send_time: new Date().toISOString()
    }));
    
    await supabase.from('campaign_contacts').insert(campaignContacts);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/pause', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/campaigns/:id/stats', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaign_stats')
      .select('*')
      .eq('campaign_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    
    if (error) throw error;
    res.json(data || {
      total_contacts: 0,
      sent_count: 0,
      opened_count: 0,
      clicked_count: 0,
      replied_count: 0,
      open_rate: 0,
      reply_rate: 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// WARM-UP ROUTES
// ============================================================================

app.get('/api/warmup/:email_account_id', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('warmup_configs')
      .select('*')
      .eq('email_account_id', req.params.email_account_id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || { is_active: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/warmup/:email_account_id', authenticateUser, async (req, res) => {
  try {
    const { is_active, daily_warmup_volume, replies_per_thread } = req.body;
    
    const { data, error } = await supabase
      .from('warmup_configs')
      .upsert({
        email_account_id: req.params.email_account_id,
        is_active,
        daily_warmup_volume: daily_warmup_volume || 1000,
        current_daily_volume: 50,
        rampup_increment: 50,
        replies_per_thread: replies_per_thread || 20
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TRACKING ROUTES
// ============================================================================

app.get('/api/track/open/:campaign_id/:contact_id/:token', async (req, res) => {
  try {
    await supabase.from('email_events').insert({
      campaign_id: req.params.campaign_id,
      contact_id: req.params.contact_id,
      event_type: 'opened',
      event_data: { user_agent: req.headers['user-agent'], ip: req.ip }
    });
    
    // Return 1x1 transparent pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.type('image/gif').send(pixel);
  } catch (error) {
    res.status(500).end();
  }
});

app.get('/api/track/click/:campaign_id/:contact_id/:token', async (req, res) => {
  try {
    const { url } = req.query;
    
    await supabase.from('email_events').insert({
      campaign_id: req.params.campaign_id,
      contact_id: req.params.contact_id,
      event_type: 'clicked',
      event_data: { url: decodeURIComponent(url) }
    });
    
    res.redirect(decodeURIComponent(url));
  } catch (error) {
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// ============================================================================
// CAMPAIGN EXECUTION ENGINE (Cron Job)
// ============================================================================

async function executePendingCampaigns() {
  console.log('[EXEC] Checking pending emails...');
  
  try {
    const { data: pending } = await supabase
      .from('campaign_contacts')
      .select(`
        *,
        campaigns!inner(*),
        contacts(*),
        campaign_steps(*)
      `)
      .eq('status', 'in_progress')
      .lte('next_send_time', new Date().toISOString())
      .limit(50);
    
    if (!pending || pending.length === 0) return;
    
    console.log(`[EXEC] Found ${pending.length} emails to send`);
    
    for (const item of pending) {
      try {
        await processCampaignContact(item);
      } catch (err) {
        console.error(`[EXEC] Error processing ${item.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[EXEC] Error:', error.message);
  }
}

async function processCampaignContact(campaignContact) {
  const { campaigns: campaign, contacts: contact, campaign_steps: step } = campaignContact;
  
  // Get email account
  const { data: emailAccount } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', campaign.email_account_id)
    .single();
  
  if (!emailAccount) return;
  
  // Check send schedule
  const now = new Date();
  const schedule = campaign.send_schedule || {};
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  
  if (schedule.days && !schedule.days.includes(dayOfWeek)) {
    // Reschedule for next day
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(9, 0, 0, 0);
    
    await supabase
      .from('campaign_contacts')
      .update({ next_send_time: nextDay.toISOString() })
      .eq('id', campaignContact.id);
    return;
  }
  
  if (step.step_type === 'email') {
    await sendEmail(campaignContact, campaign, contact, step, emailAccount);
  } else if (step.step_type === 'wait') {
    await handleWaitStep(campaignContact, step);
  } else if (step.step_type === 'condition') {
    await handleConditionStep(campaignContact, step);
  }
}

async function sendEmail(campaignContact, campaign, contact, step, emailAccount) {
  try {
    // Create SMTP transporter
    const transporter = nodemailer.createTransporter({
      host: emailAccount.smtp_host,
      port: emailAccount.smtp_port,
      secure: false,
      auth: {
        user: emailAccount.smtp_username,
        pass: decrypt(emailAccount.smtp_password)
      }
    });
    
    // Personalize content
    const personalizedSubject = step.subject
      .replace(/{{first_name}}/g, contact.first_name || '')
      .replace(/{{last_name}}/g, contact.last_name || '')
      .replace(/{{company}}/g, contact.company || '');
    
    let personalizedBody = step.body
      .replace(/{{first_name}}/g, contact.first_name || '')
      .replace(/{{last_name}}/g, contact.last_name || '')
      .replace(/{{company}}/g, contact.company || '')
      .replace(/{{email}}/g, contact.email || '');
    
    // Add tracking pixel
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const trackingPixel = `<img src="${process.env.FRONTEND_URL}/api/track/open/${campaign.id}/${contact.id}/${trackingToken}" width="1" height="1" style="display:none;" />`;
    personalizedBody += trackingPixel;
    
    // Send email
    await transporter.sendMail({
      from: emailAccount.email_address,
      to: contact.email,
      subject: personalizedSubject,
      html: personalizedBody
    });
    
    // Log sent event
    await supabase.from('email_events').insert({
      campaign_id: campaign.id,
      contact_id: contact.id,
      campaign_step_id: step.id,
      event_type: 'sent'
    });
    
    // Move to next step
    await moveToNextStep(campaignContact, step);
    
    console.log(`[EMAIL] Sent to ${contact.email}`);
  } catch (error) {
    console.error(`[EMAIL] Error sending to ${contact.email}:`, error.message);
  }
}

async function handleWaitStep(campaignContact, step) {
  const nextSendTime = new Date();
  nextSendTime.setDate(nextSendTime.getDate() + (step.wait_days || 3));
  
  const { data: nextStep } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignContact.campaign_id)
    .eq('step_order', step.step_order + 1)
    .single();
  
  if (nextStep) {
    await supabase
      .from('campaign_contacts')
      .update({
        current_step_id: nextStep.id,
        next_send_time: nextSendTime.toISOString()
      })
      .eq('id', campaignContact.id);
  } else {
    await supabase
      .from('campaign_contacts')
      .update({ status: 'completed' })
      .eq('id', campaignContact.id);
  }
}

async function handleConditionStep(campaignContact, step) {
  const { data: events } = await supabase
    .from('email_events')
    .select('*')
    .eq('campaign_id', campaignContact.campaign_id)
    .eq('contact_id', campaignContact.contact_id);
  
  let conditionMet = false;
  
  if (step.condition_type === 'if_opened') {
    conditionMet = events.some(e => e.event_type === 'opened');
  } else if (step.condition_type === 'if_not_opened') {
    conditionMet = !events.some(e => e.event_type === 'opened');
  } else if (step.condition_type === 'if_clicked') {
    conditionMet = events.some(e => e.event_type === 'clicked');
  } else if (step.condition_type === 'if_replied') {
    conditionMet = events.some(e => e.event_type === 'replied');
  }
  
  const nextStepId = conditionMet ? step.next_step_if_true : step.next_step_if_false;
  
  if (nextStepId) {
    await supabase
      .from('campaign_contacts')
      .update({
        current_step_id: nextStepId,
        next_send_time: new Date().toISOString()
      })
      .eq('id', campaignContact.id);
  } else {
    await supabase
      .from('campaign_contacts')
      .update({ status: 'completed' })
      .eq('id', campaignContact.id);
  }
}

async function moveToNextStep(campaignContact, currentStep) {
  const { data: nextStep } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignContact.campaign_id)
    .eq('step_order', currentStep.step_order + 1)
    .single();
  
  if (nextStep) {
    await supabase
      .from('campaign_contacts')
      .update({
        current_step_id: nextStep.id,
        next_send_time: new Date().toISOString()
      })
      .eq('id', campaignContact.id);
  } else {
    await supabase
      .from('campaign_contacts')
      .update({ status: 'completed' })
      .eq('id', campaignContact.id);
  }
}

// ============================================================================
// WARM-UP ENGINE (Simplified - Full version in separate file)
// ============================================================================

async function sendWarmupEmails() {
  console.log('[WARMUP] Running warm-up cycle...');
  
  try {
    const { data: configs } = await supabase
      .from('warmup_configs')
      .select('*, email_accounts(*)')
      .eq('is_active', true);
    
    for (const config of configs || []) {
      // Get random seeds
      const hourlyVolume = Math.floor(config.current_daily_volume / 24);
      
      const { data: seeds } = await supabase
        .from('warmup_seeds')
        .select('*')
        .eq('is_active', true)
        .limit(hourlyVolume);
      
      for (const seed of seeds || []) {
        await sendWarmupEmail(config, seed);
      }
    }
  } catch (error) {
    console.error('[WARMUP] Error:', error.message);
  }
}

async function sendWarmupEmail(config, seed) {
  try {
    const transporter = nodemailer.createTransporter({
      host: config.email_accounts.smtp_host,
      port: config.email_accounts.smtp_port,
      secure: false,
      auth: {
        user: config.email_accounts.smtp_username,
        pass: decrypt(config.email_accounts.smtp_password)
      }
    });
    
    // Generate human-like content
    const subjects = [
      'Quick question',
      'Following up',
      'Thoughts on the project',
      'Checking in',
      'Update'
    ];
    
    const bodies = [
      'Hi there,\n\nI hope this finds you well. Just wanted to reach out about something interesting.\n\nBest regards',
      'Hey,\n\nFollowing up on our previous discussion. Let me know if you have time to chat.\n\nThanks',
      'Hello,\n\nI came across something that reminded me of our conversation.\n\nCheers'
    ];
    
    await transporter.sendMail({
      from: config.email_accounts.email_address,
      to: seed.email_address,
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      text: bodies[Math.floor(Math.random() * bodies.length)]
    });
    
    // Create/update thread
    await supabase.from('warmup_threads').insert({
      email_account_id: config.email_account_id,
      seed_address_id: seed.id,
      reply_count: 0,
      target_replies: config.replies_per_thread,
      status: 'active'
    });
    
    console.log(`[WARMUP] Sent to ${seed.email_address}`);
  } catch (error) {
    console.error('[WARMUP] Error:', error.message);
  }
}

// ============================================================================
// SCHEDULED JOBS
// ============================================================================

// Run campaign execution every 5 minutes
cron.schedule('*/5 * * * *', executePendingCampaigns);

// Send warm-up emails every hour
cron.schedule('0 * * * *', sendWarmupEmails);

console.log('✓ Scheduled jobs initialized');

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n🚀 Mr. Snowman API running on http://localhost:${PORT}`);
  console.log(`📧 Campaign execution: Every 5 minutes`);
  console.log(`🔥 Warm-up engine: Every hour\n`);
});
