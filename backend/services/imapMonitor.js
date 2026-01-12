const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');

class ImapMonitor {
  constructor() {
    this.connections = new Map();
    this.monitoring = false;
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

      // Check if this is a reply to a campaign email
      const isReply = inReplyTo || (references && references.length > 0);

      if (isReply) {
        await this.handleCampaignReply(message, from, account);
      }

      // Check if this is a warm-up seed reply
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
