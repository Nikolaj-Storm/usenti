-- ============================================================================
-- CLEANUP SCRIPT: Delete ALL users and associated data
-- ============================================================================
-- ⚠️  WARNING: This will DELETE ALL USER DATA from your database!
--
-- Use this script for:
-- - Testing signup flow with fresh email addresses
-- - Resetting development database
-- - Clearing test data
--
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- ============================================================================

-- Step 1: Delete all data from public tables (in order to respect foreign keys)
-- This ensures cascade deletes work properly

-- Campaign-related tables
DELETE FROM public.email_events;
DELETE FROM public.campaign_contacts;
DELETE FROM public.campaign_steps;
DELETE FROM public.campaigns;

-- Warmup-related tables
DELETE FROM public.warmup_messages;
DELETE FROM public.warmup_threads;
DELETE FROM public.warmup_seeds;
DELETE FROM public.warmup_configs;

-- Contact-related tables
DELETE FROM public.contacts;
DELETE FROM public.contact_lists;

-- Email accounts
DELETE FROM public.email_accounts;

-- User profiles (this will be deleted by cascade, but we do it explicitly)
DELETE FROM public.user_profiles;

-- Step 2: Delete all users from auth.users
-- This is the main auth table managed by Supabase
-- Deleting from here will cascade to any remaining foreign key references
DELETE FROM auth.users;

-- Step 3: Verify everything is deleted
-- Run these queries to confirm all data is gone

SELECT 'auth.users' as table_name, COUNT(*) as row_count FROM auth.users
UNION ALL
SELECT 'user_profiles', COUNT(*) FROM public.user_profiles
UNION ALL
SELECT 'email_accounts', COUNT(*) FROM public.email_accounts
UNION ALL
SELECT 'contact_lists', COUNT(*) FROM public.contact_lists
UNION ALL
SELECT 'contacts', COUNT(*) FROM public.contacts
UNION ALL
SELECT 'campaigns', COUNT(*) FROM public.campaigns
UNION ALL
SELECT 'campaign_steps', COUNT(*) FROM public.campaign_steps
UNION ALL
SELECT 'campaign_contacts', COUNT(*) FROM public.campaign_contacts
UNION ALL
SELECT 'email_events', COUNT(*) FROM public.email_events
UNION ALL
SELECT 'warmup_configs', COUNT(*) FROM public.warmup_configs
UNION ALL
SELECT 'warmup_seeds', COUNT(*) FROM public.warmup_seeds
UNION ALL
SELECT 'warmup_threads', COUNT(*) FROM public.warmup_threads
UNION ALL
SELECT 'warmup_messages', COUNT(*) FROM public.warmup_messages;

-- All counts should be 0

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- All user data has been deleted. You can now:
-- 1. Test signup with any email address (even previously used ones)
-- 2. Start fresh with clean database
-- 3. Test email verification flow from scratch
-- ============================================================================
