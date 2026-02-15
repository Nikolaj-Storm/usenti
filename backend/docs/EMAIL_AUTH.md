# Email Authentication Guide

## Overview

Different email providers have different authentication requirements. This guide explains how to authenticate with each provider.

## Microsoft Outlook / Office 365

**IMPORTANT: Basic authentication (username/password) has been disabled for IMAP in Exchange Online since late 2022.**

You have two options:

### Option 1: App Passwords (Recommended for Individual Accounts)

If your organization allows it, you can use app-specific passwords:

1. Go to your Microsoft account security settings: https://account.microsoft.com/security
2. Navigate to "Advanced security options"
3. Under "App passwords", click "Create a new app password"
4. Copy the generated password
5. Use this password in Mr. Snowman instead of your regular password

**Note:** App passwords may be disabled by your organization's IT admin.

### Option 2: OAuth 2.0 (Enterprise)

For enterprise accounts or when app passwords are disabled, OAuth 2.0 is required. This requires:

1. Registering an application in Azure AD
2. Configuring API permissions (IMAP.AccessAsUser.All, SMTP.Send)
3. Implementing the OAuth flow

**Status:** OAuth 2.0 support is planned for a future release.

### Option 3: Use Modern Auth Protocols

If you have access to Microsoft Graph API, consider using it instead of IMAP/SMTP:
- Microsoft Graph API supports OAuth 2.0 natively
- More reliable and feature-rich
- Better for enterprise scenarios

## Gmail / Google Workspace

Gmail also has restrictions on basic authentication:

### App Passwords (Recommended)

1. Enable 2-Step Verification on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an app password for "Mail"
4. Use this password in Mr. Snowman

### OAuth 2.0

For better security, use OAuth 2.0 with Gmail API:
- Requires creating a project in Google Cloud Console
- Configure OAuth 2.0 credentials
- Enable Gmail API

**Status:** OAuth 2.0 support is planned for a future release.

## Zoho Mail (Recommended Alternative)

Zoho Mail supports standard IMAP/SMTP with username and password:
- **No app passwords or OAuth required**
- Simple username and password authentication
- Professional and reliable
- Great deliverability
- Affordable pricing

**Settings:**
- IMAP Host: `imap.zoho.com`
- IMAP Port: `993`
- SMTP Host: `smtp.zoho.com`
- SMTP Port: `587`

**Why choose Zoho:**
- Easy setup compared to Gmail/Outlook
- No complex authentication requirements
- Professional appearance
- Good for both personal and business use

## AWS WorkMail

AWS WorkMail supports standard IMAP/SMTP with username and password:
- No special authentication required
- Use your WorkMail email and password

## Custom SMTP (Stalwart, etc.)

Most custom SMTP servers support basic authentication:
- Standard username/password authentication
- Some may support OAuth 2.0 or other mechanisms

## Troubleshooting

### "Authentication failed" errors

1. **Check if basic auth is enabled**
   - For Outlook: Check with your IT admin
   - For Gmail: Use app passwords

2. **Verify credentials**
   - Double-check username and password
   - Ensure no extra spaces

3. **Check server settings**
   - IMAP Host: outlook.office365.com (for Outlook)
   - IMAP Port: 993
   - SMTP Host: smtp.office365.com (for Outlook)
   - SMTP Port: 587

4. **Firewall/Network issues**
   - Ensure ports 993 (IMAP) and 587 (SMTP) are not blocked
   - Try from a different network

### "Connection timeout" errors

- Check if your network allows IMAP/SMTP connections
- Some corporate networks block these ports
- Try using a VPN

## Future Enhancements

Planned authentication improvements:
- [ ] Native OAuth 2.0 support for Microsoft 365
- [ ] Native OAuth 2.0 support for Gmail
- [ ] Support for Microsoft Graph API
- [ ] Support for Gmail API
- [ ] Token refresh automation
- [ ] Multi-factor authentication support
