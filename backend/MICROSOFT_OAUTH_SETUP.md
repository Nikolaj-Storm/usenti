# Microsoft OAuth Setup Guide

This guide will help you set up Microsoft OAuth integration for Outlook/Microsoft 365 email accounts.

## Why Microsoft OAuth?

Similar to Gmail OAuth, Microsoft Graph API allows you to:

- **Bypass SMTP restrictions** - Uses HTTPS instead of SMTP ports
- **Better security** - OAuth2 instead of passwords
- **Official API** - Send via Microsoft Graph API
- **User-owned reputation** - Each user sends from their own Outlook account
- **Works everywhere** - No port blocking issues

## Supported Email Providers

This integration works with:
- **Outlook.com** (personal Microsoft accounts)
- **Hotmail.com**
- **Live.com**
- **Microsoft 365** (business accounts)
- **Office 365** (business accounts)

## Step 1: Access Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign in with your Microsoft account
3. If you don't have an Azure subscription, you can still register apps for free

## Step 2: Register Your Application

1. Navigate to **Azure Active Directory** (search for it in the top search bar)
2. Click **App registrations** in the left sidebar
3. Click **New registration**
4. Fill in the application details:
   - **Name**: Your app name (e.g., "Snowman Email Platform")
   - **Supported account types**: Select "Accounts in any organizational directory and personal Microsoft accounts"
     - This allows both personal Outlook.com and business Microsoft 365 accounts
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://your-backend-url.onrender.com/api/oauth/microsoft/callback`
     - For local testing, you'll add `http://localhost:3000/api/oauth/microsoft/callback` later
5. Click **Register**

## Step 3: Note Your Application (Client) ID

1. After registration, you'll see the **Overview** page
2. Copy the **Application (client) ID** - you'll need this for `MICROSOFT_OAUTH_CLIENT_ID`
3. Copy the **Directory (tenant) ID** - you won't need this for multi-tenant apps

## Step 4: Create a Client Secret

1. In the left sidebar, click **Certificates & secrets**
2. Click **New client secret**
3. Description: "Snowman Backend Secret" (or your preferred name)
4. Expires: Choose an expiration period
   - **Recommended**: 24 months (you'll need to renew it before expiration)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** immediately - you'll need this for `MICROSOFT_OAUTH_CLIENT_SECRET`
7. ⚠️ **Warning**: This value is only shown once. If you lose it, you'll need to create a new secret.

## Step 5: Add Redirect URIs

1. In the left sidebar, click **Authentication**
2. Under **Platform configurations** → **Web**, you should see your redirect URI
3. Click **Add URI** to add additional URIs:
   - `http://localhost:3000/api/oauth/microsoft/callback` (for local development)
   - Any other URLs you need for different environments
4. Under **Advanced settings**:
   - Leave **Allow public client flows** as **No**
   - Leave **Enable the following mobile and desktop flows** unchecked
5. Click **Save**

## Step 6: Configure API Permissions

1. In the left sidebar, click **API permissions**
2. You should see **Microsoft Graph** → **User.Read** (default permission)
3. Click **Add a permission**
4. Select **Microsoft Graph**
5. Select **Delegated permissions**
6. Search for and add these permissions:
   - ✅ **Mail.Send** - Send mail as user
   - ✅ **Mail.ReadWrite** - Read and write access to user mail
   - ✅ **User.Read** - Sign in and read user profile (already added)
   - ✅ **offline_access** - Maintain access to data (for refresh token)
7. Click **Add permissions**

**Final permissions should be:**
- Microsoft Graph (4):
  - Mail.Send
  - Mail.ReadWrite
  - User.Read
  - offline_access

### Admin Consent (Optional)

If you're setting this up for a specific organization:
1. Click **Grant admin consent for [Your Organization]**
2. This pre-approves the permissions for all users in your organization

For multi-tenant apps (personal accounts), users will consent individually.

## Step 7: Update Environment Variables

Add these to your `.env` file (backend):

```env
# Microsoft OAuth Credentials
MICROSOFT_OAUTH_CLIENT_ID=your_application_client_id_here
MICROSOFT_OAUTH_CLIENT_SECRET=your_client_secret_here
MICROSOFT_OAUTH_REDIRECT_URI=https://your-backend-url.onrender.com/api/oauth/microsoft/callback

# Make sure FRONTEND_URL is set for redirects after OAuth
FRONTEND_URL=https://nikolaj-storm.github.io/Snowman.2.0
```

Also add these to your Render environment variables:
1. Go to Render Dashboard → Your Service → Environment
2. Add `MICROSOFT_OAUTH_CLIENT_ID`
3. Add `MICROSOFT_OAUTH_CLIENT_SECRET`
4. Add `MICROSOFT_OAUTH_REDIRECT_URI`

## Step 8: Frontend Integration

### Add Microsoft Connection Button

In your email accounts page (`/frontend/src/pages/EmailAccounts.jsx`):

```jsx
<button
  onClick={() => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/api/oauth/microsoft/authorize`;
  }}
  className="btn btn-primary"
>
  <img src="/microsoft-icon.png" alt="Microsoft" className="icon" />
  Connect Outlook Account
</button>
```

### Handle OAuth Callback

```jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  // Handle Microsoft OAuth success
  if (params.get('success') === 'microsoft_connected') {
    const email = params.get('email');
    alert(`Microsoft account ${email} connected successfully!`);
    window.history.replaceState({}, '', '/email-accounts');
    fetchEmailAccounts();
  }

  // Handle Gmail OAuth success
  if (params.get('success') === 'gmail_connected') {
    const email = params.get('email');
    alert(`Gmail account ${email} connected successfully!`);
    window.history.replaceState({}, '', '/email-accounts');
    fetchEmailAccounts();
  }

  // Handle errors
  if (params.get('error')) {
    const error = params.get('error');
    alert(`Error connecting account: ${error}`);
    window.history.replaceState({}, '', '/email-accounts');
  }
}, []);
```

### Display Provider Badges

```jsx
{account.provider_type === 'gmail_oauth' && (
  <span className="badge badge-success">
    <i className="fab fa-google"></i> Gmail
  </span>
)}
{account.provider_type === 'microsoft_oauth' && (
  <span className="badge badge-info">
    <i className="fab fa-microsoft"></i> Outlook
  </span>
)}
{account.provider_type === 'smtp' && (
  <span className="badge badge-secondary">
    <i className="fas fa-envelope"></i> SMTP
  </span>
)}
```

## Step 9: Testing

### Local Testing:

1. Start backend: `cd backend && npm install && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to Email Accounts page
4. Click "Connect Outlook Account"
5. Sign in with your Microsoft account
6. Grant permissions
7. Verify you're redirected back and account appears in list

### Production Testing:

1. Deploy backend to Render with environment variables set
2. Make sure redirect URI in Azure matches your production URL
3. Test the flow on your production site

## How It Works

### OAuth Flow:

```
1. User clicks "Connect Outlook"
   → Redirects to /api/oauth/microsoft/authorize

2. Backend generates Microsoft OAuth URL
   → Redirects user to Microsoft login page

3. User signs in and grants permissions
   → Microsoft redirects to /api/oauth/microsoft/callback?code=xxx

4. Backend exchanges code for tokens
   → Gets access_token and refresh_token
   → Gets user's email from Microsoft Graph API
   → Saves tokens to database

5. Backend redirects to frontend
   → Success message shown
   → Email account appears in list
```

### Sending Emails:

```
1. Campaign triggers email send
   → emailService.sendEmail() called

2. Checks provider_type
   → If 'microsoft_oauth', routes to microsoftService

3. Microsoft service validates token
   → Auto-refreshes if expired
   → Updates database with new token

4. Sends via Microsoft Graph API
   → POST /me/sendMail
   → Returns success

5. Email sent!
   → No SMTP needed
   → Works on any hosting
```

## Important Differences from Gmail OAuth

### 1. Token Refresh
- Microsoft refresh tokens **don't expire** (unless revoked)
- Gmail refresh tokens also don't expire but can be revoked if inactive for 6 months

### 2. Revoking Access
- Microsoft: Users must revoke at https://account.live.com/consent/Manage
- Gmail: Can be revoked via API

### 3. Message ID
- Microsoft Graph API doesn't return message ID after sending
- We generate a unique tracking ID instead

### 4. Scopes
- Microsoft uses different scope syntax (Mail.Send vs gmail.send)
- `offline_access` is explicitly needed for refresh token

## Daily Send Limits

Microsoft accounts have different limits:

- **Outlook.com (Personal)**: ~300 emails/day
- **Microsoft 365 (Business)**: ~10,000 emails/day (varies by plan)
- **Office 365 E1/E3**: ~10,000 emails/day

Our default for OAuth accounts is **50 emails/day** to be conservative.

## Security Notes

1. **Client Secret**: Store securely, never commit to git
2. **Refresh Tokens**: Long-lived, store securely (already encrypted in DB)
3. **Access Tokens**: Expire after 1 hour, auto-refreshed
4. **State Parameter**: Prevents CSRF attacks
5. **HTTPS Only**: Redirect URIs must use HTTPS in production

## Troubleshooting

### "AADSTS50011: The redirect URI specified does not match"

**Problem**: Redirect URI in your request doesn't match Azure configuration

**Solution**:
1. Check Azure Portal → App registrations → Authentication
2. Ensure redirect URI exactly matches (including http/https and trailing slashes)
3. For Render, use: `https://your-app.onrender.com/api/oauth/microsoft/callback`

### "AADSTS65001: The user or administrator has not consented"

**Problem**: User hasn't consented to permissions

**Solution**:
1. Make sure `prompt: 'consent'` is in authorization URL (already set)
2. User needs to complete consent flow
3. If for organization, admin may need to grant consent in Azure Portal

### "Invalid client secret"

**Problem**: Client secret is incorrect or expired

**Solution**:
1. Go to Azure Portal → App registrations → Certificates & secrets
2. Check if secret is expired
3. Create new secret if needed
4. Update environment variable

### "No refresh token received"

**Problem**: `offline_access` scope not granted

**Solution**:
1. Check that `offline_access` is in the scopes list (already included)
2. Make sure `prompt: 'consent'` is set (already set)
3. User may need to revoke and reconnect

### "Graph API error: InvalidAuthenticationToken"

**Problem**: Access token expired or invalid

**Solution**:
- Service automatically refreshes tokens
- If persists, user needs to reconnect account

## Testing Endpoint

Test if Microsoft OAuth connection is working:

```bash
GET /api/oauth/microsoft/test/:accountId
Authorization: Bearer YOUR_JWT_TOKEN
```

Response:
```json
{
  "success": true,
  "message": "Microsoft OAuth connection is working",
  "email": "user@outlook.com",
  "hasValidToken": true
}
```

## Next Steps

After Microsoft OAuth is working:

1. **Test with different account types**:
   - Personal Outlook.com account
   - Business Microsoft 365 account
   - Hotmail/Live accounts

2. **Monitor token refresh**: Check logs to ensure tokens refresh properly

3. **Add rate limiting**: Respect Microsoft's API rate limits

4. **Implement retry logic**: Handle transient API errors

5. **Add webhook support**: Monitor for revoked tokens

## Support Resources

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph Send Mail API](https://docs.microsoft.com/en-us/graph/api/user-sendmail)
- [OAuth 2.0 in Azure AD](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
