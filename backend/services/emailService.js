const nodemailer = require('nodemailer');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');
const crypto = require('crypto');
const gmailService = require('./gmailService');
const microsoftService = require('./microsoftService');

class EmailService {
  constructor() {
    this.transporters = new Map();
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

    console.log(`[EMAIL]    📧 Account: ${account.email_address}`);
    console.log(`[EMAIL]    🌐 SMTP Host: ${account.smtp_host}:${account.smtp_port}`);
    console.log(`[EMAIL]    👤 SMTP User: ${account.smtp_username}`);
    console.log(`[EMAIL]    🔒 Secure: ${account.smtp_port === 465 ? 'YES (SSL)' : 'NO (TLS/STARTTLS)'}`);

    console.log(`[EMAIL]    🔧 Creating SMTP transporter...`);
    const transporter = nodemailer.createTransport({
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

  // Add tracking pixel to email body
  addTrackingPixel(htmlBody, campaignId, contactId) {
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/track/open/${campaignId}/${contactId}/${trackingToken}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
    
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
      // Get account to check provider type
      console.log(`[EMAIL] 🔍 Getting email account to determine provider type...`);
      const { data: account, error: accountError } = await supabase
        .from('email_accounts')
        .select('provider_type, email_address')
        .eq('id', emailAccountId)
        .single();

      if (accountError || !account) {
        throw new Error('Email account not found');
      }

      const providerType = account.provider_type || 'smtp';
      console.log(`[EMAIL]    Provider type: ${providerType}`);
      console.log(`[EMAIL]    From: ${account.email_address}`);

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

        console.log(`[EMAIL] 📤 Sending via SMTP...`);
        console.log(`[EMAIL]    Body length: ${finalBody.length} characters`);

        const mailOptions = {
          from: account.email_address,
          to,
          subject,
          html: finalBody
        };

        console.log(`[EMAIL] 🚀 Calling transporter.sendMail()...`);
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
    if (!schedule || !schedule.days || !schedule.start_hour || !schedule.end_hour) {
      return true; // No schedule = always send
    }

    const now = new Date();
    // Use UTC to ensure consistent behavior regardless of server timezone
    const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayOfWeek = daysOfWeek[now.getUTCDay()];
    const hour = now.getUTCHours();

    const dayAllowed = schedule.days.includes(dayOfWeek);
    const hourAllowed = hour >= schedule.start_hour && hour < schedule.end_hour;

    console.log(`[SCHEDULE] Checking schedule - UTC Day: ${dayOfWeek}, UTC Hour: ${hour}, Days allowed: ${schedule.days.join(',')}, Hours: ${schedule.start_hour}-${schedule.end_hour}`);
    console.log(`[SCHEDULE] Day allowed: ${dayAllowed}, Hour allowed: ${hourAllowed}, Within schedule: ${dayAllowed && hourAllowed}`);

    return dayAllowed && hourAllowed;
  }

  // Get next available send time based on schedule (uses UTC for consistency)
  getNextSendTime(schedule) {
    const now = new Date();

    if (!schedule || !schedule.days || !schedule.start_hour) {
      return now; // No schedule = send now
    }

    const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let checkDate = new Date(now);
    let attempts = 0;

    while (attempts < 14) { // Check up to 2 weeks ahead
      const dayOfWeek = daysOfWeek[checkDate.getUTCDay()];

      if (schedule.days.includes(dayOfWeek)) {
        // Set to the start hour in UTC
        checkDate.setUTCHours(schedule.start_hour || 9, 0, 0, 0);

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
  }

  // Clear all transporters
  clearAllTransporters() {
    this.transporters.clear();
  }
}

module.exports = new EmailService();
