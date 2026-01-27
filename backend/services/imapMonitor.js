const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');

class ImapMonitor {
  constructor() {
    this.connections = new Map();
    this.monitoring = false;
    // Storage limits
    this.maxMessagesPerAccount = 500;
    this.maxAgeDays = 30;
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
    try {
      // Skip if already monitoring
      if (this.connections.has(account.id)) {
        return;
      }

      const imap = new Imap({
        user: account.imap_username,
        password: decrypt(account.imap_password),
        host: account.imap_host,
        port: account.imap_port,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true
      });

      imap.once('ready', () => {
        console.log(`[IMAP] ✓ Connected to ${account.email_address}`);
        this.openInbox(imap, account);
      });

      imap.once('error', (err) => {
        console.error(`[IMAP] ✗ Error for ${account.email_address}:`, err.message);
        this.connections.delete(account.id);
      });

      imap.once('end', () => {
        console.log(`[IMAP] Connection ended for ${account.email_address}`);
        this.connections.delete(account.id);
      });

      imap.connect();
      this.connections.set(account.id, { imap, account });
    } catch (error) {
      console.error(`[IMAP] Failed to connect ${account.email_address}:`, error);
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

        console.log(`[${requestId}] Connecting to ${account.imap_host}:${account.imap_port}...`);

        const imap = new Imap({
          user: account.imap_username,
          password: decrypt(account.imap_password),
          host: account.imap_host,
          port: account.imap_port,
          tls: account.imap_port === 993,
          tlsOptions: { rejectUnauthorized: false }
        });

        const messages = [];

        imap.once('ready', () => {
          console.log(`[${requestId}] Connected, opening INBOX...`);

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

            const fetch = imap.seq.fetch(range, {
              bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)', 'TEXT'],
              struct: true
            });

            fetch.on('message', (msg, seqno) => {
              const msgData = { seqno };

              msg.on('body', (stream, info) => {
                let buffer = '';
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                stream.on('end', () => {
                  if (info.which.includes('HEADER')) {
                    // Parse headers
                    const lines = buffer.split('\r\n');
                    lines.forEach(line => {
                      const [key, ...valueParts] = line.split(':');
                      if (key && valueParts.length) {
                        const value = valueParts.join(':').trim();
                        const keyLower = key.toLowerCase();
                        if (keyLower === 'from') msgData.from = value;
                        if (keyLower === 'to') msgData.to = value;
                        if (keyLower === 'subject') msgData.subject = value;
                        if (keyLower === 'date') msgData.date = value;
                        if (keyLower === 'message-id') msgData.messageId = value;
                      }
                    });
                  } else {
                    // Body text
                    msgData.snippet = buffer.substring(0, 200).replace(/\s+/g, ' ').trim();
                  }
                });
              });

              msg.on('attributes', (attrs) => {
                msgData.flags = attrs.flags;
                msgData.uid = attrs.uid;
              });

              msg.once('end', () => {
                messages.push(msgData);
              });
            });

            fetch.once('error', (err) => {
              console.error(`[${requestId}] Fetch error:`, err);
              imap.end();
              reject(err);
            });

            fetch.once('end', async () => {
              console.log(`[${requestId}] Fetched ${messages.length} messages, saving to database...`);

              // Save messages to inbox_messages table
              for (const msg of messages) {
                try {
                  // Parse from address
                  const fromMatch = msg.from?.match(/<([^>]+)>/) || [null, msg.from];
                  const fromAddress = fromMatch[1] || msg.from || 'unknown';
                  const fromName = msg.from?.replace(/<[^>]+>/, '').trim() || '';

                  await supabase.from('inbox_messages').upsert({
                    email_account_id: account.id,
                    message_id: msg.messageId || `sync-${msg.uid}-${Date.now()}`,
                    from_name: fromName,
                    from_address: fromAddress.toLowerCase(),
                    subject: msg.subject || '(No Subject)',
                    snippet: msg.snippet || '',
                    received_at: msg.date ? new Date(msg.date).toISOString() : new Date().toISOString(),
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
            });
          });
        });

        imap.once('error', (err) => {
          console.error(`[${requestId}] IMAP connection error:`, err);
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
  async fetchEmailContent(accountId, messageId) {
    return new Promise(async (resolve, reject) => {
      const requestId = `FETCH-${Date.now()}`;
      console.log(`[${requestId}] Fetching full content for message ${messageId}...`);

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

        const imap = new Imap({
          user: account.imap_username,
          password: decrypt(account.imap_password),
          host: account.imap_host,
          port: account.imap_port,
          tls: account.imap_port === 993,
          tlsOptions: { rejectUnauthorized: false }
        });

        imap.once('ready', () => {
          imap.openBox('INBOX', true, (err, box) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            // Search for the message by Message-ID header
            imap.search([['HEADER', 'MESSAGE-ID', messageId]], (err, results) => {
              if (err || !results || results.length === 0) {
                imap.end();
                return reject(new Error('Message not found on server'));
              }

              const fetch = imap.fetch(results, { bodies: '' });
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
                      body_html: parsed.html || '',
                      body_text: parsed.text || '',
                      received_at: parsed.date?.toISOString() || new Date().toISOString(),
                      attachments: (parsed.attachments || []).map(a => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size
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
            });
          });
        });

        imap.once('error', (err) => {
          reject(err);
        });

        imap.connect();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Save incoming email to inbox
  async saveToInbox(message, account) {
    try {
      const from = message.from?.value?.[0] || {};
      const simpleBody = message.text || message.html || '';

      // Create a snippet (first 100 chars)
      const snippet = simpleBody.substring(0, 100).replace(/\s+/g, ' ').trim();
      const snippetWithEllipsis = snippet + (simpleBody.length > 100 ? '...' : '');

      await supabase.from('inbox_messages').upsert({
        email_account_id: account.id,
        message_id: message.messageId,
        from_name: from.name || '',
        from_address: from.address?.toLowerCase(),
        subject: message.subject || '(No Subject)',
        snippet: snippetWithEllipsis,
        body_html: message.html,
        body_text: message.text,
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
        console.log('[IMAP] No sender address, skipping');
        return;
      }

      console.log(`[IMAP] Processing message from ${from}`);

      // 1. SAVE TO INBOX (New - save all incoming emails)
      await this.saveToInbox(message, account);

      // 2. Check if this is a reply to a campaign email
      const isReply = inReplyTo || (references && references.length > 0);

      if (isReply) {
        await this.handleCampaignReply(message, from, account);
      }

      // 3. Check if this is a warm-up seed reply
      await this.handleWarmupReply(message, from, account);

    } catch (error) {
      console.error('[IMAP] Error processing message:', error);
    }
  }

  // Handle reply to campaign email
  async handleCampaignReply(message, fromEmail, account) {
    try {
      // Find the contact who sent this reply
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, list_id')
        .eq('email', fromEmail)
        .single();

      if (!contact) {
        console.log(`[IMAP] No contact found for ${fromEmail}`);
        return;
      }

      // Find active campaigns for this contact
      const { data: campaignContacts } = await supabase
        .from('campaign_contacts')
        .select('campaign_id, contact_id')
        .eq('contact_id', contact.id)
        .in('status', ['in_progress', 'completed']);

      if (!campaignContacts || campaignContacts.length === 0) {
        return;
      }

      // Log reply event for each active campaign
      for (const cc of campaignContacts) {
        await supabase.from('email_events').insert({
          campaign_id: cc.campaign_id,
          contact_id: contact.id,
          event_type: 'replied',
          event_data: {
            from: fromEmail,
            subject: message.subject,
            timestamp: new Date().toISOString()
          }
        });

        // Mark campaign contact as replied
        await supabase
          .from('campaign_contacts')
          .update({ 
            status: 'replied',
            replied_at: new Date().toISOString()
          })
          .eq('campaign_id', cc.campaign_id)
          .eq('contact_id', contact.id);

        console.log(`[IMAP] ✓ Logged reply from ${fromEmail} for campaign ${cc.campaign_id}`);
      }
    } catch (error) {
      console.error('[IMAP] Error handling campaign reply:', error);
    }
  }

  // Handle reply to warm-up email
  async handleWarmupReply(message, fromEmail, account) {
    try {
      // Find warmup thread with this seed address
      const { data: thread } = await supabase
        .from('warmup_threads')
        .select(`
          id,
          reply_count,
          target_replies,
          warmup_seeds!inner(email_address)
        `)
        .eq('email_account_id', account.id)
        .eq('warmup_seeds.email_address', fromEmail)
        .eq('status', 'active')
        .single();

      if (!thread) {
        return;
      }

      // Update thread reply count
      const newReplyCount = thread.reply_count + 1;
      const isComplete = newReplyCount >= thread.target_replies;

      await supabase
        .from('warmup_threads')
        .update({
          reply_count: newReplyCount,
          status: isComplete ? 'completed' : 'active',
          last_reply_at: new Date().toISOString()
        })
        .eq('id', thread.id);

      // Log warmup message
      await supabase.from('warmup_messages').insert({
        warmup_thread_id: thread.id,
        email_account_id: account.id,
        direction: 'received',
        subject: message.subject,
        from_address: fromEmail,
        to_address: account.email_address
      });

      console.log(`[IMAP] ✓ Logged warmup reply ${newReplyCount}/${thread.target_replies} from ${fromEmail}`);

      // If thread is complete, we're done
      if (isComplete) {
        console.log(`[IMAP] ✓ Warmup thread completed for ${fromEmail}`);
      }
    } catch (error) {
      console.error('[IMAP] Error handling warmup reply:', error);
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
