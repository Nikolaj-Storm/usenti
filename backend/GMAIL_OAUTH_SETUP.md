# Gmail OAuth Setup Guide

This guide will help you set up Gmail OAuth integration for your email campaign platform.

## Why Gmail OAuth?

Instead of using SMTP (which requires app passwords and can be blocked by hosting providers), we use the Gmail API with OAuth2. This provides:

- **No port restrictions** - Uses HTTPS (port 443) instead of SMTP ports
- **Better security** - Users grant permission without sharing passwords
- **Higher deliverability** - Emails sent via official Gmail API
- **User-owned reputation** - Each user sends from their own Gmail account
- **Works on Render** - Bypasses SMTP port blocking

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Snowman Email Platform")
4. Click "Create"

## Step 2: Enable Gmail API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have a Google Workspace account)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Your platform name (e.g., "Snowman Email Platform")
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click "Save and Continue"
6. **Scopes**: Click "Add or Remove Scopes"
   - Add `https://www.googleapis.com/auth/gmail.send` (Send email on user's behalf)
   - Add `https://www.googleapis.com/auth/gmail.readonly` (Read email metadata)
   - Add `https://www.googleapis.com/auth/userinfo.email` (Get user email address)
7. Click "Save and Continue"
8. **Test users** (while in development):
   - Add email addresses of users who can test the app
   - Click "Save and Continue"
9. Click "Back to Dashboard"

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "Snowman Web Client" (or your preferred name)
5. **Authorized JavaScript origins**:
   - Add `http://localhost:3000` (for local development)
   - Add your frontend URL (e.g., `https://nikolaj-storm.github.io`)
6. **Authorized redirect URIs**:
   - Add `http://localhost:3000/api/oauth/gmail/callback` (for local testing)
   - Add `https://your-backend-url.onrender.com/api/oauth/gmail/callback` (production)
7. Click "Create"
8. **Copy the Client ID and Client Secret** - you'll need these!

## Step 5: Update Environment Variables

Add these to your `.env` file (backend):

```env
# Gmail OAuth Credentials
GMAIL_OAUTH_CLIENT_ID=your_client_id_here
GMAIL_OAUTH_CLIENT_SECRET=your_client_secret_here
GMAIL_OAUTH_REDIRECT_URI=https://your-backend-url.onrender.com/api/oauth/gmail/callback

# Make sure FRONTEND_URL is set for redirects after OAuth
FRONTEND_URL=https://nikolaj-storm.github.io/Snowman.2.0
```

Also update these in your Render environment variables.

## Step 6: Update Frontend

You'll need to add a "Connect Gmail" button in your email accounts page.

### Frontend Changes Needed:

1. **Add Gmail connection button** in `/frontend/src/pages/EmailAccounts.jsx`:

```jsx
<button
  onClick={() => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/api/oauth/gmail/authorize`;
  }}
  className="btn btn-primary"
>
  <img src="/gmail-icon.png" alt="Gmail" className="icon" />
  Connect Gmail Account
</button>
```

2. **Handle OAuth callback** - The backend redirects to:
   - Success: `/email-accounts?success=gmail_connected&email=user@gmail.com`
   - Error: `/email-accounts?error=oauth_denied`

3. **Show success/error messages**:

```jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('success') === 'gmail_connected') {
    const email = params.get('email');
    alert(`Gmail account ${email} connected successfully!`);
    // Clear URL parameters
    window.history.replaceState({}, '', '/email-accounts');
    // Refresh email accounts list
    fetchEmailAccounts();
  }

  if (params.get('error')) {
    const error = params.get('error');
    alert(`Error connecting Gmail: ${error}`);
    window.history.replaceState({}, '', '/email-accounts');
  }
}, []);
```

4. **Update email accounts display** to show provider type:

```jsx
{account.provider_type === 'gmail_oauth' && (
  <span className="badge badge-success">Gmail OAuth</span>
)}
{account.provider_type === 'smtp' && (
  <span className="badge badge-secondary">SMTP</span>
)}
```

## Step 7: Database Migration

Run the migration to add OAuth support columns:

```bash
# The migration file is at:
# backend/database/migrations/005_add_oauth_support_to_email_accounts.sql

# Run it in your Supabase SQL editor
```

This adds the following columns to `email_accounts`:
- `provider_type` (gmail_oauth, microsoft_oauth, smtp_relay, smtp_direct)
- `oauth_refresh_token` (stored securely)
- `oauth_access_token` (auto-refreshed when expired)
- `oauth_token_expires_at` (expiration timestamp)
- `oauth_scope` (granted permissions)
- `warmup_enabled` (email warmup tracking)
- `warmup_daily_limit` (current warmup limit)
- `warmup_current_day` (day of warmup)
- `warmup_started_at` (warmup start date)

## Step 8: Testing

### Local Testing:

1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Go to Email Accounts page
4. Click "Connect Gmail Account"
5. You'll be redirected to Google consent screen
6. Grant permissions
7. You'll be redirected back to your app
8. The Gmail account should appear in your email accounts list

### Production Testing:

1. Deploy to Render (make sure environment variables are set)
2. Update Google Cloud Console redirect URIs with production URL
3. Test the flow on your production site

## How It Works

### OAuth Flow:

```
1. User clicks "Connect Gmail"
   → Frontend redirects to /api/oauth/gmail/authorize

2. Backend generates Google OAuth URL
   → Redirects user to Google consent screen

3. User grants permissions
   → Google redirects to /api/oauth/gmail/callback?code=xxx

4. Backend exchanges code for tokens
   → Gets access_token and refresh_token
   → Gets user's email address from Gmail API
   → Saves to database

5. Backend redirects to frontend
   → Frontend shows success message
   → Email account appears in list
```

### Sending Emails:

```
1. Campaign execution triggers
   → emailService.sendEmail() is called

2. Email service checks account.provider_type
   → If 'gmail_oauth', routes to gmailService

3. Gmail service checks token expiration
   → Auto-refreshes if expired (uses refresh_token)
   → Updates database with new access_token

4. Gmail service sends via Gmail API
   → Creates MIME message
   → Calls gmail.users.messages.send()
   → Returns message ID

5. Success!
   → Email sent via official Gmail API
   → No SMTP ports needed
```

## Security Notes

1. **Refresh tokens are long-lived** - Store them securely (already handled)
2. **Access tokens expire after 1 hour** - Auto-refreshed by gmailService
3. **Users can revoke access** - Use DELETE /api/oauth/gmail/:accountId
4. **Scope principle** - Only request minimum required scopes
5. **State parameter** - Contains user ID (base64 encoded) to prevent CSRF

## Daily Send Limits

Gmail accounts have sending limits:

- **Free Gmail**: ~500 emails/day
- **Google Workspace**: ~2,000 emails/day

Our default for OAuth accounts is **50 emails/day** to be conservative and allow for email warmup.

Users can gradually increase this limit as their account builds reputation.

## Warmup Strategy

For new Gmail accounts, we recommend:

- **Day 1-7**: 10 emails/day
- **Day 8-14**: 20 emails/day
- **Day 15-21**: 35 emails/day
- **Day 22-30**: 50 emails/day
- **After 30 days**: Gradually increase to 100-200/day

This is handled automatically by the warmup system (to be implemented).

## Troubleshooting

### "No refresh token received"

**Problem**: Google didn't return a refresh token

**Solution**:
- User needs to revoke access at https://myaccount.google.com/permissions
- Try connecting again
- Make sure `prompt: 'consent'` is in authorization URL (already set)

### "Invalid grant" error

**Problem**: Refresh token has been revoked or expired

**Solution**:
- User needs to reconnect their Gmail account
- Delete the old account and create a new connection

### "Daily sending limit exceeded"

**Problem**: Account has hit Gmail's daily limit

**Solution**:
- Wait 24 hours
- Consider adding more email accounts to distribute the load
- Upgrade to Google Workspace for higher limits

## Next Steps

After Gmail OAuth is working:

1. **Implement Microsoft OAuth** - Same pattern for Outlook/Microsoft 365
2. **Build SMTP Relay** - For Zoho and custom providers
3. **Add Email Warmup** - Automated reputation building
4. **Multi-account rotation** - Distribute sending across multiple accounts
5. **Health monitoring** - Track bounce rates, spam complaints

## Support

For issues with:
- **Google OAuth setup**: Check Google Cloud Console settings
- **Backend errors**: Check Render logs for detailed error messages
- **Frontend issues**: Check browser console for errors
- **Database errors**: Check Supabase logs

## Testing Endpoint

Use this to test if OAuth connection is working:

```bash
GET /api/oauth/gmail/test/:accountId
Authorization: Bearer YOUR_JWT_TOKEN
```

Returns:
```json
{
  "success": true,
  "message": "Gmail OAuth connection is working",
  "email": "user@gmail.com",
  "hasValidToken": true
}
```
