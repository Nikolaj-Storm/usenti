-- ============================================================================
-- Migration 008: Multi-Account Campaign Support
-- ============================================================================
-- Allows campaigns to use multiple email accounts with rotation
--
-- To apply: Run this SQL in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create Junction Table for Campaign-to-Email Account Mapping
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  -- Round-robin tracking
  emails_sent_today INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  -- Allow disabling specific accounts for a campaign without removing
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Each email account can only be added once per campaign
  UNIQUE(campaign_id, email_account_id)
);

-- Enable RLS
ALTER TABLE campaign_email_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage campaign_email_accounts for their own campaigns
CREATE POLICY "Users can manage campaign email accounts" ON campaign_email_accounts
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_campaign_email_accounts_campaign ON campaign_email_accounts(campaign_id);
CREATE INDEX idx_campaign_email_accounts_email ON campaign_email_accounts(email_account_id);
CREATE INDEX idx_campaign_email_accounts_last_used ON campaign_email_accounts(campaign_id, last_used_at);

-- ============================================================================
-- SECTION 2: Make email_account_id Nullable in Campaigns Table
-- ============================================================================
-- We keep the existing column for backward compatibility but make it nullable
-- New campaigns will use the junction table; legacy campaigns still work

ALTER TABLE campaigns
  ALTER COLUMN email_account_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN campaigns.email_account_id IS
  'DEPRECATED for new campaigns. Use campaign_email_accounts junction table instead. Kept for backward compatibility.';

-- ============================================================================
-- SECTION 3: Helper Function to Get Next Email Account (Round-Robin)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_campaign_email_account(p_campaign_id UUID)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_account RECORD;
BEGIN
  -- First, check if campaign uses the junction table
  SELECT cea.email_account_id, cea.emails_sent_today, ea.daily_send_limit
  INTO v_account
  FROM campaign_email_accounts cea
  JOIN email_accounts ea ON ea.id = cea.email_account_id
  WHERE cea.campaign_id = p_campaign_id
    AND cea.is_active = true
    AND ea.is_active = true
    AND cea.emails_sent_today < COALESCE(ea.daily_send_limit, 500)
  ORDER BY cea.last_used_at NULLS FIRST, cea.emails_sent_today ASC
  LIMIT 1;

  IF v_account IS NOT NULL THEN
    RETURN v_account.email_account_id;
  END IF;

  -- Fallback to legacy single email_account_id
  SELECT email_account_id INTO v_account_id
  FROM campaigns
  WHERE id = p_campaign_id;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 4: Function to Reset Daily Counters (call via cron/scheduled job)
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_campaign_email_account_daily_counters()
RETURNS void AS $$
BEGIN
  UPDATE campaign_email_accounts
  SET emails_sent_today = 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration Complete
-- ============================================================================
--
-- New columns/tables:
--   - campaign_email_accounts: Junction table for multi-account campaigns
--   - campaigns.email_account_id: Now nullable (backward compatible)
--
-- New functions:
--   - get_next_campaign_email_account(): Round-robin account selection
--   - reset_campaign_email_account_daily_counters(): Daily reset
--
-- Usage:
--   For new campaigns: Insert into campaign_email_accounts, leave email_account_id NULL
--   For legacy campaigns: Continue using email_account_id directly
-- ============================================================================
