const { Client } = require('@microsoft/microsoft-graph-client');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Microsoft OAuth Service
 * Handles Microsoft Graph API authentication and email sending
 *
 * Setup Instructions:
 * 1. Go to https://portal.azure.com/
 * 2. Navigate to "Azure Active Directory" → "App registrations"
 * 3. Click "New registration"
 * 4. Name: Your app name (e.g., "Snowman Email Platform")
 * 5. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
 * 6. Redirect URI: Web → https://your-domain.com/api/oauth/microsoft/callback
 * 7. Click "Register"
 * 8. Copy "Application (client) ID" to MICROSOFT_OAUTH_CLIENT_ID
 * 9. Go to "Certificates & secrets" → "New client secret"
 * 10. Copy the secret value to MICROSOFT_OAUTH_CLIENT_SECRET
 * 11. Go to "API permissions" → "Add a permission" → "Microsoft Graph" → "Delegated permissions"
 * 12. Add: Mail.Send, Mail.ReadWrite, User.Read, offline_access
 * 13. Click "Grant admin consent" (if required)
 */

class MicrosoftService {
  constructor() {
    this.clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    this.redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/oauth/microsoft/callback';
    this.authority = 'https://login.microsoftonline.com/common';
    this.tokenEndpoint = `${this.authority}/oauth2/v2.0/token`;
    this.authorizeEndpoint = `${this.authority}/oauth2/v2.0/authorize`;
  }

  /**
   * Generate authorization URL for user to grant access
   * @param {string} userId - User ID to store in state
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(userId) {
    const scopes = [
      'offline_access',
      'User.Read',
      'Mail.Send',
      'Mail.ReadWrite'
    ].join(' ');

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes,
      state: state,
      response_mode: 'query',
      prompt: 'consent' // Force consent to ensure we get refresh token
    });

    return `${this.authorizeEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Object} Tokens object with access_token, refresh_token, etc.
   */
  async getTokensFromCode(code) {
    console.log('[MICROSOFT] 🔐 Exchanging code for tokens...');

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code'
    });

    try {
      const response = await axios.post(this.tokenEndpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('[MICROSOFT] ✅ Tokens received');
      return response.data;
    } catch (error) {
      console.error('[MICROSOFT] ❌ Token exchange failed:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for tokens');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Object} New tokens
   */
  async refreshAccessToken(refreshToken) {
    console.log('[MICROSOFT] 🔄 Refreshing access token...');

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    try {
      const response = await axios.post(this.tokenEndpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('[MICROSOFT] ✅ Access token refreshed successfully');

      // Calculate expiration time (response has expires_in in seconds)
      const expiresAt = new Date(Date.now() + response.data.expires_in * 1000).toISOString();

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || refreshToken, // Use new refresh token if provided
        token_expires_at: expiresAt
      };
    } catch (error) {
      console.error('[MICROSOFT] ❌ Failed to refresh access token:', error.response?.data || error.message);
      throw new Error('Failed to refresh Microsoft access token. User may need to re-authenticate.');
    }
  }

  /**
   * Get user's email address from Microsoft Graph API
   * @param {string} accessToken - OAuth access token
   * @returns {string} Email address
   */
  async getUserEmail(accessToken) {
    console.log('[MICROSOFT] 📧 Fetching user email from Graph API...');

    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const email = response.data.mail || response.data.userPrincipalName;
      console.log(`[MICROSOFT] ✅ User email: ${email}`);

      return email;
    } catch (error) {
      console.error('[MICROSOFT] ❌ Failed to get user email:', error.response?.data || error.message);
      throw new Error('Failed to get user email from Microsoft Graph');
    }
  }

  /**
   * Get valid access token for an email account
   * Automatically refreshes if expired
   * @param {string} emailAccountId - Email account ID
   * @returns {Object} { accessToken, client }
   */
  async getValidAccessToken(emailAccountId) {
    console.log(`[MICROSOFT] 🔑 Getting valid access token for account ${emailAccountId}...`);

    // Get account from database
    const { data: account, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .single();

    if (error || !account) {
      throw new Error('Email account not found');
    }

    if (account.provider_type !== 'microsoft_oauth') {
      throw new Error('Account is not a Microsoft OAuth account');
    }

    if (!account.oauth_refresh_token) {
      throw new Error('No refresh token found. User needs to reconnect account.');
    }

    // Check if access token is expired (with 5 minute buffer)
    const now = new Date();
    const expiresAt = account.oauth_token_expires_at ? new Date(account.oauth_token_expires_at) : null;
    const isExpired = !expiresAt || (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000;

    if (isExpired || !account.oauth_access_token) {
      console.log('[MICROSOFT] ⏰ Access token expired or missing, refreshing...');

      // Refresh the token
      const newTokens = await this.refreshAccessToken(account.oauth_refresh_token);

      // Update database with new tokens
      await supabase
        .from('email_accounts')
        .update({
          oauth_access_token: newTokens.access_token,
          oauth_refresh_token: newTokens.refresh_token,
          oauth_token_expires_at: newTokens.token_expires_at
        })
        .eq('id', emailAccountId);

      console.log('[MICROSOFT] ✅ Token refreshed and updated in database');

      return { accessToken: newTokens.access_token };
    }

    console.log('[MICROSOFT] ✅ Using existing valid access token');
    return { accessToken: account.oauth_access_token };
  }

  /**
   * Create Microsoft Graph client
   * @param {string} accessToken - OAuth access token
   * @returns {Client} Microsoft Graph client
   */
  createGraphClient(accessToken) {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Send email via Microsoft Graph API
   * @param {Object} params - Email parameters
   * @returns {Object} Sent message info
   */
  async sendEmail({ emailAccountId, to, subject, body, replyTo }) {
    console.log(`[MICROSOFT] 📨 Preparing to send email via Microsoft Graph API...`);
    console.log(`[MICROSOFT]    Account ID: ${emailAccountId}`);
    console.log(`[MICROSOFT]    To: ${to}`);
    console.log(`[MICROSOFT]    Subject: "${subject}"`);

    try {
      // Get valid access token (auto-refreshes if needed)
      const { accessToken } = await this.getValidAccessToken(emailAccountId);

      // Get account details
      const { data: account } = await supabase
        .from('email_accounts')
        .select('email_address, from_name')
        .eq('id', emailAccountId)
        .single();

      // Create Graph client
      const client = this.createGraphClient(accessToken);

      // Prepare email message
      const message = {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: body
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      };

      // Add reply-to if specified
      if (replyTo) {
        message.replyTo = [
          {
            emailAddress: {
              address: replyTo
            }
          }
        ];
      }

      console.log('[MICROSOFT] 🚀 Calling Microsoft Graph API to send message...');

      // Send the email
      const result = await client
        .api('/me/sendMail')
        .post({
          message: message,
          saveToSentItems: true
        });

      console.log(`[MICROSOFT] ✅ Email sent successfully via Microsoft Graph API!`);

      // Microsoft Graph sendMail doesn't return a message ID in the response
      // Generate a unique ID for tracking
      const messageId = `microsoft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        messageId: messageId,
        provider: 'microsoft_graph'
      };

    } catch (error) {
      console.error(`[MICROSOFT] ❌ Microsoft Graph API send error!`);
      console.error(`[MICROSOFT]    Error type: ${error.constructor.name}`);
      console.error(`[MICROSOFT]    Error message: ${error.message}`);

      if (error.response) {
        console.error(`[MICROSOFT]    Response status: ${error.response.status}`);
        console.error(`[MICROSOFT]    Response data:`, error.response.data);
      }

      throw new Error(`Microsoft Graph API error: ${error.message}`);
    }
  }

  /**
   * Revoke OAuth access for an account
   * Note: Microsoft doesn't have a direct revoke endpoint via API
   * Users must revoke at https://account.live.com/consent/Manage
   * @param {string} emailAccountId - Email account ID
   */
  async revokeAccess(emailAccountId) {
    console.log(`[MICROSOFT] 🚫 Clearing OAuth tokens for account ${emailAccountId}...`);

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

    console.log('[MICROSOFT] ✅ OAuth tokens cleared from database');
    console.log('[MICROSOFT] ℹ️  User can revoke app access at: https://account.live.com/consent/Manage');
  }
}

module.exports = new MicrosoftService();
