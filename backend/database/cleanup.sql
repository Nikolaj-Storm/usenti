-- ============================================================================
-- CLEANUP SCRIPT: Delete ALL users and associated data
-- ============================================================================
-- Version: 2.1 (Synced with Verified Schema)
-- Updated: 2026-02-01
--
-- This will PERMANENTLY DELETE ALL USER DATA from your database!
--
-- Use this script for:
-- - Testing signup/login flow with fresh email addresses
-- - Resetting development database
-- - Clearing test data between testing sessions
-- - Removing all authentication sessions and user records
-- - Clearing OAuth tokens (Gmail, Microsoft) from email accounts
--
-- DANGER ZONE: This cannot be undone!
--
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Delete inbox messages (unified inbox)
-- ============================================================================
DELETE FROM public.inbox_messages;

-- ============================================================================
-- STEP 2: Delete campaign-related data (in order of dependencies)
-- ============================================================================
-- Email events (sent, opened, clicked, replied, unsubscribed)
DELETE FROM public.email_events;

-- Campaign-contact relationships (who's in which campaign)
DELETE FROM public.campaign_contacts;

-- Campaign steps (email sequences, waits, conditions)
-- Note: Handles recursive self-references via ON DELETE SET NULL in schema
DELETE FROM public.campaign_steps;

-- Campaigns (main campaign records)
DELETE FROM public.campaigns;

-- ============================================================================
-- STEP 3: Delete warmup-related data
-- ============================================================================
DELETE FROM public.warmup_messages;
DELETE FROM public.warmup_threads;

-- OPTIONAL: Delete Warmup Seeds
-- These are admin-managed accounts. Comment out the next line if you want 
-- to keep your seed network while wiping user data.
DELETE FROM public.warmup_seeds;

DELETE FROM public.warmup_configs;

-- ============================================================================
-- STEP 4: Delete contact data
-- ============================================================================
DELETE FROM public.contacts;
DELETE FROM public.contact_lists;

-- ============================================================================
-- STEP 5: Delete email accounts
-- ============================================================================
-- Deletes connected Gmail/Outlook accounts and tokens
DELETE FROM public.email_accounts;

-- ============================================================================
-- STEP 6: Delete user profiles
-- ============================================================================
DELETE FROM public.user_profiles;

-- ============================================================================
-- STEP 7: Delete authentication records
-- ============================================================================
-- Cleans up Supabase Auth schema

-- Clear all active sessions (forces logout)
DELETE FROM auth.sessions;

-- Clear all refresh tokens
DELETE FROM auth.refresh_tokens;

-- Clear identities (OAuth connections like Google, GitHub, etc.)
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users);

-- Clear MFA factors (if any)
DELETE FROM auth.mfa_factors WHERE user_id IN (SELECT id FROM auth.users);

-- Clear MFA challenges (if any)
DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors);

-- Clear one-time tokens (password reset, email confirmation, etc.)
DELETE FROM auth.one_time_tokens WHERE user_id IN (SELECT id FROM auth.users);

-- Finally, delete all users (this cascades to internal auth tables)
DELETE FROM auth.users;

-- ============================================================================
-- STEP 8: Verify cleanup was successful
-- ============================================================================
-- All row counts should be 0

SELECT
  'auth.users' as table_name,
  COUNT(*) as row_count,
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END as status
FROM auth.users

UNION ALL
SELECT 'auth.sessions', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM auth.sessions

UNION ALL
SELECT 'auth.identities', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM auth.identities

UNION ALL
SELECT 'user_profiles', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.user_profiles

UNION ALL
SELECT 'email_accounts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.email_accounts

UNION ALL
SELECT 'inbox_messages', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.inbox_messages

UNION ALL
SELECT 'contact_lists', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.contact_lists

UNION ALL
SELECT 'contacts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.contacts

UNION ALL
SELECT 'campaigns', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.campaigns

UNION ALL
SELECT 'campaign_steps', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.campaign_steps

UNION ALL
SELECT 'campaign_contacts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.campaign_contacts

UNION ALL
SELECT 'email_events', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.email_events

UNION ALL
SELECT 'warmup_configs', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.warmup_configs

UNION ALL
SELECT 'warmup_seeds', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.warmup_seeds

UNION ALL
SELECT 'warmup_threads', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.warmup_threads

UNION ALL
SELECT 'warmup_messages', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM public.warmup_messages

ORDER BY table_name;

COMMIT;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
