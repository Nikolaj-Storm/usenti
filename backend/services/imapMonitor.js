const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');

// Zoho IMAP hosts for different data centers (same regions as SMTP)
const ZOHO_IMAP_HOSTS = [
  'imap.zoho.com',      // US
  'imap.zoho.eu',       // EU
  'imap.zoho.in',       // India
  'imap.zoho.com.au',   // Australia
  'imap.zoho.com.cn',   // China
  'imappro.zoho.com',   // US Pro
  'imappro.zoho.eu',    // EU Pro
  'imappro.zoho.in',    // India Pro
];

class ImapMonitor {
  constructor() {
    this.connections = new Map();
    this.monitoring = false;
    // Storage limits
    this.maxMessagesPerAccount = 200;
    this.maxAgeDays = 30;
    // Cache working Zoho hosts per account
    this.zohoHostCache = new Map();
  }

  // Check if a host is a Zoho IMAP host
  isZohoHost(host) {
    if (!host) return false;
    const lowerHost = host.toLowerCase();
    return lowerHost.includes('zoho') ||
      ZOHO_IMAP_HOSTS.some(zh => lowerHost.includes(zh.replace('imap.', '').replace('imappro.', '')));
  }

  // Helper to normalize subject lines for comparison (strip Re:, Fwd:, etc.)
  normalizeSubject(subject) {
    if (!subject) return '';
    return subject
      .replace(/^(re|fwd|fw|aw|wg|undeliverable|auto):\s*/i, '') // Remove prefixes
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .toLowerCase();
  }

  // Helper to extract cleaner text body, removing tracking pixels and artifacts
  extractCleanerText(parsed) {
    let text = parsed.text || '';

    // If text is empty or looks like just a URL/image, try to get it from HTML (simple strip tags)
    if ((!text || text.length < 5) && parsed.html) {
      // Very basic HTML to text fallback
      text = parsed.html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style blocks
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script blocks
        .replace(/<br\s*\/?>/gi, '\n') // Replace <br> with newline
        .replace(/<\/p>/gi, '\n') // Replace </p> with newline
        .replace(/<[^>]*>?/gm, '') // Remove all other tags
        .replace(/&nbsp;/g, ' '); // Replace &nbsp;
    }

    if (!text) return '';

    // Filter out common tracking pixel patterns and image placeholders
    return text
      .split('\n')
      .map(line => {
        let cleaned = line.trim();
        // Remove [https://...] patterns (common mailparser image placeholder)
        cleaned = cleaned.replace(/\[https?:\/\/[^\]]*\]/gi, '').trim();

        // Remove raw URLs if they look like trackers
        if (cleaned.match(/^https?:\/\/[^\s]*$/i) && (cleaned.includes('track') || cleaned.includes('pixel') || cleaned.includes('click'))) {
          return '';
        }

        // Remove lines that are just "images" or "links" or empty brackets
        if (cleaned === '[]' || cleaned === '[image]' || cleaned === '[link]') return '';

        return cleaned;
      })
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }

  // Check if an account is a Zoho account
  isZohoAccount(account) {
    return this.isZohoHost(account.imap_host) ||
      account.email_address?.toLowerCase().includes('@zoho') ||
      account.account_type === 'zoho';
  }

  // Resolve the correct IMAP host for a Zoho account (with regional fallback)
  // Returns the working host, or throws with a helpful error if IMAP is disabled
  async resolveImapHost(account, decryptedPassword) {
    if (!this.isZohoAccount(account)) {
      return account.imap_host;
    }

    // Check cache first - if monitoring already found a working host, use it
    const cachedHost = this.zohoHostCache.get(account.id);
    if (cachedHost) {
      console.log(`[IMAP] Using cached Zoho host for ${account.email_address}: ${cachedHost}`);
      return cachedHost;
    }

    console.log(`[IMAP] 🌐 Resolving Zoho IMAP host for ${account.email_address}...`);

    // Build list of hosts to try (configured first, then all regional)
    let hostsToTry = [...ZOHO_IMAP_HOSTS];
    if (account.imap_host && !hostsToTry.includes(account.imap_host)) {
      hostsToTry.unshift(account.imap_host);
    }

    let imapDisabledHost = null;

    for (const host of hostsToTry) {
      console.log(`[IMAP]    🔄 Testing Zoho host: ${host}...`);
      const result = await this.quickTestHost(host, account, decryptedPassword);
      if (result.success) {
        this.zohoHostCache.set(account.id, host);
        console.log(`[IMAP]    ✅ Zoho host resolved: ${host}`);
        return host;
      }
      // "enable IMAP" error means credentials are valid but IMAP is disabled
      if (result.error && result.error.toLowerCase().includes('enable imap')) {
        imapDisabledHost = host;
        console.log(`[IMAP]    ⚠️ Correct Zoho datacenter found (${host}) but IMAP is disabled`);
      }
    }

    // If we found the correct datacenter but IMAP is disabled, throw a clear error
    if (imapDisabledHost) {
      const errorMsg = `IMAP is not enabled for ${account.email_address}. Please enable IMAP access in your Zoho Mail settings: go to Zoho Mail → Settings → Mail Accounts → IMAP Access, and enable it. Your Zoho datacenter is ${imapDisabledHost}.`;
      console.error(`[IMAP] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.error(`[IMAP] ❌ All Zoho hosts failed for ${account.email_address}, using configured: ${account.imap_host}`);
    return account.imap_host;
  }

  // Quick IMAP host connectivity test (connect + auth + disconnect)
  // Returns { success: boolean, error?: string }
  quickTestHost(host, account, decryptedPassword) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`[IMAP]       ⏱️ Timeout: ${host}`);
        resolve({ success: false, error: 'timeout' });
      }, 10000);

      try {
        const imap = new Imap({
          user: account.imap_username,
          password: decryptedPassword,
          host: host,
          port: account.imap_port || 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false },
          connTimeout: 10000,
          authTimeout: 10000
        });

        imap.once('ready', () => {
          clearTimeout(timeout);
          imap.end();
          resolve({ success: true });
        });

        imap.once('error', (err) => {
          clearTimeout(timeout);
          console.log(`[IMAP]       ❌ ${host}: ${err.message}`);
          resolve({ success: false, error: err.message });
        });

        imap.connect();
      } catch (error) {
        clearTimeout(timeout);
        console.log(`[IMAP]       ❌ ${host}: ${error.message}`);
        resolve({ success: false, error: error.message });
      }
    });
  }

  // Cleanup old messages to prevent database bloat
  async cleanupOldMessages(accountId = null) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxAgeDays);

      let deleteQuery = supabase
        .from('inbox_messages')
        .delete()
        .lt('received_at', cutoffDate.toISOString());

      if (accountId) {
        deleteQuery = deleteQuery.eq('email_account_id', accountId);
      }

      const { count, error } = await deleteQuery;

      if (error) {
        console.error('[IMAP] Error cleaning up old messages:', error);
      } else {
        console.log(`[IMAP] Cleaned up ${count || 0} messages older than ${this.maxAgeDays} days`);
      }
    } catch (error) {
      console.error('[IMAP] Cleanup error:', error);
    }
  }

  // Enforce max messages per account limit
  async enforceMessageLimit(accountId) {
    try {
      // Count messages for this account
      const { count, error: countError } = await supabase
        .from('inbox_messages')
        .select('*', { count: 'exact', head: true })
        .eq('email_account_id', accountId);

      if (countError) {
        console.error('[IMAP] Error counting messages:', countError);
        return;
      }

      if (count > this.maxMessagesPerAccount) {
        const excess = count - this.maxMessagesPerAccount;
        console.log(`[IMAP] Account ${accountId} has ${count} messages, removing ${excess} oldest...`);

        // Get oldest messages to delete
        const { data: oldestMessages, error: fetchError } = await supabase
          .from('inbox_messages')
          .select('id')
          .eq('email_account_id', accountId)
          .order('received_at', { ascending: true })
          .limit(excess);

        if (fetchError) {
          console.error('[IMAP] Error fetching oldest messages:', fetchError);
          return;
        }

        const idsToDelete = oldestMessages.map(m => m.id);

        const { error: deleteError } = await supabase
          .from('inbox_messages')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('[IMAP] Error deleting excess messages:', deleteError);
        } else {
          console.log(`[IMAP] Removed ${idsToDelete.length} old messages from account ${accountId}`);
        }
      }
    } catch (error) {
      console.error('[IMAP] Enforce limit error:', error);
    }
  }

  // Start monitoring all active email accounts
  async startMonitoringAll() {
    if (this.monitoring) {
      console.log('[IMAP] Already monitoring');
      return;
    }

    this.monitoring = true;
    console.log('[IMAP] Starting IMAP monitoring for all accounts...');

    try {
      const { data: accounts, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      for (const account of accounts || []) {
        this.startMonitoring(account);
      }

      console.log(`[IMAP] Monitoring ${accounts?.length || 0} email accounts`);
    } catch (error) {
      console.error('[IMAP] Error starting monitoring:', error);
      this.monitoring = false;
    }
  }

  // Start monitoring a single email account
  startMonitoring(account) {
    // Skip if already monitoring
    if (this.connections.has(account.id)) {
      return;
    }

    // Decrypt password with error handling
    let decryptedPassword;
    try {
      if (!account.imap_password) {
        console.error(`[IMAP] ✗ No IMAP password stored for ${account.email_address}`);
        return;
      }
      decryptedPassword = decrypt(account.imap_password);
      if (!decryptedPassword) {
        console.error(`[IMAP] ✗ Password decryption returned empty for ${account.email_address}`);
        return;
      }
    } catch (decryptError) {
      console.error(`[IMAP] ✗ Password decryption failed for ${account.email_address}:`);
      console.error(`[IMAP]   - Error: ${decryptError.message}`);
      return;
    }

    // Check if this is a Zoho account - if so, try multiple regional hosts
    const isZoho = this.isZohoAccount(account);

    if (isZoho) {
      // Try Zoho hosts with regional fallback
      this.startMonitoringZoho(account, decryptedPassword);
    } else {
      // Standard single-host connection
      this.startMonitoringSingleHost(account, account.imap_host, decryptedPassword);
    }
  }

  // Start monitoring with Zoho regional host fallback
  async startMonitoringZoho(account, decryptedPassword) {
    console.log(`[IMAP] 🌐 Zoho account detected for ${account.email_address}`);

    // Check cache first
    const cachedHost = this.zohoHostCache.get(account.id);

    // Build list of hosts to try (cached first, then configured, then all others)
    let hostsToTry = [...ZOHO_IMAP_HOSTS];
    if (cachedHost) {
      hostsToTry = [cachedHost, ...hostsToTry.filter(h => h !== cachedHost)];
    }
    if (account.imap_host && !hostsToTry.includes(account.imap_host)) {
      hostsToTry.unshift(account.imap_host);
    }

    console.log(`[IMAP]    Will try Zoho hosts: ${hostsToTry.slice(0, 4).join(', ')}...`);

    for (const host of hostsToTry) {
      console.log(`[IMAP]    🔄 Trying Zoho host: ${host}...`);

      const success = await this.tryConnectHost(account, host, decryptedPassword);

      if (success) {
        // Cache the working host
        this.zohoHostCache.set(account.id, host);
        console.log(`[IMAP]    ✅ Connected via ${host} - cached for future connections`);
        return;
      }
    }

    console.error(`[IMAP] ❌ All Zoho IMAP hosts failed for ${account.email_address}`);
    console.error(`[IMAP]    Please verify:`);
    console.error(`[IMAP]    1. IMAP is enabled in Zoho Mail settings`);
    console.error(`[IMAP]    2. Using App-Specific Password if 2FA is enabled`);
    console.error(`[IMAP]    3. Account is active and not locked`);
  }

  // Try connecting to a specific host - returns promise that resolves to success boolean
  tryConnectHost(account, host, decryptedPassword) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`[IMAP]       ⏱️ Connection timeout for ${host}`);
        resolve(false);
      }, 10000); // 10 second timeout

      try {
        const imap = new Imap({
          user: account.imap_username,
          password: decryptedPassword,
          host: host,
          port: account.imap_port || 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false },
          keepalive: true,
          connTimeout: 10000,
          authTimeout: 10000
        });

        imap.once('ready', () => {
          clearTimeout(timeout);
          console.log(`[IMAP] ✓ Connected to ${account.email_address} via ${host}`);
          this.connections.set(account.id, { imap, account, host });
          this.openInbox(imap, account);
          resolve(true);
        });

        imap.once('error', (err) => {
          clearTimeout(timeout);
          console.log(`[IMAP]       ❌ ${host}: ${err.message}`);
          resolve(false);
        });

        imap.once('end', () => {
          if (this.connections.has(account.id)) {
            console.log(`[IMAP] Connection ended for ${account.email_address}`);
            this.connections.delete(account.id);
          }
        });

        imap.connect();
      } catch (error) {
        clearTimeout(timeout);
        console.log(`[IMAP]       ❌ ${host}: ${error.message}`);
        resolve(false);
      }
    });
  }

  // Start monitoring with a single host (non-Zoho accounts)
  startMonitoringSingleHost(account, host, decryptedPassword) {
    try {
      console.log(`[IMAP] Attempting connection for ${account.email_address}:`);
      console.log(`[IMAP]   - Host: ${host}`);
      console.log(`[IMAP]   - Port: ${account.imap_port}`);
      console.log(`[IMAP]   - Username: ${account.imap_username}`);
      console.log(`[IMAP]   - TLS: enabled`);
      console.log(`[IMAP]   - Password: decrypted (${decryptedPassword.length} chars)`);

      const imap = new Imap({
        user: account.imap_username,
        password: decryptedPassword,
        host: host,
        port: account.imap_port,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true,
        debug: (msg) => console.log(`[IMAP DEBUG ${account.email_address}] ${msg}`)
      });

      imap.once('ready', () => {
        console.log(`[IMAP] ✓ Connected to ${account.email_address}`);
        this.openInbox(imap, account);
      });

      imap.once('error', (err) => {
        console.error(`[IMAP] ✗ Error for ${account.email_address}:`);
        console.error(`[IMAP]   - Message: ${err.message}`);
        console.error(`[IMAP]   - Error type: ${err.type || 'unknown'}`);
        console.error(`[IMAP]   - Error source: ${err.source || 'unknown'}`);
        console.error(`[IMAP]   - Text code: ${err.textCode || 'none'}`);
        if (err.message.includes('Invalid credentials')) {
          console.error(`[IMAP]   - Troubleshooting tips:`);
          console.error(`[IMAP]     1. Verify IMAP username matches email: ${account.imap_username}`);
          console.error(`[IMAP]     2. Check if "Less secure apps" or "App password" is required`);
          console.error(`[IMAP]     3. Verify IMAP is enabled in email provider settings`);
          console.error(`[IMAP]     4. For Gmail: Use App Password, not account password`);
          console.error(`[IMAP]     5. For custom domains: Check mail server auth settings`);
        }
        if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
          console.error(`[IMAP]   - Network issue: Cannot reach ${host}:${account.imap_port}`);
        }
        this.connections.delete(account.id);
      });

      imap.once('end', () => {
        console.log(`[IMAP] Connection ended for ${account.email_address}`);
        this.connections.delete(account.id);
      });

      console.log(`[IMAP] Initiating connection to ${host}...`);
      imap.connect();
      this.connections.set(account.id, { imap, account });
    } catch (error) {
      console.error(`[IMAP] Failed to connect ${account.email_address}:`);
      console.error(`[IMAP]   - Error: ${error.message}`);
      console.error(`[IMAP]   - Stack: ${error.stack}`);
    }
  }

  // Open inbox and watch for new messages
  openInbox(imap, account) {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error(`[IMAP] Failed to open inbox for ${account.email_address}:`, err);
        return;
      }

      console.log(`[IMAP] Watching inbox for ${account.email_address}`);

      // Listen for new emails
      imap.on('mail', (numNewMsgs) => {
        console.log(`[IMAP] ${numNewMsgs} new message(s) for ${account.email_address}`);
        this.fetchNewMessages(imap, account);
      });

      // Check for existing unread messages on startup
      this.fetchNewMessages(imap, account);
    });
  }

  // Fetch new/unread messages
  fetchNewMessages(imap, account) {
    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        console.error(`[IMAP] Search error for ${account.email_address}:`, err);
        return;
      }

      if (!results || results.length === 0) {
        return;
      }

      console.log(`[IMAP] Processing ${results.length} unread message(s) for ${account.email_address}`);

      const fetch = imap.fetch(results, {
        bodies: '',
        markSeen: true
      });

      fetch.on('message', (msg, seqno) => {
        msg.on('body', (stream, info) => {
          simpleParser(stream, async (err, parsed) => {
            if (err) {
              console.error(`[IMAP] Parse error:`, err);
              return;
            }

            await this.processMessage(parsed, account);
          });
        });
      });

      fetch.once('error', (err) => {
        console.error(`[IMAP] Fetch error:`, err);
      });
    });
  }

  // Sync inbox - fetch ALL recent messages (not just unread)
  async syncInbox(accountId, limit = 50) {
    return new Promise(async (resolve, reject) => {
      const requestId = `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[${requestId}] Starting inbox sync for account ${accountId}...`);

      try {
        // Get account details
        const { data: account, error: accountError } = await supabase
          .from('email_accounts')
          .select('*')
          .eq('id', accountId)
          .single();

        if (accountError || !account) {
          console.error(`[${requestId}] Account not found:`, accountError?.message);
          return reject(new Error('Email account not found'));
        }

        // Detailed connection logging
        console.log(`[${requestId}] Connection details for ${account.email_address}:`);
        console.log(`[${requestId}]   - Host: ${account.imap_host}`);
        console.log(`[${requestId}]   - Port: ${account.imap_port}`);
        console.log(`[${requestId}]   - Username: ${account.imap_username}`);
        console.log(`[${requestId}]   - TLS: ${account.imap_port === 993 ? 'enabled' : 'disabled'}`);

        // Decrypt password with error handling
        let decryptedPassword;
        try {
          if (!account.imap_password) {
            console.error(`[${requestId}] ✗ No IMAP password stored for ${account.email_address}`);
            return reject(new Error('No IMAP password configured'));
          }
          decryptedPassword = decrypt(account.imap_password);
          if (!decryptedPassword) {
            console.error(`[${requestId}] ✗ Password decryption returned empty`);
            return reject(new Error('Password decryption failed'));
          }
          console.log(`[${requestId}]   - Password: decrypted successfully (${decryptedPassword.length} chars)`);
        } catch (decryptError) {
          console.error(`[${requestId}] ✗ Password decryption failed:`);
          console.error(`[${requestId}]   - Error: ${decryptError.message}`);
          return reject(new Error(`Password decryption failed: ${decryptError.message}`));
        }

        // Resolve the correct IMAP host (handles Zoho regional fallback)
        const imapHost = await this.resolveImapHost(account, decryptedPassword);
        console.log(`[${requestId}]   - Resolved host: ${imapHost}`);

        const imap = new Imap({
          user: account.imap_username,
          password: decryptedPassword,
          host: imapHost,
          port: account.imap_port || 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false },
          connTimeout: 15000,
          authTimeout: 15000,
          debug: (msg) => console.log(`[${requestId} DEBUG] ${msg}`)
        });

        const messages = [];

        imap.once('ready', () => {
          console.log(`[${requestId}] ✓ Connected, opening INBOX...`);

          imap.openBox('INBOX', true, (err, box) => {
            if (err) {
              console.error(`[${requestId}] Failed to open inbox:`, err);
              imap.end();
              return reject(err);
            }

            console.log(`[${requestId}] INBOX opened. Total messages: ${box.messages.total}`);

            // Fetch the most recent messages (last N messages)
            const totalMessages = box.messages.total;
            if (totalMessages === 0) {
              console.log(`[${requestId}] No messages in inbox`);
              imap.end();
              return resolve([]);
            }

            const start = Math.max(1, totalMessages - limit + 1);
            const range = `${start}:${totalMessages}`;
            console.log(`[${requestId}] Fetching messages ${range}...`);

            // Fetch full message bodies for proper parsing with simpleParser
            const fetch = imap.seq.fetch(range, {
              bodies: '',
              struct: true
            });

            let pendingParses = 0;
            let fetchEnded = false;

            fetch.on('message', (msg, seqno) => {
              pendingParses++;

              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    console.error(`[${requestId}] Parse error for seq ${seqno}:`, err);
                    pendingParses--;
                    return;
                  }

                  const from = parsed.from?.value?.[0] || {};

                  // Use cleaner text extraction
                  const cleanText = this.extractCleanerText(parsed);
                  const body = cleanText || parsed.html || '';
                  const snippet = body.substring(0, 200).replace(/\s+/g, ' ').trim();

                  messages.push({
                    seqno,
                    from: parsed.from?.text || '',
                    fromName: from.name || '',
                    fromAddress: from.address || 'unknown',
                    subject: parsed.subject || '(No Subject)',
                    date: parsed.date?.toISOString() || new Date().toISOString(),
                    messageId: parsed.messageId,
                    snippet: snippet + (body.length > 200 ? '...' : ''),
                    // Store full body for reliable display
                    bodyHtml: parsed.html || parsed.textAsHtml || null,
                    bodyText: cleanText || null,
                    flags: null // will be set by attributes
                  });

                  pendingParses--;
                  if (fetchEnded && pendingParses === 0) {
                    await finalizeSave();
                  }
                });
              });

              msg.on('attributes', (attrs) => {
                // Store flags temporarily — will be merged after parse
                const lastMsg = messages.find(m => m.seqno === seqno);
                if (lastMsg) {
                  lastMsg.flags = attrs.flags;
                } else {
                  // Attrs arrived before parse finished, store for later merge
                  setTimeout(() => {
                    const m = messages.find(m => m.seqno === seqno);
                    if (m) m.flags = attrs.flags;
                  }, 100);
                }
              });
            });

            fetch.once('error', (err) => {
              console.error(`[${requestId}] Fetch error:`, err);
              imap.end();
              reject(err);
            });

            const finalizeSave = async () => {
              console.log(`[${requestId}] Fetched ${messages.length} messages, saving to database...`);

              // Save messages to inbox_messages table
              for (const msg of messages) {
                try {
                  await supabase.from('inbox_messages').upsert({
                    email_account_id: account.id,
                    message_id: msg.messageId || `sync-${msg.seqno}-${Date.now()}`,
                    from_name: msg.fromName,
                    from_address: (msg.fromAddress || 'unknown').toLowerCase(),
                    subject: msg.subject,
                    snippet: msg.snippet || '',
                    // Store body for reliable display - GDPR compliance maintained via
                    // 30-day auto-cleanup and 500-message-per-account limit
                    body_html: msg.bodyHtml || null,
                    body_text: msg.bodyText || null,
                    received_at: msg.date || new Date().toISOString(),
                    is_read: msg.flags?.includes('\\Seen') || false
                  }, {
                    onConflict: 'email_account_id, message_id',
                    ignoreDuplicates: false
                  });
                } catch (saveError) {
                  console.error(`[${requestId}] Error saving message:`, saveError.message);
                }
              }

              // Cleanup: enforce message limit per account
              await this.enforceMessageLimit(account.id);

              console.log(`[${requestId}] ✅ Inbox sync complete. Saved ${messages.length} messages.`);
              imap.end();
              resolve(messages);
            };

            fetch.once('end', async () => {
              fetchEnded = true;
              if (pendingParses === 0) {
                await finalizeSave();
              }
              // Otherwise, finalizeSave will be called when last parse completes
            });
          });
        });

        imap.once('error', (err) => {
          console.error(`[${requestId}] ✗ IMAP connection error for ${account.email_address}:`);
          console.error(`[${requestId}]   - Message: ${err.message}`);
          console.error(`[${requestId}]   - Error type: ${err.type || 'unknown'}`);
          console.error(`[${requestId}]   - Error source: ${err.source || 'unknown'}`);
          console.error(`[${requestId}]   - Text code: ${err.textCode || 'none'}`);
          if (err.message.includes('Invalid credentials')) {
            console.error(`[${requestId}]   - Troubleshooting tips:`);
            console.error(`[${requestId}]     1. Verify IMAP username matches email: ${account.imap_username}`);
            console.error(`[${requestId}]     2. Check if "Less secure apps" or "App password" is required`);
            console.error(`[${requestId}]     3. Verify IMAP is enabled in email provider settings`);
            console.error(`[${requestId}]     4. For Gmail: Use App Password, not account password`);
            console.error(`[${requestId}]     5. For custom domains: Check mail server auth settings`);
          }
          reject(err);
        });

        imap.once('end', () => {
          console.log(`[${requestId}] IMAP connection closed`);
        });

        imap.connect();
      } catch (error) {
        console.error(`[${requestId}] Sync error:`, error);
        reject(error);
      }
    });
  }

  // Fetch a specific email's full content from IMAP (on-demand, not stored)
  // Accepts accountId and either messageId (string) or message object (with metadata for fallback)
  // If includeAttachmentContent is true, attachment binary data is included (base64-encoded)
  async fetchEmailContent(accountId, messageOrId, includeAttachmentContent = false) {
    return new Promise(async (resolve, reject) => {
      const requestId = `FETCH-${Date.now()}`;

      // Determine if we have a simple ID or full message object
      let messageId = typeof messageOrId === 'string' ? messageOrId : messageOrId.message_id;
      const messageData = typeof messageOrId === 'object' ? messageOrId : null;

      console.log(`[${requestId}] Fetching content for message ${messageId}...`);

      try {
        // Get account details
        const { data: account, error: accountError } = await supabase
          .from('email_accounts')
          .select('*')
          .eq('id', accountId)
          .single();

        if (accountError || !account) {
          return reject(new Error('Email account not found'));
        }

        // Detailed connection logging
        console.log(`[${requestId}] Connection details for ${account.email_address}:`);
        console.log(`[${requestId}]   - Host: ${account.imap_host}:${account.imap_port}`);
        console.log(`[${requestId}]   - Username: ${account.imap_username}`);

        // Decrypt password with error handling
        let decryptedPassword;
        try {
          if (!account.imap_password) {
            console.error(`[${requestId}] ✗ No IMAP password stored`);
            return reject(new Error('No IMAP password configured'));
          }
          decryptedPassword = decrypt(account.imap_password);
          if (!decryptedPassword) {
            console.error(`[${requestId}] ✗ Password decryption returned empty`);
            return reject(new Error('Password decryption failed'));
          }
        } catch (decryptError) {
          console.error(`[${requestId}] ✗ Password decryption failed: ${decryptError.message}`);
          return reject(new Error(`Password decryption failed: ${decryptError.message}`));
        }

        // Resolve the correct IMAP host (handles Zoho regional fallback)
        const imapHost = await this.resolveImapHost(account, decryptedPassword);
        console.log(`[${requestId}]   - Resolved host: ${imapHost}`);

        const imap = new Imap({
          user: account.imap_username,
          password: decryptedPassword,
          host: imapHost,
          port: account.imap_port || 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false },
          connTimeout: 15000,
          authTimeout: 15000
        });

        imap.once('ready', () => {
          console.log(`[${requestId}] ✓ Connected to IMAP`);
          imap.openBox('INBOX', true, (err, box) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            // Strategy 1: Search by Message-ID (if valid)
            const searchByMessageId = () => {
              // Skip if messageId is a generated placeholder
              if (!messageId || messageId.startsWith('sync-')) {
                console.log(`[${requestId}] Message-ID is a placeholder, skipping ID search.`);
                return searchFallback();
              }

              console.log(`[${requestId}] Attempting search by Message-ID: ${messageId}`);

              // Try exact match first
              imap.search([['HEADER', 'MESSAGE-ID', messageId]], (err, results) => {
                if (results && results.length > 0) {
                  console.log(`[${requestId}] ✓ Found message via ID`);
                  return fetchMessage(results);
                }

                // If failed, try wrapping in brackets (some servers require it)
                if (!messageId.startsWith('<') && !messageId.endsWith('>')) {
                  const bracketId = `<${messageId}>`;
                  console.log(`[${requestId}] Retrying with brackets: ${bracketId}`);
                  imap.search([['HEADER', 'MESSAGE-ID', bracketId]], (err, results2) => {
                    if (results2 && results2.length > 0) {
                      console.log(`[${requestId}] ✓ Found message via ID (with brackets)`);
                      return fetchMessage(results2);
                    }
                    console.log(`[${requestId}] Message-ID search failed.`);
                    searchFallback();
                  });
                } else {
                  console.log(`[${requestId}] Message-ID search failed.`);
                  searchFallback();
                }
              });
            };

            // Strategy 2: Fallback Search by FROM + DATE WINDOW
            const searchFallback = () => {
              if (!messageData || !messageData.from_address || !messageData.received_at) {
                console.error(`[${requestId}] Cannot use fallback search: missing message metadata.`);
                imap.end();
                return reject(new Error('Message not found (ID search failed, metadata missing for fallback)'));
              }

              console.log(`[${requestId}] Attempting fallback search by metadata...`);
              console.log(`[${requestId}]   - From: ${messageData.from_address}`);

              const date = new Date(messageData.received_at);
              console.log(`[${requestId}]   - Received At: ${date.toISOString()}`);

              // Construct a 3-day window to handle timezone differences
              const since = new Date(date);
              since.setDate(date.getDate() - 1);

              const before = new Date(date);
              before.setDate(date.getDate() + 2);

              console.log(`[${requestId}]   - Search Window: ${since.toISOString().split('T')[0]} to ${before.toISOString().split('T')[0]}`);

              // Search criteria: FROM address + DATE WINDOW
              const criteria = [
                ['FROM', messageData.from_address],
                ['SINCE', since],
                ['BEFORE', before]
              ];

              imap.search(criteria, (err, results) => {
                if (err || !results || results.length === 0) {
                  console.log(`[${requestId}] Fallback search yielded no results.`);
                  imap.end();
                  return reject(new Error('Message not found using fallback search (no matches in date window)'));
                }

                console.log(`[${requestId}] Fallback search found ${results.length} candidate(s). filtering...`);

                // Fetch headers for candidates to find the best match (Subject)
                const fetch = imap.fetch(results, { bodies: 'HEADER.FIELDS (SUBJECT DATE)' });

                let bestMatch = null;
                let candidatesChecked = 0;
                // Store best candidate if no exact subject match found
                let bestCandidate = results[results.length - 1]; // Default to latest

                fetch.on('message', (msg, seqno) => {
                  msg.on('body', (stream) => {
                    let buffer = '';
                    stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
                    stream.on('end', () => {
                      const subjectMatch = buffer.match(/Subject: (.*)/i);
                      const subject = subjectMatch ? subjectMatch[1].trim() : '';

                      // Simple fuzzy match check
                      const storedSubject = messageData.subject || '';

                      // Normalize subjects for comparison (remove Re:, Fwd:, extra spaces)
                      const cleanSubject = (s) => s.replace(/^(Re|Fwd):\s*/i, '').trim().toLowerCase();

                      if (cleanSubject(subject).includes(cleanSubject(storedSubject)) ||
                        cleanSubject(storedSubject).includes(cleanSubject(subject))) {
                        bestMatch = seqno;
                        console.log(`[${requestId}]   ✓ Subject matched: "${subject}"`);
                      }

                      candidatesChecked++;
                      if (candidatesChecked === results.length) {
                        if (bestMatch) {
                          console.log(`[${requestId}] ✓ Matched message via subject filtering!`);
                          fetchMessage([bestMatch]);
                        } else {
                          console.warn(`[${requestId}] ⚠️ No exact subject match found. Using latest candidate as best guess.`);
                          fetchMessage([bestCandidate]);
                        }
                      }
                    });
                  });
                });

                fetch.once('error', (err) => {
                  console.error(`[${requestId}] Error fetching headers for fallback:`, err);
                  // Try blindly fetching the latest one
                  fetchMessage([bestCandidate]);
                });
              });
            };

            // Helper to fetch content given UIDs/SeqNos
            const fetchMessage = (results) => {
              const fetch = imap.fetch(results[0], { bodies: '' });
              let emailContent = null;

              fetch.on('message', (msg) => {
                msg.on('body', (stream) => {
                  simpleParser(stream, (err, parsed) => {
                    if (err) {
                      console.error(`[${requestId}] Parse error:`, err);
                      return;
                    }
                    emailContent = {
                      from_name: parsed.from?.value?.[0]?.name || '',
                      from_address: parsed.from?.value?.[0]?.address || '',
                      to: parsed.to?.text || '',
                      subject: parsed.subject || '(No Subject)',
                      body_html: parsed.html || parsed.textAsHtml || '',
                      body_text: this.extractCleanerText(parsed),
                      received_at: parsed.date?.toISOString() || new Date().toISOString(),
                      attachments: (parsed.attachments || []).map(a => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size,
                        // Include binary content only when explicitly requested (for attachment downloads)
                        ...(includeAttachmentContent && a.content ? { content: a.content.toString('base64') } : {})
                      }))
                    };
                  });
                });
              });

              fetch.once('end', () => {
                imap.end();
                if (emailContent) {
                  console.log(`[${requestId}] ✅ Fetched full email content`);
                  resolve(emailContent);
                } else {
                  reject(new Error('Failed to parse email content'));
                }
              });

              fetch.once('error', (err) => {
                imap.end();
                reject(err);
              });
            };

            // Start the process
            searchByMessageId();
          });
        });

        imap.once('error', (err) => {
          console.error(`[${requestId}] ✗ IMAP connection error:`);
          console.error(`[${requestId}]   - Message: ${err.message}`);
          console.error(`[${requestId}]   - Error type: ${err.type || 'unknown'}`);
          if (err.message.includes('Invalid credentials')) {
            console.error(`[${requestId}]   - Credentials issue detected for ${account.imap_username}`);
          }
          reject(err);
        });

        imap.connect();
      } catch (error) {
        console.error(`[${requestId}] ✗ Unexpected error: ${error.message}`);
        reject(error);
      }
    });
  }

  // Save incoming email to inbox
  async saveToInbox(message, account) {
    try {
      const from = message.from?.value?.[0] || {};

      // Use cleaner text extraction for snippet
      let simpleBody = typeof message.extractCleanerText === 'function' ?
        message.extractCleanerText(message) : // If passed the parsed object directly
        (message.text || message.html || '');

      // If message is the parsed object from simpleParser, we can use our helper
      if (message.html || message.text) {
        simpleBody = this.extractCleanerText(message);
      }

      // Create a snippet (first 100 chars)
      const snippet = simpleBody.substring(0, 100).replace(/\s+/g, ' ').trim();
      const snippetWithEllipsis = snippet + (simpleBody.length > 100 ? '...' : '');

      // Extract attachment metadata (without content, for display purposes)
      const attachmentMeta = (message.attachments || []).map(a => ({
        filename: a.filename || 'unnamed',
        contentType: a.contentType || 'application/octet-stream',
        size: a.size || 0
      }));

      await supabase.from('inbox_messages').upsert({
        email_account_id: account.id,
        message_id: message.messageId,
        from_name: from.name || '',
        from_address: from.address?.toLowerCase(),
        subject: message.subject || '(No Subject)',
        snippet: snippetWithEllipsis,
        // Store body for reliable display - GDPR compliance maintained via
        // 30-day auto-cleanup and 500-message-per-account limit
        body_html: message.html || message.textAsHtml || null,
        body_text: simpleBody || null,
        received_at: message.date || new Date().toISOString()
      }, {
        onConflict: 'email_account_id, message_id'
      });

      console.log(`[IMAP] 📥 Saved email from ${from.address} to inbox`);
    } catch (error) {
      console.error('[IMAP] Error saving to inbox:', error);
    }
  }

  // Process a received message
  async processMessage(message, account) {
    try {
      const from = message.from?.value?.[0]?.address?.toLowerCase();
      const inReplyTo = message.inReplyTo;
      const references = message.references;

      if (!from) {
        console.log('[IMAP] ⚠️  No sender address found in message, skipping');
        return;
      }

      console.log(`[IMAP] 📨 Processing message from: ${from} | Subject: "${message.subject}"`);

      // 1. SAVE TO INBOX (New - save all incoming emails)
      await this.saveToInbox(message, account);

      // 2. Check if this is a reply to a campaign email
      // We check ALL incoming messages from known contacts to catch replies even if headers are missing
      // The handleCampaignReply function will verify if the sender is in an active campaign
      await this.handleCampaignReply(message, from, account);


    } catch (error) {
      console.error('[IMAP] Error processing message:', error);
    }
  }

  // Handle reply to campaign email
  async handleCampaignReply(message, fromEmail, account) {
    try {
      // Find ALL contacts with this email address (may exist in multiple lists)
      // Using .select() without .single() to avoid errors when email exists in multiple lists
      const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .select('id, list_id')
        .eq('email', fromEmail);

      if (contactError) {
        console.error(`[IMAP]    ❌ Error querying contacts for ${fromEmail}:`, contactError);
        return;
      }

      if (!contacts || contacts.length === 0) {
        console.log(`[IMAP]    ❌ Contact not found for email: ${fromEmail}`);
        return;
      }

      const contactIds = contacts.map(c => c.id);
      console.log(`[IMAP]    🔍 Found ${contacts.length} contact(s) for ${fromEmail}: ${contactIds.join(', ')}`);

      // Find the campaign that most recently sent an email to ANY of these contacts.
      // This prevents cross-campaign contamination: a reply to Campaign A's email
      // should NOT create a "replied" event for Campaign B.
      const { data: lastSentEvent, error: sentError } = await supabase
        .from('email_events')
        .select('campaign_id, contact_id')
        .in('contact_id', contactIds)
        .eq('event_type', 'sent')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sentError) {
        console.log(`[IMAP]    ❌ No recent 'sent' event found for contacts [${contactIds.join(', ')}]. Cannot attribute reply. (${sentError.message})`);
        return;
      }

      if (!lastSentEvent) {
        console.log(`[IMAP]    ❌ No recent 'sent' event found for contacts [${contactIds.join(', ')}]. Cannot attribute reply.`);
        return;
      }

      const targetCampaignId = lastSentEvent.campaign_id;
      const targetContactId = lastSentEvent.contact_id;
      console.log(`[IMAP]    🔍 Most recent campaign sent to contact ${targetContactId}: ${targetCampaignId}`);

      // Verify this contact is still active in the campaign
      // Include 'processing' status since the executor temporarily sets this during execution
      const { data: campaignContact } = await supabase
        .from('campaign_contacts')
        .select('campaign_id, contact_id')
        .eq('contact_id', targetContactId)
        .eq('campaign_id', targetCampaignId)
        .in('status', ['in_progress', 'completed', 'processing'])
        .single();

      if (!campaignContact) {
        console.log(`[IMAP]    ❌ Contact ${targetContactId} is NOT active in campaign ${targetCampaignId}. Ignoring reply.`);
        return;
      }

      // Check subject match (optional but helpful for logging)
      const incomingSubject = this.normalizeSubject(message.subject);
      // We don't strictly reject on subject mismatch anymore, but we log it
      console.log(`[IMAP]    ✅ QUERY MATCH: Found active campaign ${targetCampaignId}. Registering reply.`);
      console.log(`[IMAP]       (Normalized Subject: "${incomingSubject}")`);

      // Log reply event only for the specific campaign the contact is replying to
      await supabase.from('email_events').insert({
        campaign_id: targetCampaignId,
        contact_id: targetContactId,
        event_type: 'replied',
        event_data: {
          from: fromEmail,
          subject: message.subject,
          timestamp: new Date().toISOString()
        }
      });

      // Mark campaign contact as replied - stops all future follow-ups in this campaign
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'replied',
          replied_at: new Date().toISOString()
        })
        .eq('campaign_id', targetCampaignId)
        .eq('contact_id', targetContactId);

      console.log(`[IMAP] ✓ Logged reply from ${fromEmail} for campaign ${targetCampaignId} (subject: "${message.subject}")`);
    } catch (error) {
      console.error('[IMAP] Error handling campaign reply:', error);
    }
  }


  // Stop monitoring a specific account
  stopMonitoring(accountId) {
    const connection = this.connections.get(accountId);
    if (connection) {
      connection.imap.end();
      this.connections.delete(accountId);
      console.log(`[IMAP] Stopped monitoring account ${accountId}`);
    }
  }

  // Stop all monitoring
  stopAll() {
    console.log('[IMAP] Stopping all IMAP monitoring...');
    for (const [accountId, connection] of this.connections) {
      connection.imap.end();
    }
    this.connections.clear();
    this.monitoring = false;
  }
}

module.exports = new ImapMonitor();
