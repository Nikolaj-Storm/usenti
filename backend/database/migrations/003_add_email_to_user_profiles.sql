-- ============================================================================
-- Migration: Add email column to user_profiles table
-- ============================================================================
-- This adds the user's email address to the user_profiles table for convenience
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- ============================================================================

-- Add email column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email for existing users from auth.users
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
AND up.email IS NULL;

-- Verify the migration
SELECT
  up.id,
  up.email,
  au.email as auth_email,
  CASE
    WHEN up.email = au.email THEN '✅ Match'
    WHEN up.email IS NULL THEN '⚠️ Missing'
    ELSE '❌ Mismatch'
  END as status
FROM public.user_profiles up
JOIN auth.users au ON up.id = au.id
LIMIT 10;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
