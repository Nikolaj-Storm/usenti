const nodemailer = require('nodemailer');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.transporters = new Map();
  }

  // Get or create transporter for email account
  async getTransporter(emailAccountId) {
    if (this.transporters.has(emailAccountId)) {
      return this.transporters.get(emailAccountId);
    }

    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .single();

    if (error || !account) {
      throw new Error('Email account not found');
    }

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
    try {
      const transporter = await this.getTransporter(emailAccountId);
      
      // Get sender info
      const { data: account } = await supabase
        .from('email_accounts')
        .select('email_address')
        .eq('id', emailAccountId)
        .single();

      let finalBody = body;

      // Add tracking
      if (trackOpens) {
        finalBody = this.addTrackingPixel(finalBody, campaignId, contactId);
      }
      if (trackClicks) {
        finalBody = this.rewriteLinksForTracking(finalBody, campaignId, contactId);
      }

      // Send email
      const info = await transporter.sendMail({
        from: account.email_address,
        to,
        subject,
        html: finalBody
      });

      // Log sent event
      await supabase.from('email_events').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        event_type: 'sent',
        event_data: {
          message_id: info.messageId,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Email send error:', error);
      
      // Log failed event
      await supabase.from('email_events').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        event_type: 'failed',
        event_data: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  // Check if within sending schedule
  isWithinSchedule(schedule) {
    if (!schedule || !schedule.days || !schedule.start_hour || !schedule.end_hour) {
      return true; // No schedule = always send
    }

    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    const hour = now.getHours();

    const dayAllowed = schedule.days.includes(dayOfWeek);
    const hourAllowed = hour >= schedule.start_hour && hour < schedule.end_hour;

    return dayAllowed && hourAllowed;
  }

  // Get next available send time based on schedule
  getNextSendTime(schedule) {
    const now = new Date();
    
    if (!schedule || !schedule.days || !schedule.start_hour) {
      return now; // No schedule = send now
    }

    const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let checkDate = new Date(now);
    let attempts = 0;

    while (attempts < 14) { // Check up to 2 weeks ahead
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
