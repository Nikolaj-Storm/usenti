-- ============================================================================
-- DATABASE VERIFICATION AND CLEANUP SCRIPT
-- ============================================================================
-- Run this script in Supabase SQL Editor to diagnose and fix issues
-- with user authentication and email account creation.
--
-- This script will:
-- 1. Check if the user_profiles trigger exists
-- 2. Verify user-profile synchronization
-- 3. Check account_type constraints
-- 4. Clean up orphaned data
-- 5. Provide diagnostic information
-- ============================================================================

\echo '=================================================='
\echo 'SNOWMAN 2.0 - DATABASE DIAGNOSTIC REPORT'
\echo '=================================================='
\echo ''

-- ============================================================================
-- SECTION 1: TRIGGER VERIFICATION
-- ============================================================================

\echo '1. CHECKING USER_PROFILES TRIGGER...'
\echo ''

SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS: Trigger exists'
    ELSE '❌ FAIL: Trigger does NOT exist - run 001_fix_user_profiles_trigger.sql'
  END AS status,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
GROUP BY trigger_name, event_manipulation, event_object_table;

\echo ''

-- ============================================================================
-- SECTION 2: FUNCTION VERIFICATION
-- ============================================================================

\echo '2. CHECKING HANDLE_NEW_USER FUNCTION...'
\echo ''

SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS: Function exists'
    ELSE '❌ FAIL: Function does NOT exist - run 001_fix_user_profiles_trigger.sql'
  END AS status,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public'
GROUP BY routine_name, routine_type;

\echo ''

-- ============================================================================
-- SECTION 3: USER-PROFILE SYNC STATUS
-- ============================================================================

\echo '3. CHECKING USER-PROFILE SYNCHRONIZATION...'
\echo ''

WITH sync_stats AS (
  SELECT
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM public.user_profiles) as total_profiles,
    (SELECT COUNT(*)
     FROM auth.users au
     WHERE NOT EXISTS (
       SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
     )
    ) as orphaned_users
)
SELECT
  total_auth_users,
  total_profiles,
  orphaned_users,
  CASE
    WHEN orphaned_users = 0 THEN '✅ PASS: All users have profiles'
    ELSE '⚠️  WARNING: ' || orphaned_users || ' users missing profiles - will be fixed below'
  END AS status
FROM sync_stats;

\echo ''

-- ============================================================================
-- SECTION 4: ORPHANED USERS DETAILS
-- ============================================================================

\echo '4. LISTING ORPHANED USERS (if any)...'
\echo ''

SELECT
  au.id,
  au.email,
  au.created_at,
  'Missing profile' AS issue
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL;

\echo ''

-- ============================================================================
-- SECTION 5: ACCOUNT TYPE CONSTRAINT VERIFICATION
-- ============================================================================

\echo '5. CHECKING EMAIL_ACCOUNTS CONSTRAINT...'
\echo ''

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition,
  CASE
    WHEN pg_get_constraintdef(oid) LIKE '%gmail%' AND
         pg_get_constraintdef(oid) LIKE '%outlook%' AND
         pg_get_constraintdef(oid) LIKE '%zoho%' AND
         pg_get_constraintdef(oid) LIKE '%aws_workmail%' AND
         pg_get_constraintdef(oid) LIKE '%stalwart%' AND
         pg_get_constraintdef(oid) LIKE '%custom%'
    THEN '✅ PASS: Constraint includes all required types'
    ELSE '❌ FAIL: Constraint is missing required types'
  END AS status
FROM pg_constraint
WHERE conrelid = 'public.email_accounts'::regclass
AND conname = 'email_accounts_account_type_check';

\echo ''

-- ============================================================================
-- SECTION 6: EMAIL ACCOUNTS SUMMARY
-- ============================================================================

\echo '6. EMAIL ACCOUNTS SUMMARY...'
\echo ''

SELECT
  COUNT(*) AS total_email_accounts,
  COUNT(DISTINCT user_id) AS unique_users_with_accounts,
  COUNT(*) FILTER (WHERE is_active = true) AS active_accounts,
  COUNT(*) FILTER (WHERE is_warming_up = true) AS warming_up_accounts
FROM public.email_accounts;

\echo ''

SELECT
  account_type,
  COUNT(*) AS count
FROM public.email_accounts
GROUP BY account_type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- SECTION 7: RECENT SIGNUP ACTIVITY
-- ============================================================================

\echo '7. RECENT SIGNUP ACTIVITY (last 10 users)...'
\echo ''

SELECT
  au.id,
  au.email,
  au.created_at AS auth_created,
  up.created_at AS profile_created,
  CASE
    WHEN up.id IS NOT NULL THEN '✅ Has profile'
    ELSE '❌ Missing profile'
  END AS profile_status,
  (SELECT COUNT(*) FROM public.email_accounts WHERE user_id = au.id) AS email_accounts_count
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
ORDER BY au.created_at DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- SECTION 8: AUTO-FIX - CREATE MISSING PROFILES
-- ============================================================================

\echo '8. AUTO-FIX: Creating missing user_profiles...'
\echo ''

WITH inserted AS (
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  SELECT
    au.id,
    au.created_at,
    NOW()
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON au.id = up.id
  WHERE up.id IS NULL
  ON CONFLICT (id) DO NOTHING
  RETURNING *
)
SELECT
  COUNT(*) AS profiles_created,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No profiles needed to be created'
    ELSE '✅ Created ' || COUNT(*) || ' missing profiles'
  END AS status
FROM inserted;

\echo ''

-- ============================================================================
-- SECTION 9: RLS POLICIES CHECK
-- ============================================================================

\echo '9. CHECKING ROW LEVEL SECURITY POLICIES...'
\echo ''

SELECT
  schemaname,
  tablename,
  policyname,
  CASE
    WHEN cmd = 'SELECT' THEN 'Read'
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
    WHEN cmd = '*' THEN 'All Operations'
    ELSE cmd
  END AS operation,
  CASE
    WHEN roles = '{public}' THEN '⚠️  Public access'
    ELSE '✅ Restricted'
  END AS access_level
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'email_accounts', 'contact_lists', 'contacts', 'campaigns')
ORDER BY tablename, policyname;

\echo ''

-- ============================================================================
-- SECTION 10: FINAL STATUS SUMMARY
-- ============================================================================

\echo '10. FINAL STATUS SUMMARY'
\echo ''

WITH final_check AS (
  SELECT
    EXISTS(
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'on_auth_user_created'
    ) AS has_trigger,
    EXISTS(
      SELECT 1 FROM information_schema.routines
      WHERE routine_name = 'handle_new_user' AND routine_schema = 'public'
    ) AS has_function,
    (
      SELECT COUNT(*)
      FROM auth.users au
      WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = au.id)
    ) AS orphaned_count,
    EXISTS(
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.email_accounts'::regclass
      AND conname = 'email_accounts_account_type_check'
    ) AS has_constraint
)
SELECT
  CASE
    WHEN has_trigger AND has_function AND orphaned_count = 0 AND has_constraint
    THEN '🎉 ✅ ALL SYSTEMS GO! Database is properly configured.'
    ELSE '⚠️  ISSUES DETECTED - See details above'
  END AS overall_status,
  has_trigger AS "Trigger Exists",
  has_function AS "Function Exists",
  orphaned_count AS "Orphaned Users",
  has_constraint AS "Constraint Exists"
FROM final_check;

\echo ''
\echo '=================================================='
\echo 'END OF DIAGNOSTIC REPORT'
\echo '=================================================='
\echo ''
\echo 'If you see any failures or warnings:'
\echo '1. Run: 001_fix_user_profiles_trigger.sql'
\echo '2. Re-run this script to verify'
\echo '3. Test by creating a new user and adding an email account'
\echo ''
