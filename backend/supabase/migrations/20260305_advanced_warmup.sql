-- ============================================================================
-- Feature: Advanced Email Warmup
-- Description: Adds P2P opt-in and Spam Save Rate configuration.
-- ============================================================================

ALTER TABLE email_warmup_settings 
ADD COLUMN IF NOT EXISTS network_opt_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS spam_save_rate_percent INTEGER DEFAULT 100 CHECK (spam_save_rate_percent >= 0 AND spam_save_rate_percent <= 100);

-- Make sure existing active settings are opted-in by default if they were already 'active' under the old system, 
-- or you can leave them false to force them to toggle it.
-- We'll leave them false to be safe and compliant.
