-- ============================================================================
-- CLEANUP SCRIPT: Delete ALL users and associated data
-- ============================================================================
-- Version: 2.0 (Updated to match current schema)
-- Updated: 2026-01-28
--
-- This will PERMANENTLY DELETE ALL USER DATA from your database!
--
-- Use this script for:
-- - Testing signup/login flow with fresh email addresses
-- - Resetting development database
-- - Clearing test data between testing sessions
-- - Removing all authentication sessions and user records
-- - Clearing OAuth tokens (Gmail, Microsoft) from email accounts
-- - Removing unconfirmed email accounts
--
-- DANGER ZONE: This cannot be undone!
--
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ============================================================================
--
-- ALTERNATIVE: To delete ONLY unconfirmed users (not all data), use this instead:
-- /*
-- DELETE FROM auth.users WHERE email_confirmed_at IS NULL;
-- DELETE FROM auth.sessions;
-- DELETE FROM auth.refresh_tokens;
-- */
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Delete inbox messages (unified inbox)
-- ============================================================================
-- Clear all received email messages in the unified inbox

DELETE FROM public.inbox_messages;

-- ============================================================================
-- STEP 2: Delete campaign-related data (in order of dependencies)
-- ============================================================================
-- These tables track email campaigns, steps, contacts, and events

-- Email events (sent, opened, clicked, replied, unsubscribed)
DELETE FROM public.email_events;

-- Campaign-contact relationships (who's in which campaign)
DELETE FROM public.campaign_contacts;

-- Campaign steps (email sequences, waits, conditions)
DELETE FROM public.campaign_steps;

-- Campaigns (main campaign records)
DELETE FROM public.campaigns;

-- ============================================================================
-- STEP 3: Delete warmup-related data (in order of dependencies)
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
-- STEP 4: Delete contact data
-- ============================================================================
-- Contact lists and individual contacts

-- Contacts (individual contact records)
DELETE FROM public.contacts;

-- Contact lists (groups of contacts)
DELETE FROM public.contact_lists;

-- ============================================================================
-- STEP 5: Delete email accounts
-- ============================================================================
-- User's connected email accounts (Gmail, Outlook, Zoho, etc.)
-- This includes both SMTP accounts and OAuth-connected accounts
-- All OAuth tokens (Gmail, Microsoft) will be cleared
-- Sender display names will be removed

DELETE FROM public.email_accounts;

-- ============================================================================
-- STEP 6: Delete user profiles
-- ============================================================================
-- Extended user profile data (email, name, company name, timezone, etc.)

DELETE FROM public.user_profiles;

-- ============================================================================
-- STEP 7: Delete authentication records
-- ============================================================================
-- This removes all users from Supabase auth system
-- Includes: login sessions, email confirmations, password reset tokens, OAuth data

-- Clear all active sessions (forces logout)
DELETE FROM auth.sessions;

-- Clear all refresh tokens
DELETE FROM auth.refresh_tokens;

-- Clear SAML providers (if any)
DELETE FROM auth.saml_providers WHERE id IN (SELECT id FROM auth.users);

-- Clear SAML relay states (if any)
DELETE FROM auth.saml_relay_states WHERE id IN (SELECT id FROM auth.users);

-- Clear identities (OAuth connections like Google, GitHub, etc.)
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users);

-- Clear MFA factors (if any)
DELETE FROM auth.mfa_factors WHERE user_id IN (SELECT id FROM auth.users);

-- Clear MFA challenges (if any)
DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors);

-- Clear one-time tokens (password reset, email confirmation, etc.)
DELETE FROM auth.one_time_tokens WHERE user_id IN (SELECT id FROM auth.users);

-- Finally, delete all users (this should cascade to remaining references)
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
SELECT 'auth.refresh_tokens', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'Clean' ELSE 'Has data!' END
FROM auth.refresh_tokens

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
-- All user data has been deleted. You can now:
--
-- - Test signup with any email address (even previously used ones)
-- - Start fresh with a clean database
-- - Test email verification flow from scratch
-- - Test campaign creation without old data interfering
-- - All authentication sessions have been cleared
-- - All OAuth tokens (Gmail, Microsoft) have been removed
-- - Unconfirmed email accounts have been deleted
--
-- IMPORTANT: After running this script:
-- 1. Clear browser cache: localStorage.clear(); sessionStorage.clear();
-- 2. Or use incognito/private window for testing
-- 3. Users will need to sign up again to access the application
-- 4. Reconnect OAuth accounts (Gmail/Outlook) if testing OAuth features
-- ============================================================================
