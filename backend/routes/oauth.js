const express = require('express');
const router = express.Router();
const gmailService = require('../services/gmailService');
const microsoftService = require('../services/microsoftService');
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { getFrontendUrlFromRequest } = require('../config/urls');

/**
 * Auth middleware that also accepts token as a query parameter.
 * Needed for OAuth authorize endpoints since browser redirects can't send headers.
 */
async function authenticateUserOrQueryToken(req, res, next) {
  // If token is in query param, move it to the Authorization header so the standard middleware works
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticateUser(req, res, next);
}

/**
 * OAuth Routes for Email Provider Authentication
 *
 * Supported Providers:
 * - Gmail (Google OAuth)
 * - Outlook (Microsoft OAuth) - Coming soon
 */

/**
 * GET /api/oauth/gmail/authorize
 * Initiates Gmail OAuth flow
 * Redirects user to Google consent screen
 */
router.get('/gmail/authorize', authenticateUserOrQueryToken, (req, res) => {
  console.log(`[OAUTH] 🚀 Initiating Gmail OAuth flow for user ${req.user.id}...`);

  try {
    const frontendUrl = getFrontendUrlFromRequest(req);
    // Generate authorization URL with user ID in state
    const authUrl = gmailService.getAuthorizationUrl(req.user.id, frontendUrl);

    console.log(`[OAUTH] ✅ Authorization URL generated`);
    console.log(`[OAUTH]    Redirecting to Google...`);

    // Redirect user to Google consent screen
    res.redirect(authUrl);
  } catch (error) {
    console.error(`[OAUTH] ❌ Error generating auth URL:`, error);
    res.status(500).json({
      error: 'Failed to initiate OAuth flow',
      details: error.message
    });
  }
});

/**
 * GET /api/oauth/gmail/callback
 * Handles OAuth callback from Google
 * Exchanges code for tokens and saves to database
 */
router.get('/gmail/callback', async (req, res) => {
  const { code, state, error } = req.query;

  console.log(`[OAUTH] 🔄 Gmail OAuth callback received`);

  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  let userId = null;

  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      userId = stateData.userId;
      if (stateData.frontendUrl) {
        frontendUrl = stateData.frontendUrl;
      }
    }
  } catch (e) {
    console.warn(`[OAUTH] ⚠️ Failed to parse state payload:`, e.message);
  }

  // Check for OAuth errors
  if (error) {
    console.error(`[OAUTH] ❌ OAuth error from Google: ${error}`);
    return res.redirect(`${frontendUrl}?error=oauth_denied`);
  }

  if (!code || !userId) {
    console.error(`[OAUTH] ❌ Missing code or valid state parameter`);
    return res.redirect(`${frontendUrl}?error=invalid_callback`);
  }

  try {
    console.log(`[OAUTH]    User ID: ${userId}`);
    console.log(`[OAUTH] 🔐 Exchanging authorization code for tokens...`);

    // Exchange code for tokens
    const tokens = await gmailService.getTokensFromCode(code);

    console.log(`[OAUTH] ✅ Tokens received successfully`);
    console.log(`[OAUTH]    Access token: ${tokens.access_token?.substring(0, 20)}...`);
    console.log(`[OAUTH]    Refresh token: ${tokens.refresh_token ? 'Present' : 'Missing'}`);
    console.log(`[OAUTH]    Expires at: ${new Date(tokens.expiry_date).toISOString()}`);

    if (!tokens.refresh_token) {
      console.error(`[OAUTH] ❌ No refresh token received. User may need to revoke access and try again.`);
      return res.redirect(`${frontendUrl}?error=no_refresh_token`);
    }

    // Get user's email address from Gmail API
    console.log(`[OAUTH] 📧 Fetching user email address from Gmail API...`);
    const emailAddress = await gmailService.getUserEmail(tokens.access_token);
    console.log(`[OAUTH]    Email: ${emailAddress}`);

    // Check if this email account already exists for this user
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('email_address', emailAddress)
      .single();

    if (existingAccount) {
      console.log(`[OAUTH] 🔄 Email account already exists, updating tokens...`);

      // Update existing account with new tokens
      const { error: updateError } = await supabase
        .from('email_accounts')
        .update({
          provider_type: 'gmail_oauth',
          oauth_refresh_token: tokens.refresh_token,
          oauth_access_token: tokens.access_token,
          oauth_token_expires_at: new Date(tokens.expiry_date).toISOString(),
          oauth_scope: tokens.scope,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error(`[OAUTH] ❌ Error updating account:`, updateError);
        throw updateError;
      }

      console.log(`[OAUTH] ✅ Account updated successfully`);
    } else {
      console.log(`[OAUTH] 📝 Creating new email account...`);

      // Create new email account
      const { data: newAccount, error: insertError } = await supabase
        .from('email_accounts')
        .insert({
          user_id: userId,
          email_address: emailAddress,
          account_type: 'gmail',
          provider_type: 'gmail_oauth',
          oauth_refresh_token: tokens.refresh_token,
          oauth_access_token: tokens.access_token,
          oauth_token_expires_at: new Date(tokens.expiry_date).toISOString(),
          oauth_scope: tokens.scope,
          daily_send_limit: 500,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[OAUTH] ❌ Error creating account:`, insertError);
        throw insertError;
      }

      console.log(`[OAUTH] ✅ New account created with ID: ${newAccount.id}`);
    }

    // Redirect back to frontend with success
    console.log(`[OAUTH] ✅ OAuth flow completed successfully`);
    console.log(`[OAUTH]    Redirecting to frontend...`);

    res.redirect(`${frontendUrl}?success=gmail_connected&email=${encodeURIComponent(emailAddress)}`);

  } catch (error) {
    console.error(`[OAUTH] ❌ Error processing OAuth callback:`, error);
    console.error(`[OAUTH]    Error message: ${error.message}`);
    console.error(`[OAUTH]    Stack trace:`, error.stack);

    res.redirect(`${frontendUrl}?error=processing_failed`);
  }
});

/**
 * DELETE /api/oauth/gmail/:accountId
 * Revokes Gmail OAuth access and removes tokens
 */
router.delete('/gmail/:accountId', authenticateUser, async (req, res) => {
  console.log(`[OAUTH] 🚫 Revoking Gmail OAuth access for account ${req.params.accountId}...`);

  try {
    // Verify account belongs to user
    const { data: account, error: fetchError } = await supabase
      .from('email_accounts')
      .select('id, user_id, email_address')
      .eq('id', req.params.accountId)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    if (account.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to revoke this account' });
    }

    // Revoke OAuth access
    await gmailService.revokeAccess(req.params.accountId);

    console.log(`[OAUTH] ✅ OAuth access revoked successfully`);

    res.json({
      success: true,
      message: 'Gmail OAuth access revoked'
    });

  } catch (error) {
    console.error(`[OAUTH] ❌ Error revoking OAuth access:`, error);
    res.status(500).json({
      error: 'Failed to revoke OAuth access',
      details: error.message
    });
  }
});

/**
 * GET /api/oauth/gmail/test/:accountId
 * Test Gmail OAuth connection (development only)
 */
router.get('/gmail/test/:accountId', authenticateUser, async (req, res) => {
  console.log(`[OAUTH] 🧪 Testing Gmail OAuth connection for account ${req.params.accountId}...`);

  try {
    // Verify account belongs to user
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id, user_id, email_address, provider_type')
      .eq('id', req.params.accountId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    if (account.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (account.provider_type !== 'gmail_oauth') {
      return res.status(400).json({ error: 'Account is not a Gmail OAuth account' });
    }

    // Test by getting a valid access token
    const { accessToken } = await gmailService.getValidAccessToken(req.params.accountId);

    console.log(`[OAUTH] ✅ Gmail OAuth connection is valid`);

    res.json({
      success: true,
      message: 'Gmail OAuth connection is working',
      email: account.email_address,
      hasValidToken: !!accessToken
    });

  } catch (error) {
    console.error(`[OAUTH] ❌ Gmail OAuth connection test failed:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// MICROSOFT OAUTH ROUTES
// ============================================================================

/**
 * GET /api/oauth/microsoft/authorize
 * Initiates Microsoft OAuth flow
 * Redirects user to Microsoft consent screen
 */
router.get('/microsoft/authorize', authenticateUserOrQueryToken, (req, res) => {
  console.log(`[OAUTH] 🚀 Initiating Microsoft OAuth flow for user ${req.user.id}...`);

  try {
    const frontendUrl = getFrontendUrlFromRequest(req);
    // Generate authorization URL with user ID in state
    const authUrl = microsoftService.getAuthorizationUrl(req.user.id, frontendUrl);

    console.log(`[OAUTH] ✅ Authorization URL generated`);
    console.log(`[OAUTH]    Redirecting to Microsoft...`);

    // Redirect user to Microsoft consent screen
    res.redirect(authUrl);
  } catch (error) {
    console.error(`[OAUTH] ❌ Error generating auth URL:`, error);
    res.status(500).json({
      error: 'Failed to initiate OAuth flow',
      details: error.message
    });
  }
});

/**
 * GET /api/oauth/microsoft/callback
 * Handles OAuth callback from Microsoft
 * Exchanges code for tokens and saves to database
 */
router.get('/microsoft/callback', async (req, res) => {
  const { code, state, error } = req.query;

  console.log(`[OAUTH] 🔄 Microsoft OAuth callback received`);

  let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  let userId = null;

  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      userId = stateData.userId;
      if (stateData.frontendUrl) {
        frontendUrl = stateData.frontendUrl;
      }
    }
  } catch (e) {
    console.warn(`[OAUTH] ⚠️ Failed to parse state payload:`, e.message);
  }

  // Check for OAuth errors
  if (error) {
    console.error(`[OAUTH] ❌ OAuth error from Microsoft: ${error}`);
    return res.redirect(`${frontendUrl}?error=oauth_denied`);
  }

  if (!code || !userId) {
    console.error(`[OAUTH] ❌ Missing code or valid state parameter`);
    return res.redirect(`${frontendUrl}?error=invalid_callback`);
  }

  try {
    console.log(`[OAUTH]    User ID: ${userId}`);
    console.log(`[OAUTH] 🔐 Exchanging authorization code for tokens...`);

    // Exchange code for tokens
    const tokens = await microsoftService.getTokensFromCode(code);

    console.log(`[OAUTH] ✅ Tokens received successfully`);
    console.log(`[OAUTH]    Access token: ${tokens.access_token?.substring(0, 20)}...`);
    console.log(`[OAUTH]    Refresh token: ${tokens.refresh_token ? 'Present' : 'Missing'}`);

    if (!tokens.refresh_token) {
      console.error(`[OAUTH] ❌ No refresh token received.`);
      return res.redirect(`${frontendUrl}?error=no_refresh_token`);
    }

    // Get user's email address from Microsoft Graph API
    console.log(`[OAUTH] 📧 Fetching user email address from Microsoft Graph...`);
    const emailAddress = await microsoftService.getUserEmail(tokens.access_token);
    console.log(`[OAUTH]    Email: ${emailAddress}`);

    // Calculate token expiration (tokens.expires_in is in seconds)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Check if this email account already exists for this user
    const { data: existingAccount } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('email_address', emailAddress)
      .single();

    if (existingAccount) {
      console.log(`[OAUTH] 🔄 Email account already exists, updating tokens...`);

      // Update existing account with new tokens
      const { error: updateError } = await supabase
        .from('email_accounts')
        .update({
          provider_type: 'microsoft_oauth',
          oauth_refresh_token: tokens.refresh_token,
          oauth_access_token: tokens.access_token,
          oauth_token_expires_at: expiresAt,
          oauth_scope: tokens.scope,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error(`[OAUTH] ❌ Error updating account:`, updateError);
        throw updateError;
      }

      console.log(`[OAUTH] ✅ Account updated successfully`);
    } else {
      console.log(`[OAUTH] 📝 Creating new email account...`);

      // Create new email account
      const { data: newAccount, error: insertError } = await supabase
        .from('email_accounts')
        .insert({
          user_id: userId,
          email_address: emailAddress,
          account_type: 'outlook',
          provider_type: 'microsoft_oauth',
          oauth_refresh_token: tokens.refresh_token,
          oauth_access_token: tokens.access_token,
          oauth_token_expires_at: expiresAt,
          oauth_scope: tokens.scope,
          daily_send_limit: 500,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[OAUTH] ❌ Error creating account:`, insertError);
        throw insertError;
      }

      console.log(`[OAUTH] ✅ New account created with ID: ${newAccount.id}`);
    }

    // Redirect back to frontend with success
    console.log(`[OAUTH] ✅ OAuth flow completed successfully`);
    console.log(`[OAUTH]    Redirecting to frontend...`);

    res.redirect(`${frontendUrl}?success=microsoft_connected&email=${encodeURIComponent(emailAddress)}`);

  } catch (error) {
    console.error(`[OAUTH] ❌ Error processing OAuth callback:`, error);
    console.error(`[OAUTH]    Error message: ${error.message}`);
    console.error(`[OAUTH]    Stack trace:`, error.stack);

    res.redirect(`${frontendUrl}?error=processing_failed`);
  }
});

/**
 * DELETE /api/oauth/microsoft/:accountId
 * Revokes Microsoft OAuth access and removes tokens
 */
router.delete('/microsoft/:accountId', authenticateUser, async (req, res) => {
  console.log(`[OAUTH] 🚫 Revoking Microsoft OAuth access for account ${req.params.accountId}...`);

  try {
    // Verify account belongs to user
    const { data: account, error: fetchError } = await supabase
      .from('email_accounts')
      .select('id, user_id, email_address')
      .eq('id', req.params.accountId)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    if (account.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to revoke this account' });
    }

    // Revoke OAuth access
    await microsoftService.revokeAccess(req.params.accountId);

    console.log(`[OAUTH] ✅ OAuth access revoked successfully`);

    res.json({
      success: true,
      message: 'Microsoft OAuth access revoked'
    });

  } catch (error) {
    console.error(`[OAUTH] ❌ Error revoking OAuth access:`, error);
    res.status(500).json({
      error: 'Failed to revoke OAuth access',
      details: error.message
    });
  }
});

/**
 * GET /api/oauth/microsoft/test/:accountId
 * Test Microsoft OAuth connection (development only)
 */
router.get('/microsoft/test/:accountId', authenticateUser, async (req, res) => {
  console.log(`[OAUTH] 🧪 Testing Microsoft OAuth connection for account ${req.params.accountId}...`);

  try {
    // Verify account belongs to user
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id, user_id, email_address, provider_type')
      .eq('id', req.params.accountId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    if (account.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (account.provider_type !== 'microsoft_oauth') {
      return res.status(400).json({ error: 'Account is not a Microsoft OAuth account' });
    }

    // Test by getting a valid access token
    const { accessToken } = await microsoftService.getValidAccessToken(req.params.accountId);

    console.log(`[OAUTH] ✅ Microsoft OAuth connection is valid`);

    res.json({
      success: true,
      message: 'Microsoft OAuth connection is working',
      email: account.email_address,
      hasValidToken: !!accessToken
    });

  } catch (error) {
    console.error(`[OAUTH] ❌ Microsoft OAuth connection test failed:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
