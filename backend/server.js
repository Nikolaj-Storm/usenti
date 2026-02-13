const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config();

// Configure multer for file uploads (memory storage for email attachments)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5 // Max 5 files per upload
  }
});

// Import services
const imapMonitor = require('./services/imapMonitor');
const campaignExecutor = require('./services/campaignExecutor');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Updated CORS to support GitHub Pages
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
  'https://nikolaj-storm.github.io',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================================================
// AUTH ROUTES
// ============================================================================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0]
        }
      }
    });

    if (error) throw error;
    res.json({ success: true, user: data.user, session: data.session });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({ success: true, session: data.session, user: data.user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await supabase.auth.signOut(token);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ success: true }); // Return success anyway
  }
});

app.get('/api/auth/me', authenticateUser, async (req, res) => {
  res.json({ user: req.user });
});

// ============================================================================
// OAUTH ROUTES
// ============================================================================

const oauthRoutes = require('./routes/oauth');
app.use('/api/oauth', oauthRoutes);

// ============================================================================
// EMAIL ACCOUNTS ROUTES
// ============================================================================

app.get('/api/email-accounts', authenticateUser, async (req, res) => {
  try {
    // Get base email account data
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('id, email_address, account_type, sender_name, daily_send_limit, is_active, health_score, created_at, smtp_host, smtp_port, smtp_username, imap_host, imap_port, imap_username')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get aggregated sent_today from campaign_email_accounts junction table
    // This sums all emails_sent_today across all campaigns for each email account
    const accountIds = accounts.map(a => a.id);

    if (accountIds.length > 0) {
      const { data: sentData, error: sentError } = await supabase
        .from('campaign_email_accounts')
        .select('email_account_id, emails_sent_today')
        .in('email_account_id', accountIds);

      if (!sentError && sentData) {
        // Aggregate sent_today per email account
        const sentTodayByAccount = {};
        sentData.forEach(row => {
          if (!sentTodayByAccount[row.email_account_id]) {
            sentTodayByAccount[row.email_account_id] = 0;
          }
          sentTodayByAccount[row.email_account_id] += (row.emails_sent_today || 0);
        });

        // Add sent_today to each account
        accounts.forEach(account => {
          account.sent_today = sentTodayByAccount[account.id] || 0;
        });
      }
    }

    res.json(accounts);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email-accounts', authenticateUser, async (req, res) => {
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const {
      email_address, account_type, sender_name, imap_host, imap_port, imap_username, imap_password,
      smtp_host, smtp_port, smtp_username, smtp_password, daily_send_limit
    } = req.body;

    // Validation
    if (!email_address || !account_type) {
      return res.status(400).json({
        error: 'Email address and account type are required',
        requestId
      });
    }

    // Validate account_type is one of the allowed values
    const allowedTypes = ['gmail', 'outlook', 'zoho', 'aws_workmail', 'stalwart', 'custom'];
    if (!allowedTypes.includes(account_type)) {
      return res.status(400).json({
        error: `Invalid account_type. Must be one of: ${allowedTypes.join(', ')}`,
        received: account_type,
        requestId
      });
    }

    // Check for existing account
    const { data: existing, error: checkError } = await supabase
      .from('email_accounts')
      .select('id, email_address, created_at')
      .eq('user_id', req.user.id)
      .eq('email_address', email_address.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({
        error: 'Email account already exists',
        existingId: existing.id,
        requestId
      });
    }

    let encryptedImapPassword, encryptedSmtpPassword;

    try {
      encryptedImapPassword = encrypt(imap_password);
    } catch (encErr) {
      throw new Error(`IMAP password encryption failed: ${encErr.message}`);
    }

    try {
      encryptedSmtpPassword = encrypt(smtp_password);
    } catch (encErr) {
      throw new Error(`SMTP password encryption failed: ${encErr.message}`);
    }

    // Verify SMTP credentials before saving (for stalwart and custom accounts)
    if (account_type === 'stalwart' || account_type === 'custom') {
      const verifyPort = parseInt(smtp_port, 10) || 587;
      const verifySecure = verifyPort === 465;
      const isStalwart = account_type === 'stalwart';

      const verifyConfig = {
        host: smtp_host,
        port: verifyPort,
        secure: verifySecure,
        auth: {
          user: smtp_username || email_address,
          pass: smtp_password
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000
      };

      if (isStalwart && !verifySecure) {
        verifyConfig.requireTLS = true;
        verifyConfig.authMethod = 'PLAIN';
      }

      try {
        const testTransporter = nodemailer.createTransport(verifyConfig);
        await testTransporter.verify();
      } catch (smtpError) {
        let userMessage = `SMTP connection failed: ${smtpError.message}`;
        return res.status(400).json({
          error: userMessage,
          errorType: 'smtp_verification_failed',
          requestId
        });
      }
    }

    const insertData = {
      user_id: req.user.id,
      email_address: email_address.toLowerCase(),
      account_type,
      sender_name: sender_name || null,
      imap_host,
      imap_port: imap_port || 993,
      imap_username: imap_username || email_address,
      imap_password: encryptedImapPassword,
      smtp_host,
      smtp_port: smtp_port || 587,
      smtp_username: smtp_username || email_address,
      smtp_password: encryptedSmtpPassword,
      daily_send_limit: daily_send_limit || 10000,
      is_active: true,
      health_score: 100
    };

    const { data, error } = await supabase
      .from('email_accounts')
      .insert(insertData)
      .select('id, email_address, account_type, sender_name, daily_send_limit, is_active, health_score, created_at, smtp_host, smtp_port, smtp_username, imap_host, imap_port, imap_username')
      .single();

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Test email account credentials (before creating)
app.post('/api/email-accounts/test', async (req, res) => {
  try {
    const {
      smtp_host, smtp_port, smtp_username, smtp_password,
      imap_host, imap_port, imap_username, imap_password,
      account_type
    } = req.body;

    const results = {
      smtp: null,
      imap: null
    };

    // Test SMTP
    if (smtp_host && smtp_username && smtp_password) {
      try {
        const smtpPort = parseInt(smtp_port, 10) || 587;
        const isSecure = smtpPort === 465;
        const isStalwart = account_type === 'stalwart';

        const smtpConfig = {
          host: smtp_host,
          port: smtpPort,
          secure: isSecure,
          auth: {
            user: smtp_username,
            pass: smtp_password
          },
          tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
          connectionTimeout: 15000,
          greetingTimeout: 15000
        };

        if (isStalwart && !isSecure) {
          smtpConfig.requireTLS = true;
          smtpConfig.authMethod = 'PLAIN';
        }

        const transporter = nodemailer.createTransport(smtpConfig);

        await transporter.verify();
        results.smtp = { success: true, message: 'SMTP connection successful' };
      } catch (error) {
        results.smtp = { success: false, message: `SMTP failed: ${error.message}` };
      }
    }

    // Test IMAP
    if (imap_host && imap_username && imap_password) {
      try {
        const imap = new Imap({
          user: imap_username,
          password: imap_password,
          host: imap_host,
          port: imap_port || 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false }
        });

        results.imap = await new Promise((resolve) => {
          let timeout = setTimeout(() => {
            imap.end();
            resolve({ success: false, message: 'IMAP connection timeout' });
          }, 10000);

          imap.once('ready', () => {
            clearTimeout(timeout);
            imap.end();
            resolve({ success: true, message: 'IMAP connection successful' });
          });

          imap.once('error', (err) => {
            clearTimeout(timeout);
            resolve({ success: false, message: `IMAP failed: ${err.message}` });
          });

          imap.connect();
        });
      } catch (error) {
        results.imap = { success: false, message: `IMAP failed: ${error.message}` };
      }
    }

    const allSuccess = (!results.smtp || results.smtp.success) && (!results.imap || results.imap.success);

    res.json({
      success: allSuccess,
      message: allSuccess ? 'All connections successful!' : 'Some connections failed',
      results
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/email-accounts/:id/test-imap', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Ensure port is a number
    const imapPort = parseInt(account.imap_port, 10) || 993;

    let decryptedPassword;
    try {
      decryptedPassword = decrypt(account.imap_password);
    } catch (decryptError) {
      return res.status(400).json({
        success: false,
        error: `Password decryption failed: ${decryptError.message}`
      });
    }

    const imap = new Imap({
      user: account.imap_username,
      password: decryptedPassword,
      host: account.imap_host,
      port: imapPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    return new Promise((resolve) => {
      let timeout = setTimeout(() => {
        imap.end();
        resolve(res.status(400).json({
          success: false,
          error: 'Connection timeout'
        }));
      }, 10000);

      imap.once('ready', () => {
        clearTimeout(timeout);
        imap.end();
        resolve(res.json({ success: true, message: 'IMAP connection successful' }));
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        resolve(res.status(400).json({
          success: false,
          error: `IMAP failed: ${err.message}`
        }));
      });

      imap.connect();
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Zoho SMTP hosts for different data centers
const ZOHO_SMTP_HOSTS = [
  'smtp.zoho.com',      // US
  'smtp.zoho.eu',       // EU
  'smtp.zoho.in',       // India
  'smtp.zoho.com.au',   // Australia
  'smtp.zoho.com.cn'    // China
];

app.post('/api/email-accounts/:id/test-smtp', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Ensure port is a number
    const smtpPort = parseInt(account.smtp_port, 10) || 587;
    const isSecure = smtpPort === 465;

    let decryptedPassword;
    try {
      decryptedPassword = decrypt(account.smtp_password);
    } catch (decryptError) {
      return res.status(400).json({
        success: false,
        error: `Password decryption failed: ${decryptError.message}`
      });
    }

    // Determine account-type-specific handling
    const isZoho = account.smtp_host?.toLowerCase().includes('zoho') || account.account_type === 'zoho';
    const isStalwart = account.account_type === 'stalwart';

    // Helper to create transporter config
    const createConfig = (host) => {
      const config = {
        host,
        port: smtpPort,
        secure: isSecure,
        auth: {
          user: account.smtp_username,
          pass: decryptedPassword
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000
      };

      // Zoho requires LOGIN auth method
      if (isZoho) {
        config.authMethod = 'LOGIN';
      }

      // Stalwart prefers PLAIN auth and requires STARTTLS on non-SSL ports
      if (isStalwart && !isSecure) {
        config.requireTLS = true;
        config.authMethod = 'PLAIN';
      }

      return config;
    };

    // For Zoho accounts, try multiple data centers
    if (isZoho) {
      // Build list of hosts to try
      const hostsToTry = [account.smtp_host];
      for (const host of ZOHO_SMTP_HOSTS) {
        if (!hostsToTry.includes(host)) {
          hostsToTry.push(host);
        }
      }

      let lastError;
      for (const host of hostsToTry) {
        try {
          const transporter = nodemailer.createTransport(createConfig(host));
          await transporter.verify();

          // Update account if we found a working host different from configured
          if (host !== account.smtp_host) {
            await supabase
              .from('email_accounts')
              .update({ smtp_host: host })
              .eq('id', req.params.id);
          }

          return res.json({
            success: true,
            message: `SMTP connection successful (${host})`,
            host
          });
        } catch (err) {
          lastError = err;
        }
      }

      // All hosts failed
      return res.status(400).json({
        success: false,
        error: `SMTP failed on all Zoho data centers: ${lastError?.message}`,
        errorCode: lastError?.code,
        triedHosts: hostsToTry
      });
    }

    // Non-Zoho: standard single host test
    const transporter = nodemailer.createTransport(createConfig(account.smtp_host));

    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (error) {
    let errorDetail = `SMTP failed: ${error.message}`;
    if (error.message.includes('Authentication credentials invalid') || error.message.includes('Invalid login')) {
      errorDetail = `Authentication failed - the mail server rejected the credentials. Verify the password matches your mail server account and the username format is correct.`;
    } else if (error.message.includes('ECONNREFUSED')) {
      errorDetail = `Cannot connect to ${account.smtp_host}:${smtpPort}. Check that the hostname is correct and the port is open in your firewall.`;
    } else if (error.message.includes('ENOTFOUND')) {
      errorDetail = `DNS lookup failed for ${account.smtp_host}. Make sure the hostname has a DNS record pointing to your server.`;
    }

    res.status(400).json({
      success: false,
      error: errorDetail,
      errorCode: error.code
    });
  }
});

app.put('/api/email-accounts/:id', authenticateUser, async (req, res) => {
  try {
    const { email_address, daily_send_limit, is_active, imap_password, smtp_password } = req.body;

    const updates = {};
    if (email_address) updates.email_address = email_address.toLowerCase();
    if (daily_send_limit !== undefined) updates.daily_send_limit = daily_send_limit;
    if (is_active !== undefined) updates.is_active = is_active;
    if (imap_password) updates.imap_password = encrypt(imap_password);
    if (smtp_password) updates.smtp_password = encrypt(smtp_password);

    const { data, error } = await supabase
      .from('email_accounts')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, email_address, account_type, daily_send_limit, is_active, health_score, created_at')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Account not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/email-accounts/:id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// INBOX ROUTES
// ============================================================================

app.get('/api/inbox', authenticateUser, async (req, res) => {
  const requestId = `INBOX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { account_id, limit = 50, offset = 0 } = req.query;

    // First, get all email accounts that belong to the user
    const { data: userAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', req.user.id);

    if (accountsError) {
      throw accountsError;
    }

    const userAccountIds = userAccounts.map(a => a.id);

    if (userAccountIds.length === 0) {
      return res.json([]);
    }

    // Build the inbox query
    let query = supabase
      .from('inbox_messages')
      .select(`
        *,
        email_accounts!inner(email_address, id)
      `)
      .order('received_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filter by specific account if requested
    if (account_id && account_id !== 'all') {
      // Verify the account belongs to the user
      if (!userAccountIds.includes(account_id)) {
        return res.status(403).json({ error: 'Unauthorized access to this email account' });
      }
      query = query.eq('email_account_id', account_id);
    } else {
      // Show all messages from all user's accounts
      query = query.in('email_account_id', userAccountIds);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error(`[${requestId}] Error in inbox route:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Mark inbox message as read/unread
app.put('/api/inbox/:id/read', authenticateUser, async (req, res) => {
  const requestId = `INBOX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { id } = req.params;
    const { is_read } = req.body;

    // Verify the message belongs to user's email account
    const { data: message, error: fetchError } = await supabase
      .from('inbox_messages')
      .select('email_account_id, email_accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (fetchError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.email_accounts.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update the message
    const { data, error } = await supabase
      .from('inbox_messages')
      .update({ is_read })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error(`[${requestId}] Error in route:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Sync inbox from IMAP server (fetches ALL recent messages, not just unread)
app.post('/api/inbox/sync', authenticateUser, async (req, res) => {
  const requestId = `INBOX-SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { account_id, limit = 50 } = req.body;

    // Get user's email accounts
    let accountsQuery = supabase
      .from('email_accounts')
      .select('id, email_address')
      .eq('user_id', req.user.id)
      .eq('is_active', true);

    if (account_id && account_id !== 'all') {
      accountsQuery = accountsQuery.eq('id', account_id);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return res.json({ synced: 0, message: 'No email accounts to sync' });
    }

    const imapMonitor = require('./services/imapMonitor');
    let totalSynced = 0;
    const results = [];

    for (const account of accounts) {
      try {
        const messages = await imapMonitor.syncInbox(account.id, limit);
        totalSynced += messages.length;
        results.push({
          account_id: account.id,
          email: account.email_address,
          synced: messages.length,
          status: 'success'
        });
      } catch (syncError) {
        console.error(`[${requestId}] Error syncing ${account.email_address}:`, syncError.message);
        results.push({
          account_id: account.id,
          email: account.email_address,
          synced: 0,
          status: 'error',
          error: syncError.message
        });
      }
    }

    res.json({
      synced: totalSynced,
      accounts: results
    });
  } catch (error) {
    console.error(`[${requestId}] Error in sync route:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch email content on-demand from IMAP (without storing in database)
app.get('/api/inbox/:id/content', authenticateUser, async (req, res) => {
  const requestId = `FETCH-CONTENT-${Date.now()}`;

  try {
    const { id } = req.params;

    // Get the inbox message record
    const { data: message, error: msgError } = await supabase
      .from('inbox_messages')
      .select('*, email_accounts!inner(id, user_id)')
      .eq('id', id)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify ownership
    if (message.email_accounts.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // If we already have the body stored, return it
    if (message.body_html || message.body_text) {
      return res.json({
        body_html: message.body_html,
        body_text: message.body_text,
        from_name: message.from_name,
        from_address: message.from_address,
        subject: message.subject,
        received_at: message.received_at
      });
    }

    // Fetch from IMAP if not stored
    const imapMonitor = require('./services/imapMonitor');

    try {
      const content = await imapMonitor.fetchEmailContent(
        message.email_account_id,
        message.message_id
      );

      // Optionally store the fetched content for future use
      await supabase
        .from('inbox_messages')
        .update({
          body_html: content.body_html,
          body_text: content.body_text
        })
        .eq('id', id);

      res.json(content);
    } catch (imapError) {
      console.error(`[${requestId}] IMAP fetch failed:`, imapError.message);
      // Return snippet as fallback
      res.json({
        body_html: null,
        body_text: message.snippet || 'Email content could not be loaded from server.',
        from_name: message.from_name,
        from_address: message.from_address,
        subject: message.subject,
        received_at: message.received_at,
        fetch_error: imapError.message
      });
    }
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Send reply to an inbox message (supports attachments via multipart form data)
app.post('/api/inbox/:id/reply', authenticateUser, upload.any(), async (req, res) => {
  const requestId = `REPLY-${Date.now()}`;

  try {
    const { id } = req.params;
    const body = req.body.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    // Extract attachments from uploaded files
    const attachments = (req.files || []).map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }));

    // Get the original message
    const { data: originalMessage, error: msgError } = await supabase
      .from('inbox_messages')
      .select('*, email_accounts!inner(*)')
      .eq('id', id)
      .single();

    if (msgError || !originalMessage) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    // Verify ownership
    if (originalMessage.email_accounts.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const emailAccount = originalMessage.email_accounts;
    const replySubject = originalMessage.subject.startsWith('Re:')
      ? originalMessage.subject
      : `Re: ${originalMessage.subject}`;

    // Compose reply body with quote
    const quotedOriginal = `\n\n---\nOn ${new Date(originalMessage.received_at).toLocaleString()}, ${originalMessage.from_name || originalMessage.from_address} wrote:\n> ${(originalMessage.snippet || '').split('\n').join('\n> ')}`;
    const fullBody = body + quotedOriginal;

    // Use emailService to send the reply
    const emailService = require('./services/emailService');

    await emailService.sendEmail({
      emailAccountId: emailAccount.id,
      to: originalMessage.from_address,
      subject: replySubject,
      body: fullBody.replace(/\n/g, '<br/>'),
      attachments: attachments,
      campaignId: null,
      contactId: null,
      trackOpens: false,
      trackClicks: false
    });

    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (error) {
    console.error(`[${requestId}] Error sending reply:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old inbox messages (admin/maintenance endpoint)
app.post('/api/inbox/cleanup', authenticateUser, async (req, res) => {
  try {
    const imapMonitor = require('./services/imapMonitor');

    // Get user's email accounts
    const { data: accounts } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', req.user.id);

    if (!accounts || accounts.length === 0) {
      return res.json({ message: 'No accounts to clean up' });
    }

    // Run cleanup for each account
    for (const account of accounts) {
      await imapMonitor.cleanupOldMessages(account.id);
      await imapMonitor.enforceMessageLimit(account.id);
    }

    res.json({ message: 'Cleanup complete' });
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

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    const { data, error } = await supabase
      .from('contact_lists')
      .insert({ user_id: req.user.id, name, description: description || '', total_contacts: 0 })
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
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Contacts array is required' });
    }

    // Verify list belongs to user
    const { data: list } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Get existing contacts in this list to avoid duplicates
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('email')
      .eq('list_id', req.params.id);

    const existingEmails = new Set(existingContacts?.map(c => c.email.toLowerCase()) || []);

    // Filter out duplicates
    const newContacts = contacts.filter(c => !existingEmails.has(c.email.toLowerCase().trim()));

    if (newContacts.length === 0) {
      return res.json({ success: true, imported: 0, duplicates: contacts.length });
    }

    const contactsToInsert = newContacts.map(c => ({
      list_id: req.params.id,
      email: c.email.toLowerCase().trim(),
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

    const imported = data?.length || 0;

    // Update list count
    const { count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', req.params.id);

    await supabase
      .from('contact_lists')
      .update({ total_contacts: count || 0 })
      .eq('id', req.params.id);

    res.json({ success: true, imported, duplicates: contacts.length - newContacts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contacts in a specific list
app.get('/api/contacts/lists/:listId/contacts', authenticateUser, async (req, res) => {
  try {
    const { listId } = req.params;
    const { search, status, limit = 100, offset = 0 } = req.query;

    // Verify list belongs to user
    const { data: list, error: listError } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('user_id', req.user.id)
      .single();

    if (listError || !list) {
      return res.status(404).json({ error: 'List not found' });
    }

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('list_id', listId)
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      contacts: data || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[CONTACTS] Error in route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a contact list
app.delete('/api/contacts/lists/:listId', authenticateUser, async (req, res) => {
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
    console.error('[CONTACTS] Error deleting list:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a contact
app.put('/api/contacts/:contactId', authenticateUser, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { email, first_name, last_name, company, custom_fields, status } = req.body;

    // Verify contact belongs to user's list
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('list_id, contact_lists!inner(user_id)')
      .eq('id', contactId)
      .single();

    if (fetchError || !contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Verify user owns the list
    if (contact.contact_lists.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = {};
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (company !== undefined) updates.company = company;
    if (custom_fields !== undefined) updates.custom_fields = custom_fields;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('[CONTACTS] Error updating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a contact
app.delete('/api/contacts/:contactId', authenticateUser, async (req, res) => {
  try {
    const { contactId } = req.params;

    // Get contact to verify ownership
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('list_id, contact_lists!inner(user_id)')
      .eq('id', contactId)
      .single();

    if (fetchError || !contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Verify user owns the list
    if (contact.contact_lists.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[CONTACTS] Error deleting contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DASHBOARD ROUTES
// ============================================================================

app.get('/api/dashboard/stats', authenticateUser, async (req, res) => {
  try {
    // Get user's campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('user_id', req.user.id);

    if (campaignsError) throw campaignsError;

    const campaignIds = campaigns.map(c => c.id);

    // Get email events for user's campaigns
    let totalSent = 0;
    let totalOpened = 0;
    let totalReplied = 0;
    let activityData = [];

    if (campaignIds.length > 0) {
      // Get total counts
      const { data: events, error: eventsError } = await supabase
        .from('email_events')
        .select('event_type, created_at')
        .in('campaign_id', campaignIds);

      if (!eventsError && events) {
        totalSent = events.filter(e => e.event_type === 'sent').length;
        totalOpened = events.filter(e => e.event_type === 'opened').length;
        totalReplied = events.filter(e => e.event_type === 'replied').length;

        // Get activity data for the last 7 days
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const recentEvents = events.filter(e => new Date(e.created_at) >= last7Days);

        // Group by day
        const dayMap = {};
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dateKey = date.toISOString().split('T')[0];
          dayMap[dateKey] = {
            name: dayName,
            sent: 0,
            opened: 0,
            replied: 0
          };
        }

        recentEvents.forEach(event => {
          const dateKey = event.created_at.split('T')[0];
          if (dayMap[dateKey]) {
            if (event.event_type === 'sent') dayMap[dateKey].sent++;
            if (event.event_type === 'opened') dayMap[dateKey].opened++;
            if (event.event_type === 'replied') dayMap[dateKey].replied++;
          }
        });

        activityData = Object.values(dayMap);
      }
    }

    // Calculate rates
    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
    const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0';

    res.json({
      metrics: [
        {
          label: 'Total Sent',
          value: totalSent.toLocaleString(),
          change: '+0%',
          icon: 'Mail',
          color: 'text-blue-600'
        },
        {
          label: 'Open Rate',
          value: `${openRate}%`,
          change: '+0%',
          icon: 'ArrowUpRight',
          color: 'text-emerald-600'
        },
        {
          label: 'Reply Rate',
          value: `${replyRate}%`,
          change: '+0%',
          icon: 'MessageSquare',
          color: 'text-jaguar-900'
        }
      ],
      activity: activityData
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
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
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/campaigns/:id', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts)
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Campaign not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', authenticateUser, async (req, res) => {
  try {
    const { name, email_account_id, contact_list_id, send_schedule, daily_limit, send_immediately } = req.body;

    if (!name || !email_account_id || !contact_list_id) {
      return res.status(400).json({ error: 'Name, email account, and contact list are required' });
    }

    // Verify email account belongs to user
    const { data: emailAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', email_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!emailAccount) {
      return res.status(400).json({ error: 'Invalid email account' });
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

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: req.user.id,
        name,
        email_account_id,
        contact_list_id,
        status: 'draft',
        send_schedule: send_schedule || {
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start_hour: 9,
          end_hour: 17
        },
        daily_limit: daily_limit || 500,
        send_immediately: send_immediately || false
      })
      .select(`
        *,
        email_accounts(id, email_address),
        contact_lists(id, name, total_contacts)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campaigns/:id', authenticateUser, async (req, res) => {
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
    if (!data) return res.status(404).json({ error: 'Campaign not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campaigns/:id', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/campaigns/:id/steps', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { data, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('step_order');

    if (error) throw error;

    // Map DB column names to frontend field names
    const mappedData = (data || []).map(step => ({
      ...step,
      parent_step_id: step.parent_id || null
    }));
    res.json(mappedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/steps', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const {
      step_type,
      subject,
      body,
      wait_days,
      wait_hours,
      wait_minutes,
      step_order,
      parent_step_id,
      condition_type,
      branch,
      x,
      y
    } = req.body;

    if (!['email', 'wait', 'condition'].includes(step_type)) {
      return res.status(400).json({ error: 'Invalid step type. Only email, wait, and condition are supported.' });
    }

    const { data, error } = await supabase
      .from('campaign_steps')
      .insert({
        campaign_id: req.params.id,
        step_type,
        step_order: step_order || 1,
        subject: step_type === 'email' ? subject : null,
        body: step_type === 'email' ? body : null,
        wait_days: wait_days || 0,
        wait_hours: wait_hours || 0,
        wait_minutes: wait_minutes || 0,
        condition_type: step_type === 'condition' ? (condition_type || 'email_opened') : null,
        parent_id: parent_step_id || null,
        branch: branch || null,
        position_x: x || 0,
        position_y: y || 0
      })
      .select()
      .single();

    if (error) throw error;

    // Map DB fields back to what frontend expects + echo position/branch from request
    res.json({
      ...data,
      parent_step_id: data.parent_id || null,
      branch: req.body.branch || null,
      position_x: req.body.position_x || req.body.x || null,
      position_y: req.body.position_y || req.body.y || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campaigns/:campaignId/steps/:stepId', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { subject, body, wait_days, wait_hours, wait_minutes, step_order, condition_type, position_x, position_y } = req.body;

    const updates = {};
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (wait_days !== undefined) updates.wait_days = wait_days;
    if (wait_hours !== undefined) updates.wait_hours = wait_hours;
    if (wait_minutes !== undefined) updates.wait_minutes = wait_minutes;
    if (step_order !== undefined) updates.step_order = step_order;
    if (condition_type !== undefined) updates.condition_type = condition_type;
    if (position_x !== undefined) updates.position_x = position_x;
    if (position_y !== undefined) updates.position_y = position_y;

    if (Object.keys(updates).length === 0) {
      // No actual updates - just fetch and return the existing step
      const { data: existingSteps } = await supabase
        .from('campaign_steps')
        .select('*')
        .eq('id', req.params.stepId)
        .eq('campaign_id', req.params.campaignId);
      const existing = existingSteps && existingSteps.length > 0 ? existingSteps[0] : null;
      if (!existing) return res.status(404).json({ error: 'Step not found' });
      return res.json({ ...existing, parent_step_id: existing.parent_id || null });
    }

    const { data, error } = await supabase
      .from('campaign_steps')
      .update(updates)
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId)
      .select();

    if (error) throw error;

    const step = data && data.length > 0 ? data[0] : null;
    if (!step) return res.status(404).json({ error: 'Step not found' });

    // Map DB column names back to frontend field names
    res.json({ ...step, parent_step_id: step.parent_id || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campaigns/:campaignId/steps/:stepId', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { error } = await supabase
      .from('campaign_steps')
      .delete()
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/start', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, contact_list_id, send_schedule, send_immediately')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // DEBUG: First, get ALL steps for this campaign (no filters) to see what exists
    const { data: allSteps, error: allStepsError } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', req.params.id);

    console.log(`[CAMPAIGN-START] Campaign ${req.params.id} - ALL steps query:`);
    console.log(`[CAMPAIGN-START]   Error: ${allStepsError ? JSON.stringify(allStepsError) : 'none'}`);
    console.log(`[CAMPAIGN-START]   Step count: ${allSteps ? allSteps.length : 0}`);
    if (allSteps && allSteps.length > 0) {
      allSteps.forEach((s, i) => {
        console.log(`[CAMPAIGN-START]   Step[${i}]: id=${s.id}, type=${s.step_type}, order=${s.step_order}, parent_id=${s.parent_id}, subject=${s.subject}`);
      });
      // Log ALL column names from first step to see actual DB schema
      console.log(`[CAMPAIGN-START]   DB columns: ${Object.keys(allSteps[0]).join(', ')}`);
    }

    // Find the first main-flow step (lowest step_order, no parent)
    const { data: firstSteps, error: firstStepError } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', req.params.id)
      .is('parent_id', null)
      .order('step_order')
      .limit(1);

    console.log(`[CAMPAIGN-START]   First step query (parent_id IS NULL):`);
    console.log(`[CAMPAIGN-START]     Error: ${firstStepError ? JSON.stringify(firstStepError) : 'none'}`);
    console.log(`[CAMPAIGN-START]     Result: ${JSON.stringify(firstSteps)}`);

    let firstStep = firstSteps && firstSteps.length > 0 ? firstSteps[0] : null;

    if (!firstStep) {
      // Fallback: try without parent_id filter in case parent_id column doesn't behave as expected
      const { data: anySteps, error: anyError } = await supabase
        .from('campaign_steps')
        .select('id, step_order, step_type')
        .eq('campaign_id', req.params.id)
        .order('step_order')
        .limit(1);

      console.log(`[CAMPAIGN-START]   Fallback query (no parent filter):`);
      console.log(`[CAMPAIGN-START]     Error: ${anyError ? JSON.stringify(anyError) : 'none'}`);
      console.log(`[CAMPAIGN-START]     Result: ${JSON.stringify(anySteps)}`);

      if (anySteps && anySteps.length > 0) {
        console.log(`[CAMPAIGN-START]   ⚠️ Steps found without parent filter - using first step as fallback`);
        firstStep = anySteps[0];
      } else {
        return res.status(400).json({ error: 'Campaign has no steps' });
      }
    }

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('list_id', campaign.contact_list_id)
      .eq('status', 'active');

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ error: 'No active contacts in list' });
    }

    // Clean up data from previous runs
    const { error: deleteContactsError } = await supabase
      .from('campaign_contacts')
      .delete()
      .eq('campaign_id', req.params.id);

    if (deleteContactsError) {
      console.error('[CAMPAIGN-START] Error cleaning up old campaign contacts:', deleteContactsError);
    } else {
      console.log('[CAMPAIGN-START] Cleaned up old campaign contacts');
    }

    const { error: deleteEventsError } = await supabase
      .from('email_events')
      .delete()
      .eq('campaign_id', req.params.id);

    if (deleteEventsError) {
      console.error('[CAMPAIGN-START] Error cleaning up old email events:', deleteEventsError);
    } else {
      console.log('[CAMPAIGN-START] Cleaned up old email events');
    }

    // Calculate next_send_time based on schedule and send_immediately flag
    let nextSendTime;
    if (campaign.send_immediately) {
      // Send immediately - use current time
      nextSendTime = new Date().toISOString();
      console.log(`[CAMPAIGN-START] Send immediately enabled, using current time: ${nextSendTime}`);
    } else {
      // Calculate next valid send time based on schedule
      const emailService = require('./services/emailService');
      if (emailService.isWithinSchedule(campaign.send_schedule)) {
        nextSendTime = new Date().toISOString();
        console.log(`[CAMPAIGN-START] Within schedule, using current time: ${nextSendTime}`);
      } else {
        nextSendTime = emailService.getNextSendTime(campaign.send_schedule).toISOString();
        console.log(`[CAMPAIGN-START] Outside schedule, next send time: ${nextSendTime}`);
      }
    }

    const campaignContacts = contacts.map(contact => ({
      campaign_id: req.params.id,
      contact_id: contact.id,
      current_step_id: firstStep.id,
      status: 'in_progress',
      next_send_time: nextSendTime
    }));

    const { error: insertError } = await supabase
      .from('campaign_contacts')
      .insert(campaignContacts);

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Campaign started with ${contacts.length} contacts`,
      next_send_time: nextSendTime,
      send_immediately: campaign.send_immediately
    });
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

// Manual trigger for campaign executor (for testing)
app.post('/api/campaigns/executor/trigger', authenticateUser, async (req, res) => {
  try {
    console.log('[API] 🔧 Manual trigger for campaign executor requested by user:', req.user.id);

    // Execute immediately (don't wait for cron)
    campaignExecutor.executePendingCampaigns()
      .then(() => console.log('[API] ✅ Manual campaign execution completed'))
      .catch(err => console.error('[API] ❌ Manual campaign execution failed:', err));

    res.json({
      success: true,
      message: 'Campaign executor triggered. Check server logs for details.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/campaigns/:id/stats', authenticateUser, async (req, res) => {
  try {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { count: totalContacts } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', req.params.id);

    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('campaign_id', req.params.id);

    const sentCount = events?.filter(e => e.event_type === 'sent').length || 0;
    const openedCount = events?.filter(e => e.event_type === 'opened').length || 0;
    const clickedCount = events?.filter(e => e.event_type === 'clicked').length || 0;
    const repliedCount = events?.filter(e => e.event_type === 'replied').length || 0;

    res.json({
      total_contacts: totalContacts || 0,
      sent_count: sentCount,
      opened_count: openedCount,
      clicked_count: clickedCount,
      replied_count: repliedCount,
      open_rate: sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(1) : 0,
      click_rate: sentCount > 0 ? ((clickedCount / sentCount) * 100).toFixed(1) : 0,
      reply_rate: sentCount > 0 ? ((repliedCount / sentCount) * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// TRACKING ROUTES
// ============================================================================

app.get('/api/track/open/:campaign_id/:contact_id/:token', async (req, res) => {
  try {
    console.log(`[TRACKING] API open tracking: campaign=${req.params.campaign_id}, contact=${req.params.contact_id}`);

    // Check if this contact already has an 'opened' event for this campaign
    const { data: existingOpen } = await supabase
      .from('email_events')
      .select('id, event_data, created_at')
      .eq('campaign_id', req.params.campaign_id)
      .eq('contact_id', req.params.contact_id)
      .eq('event_type', 'opened')
      .limit(1)
      .single();

    if (existingOpen) {
      // Update the existing open event with the latest timestamp.
      // This ensures that if the first "open" was an automated preload by the email client
      // (e.g. Gmail image proxy), the timestamp gets updated when the user actually opens.
      const { error: updateError } = await supabase
        .from('email_events')
        .update({
          created_at: new Date().toISOString(),
          event_data: {
            user_agent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString(),
            first_opened_at: existingOpen.event_data?.first_opened_at || existingOpen.event_data?.timestamp || existingOpen.created_at
          }
        })
        .eq('id', existingOpen.id);

      if (updateError) {
        console.error(`[TRACKING] Failed to update open event:`, updateError);
      } else {
        console.log(`[TRACKING] 🔄 Updated open event timestamp for contact ${req.params.contact_id} (previous open at ${existingOpen.created_at})`);
      }
    } else {
      const { error: insertError } = await supabase.from('email_events').insert({
        campaign_id: req.params.campaign_id,
        contact_id: req.params.contact_id,
        event_type: 'opened',
        event_data: {
          user_agent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date().toISOString(),
          first_opened_at: new Date().toISOString()
        }
      });

      if (insertError) {
        console.error(`[TRACKING] Failed to insert open event:`, insertError);
      } else {
        console.log(`[TRACKING] ✅ Open event recorded for contact ${req.params.contact_id}`);
      }
    }

    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.type('image/gif').send(pixel);
  } catch (error) {
    console.error('[TRACKING] Unexpected error:', error);
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.type('image/gif').send(pixel);
  }
});

app.get('/api/track/click/:campaign_id/:contact_id/:token', async (req, res) => {
  try {
    const { url } = req.query;

    await supabase.from('email_events').insert({
      campaign_id: req.params.campaign_id,
      contact_id: req.params.contact_id,
      event_type: 'clicked',
      event_data: {
        url: decodeURIComponent(url),
        timestamp: new Date().toISOString()
      }
    });

    res.redirect(decodeURIComponent(url));
  } catch (error) {
    console.error('Click tracking error:', error);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// Improved open tracking - looks like a regular image asset for better deliverability
// URL format: /img/e/{campaign_id}/{contact_id}/{token}.gif
// Supports both full UUIDs (new) and shortened IDs (legacy)
app.get('/img/e/:campaign_id/:contact_id/:token', async (req, res) => {
  try {
    const { campaign_id, contact_id } = req.params;

    console.log(`[TRACKING] Open tracking pixel requested: campaign=${campaign_id}, contact=${contact_id}`);

    let campaignIdToUse = campaign_id;
    let contactIdToUse = contact_id;

    // Check if we have shortened IDs (8 chars) vs full UUIDs (36 chars)
    const isShortened = campaign_id.length < 36;

    if (isShortened) {
      // Legacy: Find the full IDs by partial match using text cast
      console.log(`[TRACKING] Using legacy shortened ID lookup`);
      const { data: campaignContact, error: lookupError } = await supabase
        .from('campaign_contacts')
        .select('campaign_id, contact_id')
        .filter('campaign_id::text', 'ilike', `${campaign_id}%`)
        .filter('contact_id::text', 'ilike', `${contact_id}%`)
        .limit(1)
        .single();

      if (lookupError) {
        console.error(`[TRACKING] Lookup error for shortened IDs:`, lookupError);
      }

      if (campaignContact) {
        campaignIdToUse = campaignContact.campaign_id;
        contactIdToUse = campaignContact.contact_id;
        console.log(`[TRACKING] Found full IDs: campaign=${campaignIdToUse}, contact=${contactIdToUse}`);
      } else {
        console.log(`[TRACKING] No match found for shortened IDs`);
      }
    }

    // Check if this contact already has an 'opened' event for this campaign
    const { data: existingOpen } = await supabase
      .from('email_events')
      .select('id, event_data, created_at')
      .eq('campaign_id', campaignIdToUse)
      .eq('contact_id', contactIdToUse)
      .eq('event_type', 'opened')
      .limit(1)
      .single();

    if (existingOpen) {
      // Update the existing open event with the latest timestamp.
      // This ensures that if the first "open" was an automated preload by the email client
      // (e.g. Gmail image proxy), the timestamp gets updated when the user actually opens.
      const { error: updateError } = await supabase
        .from('email_events')
        .update({
          created_at: new Date().toISOString(),
          event_data: {
            user_agent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString(),
            first_opened_at: existingOpen.event_data?.first_opened_at || existingOpen.event_data?.timestamp || existingOpen.created_at,
            tracking_type: isShortened ? 'legacy_pixel' : 'improved_pixel'
          }
        })
        .eq('id', existingOpen.id);

      if (updateError) {
        console.error(`[TRACKING] Failed to update open event:`, updateError);
      } else {
        console.log(`[TRACKING] 🔄 Updated open event timestamp for contact ${contactIdToUse} (previous open at ${existingOpen.created_at})`);
      }
    } else {
      // Insert new open event
      const { error: insertError } = await supabase.from('email_events').insert({
        campaign_id: campaignIdToUse,
        contact_id: contactIdToUse,
        event_type: 'opened',
        event_data: {
          user_agent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date().toISOString(),
          first_opened_at: new Date().toISOString(),
          tracking_type: isShortened ? 'legacy_pixel' : 'improved_pixel'
        }
      });

      if (insertError) {
        console.error(`[TRACKING] Failed to insert open event:`, insertError);
      } else {
        console.log(`[TRACKING] ✅ Open event recorded for contact ${contactIdToUse}`);
      }
    }

    // Return transparent 1x1 GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(pixel);
  } catch (error) {
    console.error('[TRACKING] Unexpected error:', error);
    // Still return pixel even on error
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.type('image/gif').send(pixel);
  }
});

// ============================================================================
// UNSUBSCRIBE ROUTES
// ============================================================================

// One-click unsubscribe (RFC 8058) - POST request
app.post('/api/unsubscribe/:campaign_id/:contact_id/:token', async (req, res) => {
  try {
    const { campaign_id, contact_id, token } = req.params;
    console.log(`[UNSUBSCRIBE] Processing one-click unsubscribe for contact ${contact_id}`);

    // Update contact status to unsubscribed
    const { error } = await supabase
      .from('contacts')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString()
      })
      .eq('id', contact_id);

    if (error) {
      console.error('[UNSUBSCRIBE] Error updating contact:', error);
      throw error;
    }

    // Log unsubscribe event
    await supabase.from('email_events').insert({
      campaign_id,
      contact_id,
      event_type: 'unsubscribed',
      event_data: {
        method: 'one-click',
        timestamp: new Date().toISOString()
      }
    });

    // Stop any ongoing campaigns for this contact
    await supabase
      .from('campaign_contacts')
      .update({ status: 'unsubscribed' })
      .eq('contact_id', contact_id);

    console.log(`[UNSUBSCRIBE] Contact ${contact_id} unsubscribed successfully`);
    res.status(200).send('You have been unsubscribed successfully.');
  } catch (error) {
    console.error('[UNSUBSCRIBE] Error:', error);
    res.status(500).send('An error occurred while processing your unsubscribe request.');
  }
});

// Unsubscribe landing page - GET request
app.get('/api/unsubscribe/:campaign_id/:contact_id/:token', async (req, res) => {
  try {
    const { campaign_id, contact_id, token } = req.params;
    const { confirm } = req.query;

    // If confirm=true, process the unsubscribe
    if (confirm === 'true') {
      console.log(`[UNSUBSCRIBE] Processing confirmed unsubscribe for contact ${contact_id}`);

      const { error } = await supabase
        .from('contacts')
        .update({
          status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString()
        })
        .eq('id', contact_id);

      if (error) throw error;

      // Log unsubscribe event
      await supabase.from('email_events').insert({
        campaign_id,
        contact_id,
        event_type: 'unsubscribed',
        event_data: {
          method: 'link',
          timestamp: new Date().toISOString()
        }
      });

      // Stop any ongoing campaigns for this contact
      await supabase
        .from('campaign_contacts')
        .update({ status: 'unsubscribed' })
        .eq('contact_id', contact_id);

      // Show success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            h1 { color: #333; margin-bottom: 16px; }
            p { color: #666; }
            .check { font-size: 48px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="check">✓</div>
            <h1>Unsubscribed</h1>
            <p>You have been successfully unsubscribed and will no longer receive emails from this campaign.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Show confirmation page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribe</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
          h1 { color: #333; margin-bottom: 16px; }
          p { color: #666; margin-bottom: 24px; }
          .btn { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
          .btn:hover { background: #c82333; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Unsubscribe</h1>
          <p>Click the button below to confirm that you want to unsubscribe from future emails.</p>
          <a href="?confirm=true" class="btn">Confirm Unsubscribe</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[UNSUBSCRIBE] Error:', error);
    res.status(500).send('An error occurred while processing your request.');
  }
});

// ============================================================================
// CAMPAIGN EXECUTION ENGINE
// ============================================================================

async function executePendingCampaigns() {
  console.log('[EXECUTOR] Starting campaign execution cycle...');

  try {
    const { data: pending, error } = await supabase
      .from('campaign_contacts')
      .select(`
        *,
        campaigns!inner(
          id, name, email_account_id, send_schedule, status, daily_limit
        ),
        contacts!inner(
          id, email, first_name, last_name, company, custom_fields
        ),
        campaign_steps!inner(
          id, step_type, step_order, subject, body, wait_days,
          wait_hours, wait_minutes
        )
      `)
      .eq('status', 'in_progress')
      .eq('campaigns.status', 'running')
      .lte('next_send_time', new Date().toISOString())
      .limit(50);

    if (error) throw error;

    if (!pending || pending.length === 0) {
      console.log('[EXECUTOR] No pending emails to send');
      return;
    }

    console.log(`[EXECUTOR] Found ${pending.length} emails to process`);

    for (const item of pending) {
      try {
        await processCampaignContact(item);
      } catch (err) {
        console.error(`[EXECUTOR] Error processing contact ${item.id}:`, err.message);
      }
    }

    console.log('[EXECUTOR] Cycle complete');
  } catch (error) {
    console.error('[EXECUTOR] Execution error:', error);
  }
}

async function processCampaignContact(campaignContact) {
  const { campaigns: campaign, contacts: contact, campaign_steps: step } = campaignContact;

  // Check if within send schedule
  if (!isWithinSchedule(campaign.send_schedule)) {
    console.log(`[EXECUTOR] Outside schedule for campaign ${campaign.id}, rescheduling...`);
    const nextTime = getNextSendTime(campaign.send_schedule);
    await updateNextSendTime(campaignContact.id, nextTime);
    return;
  }

  // Check daily limit
  const withinLimit = await checkDailyLimit(campaign.email_account_id, campaign.id);
  if (!withinLimit) {
    console.log(`[EXECUTOR] Daily limit reached for campaign ${campaign.id}`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    await updateNextSendTime(campaignContact.id, tomorrow);
    return;
  }

  // Process based on step type
  switch (step.step_type) {
    case 'email':
      await handleEmailStep(campaignContact, campaign, contact, step);
      break;
    case 'wait':
      await handleWaitStep(campaignContact, campaign, step);
      break;
  }
}

async function handleEmailStep(campaignContact, campaign, contact, step) {
  try {
    // Get email account
    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', campaign.email_account_id)
      .single();

    if (!account) throw new Error('Email account not found');

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_port === 465,
      auth: {
        user: account.smtp_username,
        pass: decrypt(account.smtp_password)
      },
      tls: { rejectUnauthorized: false }
    });

    // Personalize content
    let personalizedSubject = step.subject || 'No Subject';
    let personalizedBody = step.body || '';

    const variables = {
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      company: contact.company || '',
      ...contact.custom_fields
    };

    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      personalizedSubject = personalizedSubject.replace(regex, variables[key]);
      personalizedBody = personalizedBody.replace(regex, variables[key]);
    });

    // Add tracking pixel
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const trackingUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/track/open/${campaign.id}/${contact.id}/${trackingToken}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
    personalizedBody += trackingPixel;

    // Rewrite links for click tracking
    const clickTrackingUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/track/click/${campaign.id}/${contact.id}/${trackingToken}`;
    personalizedBody = personalizedBody.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (match, url) => `href="${clickTrackingUrl}?url=${encodeURIComponent(url)}"`
    );

    // Send email
    await transporter.sendMail({
      from: account.email_address,
      to: contact.email,
      subject: personalizedSubject,
      html: personalizedBody
    });

    // Log sent event
    await supabase.from('email_events').insert({
      campaign_id: campaign.id,
      contact_id: contact.id,
      campaign_step_id: step.id,
      event_type: 'sent',
      event_data: { timestamp: new Date().toISOString() }
    });

    console.log(`[EXECUTOR] ✓ Sent email to ${contact.email} (Campaign: ${campaign.name})`);

    // Move to next step
    await moveToNextStep(campaignContact, campaign.id, step);
  } catch (error) {
    console.error(`[EXECUTOR] ✗ Failed to send to ${contact.email}:`, error.message);

    await supabase.from('email_events').insert({
      campaign_id: campaign.id,
      contact_id: contact.id,
      campaign_step_id: step.id,
      event_type: 'failed',
      event_data: { error: error.message, timestamp: new Date().toISOString() }
    });

    await supabase
      .from('campaign_contacts')
      .update({ status: 'failed' })
      .eq('id', campaignContact.id);
  }
}

async function handleWaitStep(campaignContact, campaign, step) {
  const waitDays = step.wait_days || 3;
  const nextSendTime = new Date();
  nextSendTime.setDate(nextSendTime.getDate() + waitDays);

  const { data: nextStep } = await supabase
    .from('campaign_steps')
    .select('id')
    .eq('campaign_id', campaign.id)
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

    console.log(`[EXECUTOR] ⏱ Wait ${waitDays} days for contact ${campaignContact.contact_id}`);
  } else {
    await supabase
      .from('campaign_contacts')
      .update({ status: 'completed' })
      .eq('id', campaignContact.id);

    console.log(`[EXECUTOR] ✓ Campaign completed for contact ${campaignContact.contact_id}`);
  }
}

async function moveToNextStep(campaignContact, campaignId, currentStep) {
  const { data: nextStep } = await supabase
    .from('campaign_steps')
    .select('id')
    .eq('campaign_id', campaignId)
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

async function updateNextSendTime(campaignContactId, nextTime) {
  await supabase
    .from('campaign_contacts')
    .update({ next_send_time: nextTime.toISOString() })
    .eq('id', campaignContactId);
}

function isWithinSchedule(schedule) {
  if (!schedule || !schedule.days || !schedule.start_hour || !schedule.end_hour) {
    return true;
  }

  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const hour = now.getHours();

  return schedule.days.includes(dayOfWeek) && hour >= schedule.start_hour && hour < schedule.end_hour;
}

function getNextSendTime(schedule) {
  const now = new Date();

  if (!schedule || !schedule.days || !schedule.start_hour) {
    return now;
  }

  const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  let checkDate = new Date(now);
  let attempts = 0;

  while (attempts < 14) {
    const dayOfWeek = daysOfWeek[checkDate.getDay()];

    if (schedule.days.includes(dayOfWeek)) {
      checkDate.setHours(schedule.start_hour || 9, 0, 0, 0);
      if (checkDate > now) {
        return checkDate;
      }
    }

    checkDate.setDate(checkDate.getDate() + 1);
    attempts++;
  }

  return checkDate;
}

async function checkDailyLimit(emailAccountId, campaignId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('email_events')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('event_type', 'sent')
    .gte('created_at', today.toISOString());

  const { data: account } = await supabase
    .from('email_accounts')
    .select('daily_send_limit')
    .eq('id', emailAccountId)
    .single();

  const limit = account?.daily_send_limit || 10000;
  return count < limit;
}

// ============================================================================
// SCHEDULED JOBS
// ============================================================================

// Execute campaigns every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] ⏰ Campaign executor scheduled run triggered');
  try {
    await campaignExecutor.executePendingCampaigns();
  } catch (error) {
    console.error('[CRON] ❌ Campaign executor error:', error);
    console.error('[CRON] Stack:', error.stack);
  }
});

console.log('✓ Campaign executor scheduled (every 5 minutes)');



// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          🎯 Mr. Snowman API Server Running                ║
║                                                           ║
║  Port:              ${PORT.toString().padEnd(38)} ║
║  Environment:       ${(process.env.NODE_ENV || 'development').padEnd(38)} ║
║  Frontend URL:      ${(process.env.FRONTEND_URL || 'http://localhost:3000').substring(0, 38).padEnd(38)} ║
║                                                           ║
║  📧 Campaign Executor:  Every 5 minutes                   ║
║  📬 IMAP Monitor:       Active                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Start IMAP monitoring for reply detection
  try {
    await imapMonitor.startMonitoringAll();
    console.log('✓ IMAP monitoring started');
  } catch (error) {
    console.error('⚠ Failed to start IMAP monitoring:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  imapMonitor.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  imapMonitor.stopAll();
  process.exit(0);
});
