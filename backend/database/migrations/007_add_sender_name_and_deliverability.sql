-- Migration: Add sender name and deliverability improvements
-- Adds support for:
-- 1. Sender display name for better deliverability
-- 2. Unsubscribe tracking

-- ============================================================================
-- STEP 1: Add sender_name column to email_accounts
-- ============================================================================

ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- ============================================================================
-- STEP 2: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.email_accounts.sender_name IS
  'Display name to use in From header, e.g., "John Smith" results in "John Smith <john@example.com>"';

-- ============================================================================
-- STEP 3: Add unsubscribe tracking to contacts table
-- ============================================================================

-- Add unsubscribed_at timestamp to track when contacts unsubscribed
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.contacts.unsubscribed_at IS
  'Timestamp when the contact unsubscribed from emails';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'email_accounts'
  AND column_name = 'sender_name';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contacts'
  AND column_name = 'unsubscribed_at';
