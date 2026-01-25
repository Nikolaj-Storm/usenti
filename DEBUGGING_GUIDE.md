# Debugging Guide for Common Issues

## Issue: Old Account Still Works After Running Cleanup Script

### Problem
After running the database cleanup script, you can still sign in with old accounts.

### Why This Happens
- The cleanup script deleted users from the database
- BUT your browser still has the old JWT authentication token cached
- The backend can validate this token even though the user is gone from the database

### Solution
**Option 1: Force logout via browser console**
```javascript
// Open browser console (F12 or Cmd+Option+I)
localStorage.clear();
sessionStorage.clear();
location.reload();
```

**Option 2: Manual logout**
1. Click "Logout" in your app
2. Clear browser data (Cmd+Shift+Delete or Ctrl+Shift+Delete)
3. Select "Cookies and other site data"
4. Click "Clear data"

**Option 3: Use incognito/private window**
- This starts with clean localStorage
- Good for testing fresh signups

---

## Issue: Campaign Won't Start / No Emails Sending

### Problem
After creating a campaign and clicking "Start Campaign", the executor logs show "No pending emails to send".

### Debugging Steps

**Step 1: Check if campaign exists and is running**

Run in Supabase SQL Editor:
```sql
SELECT
  id,
  name,
  status,
  email_account_id,
  contact_list_id,
  created_at
FROM campaigns
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: You should see your campaign with `status = 'running'`

**Step 2: Check if campaign_contacts were created**

```sql
SELECT
  cc.id,
  cc.campaign_id,
  cc.contact_id,
  cc.status,
  cc.current_step_id,
  cc.next_send_time,
  c.email as contact_email,
  camp.name as campaign_name
FROM campaign_contacts cc
JOIN contacts c ON c.id = cc.contact_id
JOIN campaigns camp ON camp.id = cc.campaign_id
WHERE camp.user_id = 'YOUR_USER_ID'
ORDER BY cc.created_at DESC
LIMIT 10;
```

Expected results:
- Rows exist (one per contact in your list)
- `status = 'in_progress'`
- `next_send_time` is in the past or near-present
- `current_step_id` is not null

**Step 3: Check if campaign steps exist**

```sql
SELECT
  cs.id,
  cs.campaign_id,
  cs.step_number,
  cs.subject,
  cs.delay_days,
  c.name as campaign_name
FROM campaign_steps cs
JOIN campaigns c ON c.id = cs.campaign_id
WHERE c.user_id = 'YOUR_USER_ID'
ORDER BY cs.campaign_id, cs.step_number;
```

Expected: At least one step with step_number = 1

**Step 4: Check email account exists**

```sql
SELECT
  id,
  email_address,
  provider_type,
  status,
  daily_send_limit
FROM email_accounts
WHERE user_id = 'YOUR_USER_ID';
```

Expected: At least one account with `status = 'active'`

**Step 5: Check contact list has contacts**

```sql
SELECT
  cl.id as list_id,
  cl.name as list_name,
  COUNT(c.id) as contact_count
FROM contact_lists cl
LEFT JOIN contacts c ON c.list_id = cl.id
WHERE cl.user_id = 'YOUR_USER_ID'
GROUP BY cl.id, cl.name;
```

Expected: Your list should show `contact_count > 0`

### Common Causes & Fixes

**Cause 1: Campaign status is 'draft' not 'running'**
- The "Start Campaign" button didn't work properly
- **Fix:** Check frontend logs for errors when clicking "Start Campaign"
- **Manual fix in database:**
  ```sql
  UPDATE campaigns
  SET status = 'running'
  WHERE id = 'YOUR_CAMPAIGN_ID';
  ```

**Cause 2: campaign_contacts not created**
- The backend route `/api/campaigns/:id/start` failed
- **Fix:** Check Render backend logs for errors during campaign start
- **Check frontend:** Open browser console, look for failed API requests to `/api/campaigns/.../start`

**Cause 3: next_send_time is in the future**
- Campaign has a schedule (e.g., only send Mon-Fri 9am-5pm)
- Current time is outside that schedule
- **Fix:** Check campaign schedule settings
- **Manual fix:**
  ```sql
  UPDATE campaign_contacts
  SET next_send_time = NOW()
  WHERE campaign_id = 'YOUR_CAMPAIGN_ID';
  ```

**Cause 4: No campaign steps**
- Campaign was created without email content
- **Fix:** Make sure you added at least one email step before starting campaign

---

## Issue: Inbox Showing 0 Emails

### Problem
The inbox page loads but shows no emails, even though your Gmail has emails.

### Why This Happens
The inbox feature uses IMAP to fetch emails from your connected accounts. If IMAP connection fails silently, you'll see 0 emails.

### Debugging Steps

**Step 1: Check if email account is connected**

In Supabase SQL Editor:
```sql
SELECT
  id,
  email_address,
  account_type,
  provider_type,
  imap_host,
  imap_port,
  imap_username,
  status
FROM email_accounts
WHERE user_id = 'YOUR_USER_ID';
```

Expected:
- At least one account exists
- `status = 'active'`
- For Gmail: `imap_host = 'imap.gmail.com'`, `imap_port = 993`

**Step 2: Check backend logs for IMAP errors**

In Render logs, search for:
- `[INBOX]` - Inbox fetch attempts
- `IMAP` - IMAP connection logs
- `Error` - Any IMAP errors

Look for error messages like:
- "Invalid credentials" - App password is wrong
- "Connection timeout" - Network/firewall issue
- "Authentication failed" - Need to enable IMAP in Gmail settings

**Step 3: Verify Gmail IMAP is enabled**

1. Go to Gmail Settings → Forwarding and POP/IMAP
2. Make sure "IMAP access" is **Enabled**
3. Click "Save Changes"

**Step 4: Verify App Password is correct**

If using Gmail with app password:
1. Go to Google Account → Security → 2-Step Verification → App passwords
2. Generate a new 16-character app password
3. Update your email account in the app with the new password

**Step 5: Check if provider_type is set correctly**

For SMTP/IMAP accounts (not OAuth):
```sql
SELECT
  email_address,
  provider_type,
  account_type
FROM email_accounts
WHERE user_id = 'YOUR_USER_ID';
```

Expected:
- If using app password: `provider_type = 'smtp'` or `NULL`
- If using OAuth: `provider_type = 'gmail_oauth'`

### Common Causes & Fixes

**Cause 1: IMAP not enabled in Gmail**
- Gmail IMAP is disabled by default for security
- **Fix:** Enable IMAP in Gmail settings (see Step 3 above)

**Cause 2: Wrong app password**
- App password was typed incorrectly or expired
- **Fix:** Generate new app password and update account

**Cause 3: IMAP monitor service not running**
- The IMAP background service might have crashed
- **Fix:** Restart Render backend service

**Cause 4: Inbox is actually empty**
- Your Gmail inbox might be empty or all emails are archived
- **Fix:** Send yourself a test email

---

## Issue: Database Cleanup Script Not Working

### Problem
After running cleanup script, some data remains or you get errors.

### Solution: Run cleanup script correctly

**Step 1: Copy the entire script**
- Include the `BEGIN;` at the start
- Include the `COMMIT;` at the end
- Don't select partial sections

**Step 2: Run in Supabase SQL Editor**
1. Go to https://app.supabase.com
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New query"
5. Paste the entire cleanup script
6. Click "Run" (or Cmd+Enter)

**Step 3: Verify cleanup worked**
The script includes a verification query at the end that shows all tables and their row counts. All should show "✓ Clean".

**Step 4: If you get permission errors**

Add this at the start of the script:
```sql
-- Set role to service_role for full permissions
SET ROLE service_role;
```

Then run the full script again.

**Step 5: Force logout all users**
After cleanup, users might still be logged in with cached tokens. To force logout:

Add this to the cleanup script BEFORE `COMMIT;`:
```sql
-- Invalidate all sessions by deleting auth.sessions
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
```

---

## Getting Your User ID

Many debugging queries require your user ID. Here's how to get it:

**Option 1: From browser console**
```javascript
// While logged in, open browser console (F12)
const user = JSON.parse(localStorage.getItem('user'));
console.log('User ID:', user.id);
console.log('Email:', user.email);
```

**Option 2: From Supabase**
```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

**Option 3: From backend logs**
Look for user_id in any API request logs.

---

## Quick Health Check Query

Run this to see the state of your data:

```sql
-- Get current user's data summary
WITH user_data AS (
  SELECT id, email FROM auth.users LIMIT 1  -- Adjust to your user
)
SELECT
  'Email Accounts' as resource,
  COUNT(*) as count
FROM email_accounts
WHERE user_id = (SELECT id FROM user_data)

UNION ALL

SELECT
  'Contact Lists',
  COUNT(*)
FROM contact_lists
WHERE user_id = (SELECT id FROM user_data)

UNION ALL

SELECT
  'Contacts',
  COUNT(*)
FROM contacts c
JOIN contact_lists cl ON cl.id = c.list_id
WHERE cl.user_id = (SELECT id FROM user_data)

UNION ALL

SELECT
  'Campaigns',
  COUNT(*)
FROM campaigns
WHERE user_id = (SELECT id FROM user_data)

UNION ALL

SELECT
  'Campaign Contacts',
  COUNT(*)
FROM campaign_contacts cc
JOIN campaigns c ON c.id = cc.campaign_id
WHERE c.user_id = (SELECT id FROM user_data)

UNION ALL

SELECT
  'Email Events',
  COUNT(*)
FROM email_events ee
JOIN campaigns c ON c.id = ee.campaign_id
WHERE c.user_id = (SELECT id FROM user_data);
```

This shows how many of each resource you have, which helps identify missing data.

---

## Still Having Issues?

### Check Render Logs
1. Go to Render Dashboard
2. Click on your backend service
3. Click "Logs" tab
4. Set to "Live tail"
5. Try the action again (start campaign, load inbox, etc.)
6. Watch for errors in red

### Check Frontend Logs
1. Open your app
2. Press F12 (or Cmd+Option+I on Mac)
3. Go to "Console" tab
4. Try the action again
5. Look for red error messages
6. Look for failed API requests (shown in red with 400/500 status codes)

### Check Database Permissions
Some issues are caused by Row Level Security (RLS) policies. Check if RLS is blocking your queries:

```sql
-- Check if RLS is enabled on key tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('campaigns', 'campaign_contacts', 'email_accounts', 'contacts', 'contact_lists');
```

If `rowsecurity = true` for any table, the RLS policies might be blocking your operations.

**Quick fix for testing (NOT for production):**
```sql
-- Temporarily disable RLS on campaigns table
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;

-- Try your operation again

-- Re-enable RLS when done testing
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
```
