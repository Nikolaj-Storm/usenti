-- ============================================================================
-- CRITICAL FIX: Auto-create user_profiles when auth.users is created
-- ============================================================================
-- This migration fixes the issue where users can sign up but their profile
-- is not created in user_profiles table, causing email account creation to fail.
--
-- Issue: When users sign up via Supabase Auth, they get added to auth.users
--        but no corresponding entry is created in user_profiles table.
--
-- Solution: Create a trigger that automatically creates a user_profiles entry
--           whenever a new user is added to auth.users.
--
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- ============================================================================

-- Step 1: Create the trigger function
-- This function will be called automatically whenever a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new row into user_profiles with the same UUID as auth.users
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (
    NEW.id,
    NOW(),
    NOW()
  )
  -- If the row already exists (shouldn't happen, but just in case), do nothing
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop the trigger if it already exists (to avoid errors on re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 3: Create the trigger
-- This trigger fires AFTER a new user is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Step 4: Backfill existing users who don't have profiles
-- ============================================================================
-- This fixes any "orphaned" users who signed up before the trigger was in place

INSERT INTO public.user_profiles (id, created_at, updated_at)
SELECT
  au.id,
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Step 5: Verify the account_type constraint is correct
-- ============================================================================
-- Drop the old constraint if it exists
ALTER TABLE public.email_accounts
DROP CONSTRAINT IF EXISTS email_accounts_account_type_check;

-- Re-create the constraint with the correct values
ALTER TABLE public.email_accounts
ADD CONSTRAINT email_accounts_account_type_check
CHECK (account_type IN ('gmail', 'outlook', 'zoho', 'aws_workmail', 'stalwart', 'custom'));

-- ============================================================================
-- VERIFICATION QUERIES (Run these to confirm the fix worked)
-- ============================================================================

-- Query 1: Check if trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Query 2: Check if function exists
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public';

-- Query 3: Check user-profile sync status
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM public.user_profiles) as total_profiles,
  (SELECT COUNT(*)
   FROM auth.users au
   WHERE NOT EXISTS (
     SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
   )
  ) as orphaned_users;
-- Result should show: orphaned_users = 0

-- Query 4: Verify account_type constraint
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.email_accounts'::regclass
AND conname = 'email_accounts_account_type_check';

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- If all verification queries return expected results, the fix is complete.
--
-- What this fixes:
-- ✅ Users can now sign up and their profile is auto-created
-- ✅ Users can add email accounts without foreign key errors
-- ✅ Account type constraint is properly validated
-- ✅ Existing users without profiles have been backfilled
--
-- Test by:
-- 1. Creating a new user account via signup
-- 2. Immediately trying to add an email account (should work!)
-- ============================================================================
