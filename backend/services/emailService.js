// Backend Email Service
// Provides email sending, scheduling, and utility functions for the campaign executor

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { decrypt } = require('../utils/encryption');

/**
 * Check if current time is within the campaign's send schedule
 * @param {Object} schedule - Schedule configuration with days, start_hour, end_hour
 * @returns {boolean} True if within schedule, false otherwise
 */
function isWithinSchedule(schedule) {
  if (!schedule || !schedule.days || !schedule.start_hour || !schedule.end_hour) {
    return true;
  }

  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const hour = now.getHours();

  return schedule.days.includes(dayOfWeek) && hour >= schedule.start_hour && hour < schedule.end_hour;
}

/**
 * Get the next available send time based on schedule
 * @param {Object} schedule - Schedule configuration with days, start_hour
 * @returns {Date} Next available send time
 */
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

/**
 * Check if email account is within its daily sending limit
 * @param {string} emailAccountId - Email account UUID
 * @param {string} campaignId - Campaign UUID
 * @returns {boolean} True if within limit, false otherwise
 */
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

/**
 * Personalize content by replacing {{variables}} with contact data
 * @param {string} content - Content string with {{variable}} placeholders
 * @param {Object} contact - Contact object with fields to substitute
 * @returns {string} Personalized content
 */
function personalizeContent(content, contact) {
  if (!content) return '';

  const variables = {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    email: contact.email || '',
    company: contact.company || '',
    ...(contact.custom_fields || {})
  };

  let result = content;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, variables[key]);
  });

  return result;
}

/**
 * Send an email via the appropriate transport (SMTP, Gmail API, or Microsoft Graph)
 * @param {Object} params - Email parameters
 * @param {string} params.emailAccountId - Email account UUID
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body (HTML)
 * @param {string} [params.campaignId] - Optional campaign UUID for tracking
 * @param {string} [params.contactId] - Optional contact UUID for tracking
 * @param {boolean} [params.trackOpens] - Whether to add open tracking pixel
 * @param {boolean} [params.trackClicks] - Whether to rewrite links for click tracking
 * @param {Array} [params.attachments] - Optional attachments array
 * @returns {Object} Result with success flag and messageId
 */
async function sendEmail({
  emailAccountId,
  to,
  subject,
  body,
  campaignId = null,
  contactId = null,
  trackOpens = false,
  trackClicks = false,
  attachments = []
}) {
  console.log(`[EMAIL-SERVICE] 📧 Preparing to send email...`);
  console.log(`[EMAIL-SERVICE]    Account ID: ${emailAccountId}`);
  console.log(`[EMAIL-SERVICE]    To: ${to}`);
  console.log(`[EMAIL-SERVICE]    Subject: "${subject}"`);

  // Get email account details
  const { data: account, error: accountError } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', emailAccountId)
    .single();

  if (accountError || !account) {
    throw new Error(`Failed to fetch email account: ${accountError?.message || 'Account not found'}`);
  }

  console.log(`[EMAIL-SERVICE]    Account type: ${account.account_type}`);
  console.log(`[EMAIL-SERVICE]    From: ${account.email_address}`);

  let finalBody = body;

  // Add tracking pixel if requested
  if (trackOpens && campaignId && contactId) {
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/track/open/${campaignId}/${contactId}/${trackingToken}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
    finalBody += trackingPixel;
    console.log(`[EMAIL-SERVICE]    Added open tracking pixel`);
  }

  // Rewrite links for click tracking if requested
  if (trackClicks && campaignId && contactId) {
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const clickTrackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/track/click/${campaignId}/${contactId}/${trackingToken}`;
    finalBody = finalBody.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (match, url) => `href="${clickTrackingUrl}?url=${encodeURIComponent(url)}"`
    );
    console.log(`[EMAIL-SERVICE]    Added click tracking to links`);
  }

  let result;

  // Route to appropriate service based on account type
  if (account.account_type === 'gmail' && account.oauth_refresh_token) {
    // Use Gmail API for OAuth-authenticated Gmail accounts
    console.log(`[EMAIL-SERVICE]    Using Gmail API...`);
    const gmailService = require('./gmailService');
    result = await gmailService.sendEmail({
      emailAccountId,
      to,
      subject,
      body: finalBody
    });
  } else if ((account.account_type === 'outlook' || account.account_type === 'microsoft') && account.oauth_refresh_token) {
    // Use Microsoft Graph API for OAuth-authenticated Microsoft accounts
    console.log(`[EMAIL-SERVICE]    Using Microsoft Graph API...`);
    const microsoftService = require('./microsoftService');
    result = await microsoftService.sendEmail({
      emailAccountId,
      to,
      subject,
      body: finalBody
    });
  } else {
    // Use SMTP for all other account types (stalwart, zoho, aws_workmail, or non-OAuth gmail/outlook)
    console.log(`[EMAIL-SERVICE]    Using SMTP...`);
    result = await sendViaSMTP({
      account,
      to,
      subject,
      body: finalBody,
      attachments
    });
  }

  // Log email event if campaign tracking is enabled
  if (campaignId && contactId) {
    await supabase.from('email_events').insert({
      campaign_id: campaignId,
      contact_id: contactId,
      event_type: 'sent',
      event_data: {
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      }
    });
    console.log(`[EMAIL-SERVICE]    Logged sent event to database`);
  }

  console.log(`[EMAIL-SERVICE] ✅ Email sent successfully!`);
  console.log(`[EMAIL-SERVICE]    Message ID: ${result.messageId}`);

  return result;
}

/**
 * Send email via SMTP using nodemailer
 * @param {Object} params - SMTP send parameters
 * @returns {Object} Result with messageId
 */
async function sendViaSMTP({ account, to, subject, body, attachments = [] }) {
  // Create SMTP transporter
  const transporter = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_port === 465,
    auth: {
      user: account.smtp_username,
      pass: decrypt(account.smtp_password)
    },
    tls: { rejectUnauthorized: false }
  });

  // Build from address with sender name if available
  const fromAddress = account.sender_name
    ? `${account.sender_name} <${account.email_address}>`
    : account.email_address;

  // Build mail options
  const mailOptions = {
    from: fromAddress,
    to: to,
    subject: subject,
    html: body
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments.map(att => ({
      filename: att.filename || att.originalname,
      content: att.buffer || att.content
    }));
  }

  // Send the email
  const info = await transporter.sendMail(mailOptions);

  return {
    success: true,
    messageId: info.messageId
  };
}

module.exports = {
  isWithinSchedule,
  getNextSendTime,
  checkDailyLimit,
  personalizeContent,
  sendEmail
};
