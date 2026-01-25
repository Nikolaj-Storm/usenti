-- ============================================================================
-- CLEANUP SCRIPT: Delete ONLY unconfirmed users
-- ============================================================================
-- This script removes users who haven't confirmed their email addresses
--
-- Use this when:
-- - You see "Email not confirmed" errors in logs
-- - Old test accounts are lingering
-- - Users signed up but never verified email
--
-- ⚠️  This will delete UNCONFIRMED users and their sessions
-- Confirmed users and their data will NOT be affected
--
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ============================================================================

BEGIN;

-- Show unconfirmed users before deletion
SELECT
  'Unconfirmed users to be deleted:' as info,
  COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NULL;

-- List the emails that will be deleted
SELECT
  email,
  created_at,
  'Will be deleted' as status
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;

-- Delete sessions for unconfirmed users
DELETE FROM auth.sessions
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL
);

-- Delete refresh tokens for unconfirmed users
DELETE FROM auth.refresh_tokens
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL
);

-- Delete identities for unconfirmed users (OAuth connections)
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL
);

-- Delete user_profiles for unconfirmed users
DELETE FROM public.user_profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL
);

-- Finally, delete the unconfirmed users
DELETE FROM auth.users
WHERE email_confirmed_at IS NULL;

-- Verify cleanup
SELECT
  'Remaining unconfirmed users:' as info,
  COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NULL;

COMMIT;

-- ============================================================================
-- SUCCESS! 🎉
-- ============================================================================
-- Unconfirmed users have been deleted.
--
-- IMPORTANT: After running this script:
-- 1. Clear browser cache: localStorage.clear(); sessionStorage.clear();
-- 2. Or use incognito/private window
-- 3. Deleted users can now sign up again with the same email
--
-- Confirmed users and their data remain untouched!
-- ============================================================================
