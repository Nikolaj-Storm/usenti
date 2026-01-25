-- ============================================================================
-- DEBUG QUERIES: Run these in Supabase SQL Editor to diagnose issues
-- ============================================================================
-- These queries will help you understand why campaigns aren't starting
-- and why the inbox is empty
-- ============================================================================

-- QUERY 1: Get your user ID and email (run this first!)
-- ============================================================================
SELECT
  id as user_id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Copy your user_id from the results above, then use it in queries below
-- Replace 'YOUR_USER_ID' with the actual UUID


-- QUERY 2: Check your campaigns
-- ============================================================================
SELECT
  id,
  name,
  status,  -- Should be 'running' for active campaigns
  email_account_id,
  contact_list_id,
  sending_schedule,
  created_at
FROM campaigns
WHERE user_id = 'YOUR_USER_ID'  -- Replace this!
ORDER BY created_at DESC;

-- What to look for:
-- ✅ status should be 'running' (not 'draft')
-- ✅ email_account_id should not be null
-- ✅ contact_list_id should not be null


-- QUERY 3: Check campaign_contacts (the missing piece!)
-- ============================================================================
SELECT
  cc.id,
  cc.campaign_id,
  cc.status,  -- Should be 'in_progress'
  cc.next_send_time,  -- Should be in the past or near-present
  cc.current_step_id,  -- Should not be null
  c.email as contact_email,
  camp.name as campaign_name
FROM campaign_contacts cc
JOIN contacts c ON c.id = cc.contact_id
JOIN campaigns camp ON camp.id = cc.campaign_id
WHERE camp.user_id = 'YOUR_USER_ID'  -- Replace this!
ORDER BY cc.created_at DESC
LIMIT 20;

-- What to look for:
-- ✅ Should have rows (one per contact)
-- ✅ status = 'in_progress'
-- ✅ next_send_time is in the past
-- ✅ current_step_id is not null
-- ❌ If NO ROWS: The "Start Campaign" button didn't work!


-- QUERY 4: Check campaign steps
-- ============================================================================
SELECT
  cs.id,
  cs.campaign_id,
  cs.step_number,
  cs.subject,
  cs.body_template,
  cs.delay_days,
  c.name as campaign_name
FROM campaign_steps cs
JOIN campaigns c ON c.id = cs.campaign_id
WHERE c.user_id = 'YOUR_USER_ID'  -- Replace this!
ORDER BY cs.campaign_id, cs.step_number;

-- What to look for:
-- ✅ At least one step with step_number = 1
-- ✅ subject and body_template are not null


-- QUERY 5: Check email accounts
-- ============================================================================
SELECT
  id,
  email_address,
  account_type,
  provider_type,
  status,
  daily_send_limit,
  imap_host,
  imap_port,
  smtp_host,
  smtp_port
FROM email_accounts
WHERE user_id = 'YOUR_USER_ID'  -- Replace this!;

-- What to look for:
-- ✅ At least one account exists
-- ✅ status = 'active'
-- ✅ For Gmail: imap_host = 'imap.gmail.com', smtp_host = 'smtp.gmail.com'


-- QUERY 6: Check contacts and contact lists
-- ============================================================================
SELECT
  cl.id as list_id,
  cl.name as list_name,
  COUNT(c.id) as contact_count,
  COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_contacts
FROM contact_lists cl
LEFT JOIN contacts c ON c.list_id = cl.id
WHERE cl.user_id = 'YOUR_USER_ID'  -- Replace this!
GROUP BY cl.id, cl.name;

-- What to look for:
-- ✅ contact_count > 0
-- ✅ active_contacts > 0


-- QUERY 7: Full diagnostic - Everything in one view
-- ============================================================================
WITH user_summary AS (
  SELECT
    'Email Accounts' as resource,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
  FROM email_accounts
  WHERE user_id = 'YOUR_USER_ID'  -- Replace this!

  UNION ALL

  SELECT
    'Contact Lists',
    COUNT(*),
    COUNT(*)
  FROM contact_lists
  WHERE user_id = 'YOUR_USER_ID'  -- Replace this!

  UNION ALL

  SELECT
    'Contacts',
    COUNT(*),
    COUNT(CASE WHEN c.status = 'active' THEN 1 END)
  FROM contacts c
  JOIN contact_lists cl ON cl.id = c.list_id
  WHERE cl.user_id = 'YOUR_USER_ID'  -- Replace this!

  UNION ALL

  SELECT
    'Campaigns',
    COUNT(*),
    COUNT(CASE WHEN status = 'running' THEN 1 END)
  FROM campaigns
  WHERE user_id = 'YOUR_USER_ID'  -- Replace this!

  UNION ALL

  SELECT
    'Campaign Steps',
    COUNT(*),
    COUNT(*)
  FROM campaign_steps cs
  JOIN campaigns c ON c.id = cs.campaign_id
  WHERE c.user_id = 'YOUR_USER_ID'  -- Replace this!

  UNION ALL

  SELECT
    'Campaign Contacts',
    COUNT(*),
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END)
  FROM campaign_contacts cc
  JOIN campaigns c ON c.id = cc.campaign_id
  WHERE c.user_id = 'YOUR_USER_ID'  -- Replace this!

  UNION ALL

  SELECT
    'Email Events (Sent)',
    COUNT(*),
    COUNT(CASE WHEN event_type = 'sent' THEN 1 END)
  FROM email_events ee
  JOIN campaigns c ON c.id = ee.campaign_id
  WHERE c.user_id = 'YOUR_USER_ID'  -- Replace this!
)
SELECT
  resource,
  total,
  active_count,
  CASE
    WHEN resource = 'Email Accounts' AND total = 0 THEN '❌ No email accounts connected!'
    WHEN resource = 'Contact Lists' AND total = 0 THEN '❌ No contact lists created!'
    WHEN resource = 'Contacts' AND total = 0 THEN '❌ No contacts added!'
    WHEN resource = 'Campaigns' AND total = 0 THEN '❌ No campaigns created!'
    WHEN resource = 'Campaigns' AND active_count = 0 THEN '⚠️  No campaigns running!'
    WHEN resource = 'Campaign Steps' AND total = 0 THEN '❌ No email steps in campaigns!'
    WHEN resource = 'Campaign Contacts' AND total = 0 THEN '❌ Campaign not started! Click "Start Campaign"'
    WHEN resource = 'Campaign Contacts' AND active_count = 0 THEN '⚠️  No contacts in progress!'
    WHEN resource = 'Email Events (Sent)' AND total = 0 THEN 'ℹ️  No emails sent yet (normal for new campaigns)'
    ELSE '✅ OK'
  END as status
FROM user_summary
ORDER BY
  CASE resource
    WHEN 'Email Accounts' THEN 1
    WHEN 'Contact Lists' THEN 2
    WHEN 'Contacts' THEN 3
    WHEN 'Campaigns' THEN 4
    WHEN 'Campaign Steps' THEN 5
    WHEN 'Campaign Contacts' THEN 6
    WHEN 'Email Events (Sent)' THEN 7
  END;

-- This query shows you a complete health check of your data
-- Look for any ❌ or ⚠️ icons to see what's wrong


-- ============================================================================
-- FIXES: Run these if you find issues
-- ============================================================================

-- FIX 1: Campaign created but not running
-- ============================================================================
-- If your campaign exists but status is 'draft':
/*
UPDATE campaigns
SET status = 'running'
WHERE user_id = 'YOUR_USER_ID'
AND id = 'YOUR_CAMPAIGN_ID';  -- Get this from QUERY 2
*/


-- FIX 2: Campaign running but no campaign_contacts
-- ============================================================================
-- This means "Start Campaign" button failed
-- You need to manually trigger the start logic
-- Check Render logs for the actual error

-- Or manually create campaign_contacts (advanced):
/*
WITH first_step AS (
  SELECT id, campaign_id
  FROM campaign_steps
  WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  ORDER BY step_number
  LIMIT 1
)
INSERT INTO campaign_contacts (campaign_id, contact_id, current_step_id, status, next_send_time)
SELECT
  'YOUR_CAMPAIGN_ID',
  c.id,
  (SELECT id FROM first_step),
  'in_progress',
  NOW()
FROM contacts c
JOIN contact_lists cl ON cl.id = c.list_id
WHERE cl.id = 'YOUR_CONTACT_LIST_ID'  -- Get this from QUERY 2
AND c.status = 'active';
*/


-- FIX 3: next_send_time is in the future
-- ============================================================================
-- If campaign_contacts exist but next_send_time is too far in future:
/*
UPDATE campaign_contacts
SET next_send_time = NOW()
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
AND status = 'in_progress';
*/


-- ============================================================================
-- INBOX DEBUGGING
-- ============================================================================

-- QUERY 8: Check IMAP settings for email accounts
-- ============================================================================
SELECT
  email_address,
  account_type,
  provider_type,
  imap_host,
  imap_port,
  imap_username,
  LENGTH(imap_password) as password_length,  -- Should be > 0
  status
FROM email_accounts
WHERE user_id = 'YOUR_USER_ID';  -- Replace this!

-- For Gmail:
-- ✅ imap_host should be 'imap.gmail.com'
-- ✅ imap_port should be 993
-- ✅ password_length should be > 0 (encrypted app password)
-- ✅ status should be 'active'

-- Common inbox issues:
-- 1. IMAP not enabled in Gmail settings
-- 2. Wrong app password
-- 3. Account type/provider_type mismatch
-- 4. Backend IMAP service not running

-- To test IMAP manually:
-- 1. Check Render logs for [INBOX] errors
-- 2. Verify Gmail IMAP is enabled (gmail.com → Settings → Forwarding and POP/IMAP)
-- 3. Generate new Gmail app password
-- 4. Update account with new password
