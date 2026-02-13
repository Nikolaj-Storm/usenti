-- ============================================================================
-- Migration: Add name and email columns to user_profiles table
-- ============================================================================
-- This adds the user's name and email to the user_profiles table
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- ============================================================================

-- Add email column (if it doesn't exist from previous migration)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add name column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS name TEXT;

-- Backfill email for existing users from auth.users
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
AND up.email IS NULL;

-- Backfill name for existing users from auth.users metadata
UPDATE public.user_profiles up
SET name = au.raw_user_meta_data->>'name'
FROM auth.users au
WHERE up.id = au.id
AND up.name IS NULL
AND au.raw_user_meta_data->>'name' IS NOT NULL;

-- Verify the migration
SELECT
  up.id,
  up.name,
  up.email,
  au.email as auth_email,
  au.raw_user_meta_data->>'name' as auth_name,
  CASE
    WHEN up.email = au.email AND up.name IS NOT NULL THEN '✅ Complete'
    WHEN up.email IS NULL THEN '⚠️ Missing email'
    WHEN up.name IS NULL THEN '⚠️ Missing name'
    ELSE '❌ Issue'
  END as status
FROM public.user_profiles up
JOIN auth.users au ON up.id = au.id
LIMIT 10;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- user_profiles now has both name and email columns
-- ============================================================================
