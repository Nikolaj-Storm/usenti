const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

// Import services
const warmupEngine = require('./services/warmupEngine');
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
    const { data, error } = await supabase
      .from('email_accounts')
      .select('id, email_address, account_type, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email-accounts', authenticateUser, async (req, res) => {
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${requestId}] NEW EMAIL ACCOUNT REQUEST`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] User ID: ${req.user?.id}`);
    console.log(`[${requestId}] User Email: ${req.user?.email}`);

    const {
      email_address, account_type, imap_host, imap_port, imap_username, imap_password,
      smtp_host, smtp_port, smtp_username, smtp_password, daily_send_limit
    } = req.body;

    console.log(`\n[${requestId}] === STEP 1: REQUEST BODY VALIDATION ===`);
    console.log(`[${requestId}] Email Address: ${email_address}`);
    console.log(`[${requestId}] Account Type: ${account_type}`);
    console.log(`[${requestId}] IMAP Host: ${imap_host}`);
    console.log(`[${requestId}] IMAP Port: ${imap_port}`);
    console.log(`[${requestId}] IMAP Username: ${imap_username}`);
    console.log(`[${requestId}] IMAP Password Provided: ${!!imap_password}`);
    console.log(`[${requestId}] IMAP Password Length: ${imap_password?.length || 0}`);
    console.log(`[${requestId}] SMTP Host: ${smtp_host}`);
    console.log(`[${requestId}] SMTP Port: ${smtp_port}`);
    console.log(`[${requestId}] SMTP Username: ${smtp_username}`);
    console.log(`[${requestId}] SMTP Password Provided: ${!!smtp_password}`);
    console.log(`[${requestId}] SMTP Password Length: ${smtp_password?.length || 0}`);
    console.log(`[${requestId}] Daily Send Limit: ${daily_send_limit}`);

    // Validation
    if (!email_address || !account_type) {
      console.log(`[${requestId}] ❌ VALIDATION FAILED: Missing required fields`);
      console.log(`[${requestId}]    - email_address present: ${!!email_address}`);
      console.log(`[${requestId}]    - account_type present: ${!!account_type}`);
      return res.status(400).json({
        error: 'Email address and account type are required',
        requestId
      });
    }

    console.log(`[${requestId}] ✓ Basic validation passed`);

    // Validate account_type is one of the allowed values
    const allowedTypes = ['gmail', 'outlook', 'zoho', 'aws_workmail', 'stalwart', 'custom'];
    if (!allowedTypes.includes(account_type)) {
      console.log(`[${requestId}] ❌ VALIDATION FAILED: Invalid account_type`);
      console.log(`[${requestId}]    - Received: ${account_type}`);
      console.log(`[${requestId}]    - Allowed: ${allowedTypes.join(', ')}`);
      return res.status(400).json({
        error: `Invalid account_type. Must be one of: ${allowedTypes.join(', ')}`,
        received: account_type,
        requestId
      });
    }

    console.log(`[${requestId}] ✓ Account type validation passed`);

    // Check for existing account
    console.log(`\n[${requestId}] === STEP 2: DUPLICATE CHECK ===`);
    console.log(`[${requestId}] Querying for existing account...`);
    console.log(`[${requestId}]    - user_id: ${req.user.id}`);
    console.log(`[${requestId}]    - email_address: ${email_address.toLowerCase()}`);

    const { data: existing, error: checkError } = await supabase
      .from('email_accounts')
      .select('id, email_address, created_at')
      .eq('user_id', req.user.id)
      .eq('email_address', email_address.toLowerCase())
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        console.log(`[${requestId}] ✓ No duplicate found (PGRST116 - no rows)`);
      } else {
        console.log(`[${requestId}] ❌ ERROR during duplicate check:`, {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details
        });
        throw checkError;
      }
    } else if (existing) {
      console.log(`[${requestId}] ❌ DUPLICATE FOUND:`, {
        id: existing.id,
        email: existing.email_address,
        created_at: existing.created_at
      });
      return res.status(400).json({
        error: 'Email account already exists',
        existingId: existing.id,
        requestId
      });
    }

    console.log(`[${requestId}] ✓ Duplicate check passed`);

    // Encrypt passwords
    console.log(`\n[${requestId}] === STEP 3: PASSWORD ENCRYPTION ===`);
    console.log(`[${requestId}] Encryption key available: ${!!process.env.ENCRYPTION_KEY}`);
    console.log(`[${requestId}] Encryption key length: ${process.env.ENCRYPTION_KEY?.length || 0}`);

    let encryptedImapPassword, encryptedSmtpPassword;

    console.log(`[${requestId}] Encrypting IMAP password...`);
    try {
      encryptedImapPassword = encrypt(imap_password);
      console.log(`[${requestId}] ✓ IMAP password encrypted successfully`);
      console.log(`[${requestId}]    - Original length: ${imap_password?.length}`);
      console.log(`[${requestId}]    - Encrypted length: ${encryptedImapPassword?.length}`);
      console.log(`[${requestId}]    - Encrypted format: ${encryptedImapPassword?.substring(0, 20)}...`);
    } catch (encErr) {
      console.log(`[${requestId}] ❌ IMAP ENCRYPTION ERROR:`, {
        name: encErr.name,
        message: encErr.message,
        stack: encErr.stack
      });
      throw new Error(`IMAP password encryption failed: ${encErr.message}`);
    }

    console.log(`[${requestId}] Encrypting SMTP password...`);
    try {
      encryptedSmtpPassword = encrypt(smtp_password);
      console.log(`[${requestId}] ✓ SMTP password encrypted successfully`);
      console.log(`[${requestId}]    - Original length: ${smtp_password?.length}`);
      console.log(`[${requestId}]    - Encrypted length: ${encryptedSmtpPassword?.length}`);
      console.log(`[${requestId}]    - Encrypted format: ${encryptedSmtpPassword?.substring(0, 20)}...`);
    } catch (encErr) {
      console.log(`[${requestId}] ❌ SMTP ENCRYPTION ERROR:`, {
        name: encErr.name,
        message: encErr.message,
        stack: encErr.stack
      });
      throw new Error(`SMTP password encryption failed: ${encErr.message}`);
    }

    console.log(`[${requestId}] ✓ Both passwords encrypted successfully`);

    // Prepare insert data
    console.log(`\n[${requestId}] === STEP 4: PREPARE DATABASE INSERT ===`);

    const insertData = {
      user_id: req.user.id,
      email_address: email_address.toLowerCase(),
      account_type,
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

    console.log(`[${requestId}] Insert data prepared:`, {
      user_id: insertData.user_id,
      email_address: insertData.email_address,
      account_type: insertData.account_type,
      imap_host: insertData.imap_host,
      imap_port: insertData.imap_port,
      imap_username: insertData.imap_username,
      imap_password: '[ENCRYPTED]',
      smtp_host: insertData.smtp_host,
      smtp_port: insertData.smtp_port,
      smtp_username: insertData.smtp_username,
      smtp_password: '[ENCRYPTED]',
      daily_send_limit: insertData.daily_send_limit,
      is_active: insertData.is_active,
      health_score: insertData.health_score
    });

    console.log(`[${requestId}] Attempting database insert...`);
    console.log(`[${requestId}] Target table: email_accounts`);
    console.log(`[${requestId}] Select fields: id, email_address, account_type, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at`);

    const { data, error } = await supabase
      .from('email_accounts')
      .insert(insertData)
      .select('id, email_address, account_type, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at')
      .single();

    if (error) {
      console.log(`\n[${requestId}] === STEP 5: DATABASE INSERT FAILED ===`);
      console.log(`[${requestId}] ❌ DATABASE ERROR DETAILS:`);
      console.log(`[${requestId}]    - Error Code: ${error.code}`);
      console.log(`[${requestId}]    - Error Message: ${error.message}`);
      console.log(`[${requestId}]    - Error Details: ${error.details}`);
      console.log(`[${requestId}]    - Error Hint: ${error.hint}`);
      console.log(`[${requestId}]    - Full Error Object:`, JSON.stringify(error, null, 2));

      // Specific error code handling
      if (error.code === '23514') {
        console.log(`[${requestId}] 🔍 CHECK CONSTRAINT VIOLATION DETECTED`);
        console.log(`[${requestId}]    This usually means the account_type value is not in the allowed list`);
        console.log(`[${requestId}]    Attempted account_type: ${account_type}`);
        console.log(`[${requestId}]    Allowed types: gmail, outlook, zoho, aws_workmail, stalwart, custom`);
      } else if (error.code === '23505') {
        console.log(`[${requestId}] 🔍 UNIQUE CONSTRAINT VIOLATION`);
        console.log(`[${requestId}]    An account with this email already exists`);
      } else if (error.code === '23503') {
        console.log(`[${requestId}] 🔍 FOREIGN KEY CONSTRAINT VIOLATION`);
        console.log(`[${requestId}]    The user_id doesn't exist in the users table`);
      }

      throw error;
    }

    console.log(`\n[${requestId}] === STEP 5: DATABASE INSERT SUCCESS ===`);
    console.log(`[${requestId}] ✅ Account created successfully!`);
    console.log(`[${requestId}] Account ID: ${data.id}`);
    console.log(`[${requestId}] Response data:`, data);
    console.log(`${'='.repeat(80)}`);
    console.log(`[${requestId}] REQUEST COMPLETED SUCCESSFULLY`);
    console.log(`${'='.repeat(80)}\n`);

    res.json(data);
  } catch (error) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${requestId}] ❌❌❌ FATAL ERROR ❌❌❌`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[${requestId}] Error Type: ${error.constructor.name}`);
    console.log(`[${requestId}] Error Name: ${error.name}`);
    console.log(`[${requestId}] Error Message: ${error.message}`);
    console.log(`[${requestId}] Error Code: ${error.code || 'N/A'}`);
    console.log(`[${requestId}] Error Details: ${error.details || 'N/A'}`);
    console.log(`[${requestId}] Error Hint: ${error.hint || 'N/A'}`);
    console.log(`[${requestId}] Full Error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.log(`[${requestId}] Stack Trace:\n${error.stack}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`[${requestId}] REQUEST FAILED`);
    console.log(`${'='.repeat(80)}\n`);

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
      imap_host, imap_port, imap_username, imap_password
    } = req.body;

    const results = {
      smtp: null,
      imap: null
    };

    // Test SMTP
    if (smtp_host && smtp_username && smtp_password) {
      try {
        const transporter = nodemailer.createTransporter({
          host: smtp_host,
          port: smtp_port || 587,
          secure: smtp_port === 465,
          auth: {
            user: smtp_username,
            pass: smtp_password
          },
          tls: { rejectUnauthorized: false }
        });

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
    console.log(`[TEST-IMAP] Testing IMAP for account ${req.params.id}...`);

    const { data: account } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Ensure port is a number
    const imapPort = parseInt(account.imap_port, 10) || 993;

    console.log(`[TEST-IMAP] Account: ${account.email_address}`);
    console.log(`[TEST-IMAP] IMAP Host: ${account.imap_host}:${imapPort}`);
    console.log(`[TEST-IMAP] IMAP User: ${account.imap_username}`);

    // Decrypt password with debug logging
    console.log(`[TEST-IMAP] Encrypted password length: ${account.imap_password?.length || 0}`);
    console.log(`[TEST-IMAP] Encrypted password has separator: ${account.imap_password?.includes(':')}`);

    let decryptedPassword;
    try {
      decryptedPassword = decrypt(account.imap_password);
      console.log(`[TEST-IMAP] Decrypted password length: ${decryptedPassword?.length || 0}`);
    } catch (decryptError) {
      console.error(`[TEST-IMAP] Decryption failed: ${decryptError.message}`);
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
        console.log(`[TEST-IMAP] ⏱️ Connection timeout`);
        imap.end();
        resolve(res.status(400).json({
          success: false,
          error: 'Connection timeout'
        }));
      }, 10000);

      imap.once('ready', () => {
        clearTimeout(timeout);
        console.log(`[TEST-IMAP] ✅ Connection successful!`);
        imap.end();
        resolve(res.json({ success: true, message: 'IMAP connection successful' }));
      });

      imap.once('error', (err) => {
        clearTimeout(timeout);
        console.error(`[TEST-IMAP] ❌ Connection failed: ${err.message}`);
        resolve(res.status(400).json({
          success: false,
          error: `IMAP failed: ${err.message}`
        }));
      });

      console.log(`[TEST-IMAP] Connecting...`);
      imap.connect();
    });
  } catch (error) {
    console.error(`[TEST-IMAP] Error: ${error.message}`);
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
    console.log(`[TEST-SMTP] Testing SMTP for account ${req.params.id}...`);

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

    console.log(`[TEST-SMTP] Account: ${account.email_address}`);
    console.log(`[TEST-SMTP] SMTP Host: ${account.smtp_host}:${smtpPort}`);
    console.log(`[TEST-SMTP] SMTP User: ${account.smtp_username}`);
    console.log(`[TEST-SMTP] Secure: ${isSecure ? 'YES (SSL)' : 'NO (TLS/STARTTLS)'}`);

    // Decrypt password with debug logging
    console.log(`[TEST-SMTP] Encrypted password length: ${account.smtp_password?.length || 0}`);
    console.log(`[TEST-SMTP] Encrypted password has separator: ${account.smtp_password?.includes(':')}`);

    let decryptedPassword;
    try {
      decryptedPassword = decrypt(account.smtp_password);
      console.log(`[TEST-SMTP] Decrypted password length: ${decryptedPassword?.length || 0}`);
    } catch (decryptError) {
      console.error(`[TEST-SMTP] Decryption failed: ${decryptError.message}`);
      return res.status(400).json({
        success: false,
        error: `Password decryption failed: ${decryptError.message}`
      });
    }

    // Determine if this is a Zoho account (needs special handling)
    const isZoho = account.smtp_host?.toLowerCase().includes('zoho') || account.account_type === 'zoho';

    // Helper to create transporter config
    const createConfig = (host) => ({
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
      ...(isZoho && { authMethod: 'LOGIN' })
    });

    // For Zoho accounts, try multiple data centers
    if (isZoho) {
      console.log(`[TEST-SMTP] Detected Zoho account - will try multiple data centers`);

      // Build list of hosts to try
      const hostsToTry = [account.smtp_host];
      for (const host of ZOHO_SMTP_HOSTS) {
        if (!hostsToTry.includes(host)) {
          hostsToTry.push(host);
        }
      }

      console.log(`[TEST-SMTP] Will try hosts: ${hostsToTry.join(', ')}`);

      let lastError;
      for (const host of hostsToTry) {
        console.log(`[TEST-SMTP] Trying ${host}...`);
        try {
          const transporter = nodemailer.createTransport(createConfig(host));
          await transporter.verify();
          console.log(`[TEST-SMTP] ✅ Connected to ${host}!`);

          // Update account if we found a working host different from configured
          if (host !== account.smtp_host) {
            console.log(`[TEST-SMTP] Updating account SMTP host to ${host}`);
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
          console.log(`[TEST-SMTP] ❌ Failed with ${host}: ${err.message}`);
          lastError = err;
        }
      }

      // All hosts failed
      console.error(`[TEST-SMTP] All Zoho hosts failed`);
      return res.status(400).json({
        success: false,
        error: `SMTP failed on all Zoho data centers: ${lastError?.message}`,
        errorCode: lastError?.code,
        triedHosts: hostsToTry
      });
    }

    // Non-Zoho: standard single host test
    console.log(`[TEST-SMTP] Testing non-Zoho SMTP...`);
    const transporter = nodemailer.createTransport(createConfig(account.smtp_host));

    console.log(`[TEST-SMTP] Verifying connection...`);
    await transporter.verify();
    console.log(`[TEST-SMTP] ✅ Connection successful!`);
    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (error) {
    console.error(`[TEST-SMTP] ❌ Connection failed: ${error.message}`);
    console.error(`[TEST-SMTP] Error code: ${error.code}`);
    res.status(400).json({
      success: false,
      error: `SMTP failed: ${error.message}`,
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
      .select('id, email_address, account_type, daily_send_limit, is_warming_up, warmup_stage, is_active, health_score, created_at')
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

    console.log(`[${requestId}] Fetching inbox for user ${req.user.id}`);
    console.log(`[${requestId}] Filters - account_id: ${account_id || 'all'}, limit: ${limit}, offset: ${offset}`);

    // First, get all email accounts that belong to the user
    const { data: userAccounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', req.user.id);

    if (accountsError) {
      console.error(`[${requestId}] Error fetching user accounts:`, accountsError);
      throw accountsError;
    }

    const userAccountIds = userAccounts.map(a => a.id);

    if (userAccountIds.length === 0) {
      console.log(`[${requestId}] No email accounts found for user`);
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
        console.warn(`[${requestId}] Unauthorized access attempt to account ${account_id}`);
        return res.status(403).json({ error: 'Unauthorized access to this email account' });
      }
      query = query.eq('email_account_id', account_id);
      console.log(`[${requestId}] Filtering by account_id: ${account_id}`);
    } else {
      // Show all messages from all user's accounts
      query = query.in('email_account_id', userAccountIds);
      console.log(`[${requestId}] Fetching from all accounts (${userAccountIds.length} accounts)`);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[${requestId}] Error fetching inbox:`, error);
      throw error;
    }

    console.log(`[${requestId}] Successfully fetched ${data?.length || 0} inbox messages`);
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

    console.log(`[${requestId}] Marking inbox message ${id} as ${is_read ? 'read' : 'unread'}`);

    // Verify the message belongs to user's email account
    const { data: message, error: fetchError } = await supabase
      .from('inbox_messages')
      .select('email_account_id, email_accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (fetchError || !message) {
      console.error(`[${requestId}] Message not found:`, fetchError);
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.email_accounts.user_id !== req.user.id) {
      console.warn(`[${requestId}] Unauthorized access attempt`);
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
      console.error(`[${requestId}] Error updating message:`, error);
      throw error;
    }

    console.log(`[${requestId}] Successfully updated message`);
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

    console.log(`[${requestId}] Inbox sync request for user ${req.user.id}`);
    console.log(`[${requestId}] Account filter: ${account_id || 'all'}, Limit: ${limit}`);

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
      console.error(`[${requestId}] Error fetching accounts:`, accountsError);
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      console.log(`[${requestId}] No email accounts found`);
      return res.json({ synced: 0, message: 'No email accounts to sync' });
    }

    console.log(`[${requestId}] Syncing ${accounts.length} account(s)...`);

    const imapMonitor = require('./services/imapMonitor');
    let totalSynced = 0;
    const results = [];

    for (const account of accounts) {
      try {
        console.log(`[${requestId}] Syncing account: ${account.email_address}`);
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

    console.log(`[${requestId}] ✅ Sync complete. Total messages synced: ${totalSynced}`);
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
    console.log(`[${requestId}] Fetching content for message ${id}`);

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
      console.log(`[${requestId}] Returning stored content`);
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
    console.log(`[${requestId}] Fetching from IMAP server...`);
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

      console.log(`[${requestId}] ✅ Fetched and cached content`);
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

// Send reply to an inbox message
app.post('/api/inbox/:id/reply', authenticateUser, async (req, res) => {
  const requestId = `REPLY-${Date.now()}`;

  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    console.log(`[${requestId}] Sending reply to message ${id}`);

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

    console.log(`[${requestId}] Sending reply from ${emailAccount.email_address} to ${originalMessage.from_address}`);

    await emailService.sendEmail({
      emailAccountId: emailAccount.id,
      to: originalMessage.from_address,
      subject: replySubject,
      body: fullBody.replace(/\n/g, '<br/>'),
      campaignId: null,
      contactId: null,
      trackOpens: false,
      trackClicks: false
    });

    console.log(`[${requestId}] ✅ Reply sent successfully`);
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

    console.log(`[CONTACTS] Fetching contacts for list ${listId}, user ${req.user.id}`);

    // Verify list belongs to user
    const { data: list, error: listError } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('user_id', req.user.id)
      .single();

    if (listError || !list) {
      console.error('[CONTACTS] List not found or unauthorized:', listError);
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
      console.error('[CONTACTS] Error fetching contacts:', error);
      throw error;
    }

    console.log(`[CONTACTS] Found ${data?.length || 0} contacts (total: ${count})`);

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

    console.log(`[CONTACTS] Deleting list ${listId} for user ${req.user.id}`);

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

    console.log(`[CONTACTS] Successfully deleted list ${listId}`);
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

    console.log(`[CONTACTS] Updating contact ${contactId}`);

    // Verify contact belongs to user's list
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('list_id, contact_lists!inner(user_id)')
      .eq('id', contactId)
      .single();

    if (fetchError || !contact) {
      console.error('[CONTACTS] Contact not found:', fetchError);
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

    console.log(`[CONTACTS] Successfully updated contact ${contactId}`);
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

    console.log(`[CONTACTS] Deleting contact ${contactId}`);

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

    console.log(`[CONTACTS] Successfully deleted contact ${contactId}`);
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
    let totalClicked = 0;
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
        totalClicked = events.filter(e => e.event_type === 'clicked').length;
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
    const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0';
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
          label: 'Click Rate',
          value: `${clickRate}%`,
          change: '+0%',
          icon: 'MousePointer2',
          color: 'text-amber-600'
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
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/steps', authenticateUser, async (req, res) => {
  try {
    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { step_type, subject, body, wait_days, condition_type, next_step_if_true, next_step_if_false, step_order } = req.body;

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
        wait_days: step_type === 'wait' ? wait_days : null,
        condition_type: step_type === 'condition' ? condition_type : null,
        next_step_if_true: step_type === 'condition' ? next_step_if_true : null,
        next_step_if_false: step_type === 'condition' ? next_step_if_false : null,
        step_order: step_order || 1
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
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

    const { subject, body, wait_days, condition_type, step_order } = req.body;

    const updates = {};
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (wait_days !== undefined) updates.wait_days = wait_days;
    if (condition_type !== undefined) updates.condition_type = condition_type;
    if (step_order !== undefined) updates.step_order = step_order;

    const { data, error } = await supabase
      .from('campaign_steps')
      .update(updates)
      .eq('id', req.params.stepId)
      .eq('campaign_id', req.params.campaignId)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
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

    const { data: firstStep } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', req.params.id)
      .eq('step_order', 1)
      .single();

    if (!firstStep) {
      return res.status(400).json({ error: 'Campaign has no steps' });
    }

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('list_id', campaign.contact_list_id)
      .eq('status', 'active');

    if (!contacts || contacts.length === 0) {
      return res.status(400).json({ error: 'No active contacts in list' });
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
// WARM-UP ROUTES
// ============================================================================

app.get('/api/warmup/:email_account_id', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', req.params.email_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Email account not found' });

    const { data, error } = await supabase
      .from('warmup_configs')
      .select('*')
      .eq('email_account_id', req.params.email_account_id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    res.json(data || { 
      is_active: false,
      daily_warmup_volume: 1000,
      current_daily_volume: 50,
      replies_per_thread: 20
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/warmup/:email_account_id', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', req.params.email_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Email account not found' });

    const { is_active, daily_warmup_volume, replies_per_thread } = req.body;
    
    const { data, error } = await supabase
      .from('warmup_configs')
      .upsert({
        email_account_id: req.params.email_account_id,
        is_active: is_active !== undefined ? is_active : true,
        daily_warmup_volume: daily_warmup_volume || 1000,
        current_daily_volume: 50,
        rampup_increment: 50,
        replies_per_thread: replies_per_thread || 20
      }, {
        onConflict: 'email_account_id'
      })
      .select()
      .single();
    
    if (error) throw error;

    await supabase
      .from('email_accounts')
      .update({ is_warming_up: is_active })
      .eq('id', req.params.email_account_id);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/warmup/:email_account_id/stats', authenticateUser, async (req, res) => {
  try {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', req.params.email_account_id)
      .eq('user_id', req.user.id)
      .single();

    if (!account) return res.status(404).json({ error: 'Email account not found' });

    const { count: activeThreads } = await supabase
      .from('warmup_threads')
      .select('*', { count: 'exact', head: true })
      .eq('email_account_id', req.params.email_account_id)
      .eq('status', 'active');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: messagesToday } = await supabase
      .from('warmup_messages')
      .select('*', { count: 'exact', head: true })
      .eq('email_account_id', req.params.email_account_id)
      .gte('created_at', today.toISOString());

    res.json({
      active_threads: activeThreads || 0,
      messages_today: messagesToday || 0,
      inbox_placement_rate: 95,
      status: activeThreads > 0 ? 'warming' : 'idle'
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
    await supabase.from('email_events').insert({
      campaign_id: req.params.campaign_id,
      contact_id: req.params.contact_id,
      event_type: 'opened',
      event_data: { 
        user_agent: req.headers['user-agent'], 
        ip: req.ip,
        timestamp: new Date().toISOString()
      }
    });
    
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.type('image/gif').send(pixel);
  } catch (error) {
    console.error('Tracking error:', error);
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
// URL format: /img/e/{campaign_short}/{contact_short}/{token}.gif
app.get('/img/e/:campaign_short/:contact_short/:token', async (req, res) => {
  try {
    const { campaign_short, contact_short } = req.params;

    // Find the campaign and contact by partial ID match
    // This is less precise but matches the shortened URL format for deliverability
    const { data: campaignContact } = await supabase
      .from('campaign_contacts')
      .select('campaign_id, contact_id')
      .ilike('campaign_id', `${campaign_short}%`)
      .ilike('contact_id', `${contact_short}%`)
      .limit(1)
      .single();

    if (campaignContact) {
      await supabase.from('email_events').insert({
        campaign_id: campaignContact.campaign_id,
        contact_id: campaignContact.contact_id,
        event_type: 'opened',
        event_data: {
          user_agent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date().toISOString(),
          tracking_type: 'improved_pixel'
        }
      });
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
    console.error('Improved tracking error:', error);
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
          id, step_type, step_order, subject, body, wait_days, condition_type,
          next_step_if_true, next_step_if_false
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
    case 'condition':
      await handleConditionStep(campaignContact, campaign, step);
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
    const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/track/open/${campaign.id}/${contact.id}/${trackingToken}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
    personalizedBody += trackingPixel;

    // Rewrite links for click tracking
    const clickTrackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/track/click/${campaign.id}/${contact.id}/${trackingToken}`;
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

async function handleConditionStep(campaignContact, campaign, step) {
  const { data: events } = await supabase
    .from('email_events')
    .select('event_type')
    .eq('campaign_id', campaign.id)
    .eq('contact_id', campaignContact.contact_id);

  let conditionMet = false;

  switch (step.condition_type) {
    case 'if_opened':
      conditionMet = events.some(e => e.event_type === 'opened');
      break;
    case 'if_not_opened':
      conditionMet = !events.some(e => e.event_type === 'opened');
      break;
    case 'if_clicked':
      conditionMet = events.some(e => e.event_type === 'clicked');
      break;
    case 'if_replied':
      conditionMet = events.some(e => e.event_type === 'replied');
      break;
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

    console.log(`[EXECUTOR] 🔀 Condition ${step.condition_type}: ${conditionMet ? 'TRUE' : 'FALSE'}`);
  } else {
    await supabase
      .from('campaign_contacts')
      .update({ status: 'completed' })
      .eq('id', campaignContact.id);
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

// Warm-up engine runs hourly
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Running warm-up engine...');
  try {
    await warmupEngine.execute();
  } catch (error) {
    console.error('[CRON] Warm-up engine error:', error);
  }
});

console.log('✓ Warm-up engine scheduled (every hour)');

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
║  🔥 Warm-up Engine:     Every hour                        ║
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
