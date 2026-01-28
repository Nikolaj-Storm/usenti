const nodemailer = require('nodemailer');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');
const crypto = require('crypto');
const gmailService = require('./gmailService');
const microsoftService = require('./microsoftService');

// Helper to extract domain from email address
const getEmailDomain = (email) => {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1] : 'localhost';
};

// Helper to convert HTML to plain text for multipart emails
const htmlToPlainText = (html) => {
  if (!html) return '';
  return html
    // Remove style and script tags and their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Convert line breaks and paragraphs to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Convert links to text with URL
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

// Zoho SMTP hosts for different data centers
const ZOHO_SMTP_HOSTS = [
  'smtp.zoho.com',      // US
  'smtp.zoho.eu',       // EU
  'smtp.zoho.in',       // India
  'smtp.zoho.com.au',   // Australia
  'smtp.zoho.com.cn'    // China
];

class EmailService {
  constructor() {
    this.transporters = new Map();
    this.zohoHostCache = new Map(); // Cache working Zoho hosts per account
  }

  // Check if a host is a Zoho SMTP host
  isZohoHost(host) {
    return host?.toLowerCase().includes('zoho');
  }

  // Create a transporter config for a given host
  createTransporterConfig(host, port, isSecure, username, password, isZoho) {
    const config = {
      host,
      port,
      secure: isSecure,
      auth: {
        user: username,
        pass: password
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    };

    if (isZoho) {
      config.authMethod = 'LOGIN';
    }

    return config;
  }

  // Try to verify a transporter connection
  async tryTransporter(config) {
    const transporter = nodemailer.createTransport(config);
    await transporter.verify();
    return transporter;
  }

  // Get or create transporter for email account
  async getTransporter(emailAccountId) {
    console.log(`[EMAIL] 🔌 Getting transporter for account ${emailAccountId}...`);

    if (this.transporters.has(emailAccountId)) {
      console.log(`[EMAIL]    ✅ Using cached transporter`);
      return this.transporters.get(emailAccountId);
    }

    console.log(`[EMAIL]    🔍 Fetching email account from database...`);
    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .single();

    if (error || !account) {
      console.error(`[EMAIL]    ❌ Email account not found: ${error?.message}`);
      throw new Error('Email account not found');
    }

    // Ensure port is a number for proper comparison and nodemailer
    const smtpPort = parseInt(account.smtp_port, 10) || 587;
    const isSecure = smtpPort === 465;

    console.log(`[EMAIL]    📧 Account: ${account.email_address}`);
    console.log(`[EMAIL]    🌐 SMTP Host: ${account.smtp_host}:${smtpPort}`);
    console.log(`[EMAIL]    👤 SMTP User: ${account.smtp_username}`);
    console.log(`[EMAIL]    🔒 Secure: ${isSecure ? 'YES (SSL)' : 'NO (TLS/STARTTLS)'}`);

    // Decrypt the password and log debug info (without exposing the actual password)
    console.log(`[EMAIL]    🔐 Decrypting SMTP password...`);
    console.log(`[EMAIL]       Encrypted password length: ${account.smtp_password?.length || 0}`);
    console.log(`[EMAIL]       Encrypted password format check: ${account.smtp_password?.includes(':') ? 'Valid (contains separator)' : 'INVALID (no separator)'}`);

    let decryptedPassword;
    try {
      decryptedPassword = decrypt(account.smtp_password);
      console.log(`[EMAIL]       Decrypted password length: ${decryptedPassword?.length || 0}`);
      console.log(`[EMAIL]       Decryption: ✅ SUCCESS`);
    } catch (decryptError) {
      console.error(`[EMAIL]       Decryption: ❌ FAILED - ${decryptError.message}`);
      throw new Error(`Password decryption failed: ${decryptError.message}`);
    }

    const isZoho = this.isZohoHost(account.smtp_host) || account.account_type === 'zoho';

    if (isZoho) {
      console.log(`[EMAIL]    📧 Detected Zoho account - will try multiple data centers if needed`);
    }

    console.log(`[EMAIL]    🔧 Creating SMTP transporter...`);

    // For Zoho accounts, try multiple data centers
    if (isZoho) {
      // Check if we have a cached working host for this account
      const cachedHost = this.zohoHostCache.get(emailAccountId);

      // Build list of hosts to try - cached host first, then configured, then all others
      const hostsToTry = [];
      if (cachedHost) {
        hostsToTry.push(cachedHost);
      }
      if (account.smtp_host && !hostsToTry.includes(account.smtp_host)) {
        hostsToTry.push(account.smtp_host);
      }
      for (const host of ZOHO_SMTP_HOSTS) {
        if (!hostsToTry.includes(host)) {
          hostsToTry.push(host);
        }
      }

      console.log(`[EMAIL]    🌐 Will try Zoho hosts in order: ${hostsToTry.join(', ')}`);

      let lastError;
      for (const host of hostsToTry) {
        console.log(`[EMAIL]    🔄 Trying Zoho host: ${host}...`);
        const config = this.createTransporterConfig(
          host, smtpPort, isSecure,
          account.smtp_username, decryptedPassword, true
        );

        try {
          const transporter = await this.tryTransporter(config);
          console.log(`[EMAIL]    ✅ Connected successfully to ${host}`);

          // Cache this working host for future use
          this.zohoHostCache.set(emailAccountId, host);
          this.transporters.set(emailAccountId, transporter);

          // Update the account's SMTP host in the database if it changed
          if (host !== account.smtp_host) {
            console.log(`[EMAIL]    📝 Updating account SMTP host to ${host}`);
            await supabase
              .from('email_accounts')
              .update({ smtp_host: host })
              .eq('id', emailAccountId);
          }

          return transporter;
        } catch (err) {
          console.log(`[EMAIL]    ❌ Failed with ${host}: ${err.message} (code: ${err.code})`);
          lastError = err;
          // Continue to next host
        }
      }

      // All hosts failed
      console.error(`[EMAIL]    ❌ All Zoho SMTP hosts failed`);
      throw lastError || new Error('Failed to connect to any Zoho SMTP server');
    }

    // Non-Zoho accounts: standard single-host connection
    const transporterConfig = this.createTransporterConfig(
      account.smtp_host, smtpPort, isSecure,
      account.smtp_username, decryptedPassword, false
    );

    console.log(`[EMAIL]    🔧 Transport config: host=${transporterConfig.host}, port=${transporterConfig.port}, secure=${transporterConfig.secure}`);

    const transporter = nodemailer.createTransport(transporterConfig);

    console.log(`[EMAIL]    ✅ Transporter created and cached`);
    this.transporters.set(emailAccountId, transporter);
    return transporter;
  }

  // Personalize email content with variables
  personalizeContent(template, contact, customVars = {}) {
    let personalized = template;
    
    const variables = {
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      company: contact.company || '',
      ...contact.custom_fields,
      ...customVars
    };

    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      personalized = personalized.replace(regex, variables[key]);
    });

    return personalized;
  }

  // Add tracking pixel to email body - improved for deliverability
  // Uses natural-looking image attributes and embeds within content
  addTrackingPixel(htmlBody, campaignId, contactId) {
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Use a more natural-looking tracking URL that mimics a spacer/logo image
    // The path looks like a standard image asset, not a tracking endpoint
    const trackingUrl = `${baseUrl}/img/e/${campaignId.slice(0, 8)}/${contactId.slice(0, 8)}/${trackingToken.slice(0, 12)}.gif`;

    // Use natural CSS properties instead of suspicious display:none or 1x1
    // A transparent spacer that doesn't trigger spam filters
    const trackingPixel = `<img src="${trackingUrl}" alt="" width="1" height="1" border="0" style="height:1px!important;width:1px!important;border-width:0!important;margin:0!important;padding:0!important" />`;

    // Try to insert the pixel before the closing body tag or at the end
    if (htmlBody.includes('</body>')) {
      return htmlBody.replace('</body>', `${trackingPixel}</body>`);
    }

    return htmlBody + trackingPixel;
  }

  // Rewrite links for click tracking
  rewriteLinksForTracking(htmlBody, campaignId, contactId) {
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const baseUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/track/click/${campaignId}/${contactId}/${trackingToken}`;
    
    return htmlBody.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (match, url) => `href="${baseUrl}?url=${encodeURIComponent(url)}"`
    );
  }

  // Send a single email
  async sendEmail({
    emailAccountId,
    to,
    subject,
    body,
    campaignId,
    contactId,
    trackOpens = true,
    trackClicks = true
  }) {
    console.log(`[EMAIL] 📨 Preparing to send email...`);
    console.log(`[EMAIL]    To: ${to}`);
    console.log(`[EMAIL]    Subject: "${subject}"`);
    console.log(`[EMAIL]    Campaign ID: ${campaignId}`);
    console.log(`[EMAIL]    Contact ID: ${contactId}`);

    try {
      // Get account to check provider type and sender name
      console.log(`[EMAIL] 🔍 Getting email account to determine provider type...`);
      const { data: account, error: accountError } = await supabase
        .from('email_accounts')
        .select('provider_type, email_address, sender_name')
        .eq('id', emailAccountId)
        .single();

      if (accountError || !account) {
        throw new Error('Email account not found');
      }

      const providerType = account.provider_type || 'smtp';
      console.log(`[EMAIL]    Provider type: ${providerType}`);
      console.log(`[EMAIL]    From: ${account.email_address}`);
      console.log(`[EMAIL]    Sender name: ${account.sender_name || '(not set)'}`);

      let finalBody = body;

      // Add tracking
      if (trackOpens) {
        console.log(`[EMAIL] 🔍 Adding open tracking pixel...`);
        finalBody = this.addTrackingPixel(finalBody, campaignId, contactId);
      }
      if (trackClicks) {
        console.log(`[EMAIL] 🔗 Adding click tracking to links...`);
        finalBody = this.rewriteLinksForTracking(finalBody, campaignId, contactId);
      }

      let result;

      // Route to appropriate sending method based on provider type
      if (providerType === 'gmail_oauth') {
        console.log(`[EMAIL] 🔀 Routing to Gmail API...`);
        result = await gmailService.sendEmail({
          emailAccountId,
          to,
          subject,
          body: finalBody
        });
      } else if (providerType === 'microsoft_oauth') {
        console.log(`[EMAIL] 🔀 Routing to Microsoft Graph API...`);
        result = await microsoftService.sendEmail({
          emailAccountId,
          to,
          subject,
          body: finalBody
        });
      } else {
        // Use traditional SMTP for smtp, smtp_direct, smtp_relay
        console.log(`[EMAIL] 🔀 Routing to SMTP...`);
        console.log(`[EMAIL] 🔌 Getting SMTP transporter...`);
        const transporter = await this.getTransporter(emailAccountId);

        console.log(`[EMAIL] 📤 Sending via SMTP with deliverability optimizations...`);
        console.log(`[EMAIL]    Body length: ${finalBody.length} characters`);

        // Build the From address with display name if available
        // Format: "Display Name <email@domain.com>" or just "email@domain.com"
        const fromAddress = account.sender_name
          ? `"${account.sender_name}" <${account.email_address}>`
          : account.email_address;

        // Get domain for Message-ID and unsubscribe URL
        const domain = getEmailDomain(account.email_address);
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // Generate a proper Message-ID with the sending domain
        const messageIdLocal = crypto.randomBytes(16).toString('hex');
        const messageId = `<${messageIdLocal}.${Date.now()}@${domain}>`;

        // Build unsubscribe URL
        const unsubscribeToken = crypto.randomBytes(16).toString('hex');
        const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${campaignId}/${contactId}/${unsubscribeToken}`;

        // Convert HTML to plain text for multipart email
        const plainTextBody = htmlToPlainText(finalBody);

        // Build mail options with deliverability optimizations
        const mailOptions = {
          from: fromAddress,
          to,
          subject,
          // Multipart: both plain text and HTML
          // Many spam filters prefer emails that have both versions
          text: plainTextBody,
          html: finalBody,
          // Proper Message-ID with sending domain
          messageId: messageId,
          // Headers for better deliverability
          headers: {
            // List-Unsubscribe header - required by Gmail/Yahoo for bulk mail
            'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@${domain}?subject=Unsubscribe-${campaignId}>`,
            // One-click unsubscribe for modern email clients (RFC 8058)
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            // Precedence header to indicate bulk mail
            'Precedence': 'bulk',
            // X-Mailer header (looks more legitimate than default nodemailer)
            'X-Mailer': 'SnowmanMailer/2.0',
            // Auto-submitted header to indicate automated message
            'Auto-Submitted': 'auto-generated'
          },
          // Reply-To same as From for proper reply routing
          replyTo: account.email_address
        };

        console.log(`[EMAIL] 🚀 Calling transporter.sendMail()...`);
        console.log(`[EMAIL]    From: ${fromAddress}`);
        console.log(`[EMAIL]    Message-ID: ${messageId}`);
        console.log(`[EMAIL]    Has plain text: ${plainTextBody.length > 0}`);
        console.log(`[EMAIL]    List-Unsubscribe: enabled`);

        const info = await transporter.sendMail(mailOptions);

        console.log(`[EMAIL] ✅ Email sent successfully via SMTP!`);
        console.log(`[EMAIL]    Message ID: ${info.messageId}`);
        console.log(`[EMAIL]    Response: ${info.response}`);

        result = {
          success: true,
          messageId: info.messageId
        };
      }

      // Log sent event
      console.log(`[EMAIL] 💾 Logging 'sent' event to database...`);
      await supabase.from('email_events').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        event_type: 'sent',
        event_data: {
          message_id: result.messageId,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`[EMAIL] ✅ Event logged successfully`);

      return result;
    } catch (error) {
      console.error(`[EMAIL] ❌ Email send error!`);
      console.error(`[EMAIL]    Error type: ${error.constructor.name}`);
      console.error(`[EMAIL]    Error message: ${error.message}`);
      console.error(`[EMAIL]    Error code: ${error.code}`);
      console.error(`[EMAIL]    Error command: ${error.command}`);
      console.error(`[EMAIL]    Full error:`, error);

      // Clear cached transporter on authentication errors to allow retry with fresh credentials
      if (error.code === 'EAUTH' || error.responseCode === 535) {
        console.log(`[EMAIL] 🔄 Clearing cached transporter due to auth error...`);
        this.clearTransporter(emailAccountId);
      }

      // Log failed event
      console.log(`[EMAIL] 💾 Logging 'failed' event to database...`);
      await supabase.from('email_events').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        event_type: 'failed',
        event_data: {
          error: error.message,
          error_code: error.code,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  // Check if within sending schedule (uses UTC time for consistency)
  isWithinSchedule(schedule) {
    if (!schedule || !schedule.days || schedule.start_hour === undefined || schedule.end_hour === undefined) {
      return true; // No schedule = always send
    }

    // Check for 24/7 schedule (all days, 0-24 hours)
    const allDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const is24_7 = schedule.days.length === 7 && schedule.start_hour === 0 && schedule.end_hour === 24;
    if (is24_7) {
      console.log(`[SCHEDULE] 24/7 schedule detected - always within schedule`);
      return true;
    }

    const now = new Date();
    // Use UTC to ensure consistent behavior regardless of server timezone
    const dayOfWeek = allDays[now.getUTCDay()];
    const hour = now.getUTCHours();

    const dayAllowed = schedule.days.includes(dayOfWeek);
    // Handle end_hour of 24 (means up to midnight)
    const endHour = schedule.end_hour === 24 ? 24 : schedule.end_hour;
    const hourAllowed = hour >= schedule.start_hour && hour < endHour;

    console.log(`[SCHEDULE] Checking schedule - UTC Day: ${dayOfWeek}, UTC Hour: ${hour}, Days allowed: ${schedule.days.join(',')}, Hours: ${schedule.start_hour}-${schedule.end_hour}`);
    console.log(`[SCHEDULE] Day allowed: ${dayAllowed}, Hour allowed: ${hourAllowed}, Within schedule: ${dayAllowed && hourAllowed}`);

    return dayAllowed && hourAllowed;
  }

  // Get next available send time based on schedule (uses UTC for consistency)
  getNextSendTime(schedule) {
    const now = new Date();

    if (!schedule || !schedule.days || schedule.start_hour === undefined) {
      return now; // No schedule = send now
    }

    // Check for 24/7 schedule - can send anytime
    const is24_7 = schedule.days.length === 7 && schedule.start_hour === 0 && schedule.end_hour === 24;
    if (is24_7) {
      console.log(`[SCHEDULE] 24/7 schedule - sending now`);
      return now;
    }

    const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let checkDate = new Date(now);
    let attempts = 0;

    while (attempts < 14) { // Check up to 2 weeks ahead
      const dayOfWeek = daysOfWeek[checkDate.getUTCDay()];

      if (schedule.days.includes(dayOfWeek)) {
        // Set to the start hour in UTC
        checkDate.setUTCHours(schedule.start_hour || 0, 0, 0, 0);

        if (checkDate > now) {
          console.log(`[SCHEDULE] Next send time calculated: ${checkDate.toISOString()} (UTC)`);
          return checkDate;
        }
      }

      // Move to next day at midnight UTC
      checkDate.setUTCDate(checkDate.getUTCDate() + 1);
      checkDate.setUTCHours(0, 0, 0, 0);
      attempts++;
    }

    console.log(`[SCHEDULE] Fallback next send time: ${checkDate.toISOString()} (UTC)`);
    return checkDate;
  }

  // Check daily sending limit
  async checkDailyLimit(emailAccountId, campaignId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('event_type', 'sent')
      .gte('created_at', today.toISOString());

    if (error) {
      console.error('Error checking daily limit:', error);
      return true; // Allow if we can't check
    }

    const { data: account } = await supabase
      .from('email_accounts')
      .select('daily_send_limit')
      .eq('id', emailAccountId)
      .single();

    const limit = account?.daily_send_limit || 10000;
    return count < limit;
  }

  // Clear transporter cache
  clearTransporter(emailAccountId) {
    if (this.transporters.has(emailAccountId)) {
      this.transporters.delete(emailAccountId);
    }
    // Also clear Zoho host cache so it will try all hosts again
    if (this.zohoHostCache.has(emailAccountId)) {
      this.zohoHostCache.delete(emailAccountId);
    }
  }

  // Clear all transporters
  clearAllTransporters() {
    this.transporters.clear();
  }
}

module.exports = new EmailService();
