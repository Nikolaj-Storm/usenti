const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Gmail OAuth Service
 * Handles Gmail API authentication and email sending
 *
 * Setup Instructions:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing
 * 3. Enable Gmail API
 * 4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
 * 5. Application type: Web application
 * 6. Authorized redirect URIs: https://your-domain.com/api/oauth/gmail/callback
 * 7. Copy Client ID and Client Secret to .env
 */

class GmailService {
  constructor() {
    this.clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
    this.redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/oauth/gmail/callback';
  }

  /**
   * Create OAuth2 client for Gmail API
   */
  createOAuth2Client() {
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
  }

  /**
   * Generate authorization URL for user to grant access
   * @param {string} userId - User ID to store in state
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(userId) {
    const oauth2Client = this.createOAuth2Client();

    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent' // Force consent screen to always get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Object} Tokens object with access_token, refresh_token, etc.
   */
  async getTokensFromCode(code) {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Get user's email address from Gmail API
   * @param {string} accessToken - OAuth access token
   * @returns {string} Email address
   */
  async getUserEmail(accessToken) {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    return profile.data.emailAddress;
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Object} New tokens
   */
  async refreshAccessToken(refreshToken) {
    console.log('[GMAIL] 🔄 Refreshing access token...');

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('[GMAIL] ✅ Access token refreshed successfully');

      return {
        access_token: credentials.access_token,
        token_expires_at: new Date(credentials.expiry_date).toISOString()
      };
    } catch (error) {
      console.error('[GMAIL] ❌ Failed to refresh access token:', error.message);
      throw new Error('Failed to refresh Gmail access token. User may need to re-authenticate.');
    }
  }

  /**
   * Get valid access token for an email account
   * Automatically refreshes if expired
   * @param {string} emailAccountId - Email account ID
   * @returns {Object} { accessToken, oauth2Client }
   */
  async getValidAccessToken(emailAccountId) {
    console.log(`[GMAIL] 🔑 Getting valid access token for account ${emailAccountId}...`);

    // Get account from database
    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .single();

    if (error || !account) {
      throw new Error('Email account not found');
    }

    if (account.provider_type !== 'gmail_oauth') {
      throw new Error('Account is not a Gmail OAuth account');
    }

    if (!account.oauth_refresh_token) {
      throw new Error('No refresh token found. User needs to reconnect account.');
    }

    const oauth2Client = this.createOAuth2Client();

    // Check if access token is expired (with 5 minute buffer)
    const now = new Date();
    const expiresAt = account.oauth_token_expires_at ? new Date(account.oauth_token_expires_at) : null;
    const isExpired = !expiresAt || (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000;

    if (isExpired || !account.oauth_access_token) {
      console.log('[GMAIL] ⏰ Access token expired or missing, refreshing...');

      // Refresh the token
      const newTokens = await this.refreshAccessToken(account.oauth_refresh_token);

      // Update database with new access token
      await supabase
        .from('email_accounts')
        .update({
          oauth_access_token: newTokens.access_token,
          oauth_token_expires_at: newTokens.token_expires_at
        })
        .eq('id', emailAccountId);

      oauth2Client.setCredentials({
        access_token: newTokens.access_token,
        refresh_token: account.oauth_refresh_token
      });

      return { accessToken: newTokens.access_token, oauth2Client };
    }

    console.log('[GMAIL] ✅ Using existing valid access token');
    oauth2Client.setCredentials({
      access_token: account.oauth_access_token,
      refresh_token: account.oauth_refresh_token
    });

    return { accessToken: account.oauth_access_token, oauth2Client };
  }

  /**
   * Create a MIME message for Gmail API
   * @param {Object} params - Email parameters
   * @returns {string} Base64url encoded MIME message
   */
  createMimeMessage({ from, to, subject, body, replyTo }) {
    const messageParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      replyTo ? `Reply-To: ${replyTo}` : null,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      body
    ].filter(Boolean);

    const message = messageParts.join('\r\n');

    // Base64url encode (replace + with -, / with _, and remove =)
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Send email via Gmail API
   * @param {Object} params - Email parameters
   * @returns {Object} Sent message info
   */
  async sendEmail({ emailAccountId, to, subject, body, replyTo }) {
    console.log(`[GMAIL] 📨 Preparing to send email via Gmail API...`);
    console.log(`[GMAIL]    Account ID: ${emailAccountId}`);
    console.log(`[GMAIL]    To: ${to}`);
    console.log(`[GMAIL]    Subject: "${subject}"`);

    try {
      // Get valid access token (auto-refreshes if needed)
      const { oauth2Client } = await this.getValidAccessToken(emailAccountId);

      // Get account details for "from" address
      const { data: account } = await supabase
        .from('email_accounts')
        .select('email_address, from_name')
        .eq('id', emailAccountId)
        .single();

      const fromAddress = account.from_name
        ? `${account.from_name} <${account.email_address}>`
        : account.email_address;

      // Create MIME message
      const encodedMessage = this.createMimeMessage({
        from: fromAddress,
        to,
        subject,
        body,
        replyTo: replyTo || account.email_address
      });

      // Send via Gmail API
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      console.log('[GMAIL] 🚀 Calling Gmail API to send message...');

      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log(`[GMAIL] ✅ Email sent successfully via Gmail API!`);
      console.log(`[GMAIL]    Message ID: ${result.data.id}`);
      console.log(`[GMAIL]    Thread ID: ${result.data.threadId}`);

      return {
        success: true,
        messageId: result.data.id,
        threadId: result.data.threadId
      };

    } catch (error) {
      console.error(`[GMAIL] ❌ Gmail API send error!`);
      console.error(`[GMAIL]    Error type: ${error.constructor.name}`);
      console.error(`[GMAIL]    Error message: ${error.message}`);

      if (error.response) {
        console.error(`[GMAIL]    Response status: ${error.response.status}`);
        console.error(`[GMAIL]    Response data:`, error.response.data);
      }

      throw new Error(`Gmail API error: ${error.message}`);
    }
  }

  /**
   * Revoke OAuth access for an account
   * @param {string} emailAccountId - Email account ID
   */
  async revokeAccess(emailAccountId) {
    console.log(`[GMAIL] 🚫 Revoking OAuth access for account ${emailAccountId}...`);

    const { data: account } = await supabase
      .from('email_accounts')
      .select('oauth_access_token')
      .eq('id', emailAccountId)
      .single();

    if (account?.oauth_access_token) {
      const oauth2Client = this.createOAuth2Client();
      await oauth2Client.revokeToken(account.oauth_access_token);
      console.log('[GMAIL] ✅ OAuth access revoked');
    }

    // Clear tokens from database
    await supabase
      .from('email_accounts')
      .update({
        oauth_refresh_token: null,
        oauth_access_token: null,
        oauth_token_expires_at: null,
        oauth_scope: null
      })
      .eq('id', emailAccountId);
  }
}

module.exports = new GmailService();
