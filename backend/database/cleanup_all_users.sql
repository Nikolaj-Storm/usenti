-- ============================================================================
-- CLEANUP SCRIPT: Delete ALL users and associated data
-- ============================================================================
-- ⚠️  WARNING: This will PERMANENTLY DELETE ALL USER DATA from your database!
--
-- Use this script for:
-- - Testing signup/login flow with fresh email addresses
-- - Resetting development database
-- - Clearing test data between testing sessions
-- - Removing all authentication sessions and user records
--
-- 🚨 DANGER ZONE: This cannot be undone!
--
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Delete campaign-related data (in order of dependencies)
-- ============================================================================
-- These tables track email campaigns, steps, contacts, and events

-- Email events (sent, opened, clicked, replied)
DELETE FROM public.email_events;

-- Campaign-contact relationships (who's in which campaign)
DELETE FROM public.campaign_contacts;

-- Campaign steps (email sequences)
DELETE FROM public.campaign_steps;

-- Campaigns (main campaign records)
DELETE FROM public.campaigns;

-- ============================================================================
-- STEP 2: Delete warmup-related data (in order of dependencies)
-- ============================================================================
-- These tables handle email account warmup to build sender reputation

-- Warmup messages (individual warmup emails sent/received)
DELETE FROM public.warmup_messages;

-- Warmup threads (conversation threads between accounts)
DELETE FROM public.warmup_threads;

-- Warmup seeds (recipient addresses used for warmup)
DELETE FROM public.warmup_seeds;

-- Warmup configs (warmup settings per email account)
DELETE FROM public.warmup_configs;

-- ============================================================================
-- STEP 3: Delete contact data
-- ============================================================================
-- Contact lists and individual contacts

-- Contacts (individual contact records)
DELETE FROM public.contacts;

-- Contact lists (groups of contacts)
DELETE FROM public.contact_lists;

-- ============================================================================
-- STEP 4: Delete email accounts
-- ============================================================================
-- User's connected email accounts (Gmail, Outlook, etc.)

DELETE FROM public.email_accounts;

-- ============================================================================
-- STEP 5: Delete user profiles
-- ============================================================================
-- Extended user profile data (company name, timezone, etc.)

DELETE FROM public.user_profiles;

-- ============================================================================
-- STEP 6: Delete authentication records
-- ============================================================================
-- This removes all users from Supabase auth system
-- Includes: login sessions, email confirmations, password reset tokens

-- Delete all auth users (this cascades to any remaining FK references)
DELETE FROM auth.users;

-- Optional: Clear any lingering auth sessions
DELETE FROM auth.sessions;

-- Optional: Clear refresh tokens
DELETE FROM auth.refresh_tokens;

-- ============================================================================
-- STEP 7: Verify cleanup was successful
-- ============================================================================
-- All row counts should be 0

SELECT
  'auth.users' as table_name,
  COUNT(*) as row_count,
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END as status
FROM auth.users

UNION ALL
SELECT 'auth.sessions', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM auth.sessions

UNION ALL
SELECT 'auth.refresh_tokens', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM auth.refresh_tokens

UNION ALL
SELECT 'user_profiles', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.user_profiles

UNION ALL
SELECT 'email_accounts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.email_accounts

UNION ALL
SELECT 'contact_lists', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.contact_lists

UNION ALL
SELECT 'contacts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.contacts

UNION ALL
SELECT 'campaigns', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.campaigns

UNION ALL
SELECT 'campaign_steps', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.campaign_steps

UNION ALL
SELECT 'campaign_contacts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.campaign_contacts

UNION ALL
SELECT 'email_events', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.email_events

UNION ALL
SELECT 'warmup_configs', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.warmup_configs

UNION ALL
SELECT 'warmup_seeds', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.warmup_seeds

UNION ALL
SELECT 'warmup_threads', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.warmup_threads

UNION ALL
SELECT 'warmup_messages', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE '✗ Has data!' END
FROM public.warmup_messages

ORDER BY table_name;

COMMIT;

-- ============================================================================
-- SUCCESS! 🎉
-- ============================================================================
-- All user data has been deleted. You can now:
--
-- ✓ Test signup with any email address (even previously used ones)
-- ✓ Start fresh with a clean database
-- ✓ Test email verification flow from scratch
-- ✓ Test campaign creation without old data interfering
-- ✓ All authentication sessions have been cleared
--
-- Note: Users will need to sign up again to access the application
-- ============================================================================
