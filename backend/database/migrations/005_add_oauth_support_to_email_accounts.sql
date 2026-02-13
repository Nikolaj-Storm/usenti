-- ============================================================================
-- Migration: Add OAuth and Multi-Provider Support
-- ============================================================================
-- This adds support for Gmail OAuth, Microsoft OAuth, and SMTP relay
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- ============================================================================

-- Add new columns for OAuth and provider types
ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'smtp'
  CHECK (provider_type IN ('gmail_oauth', 'microsoft_oauth', 'smtp_relay', 'smtp_direct'));

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT;

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS oauth_access_token TEXT;

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS oauth_token_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS oauth_scope TEXT;

-- Add warmup tracking columns
ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS warmup_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS warmup_daily_limit INTEGER DEFAULT 20;

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS warmup_current_day INTEGER DEFAULT 0;

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMP WITH TIME ZONE;

-- Update existing accounts to smtp_direct
UPDATE public.email_accounts
SET provider_type = 'smtp_direct'
WHERE provider_type IS NULL;

-- Add comments
COMMENT ON COLUMN public.email_accounts.provider_type IS
  'gmail_oauth: Gmail via OAuth API, microsoft_oauth: Outlook via Graph API, smtp_relay: Via relay server, smtp_direct: Direct SMTP (legacy)';

COMMENT ON COLUMN public.email_accounts.warmup_enabled IS
  'Whether email warmup is active for this account';

COMMENT ON COLUMN public.email_accounts.warmup_daily_limit IS
  'Current daily sending limit during warmup (increases gradually)';

-- Verify migration
SELECT
  email_address,
  provider_type,
  warmup_enabled,
  warmup_daily_limit,
  CASE
    WHEN oauth_refresh_token IS NOT NULL THEN '✅ Has OAuth token'
    ELSE '⚪ No OAuth token'
  END as oauth_status
FROM public.email_accounts
LIMIT 10;

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- Email accounts now support:
-- - Gmail OAuth (gmail_oauth)
-- - Microsoft OAuth (microsoft_oauth)
-- - SMTP via relay server (smtp_relay)
-- - Direct SMTP (smtp_direct)
-- - Email warmup tracking
-- ============================================================================
