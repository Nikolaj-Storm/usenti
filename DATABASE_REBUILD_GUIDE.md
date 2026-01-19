# 🔄 Fresh Database Build Guide

## Complete Database Rebuild from `schema.sql`

This guide will help you **completely delete** your existing database and rebuild it fresh from the `schema.sql` file with all fixes included.

---

## ⚠️ IMPORTANT: Backup Warning

**This will DELETE ALL DATA in your database!**

If you have any data you want to keep (users, email accounts, campaigns, etc.), you should back it up first. However, if you're starting fresh or fixing critical issues, this is the cleanest approach.

---

## 📋 What's Included in the Schema

The `schema.sql` file includes:

✅ **All tables** (user_profiles, email_accounts, contact_lists, contacts, campaigns, etc.)
✅ **Automatic user profile creation trigger** (the critical fix!)
✅ **Row Level Security (RLS) policies** for all tables
✅ **Indexes** for optimal performance
✅ **Constraints** including the proper account_type constraint
✅ **Auto-update triggers** for updated_at timestamps

---

## 🚀 Step-by-Step Rebuild Process

### **STEP 1: Delete Existing Database Schema**

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- ============================================================================
-- COMPLETE DATABASE CLEANUP
-- ============================================================================
-- This will DELETE ALL TABLES and DATA!
-- Make sure you have backups if needed.

-- Drop all tables in the correct order (reverse of foreign keys)
DROP TABLE IF EXISTS warmup_messages CASCADE;
DROP TABLE IF EXISTS warmup_threads CASCADE;
DROP TABLE IF EXISTS warmup_seeds CASCADE;
DROP TABLE IF EXISTS warmup_configs CASCADE;
DROP TABLE IF EXISTS email_events CASCADE;
DROP TABLE IF EXISTS campaign_contacts CASCADE;
DROP TABLE IF EXISTS campaign_steps CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS contact_lists CASCADE;
DROP TABLE IF EXISTS email_accounts CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop all triggers (CASCADE should handle this, but just to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Verify everything is gone
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- This should return empty or only system tables
```

6. Click **RUN**
7. **Verify output** shows all tables were dropped

---

### **STEP 2: Build Fresh Database from schema.sql**

1. Stay in **SQL Editor**
2. Click **New Query**
3. Open the file: `backend/database/schema.sql` from your repository
4. Copy the **ENTIRE contents** (all 450 lines)
5. Paste into SQL Editor
6. Click **RUN**
7. Wait for completion (should take 5-10 seconds)

**Expected Output:**
```
Success. No rows returned
```

If you see any errors, read them carefully - they'll tell you what went wrong.

---

### **STEP 3: Verify the Database is Correctly Built**

Run this verification query:

```sql
-- ============================================================================
-- VERIFICATION SCRIPT
-- ============================================================================

\echo '==== CHECKING TABLES ===='
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Should show: campaign_contacts, campaign_steps, campaigns, contact_lists,
--              contacts, email_accounts, email_events, user_profiles,
--              warmup_configs, warmup_messages, warmup_seeds, warmup_threads

\echo ''
\echo '==== CHECKING TRIGGER ===='
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Should show: on_auth_user_created | users | EXECUTE FUNCTION handle_new_user()

\echo ''
\echo '==== CHECKING FUNCTION ===='
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('handle_new_user', 'update_updated_at_column');
-- Should show both functions

\echo ''
\echo '==== CHECKING RLS POLICIES ===='
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Should show all RLS policies

\echo ''
\echo '==== CHECKING ACCOUNT TYPE CONSTRAINT ===='
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.email_accounts'::regclass
AND conname = 'email_accounts_account_type_check';
-- Should show constraint with all 6 types

\echo ''
\echo '==== VERIFICATION COMPLETE ===='
```

**Expected Results:**
- ✅ 12 tables created
- ✅ Trigger `on_auth_user_created` exists
- ✅ Functions `handle_new_user` and `update_updated_at_column` exist
- ✅ Multiple RLS policies exist
- ✅ Account type constraint includes: gmail, outlook, zoho, aws_workmail, stalwart, custom

---

### **STEP 4: Test the Complete User Flow**

Now test that everything works end-to-end:

#### 4a. Clear Frontend Session

1. Open: https://nikolaj-storm.github.io/Snowman.2.0/
2. Open browser console (F12)
3. Type:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```
4. Press Enter
5. Refresh the page

#### 4b. Create Test User

1. Click **Sign Up**
2. Enter:
   - Email: `test@example.com` (or your real email)
   - Password: `TestPassword123!`
   - Name: `Test User`
3. Click **Create Account**

**Expected Result:** ✅ You should be logged in and see the dashboard

#### 4c. Verify User Profile Was Created Automatically

Go back to Supabase SQL Editor and run:

```sql
-- Check if user profile was automatically created
SELECT
  au.id,
  au.email,
  au.created_at as auth_created,
  up.id as profile_id,
  up.created_at as profile_created,
  CASE
    WHEN up.id IS NOT NULL THEN '✅ Profile exists!'
    ELSE '❌ NO PROFILE - Trigger failed!'
  END as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
ORDER BY au.created_at DESC
LIMIT 5;
```

**Expected Result:** Your test user should have `status = '✅ Profile exists!'`

#### 4d. Add Email Account

1. In the app, click **Infrastructure** in the sidebar
2. Click **Add Email Account**
3. Fill in details (use your real email or test credentials):
   - **Email:** `your-email@zoho.com`
   - **Account Type:** `Zoho`
   - **IMAP Host:** `imap.zoho.com`
   - **IMAP Port:** `993`
   - **SMTP Host:** `smtp.zoho.com`
   - **SMTP Port:** `587`
   - **Username:** (your email)
   - **Password:** (your password)
4. Click **Add Account**

**Expected Result:** ✅ Account should be created successfully with NO errors

#### 4e. Verify Email Account in Database

```sql
-- Check if email account was created
SELECT
  ea.id,
  ea.email_address,
  ea.account_type,
  ea.user_id,
  ea.is_active,
  ea.created_at,
  '✅ Email account created!' as status
FROM email_accounts ea
ORDER BY ea.created_at DESC
LIMIT 5;
```

**Expected Result:** Your email account should appear in the list

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] All 12 tables exist in database
- [ ] Trigger `on_auth_user_created` exists and works
- [ ] User profile is automatically created when signing up
- [ ] Email accounts can be added without errors
- [ ] All account types are supported (Gmail, Outlook, Zoho, etc.)
- [ ] RLS policies are enforced (users can only see their own data)
- [ ] No foreign key constraint errors
- [ ] No CHECK constraint errors

---

## 🐛 Troubleshooting

### Issue: "relation already exists" error when running schema.sql

**Solution:** You didn't complete STEP 1 (cleanup). Go back and run the cleanup script first.

### Issue: Trigger doesn't work (no profile created)

**Verify trigger exists:**
```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

If it doesn't exist, the schema didn't run properly. Try STEP 2 again.

### Issue: Can't add email account (foreign key error)

**Check if user has a profile:**
```sql
SELECT au.id, au.email, up.id as profile_id
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE au.email = 'your-test-email@example.com';
```

If `profile_id` is NULL, the trigger isn't working. Delete the user and try signing up again.

### Issue: Account type constraint error

**Verify constraint exists:**
```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'email_accounts'::regclass
AND conname = 'email_accounts_account_type_check';
```

Should return: `CHECK (account_type = ANY (ARRAY['gmail', 'outlook', 'zoho', 'aws_workmail', 'stalwart', 'custom']))`

---

## 📊 Monitoring After Rebuild

To monitor your database health after rebuild:

### Check User-Profile Sync Daily

```sql
-- Run this to ensure no orphaned users
SELECT COUNT(*) as orphaned_users
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = au.id);
-- Should always return: 0
```

### Check Email Account Health

```sql
-- See all email accounts and their status
SELECT
  email_address,
  account_type,
  is_active,
  is_warming_up,
  health_score,
  daily_send_limit
FROM email_accounts
ORDER BY created_at DESC;
```

### Check System Statistics

```sql
-- Overall system stats
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM user_profiles) as total_profiles,
  (SELECT COUNT(*) FROM email_accounts) as total_email_accounts,
  (SELECT COUNT(*) FROM contact_lists) as total_contact_lists,
  (SELECT COUNT(*) FROM contacts) as total_contacts,
  (SELECT COUNT(*) FROM campaigns) as total_campaigns;
```

---

## 🎉 You're Done!

Your database is now:
- ✅ Clean and fresh
- ✅ Has all necessary tables and triggers
- ✅ Automatically creates user profiles on signup
- ✅ Supports all email account types
- ✅ Has proper RLS security
- ✅ Ready for production use

**Next Steps:**
1. Start inviting users
2. Add your email accounts
3. Create campaigns
4. Monitor the system with the queries above

---

**Date:** 2026-01-19
**Schema Version:** 1.0 (with auto-profile-creation trigger)
**Status:** ✅ Production Ready
