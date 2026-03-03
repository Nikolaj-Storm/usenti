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
 * Check if email account is within its daily sending limit AND if the user is within their subscription limits
 * @param {string} emailAccountId - Email account UUID
 * @param {string} campaignId - Campaign UUID
 * @returns {object} { withinLimit: boolean, planTier: string, errorMessage?: string }
 */
async function checkDailyLimit(emailAccountId, campaignId) {
  // 1. Get the account and its user ID
  const { data: account, error: accountError } = await supabase
    .from('email_accounts')
    .select('user_id, daily_send_limit, current_daily_sent, last_daily_reset')
    .eq('id', emailAccountId)
    .single();

  if (accountError || !account) {
    console.error('[EMAIL-SERVICE] ❌ Failed to fetch account for limit check:', accountError);
    return { withinLimit: false, planTier: 'free', errorMessage: 'Account not found' };
  }

  // 2. Get the user's subscription tier and usage
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('plan_tier, emails_sent_this_cycle, cycle_start_date')
    .eq('user_id', account.user_id)
    .single();

  // Default to free if no subscription record is found (e.g. legacy users before backfill)
  const planTier = subscription?.plan_tier || 'free';
  const cycleSent = subscription?.emails_sent_this_cycle || 0;

  // 3. Process Account-level limit first
  const now = new Date();
  const lastReset = account.last_daily_reset ? new Date(account.last_daily_reset) : null;
  let sentToday = account.current_daily_sent || 0;

  if (lastReset) {
    const isSameDay =
      lastReset.getUTCDate() === now.getUTCDate() &&
      lastReset.getUTCMonth() === now.getUTCMonth() &&
      lastReset.getUTCFullYear() === now.getUTCFullYear();

    if (!isSameDay) {
      sentToday = 0;
    }
  } else {
    sentToday = 0;
  }

  const accountLimit = account.daily_send_limit || 10000;

  if (sentToday >= accountLimit) {
    console.log(`[EMAIL-SERVICE] ⚠️ Daily limit reached for account ${emailAccountId} (${sentToday}/${accountLimit})`);
    return { withinLimit: false, planTier, errorMessage: 'Account daily limit reached' };
  }

  // 4. Process Subscription-level limit
  // Free: 50 emails/day, 200/week (For simplicity, we track 'cycle' as the current period)
  // Growth: 5,000/month
  // Hypergrowth: 100,000/month
  if (planTier === 'free') {
    // Free has a strict absolute daily limit in addition to account limit
    if (sentToday >= 50) {
      console.log(`[EMAIL-SERVICE] ⚠️ Free tier daily limit reached for user ${account.user_id} (${sentToday}/50)`);
      return { withinLimit: false, planTier, errorMessage: 'Free tier limit reached (50/day)' };
    }
    // E.g. cycle is 1 week for free
    if (cycleSent >= 200) {
      console.log(`[EMAIL-SERVICE] ⚠️ Free tier weekly limit reached for user ${account.user_id} (${cycleSent}/200)`);
      return { withinLimit: false, planTier, errorMessage: 'Free tier limit reached (200/week)' };
    }
  } else if (planTier === 'growth') {
    if (cycleSent >= 5000) {
      console.log(`[EMAIL-SERVICE] ⚠️ Growth tier monthly limit reached for user ${account.user_id} (${cycleSent}/5000)`);
      return { withinLimit: false, planTier, errorMessage: 'Growth tier limit reached (5,000/mo)' };
    }
  } else if (planTier === 'hypergrowth') {
    if (cycleSent >= 100000) {
      console.log(`[EMAIL-SERVICE] ⚠️ Hypergrowth tier monthly limit reached for user ${account.user_id} (${cycleSent}/100000)`);
      return { withinLimit: false, planTier, errorMessage: 'Hypergrowth tier limit reached (100,000/mo)' };
    }
  }

  return { withinLimit: true, planTier };
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
 * @param {string} [params.planTier] - The user's subscription tier ('free', 'growth', etc.)
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
  attachments = [],
  planTier = 'free'
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

  // Append footer if user is on Free tier
  if (planTier === 'free') {
    finalBody += `<br><br><p style="color: gray; font-size: 12px; margin-top: 15px;">Powered by <a href="https://usenti.com" style="color: inherit; text-decoration: underline;">Usenti.com</a> - email outreach for the rebels</p>`;
    console.log(`[EMAIL-SERVICE]    Added 'Powered by Usenti' footer (Free Tier)`);
  }

  // Add tracking pixel if requested
  if (trackOpens && campaignId && contactId) {
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const trackingUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/track/open/${campaignId}/${contactId}/${trackingToken}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
    finalBody += trackingPixel;
    console.log(`[EMAIL-SERVICE]    Added open tracking pixel: ${trackingUrl}`);
  }

  // Rewrite links for click tracking if requested
  if (trackClicks && campaignId && contactId) {
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const clickTrackingUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/track/click/${campaignId}/${contactId}/${trackingToken}`;
    finalBody = finalBody.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (match, url) => `href="${clickTrackingUrl}?url=${encodeURIComponent(url)}"`
    );
    console.log(`[EMAIL-SERVICE]    Added click tracking to links`);
  }

  // Generate unsubscribe link for campaign emails
  let unsubscribeHeaders = null;
  if (campaignId && contactId) {
    const unsubToken = crypto.randomBytes(16).toString('hex');
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const unsubscribeUrl = `${backendUrl}/api/unsubscribe/${campaignId}/${contactId}/${unsubToken}`;

    // RFC 8058 List-Unsubscribe headers
    unsubscribeHeaders = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    };

    // Append visible unsubscribe footer if not already present
    if (!finalBody.toLowerCase().includes('unsubscribe')) {
      finalBody += `<div style="margin-top:20px; padding-top:10px; border-top:1px solid #eee; text-align:center; font-size:11px; color:#999;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a> from future emails</div>`;
      console.log(`[EMAIL-SERVICE]    Added unsubscribe footer`);
    }
    console.log(`[EMAIL-SERVICE]    Added List-Unsubscribe headers`);
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
      attachments,
      unsubscribeHeaders
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

  // Increment global account counter (for daily limits)
  try {
    const { error: incError } = await supabase.rpc('increment_email_account_sent_count', {
      account_id: emailAccountId
    });

    if (incError) {
      console.error('[EMAIL-SERVICE] ⚠️ Failed to increment account counter:', incError);
    } else {
      console.log('[EMAIL-SERVICE]    📊 Incremented account daily sent counter');
    }
  } catch (incErr) {
    console.error('[EMAIL-SERVICE] ⚠️ Error incrementing account counter:', incErr);
  }

  return result;
}

/**
 * Send email via SMTP using nodemailer
 * @param {Object} params - SMTP send parameters
 * @returns {Object} Result with messageId
 */
async function sendViaSMTP({ account, to, subject, body, attachments = [], unsubscribeHeaders = null }) {
  // Parse port as integer (stored as string in database)
  const smtpPort = parseInt(account.smtp_port, 10) || 587;
  const isSecure = smtpPort === 465;
  const isStalwart = account.account_type === 'stalwart';
  const isZoho = account.account_type === 'zoho' || account.smtp_host?.toLowerCase().includes('zoho');

  // Debug logging for SMTP configuration
  console.log(`[EMAIL-SERVICE] 🔧 SMTP Configuration:`);
  console.log(`[EMAIL-SERVICE]    Host: ${account.smtp_host}`);
  console.log(`[EMAIL-SERVICE]    Port: ${smtpPort}`);
  console.log(`[EMAIL-SERVICE]    Secure: ${isSecure}`);
  console.log(`[EMAIL-SERVICE]    Account type: ${account.account_type}`);
  console.log(`[EMAIL-SERVICE]    Username: ${account.smtp_username}`);
  console.log(`[EMAIL-SERVICE]    Password stored: ${account.smtp_password ? 'YES (encrypted)' : 'NO'}`);

  // Attempt to decrypt password
  let decryptedPassword;
  try {
    decryptedPassword = decrypt(account.smtp_password);
    console.log(`[EMAIL-SERVICE]    Password decrypted: YES (length: ${decryptedPassword?.length || 0})`);
  } catch (decryptError) {
    console.error(`[EMAIL-SERVICE]    ❌ Password decryption FAILED: ${decryptError.message}`);
    throw new Error(`Failed to decrypt SMTP password: ${decryptError.message}`);
  }

  // Build transporter config with account-type-specific settings
  const transporterConfig = {
    host: account.smtp_host,
    port: smtpPort,
    secure: isSecure,
    auth: {
      user: account.smtp_username,
      pass: decryptedPassword
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  };

  // Stalwart requires STARTTLS on port 587 and prefers PLAIN auth
  if (isStalwart && !isSecure) {
    transporterConfig.requireTLS = true;
    transporterConfig.authMethod = 'PLAIN';
    console.log(`[EMAIL-SERVICE]    Stalwart mode: requireTLS=true, authMethod=PLAIN`);
  }

  // Zoho requires LOGIN auth method
  if (isZoho) {
    transporterConfig.authMethod = 'LOGIN';
    console.log(`[EMAIL-SERVICE]    Zoho mode: authMethod=LOGIN`);
  }

  // Create SMTP transporter
  const transporter = nodemailer.createTransport(transporterConfig);

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

  // Add unsubscribe headers if provided
  if (unsubscribeHeaders) {
    mailOptions.headers = {
      ...mailOptions.headers,
      ...unsubscribeHeaders
    };
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
