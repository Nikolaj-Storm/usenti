const nodemailer = require('nodemailer');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');

/**
 * Warm-up Engine
 *
 * This service gradually increases email sending volume to warm up new email accounts
 * and maintain reputation for existing ones. It simulates real conversations by:
 * 1. Sending emails to seed addresses (other accounts in warm-up network)
 * 2. Replying to received warm-up emails
 * 3. Gradually ramping up daily volume
 * 4. Tracking inbox placement and engagement
 */

class WarmupEngine {
  constructor() {
    this.isRunning = false;
    this.subjects = [
      'Quick question about your services',
      'Following up on our conversation',
      'Thoughts on collaboration',
      'Checking in',
      'Quick update',
      'Monday catch-up',
      'Project status',
      'Weekend plans?',
      'Regarding next steps',
      'Quick sync needed'
    ];

    this.bodies = [
      'Hi there,\n\nHope you\'re doing well! Just wanted to touch base and see if you had a chance to review my previous message.\n\nLet me know if you have any questions.\n\nBest regards',
      'Hello,\n\nI hope this email finds you well. I wanted to follow up on our last conversation.\n\nLooking forward to hearing from you.\n\nCheers',
      'Hey,\n\nJust checking in to see how things are going on your end. Do you have some time this week for a quick call?\n\nThanks!',
      'Hi,\n\nI hope you had a great weekend! I wanted to reach out about the project we discussed.\n\nLet me know your thoughts.\n\nBest',
      'Hello,\n\nThanks for your time last week. I\'ve been thinking about what we discussed and wanted to share some ideas.\n\nTalk soon!',
      'Hi there,\n\nHope all is well with you. Just wanted to send a quick update on our progress.\n\nLet\'s catch up soon.\n\nRegards',
      'Hey,\n\nI hope this message finds you in good spirits. I have some updates I\'d love to share with you.\n\nBest wishes',
      'Hello,\n\nI wanted to reach out and see if you\'re available for a brief chat this week.\n\nLooking forward to connecting.\n\nThanks'
    ];
  }

  /**
   * Main execution method - called by cron job
   */
  async execute() {
    if (this.isRunning) {
      console.log('[WARMUP] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('[WARMUP] Starting warm-up cycle...');

    try {
      // Get all active warmup configurations
      const { data: configs, error } = await supabase
        .from('warmup_configs')
        .select(`
          *,
          email_accounts!inner(*)
        `)
        .eq('is_active', true)
        .eq('email_accounts.is_active', true);

      if (error) throw error;

      if (!configs || configs.length === 0) {
        console.log('[WARMUP] No active warm-up configs found');
        this.isRunning = false;
        return;
      }

      console.log(`[WARMUP] Processing ${configs.length} warm-up account(s)`);

      for (const config of configs) {
        try {
          await this.processAccount(config);
        } catch (err) {
          console.error(`[WARMUP] Error processing account ${config.email_account_id}:`, err.message);
        }
      }

      console.log('[WARMUP] Warm-up cycle complete');
    } catch (error) {
      console.error('[WARMUP] Execution error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process warm-up for a single email account
   */
  async processAccount(config) {
    const account = config.email_accounts;
    console.log(`[WARMUP] Processing ${account.email_address}`);

    // Calculate how many emails to send today
    const dailyTarget = Math.min(
      config.current_daily_volume,
      config.daily_warmup_volume
    );

    // Check how many warmup emails sent today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: sentToday } = await supabase
      .from('warmup_messages')
      .select('*', { count: 'exact', head: true })
      .eq('email_account_id', account.id)
      .eq('direction', 'sent')
      .gte('created_at', today.toISOString());

    const remaining = dailyTarget - (sentToday || 0);

    if (remaining <= 0) {
      console.log(`[WARMUP] Daily limit reached for ${account.email_address} (${sentToday}/${dailyTarget})`);

      // Check if we should ramp up tomorrow
      if (config.current_daily_volume < config.daily_warmup_volume) {
        await this.rampUpVolume(config);
      }

      return;
    }

    console.log(`[WARMUP] Sending ${Math.min(remaining, 5)} warm-up emails for ${account.email_address}`);

    // Send a few emails at a time (max 5 per hour)
    const toSend = Math.min(remaining, 5);

    for (let i = 0; i < toSend; i++) {
      try {
        await this.sendWarmupEmail(account, config);
        // Wait 1-3 minutes between sends to appear more natural
        if (i < toSend - 1) {
          await this.delay(60000 + Math.random() * 120000);
        }
      } catch (err) {
        console.error(`[WARMUP] Failed to send warm-up email:`, err.message);
      }
    }

    // Process any pending replies
    await this.checkForReplies(account, config);
  }

  /**
   * Send a warm-up email to a random seed address
   */
  async sendWarmupEmail(account, config) {
    // Get a random active seed address
    const { data: seeds } = await supabase
      .from('warmup_seeds')
      .select('*')
      .eq('is_active', true)
      .limit(10);

    if (!seeds || seeds.length === 0) {
      throw new Error('No warm-up seed addresses available');
    }

    const seed = seeds[Math.floor(Math.random() * seeds.length)];

    // Check if we have an active thread with this seed
    let thread = null;
    const { data: existingThreads } = await supabase
      .from('warmup_threads')
      .select('*')
      .eq('email_account_id', account.id)
      .eq('seed_address_id', seed.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingThreads && existingThreads.length > 0) {
      thread = existingThreads[0];
    } else {
      // Create new thread
      const { data: newThread } = await supabase
        .from('warmup_threads')
        .insert({
          email_account_id: account.id,
          seed_address_id: seed.id,
          status: 'active',
          reply_count: 0,
          target_replies: config.replies_per_thread
        })
        .select()
        .single();

      thread = newThread;
    }

    // Create email transporter
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

    // Generate random subject and body
    const subject = this.subjects[Math.floor(Math.random() * this.subjects.length)];
    const body = this.bodies[Math.floor(Math.random() * this.bodies.length)];

    // Send email
    const info = await transporter.sendMail({
      from: account.email_address,
      to: seed.email_address,
      subject: subject,
      text: body,
      headers: {
        'X-Warmup-Thread': thread.id,
        'X-Warmup-Account': account.id
      }
    });

    // Log the message
    await supabase.from('warmup_messages').insert({
      warmup_thread_id: thread.id,
      email_account_id: account.id,
      direction: 'sent',
      subject: subject,
      from_address: account.email_address,
      to_address: seed.email_address,
      message_id: info.messageId
    });

    console.log(`[WARMUP] ✓ Sent warm-up email from ${account.email_address} to ${seed.email_address}`);

    // Update thread
    await supabase
      .from('warmup_threads')
      .update({
        reply_count: thread.reply_count + 1,
        last_reply_at: new Date().toISOString(),
        status: thread.reply_count + 1 >= thread.target_replies ? 'completed' : 'active'
      })
      .eq('id', thread.id);
  }

  /**
   * Check for replies and respond to them
   */
  async checkForReplies(account, config) {
    // Get recent warm-up threads that need replies
    const { data: threads } = await supabase
      .from('warmup_threads')
      .select(`
        *,
        warmup_messages!inner(*)
      `)
      .eq('email_account_id', account.id)
      .eq('status', 'active')
      .eq('warmup_messages.direction', 'received')
      .order('warmup_messages.created_at', { ascending: false })
      .limit(5);

    if (!threads || threads.length === 0) {
      return;
    }

    console.log(`[WARMUP] Found ${threads.length} threads needing replies`);

    // Reply to a few threads
    for (const thread of threads.slice(0, 2)) {
      try {
        // Get the seed address
        const { data: seed } = await supabase
          .from('warmup_seeds')
          .select('*')
          .eq('id', thread.seed_address_id)
          .single();

        if (!seed) continue;

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

        // Generate reply
        const replyBodies = [
          'Thanks for getting back to me! That sounds great.',
          'I appreciate your response. Let\'s definitely stay in touch.',
          'Great to hear from you! I\'ll send over more details soon.',
          'Thanks! I\'ll get back to you with more information.',
          'Perfect, looking forward to it!'
        ];

        const body = replyBodies[Math.floor(Math.random() * replyBodies.length)];

        // Send reply
        const info = await transporter.sendMail({
          from: account.email_address,
          to: seed.email_address,
          subject: `Re: ${thread.warmup_messages[0]?.subject || 'Follow up'}`,
          text: body,
          inReplyTo: thread.warmup_messages[0]?.message_id,
          headers: {
            'X-Warmup-Thread': thread.id,
            'X-Warmup-Account': account.id
          }
        });

        // Log the reply
        await supabase.from('warmup_messages').insert({
          warmup_thread_id: thread.id,
          email_account_id: account.id,
          direction: 'sent',
          subject: `Re: ${thread.warmup_messages[0]?.subject || 'Follow up'}`,
          from_address: account.email_address,
          to_address: seed.email_address,
          message_id: info.messageId
        });

        console.log(`[WARMUP] ✓ Replied to warm-up email in thread ${thread.id}`);

        // Update thread
        const newReplyCount = thread.reply_count + 1;
        await supabase
          .from('warmup_threads')
          .update({
            reply_count: newReplyCount,
            last_reply_at: new Date().toISOString(),
            status: newReplyCount >= thread.target_replies ? 'completed' : 'active'
          })
          .eq('id', thread.id);

      } catch (err) {
        console.error(`[WARMUP] Failed to reply to thread ${thread.id}:`, err.message);
      }
    }
  }

  /**
   * Gradually increase daily send volume
   */
  async rampUpVolume(config) {
    const newVolume = Math.min(
      config.current_daily_volume + config.rampup_increment,
      config.daily_warmup_volume
    );

    if (newVolume > config.current_daily_volume) {
      await supabase
        .from('warmup_configs')
        .update({ current_daily_volume: newVolume })
        .eq('id', config.id);

      console.log(`[WARMUP] Ramped up volume for account ${config.email_account_id}: ${config.current_daily_volume} → ${newVolume}`);

      // Update account warmup stage
      const stage = Math.floor((newVolume / config.daily_warmup_volume) * 100);
      await supabase
        .from('email_accounts')
        .update({ warmup_stage: stage })
        .eq('id', config.email_account_id);
    }
  }

  /**
   * Utility function to delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get random element from array
   */
  randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
}

module.exports = new WarmupEngine();
