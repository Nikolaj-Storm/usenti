-- Migration 016: Add sent stats to email accounts
-- Adds current_daily_sent and last_daily_reset to email_accounts
-- adds increment_email_account_sent_count function for atomic updates

ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS current_daily_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMP WITH TIME ZONE;

-- Create function to atomically increment sender count and handle daily resets
CREATE OR REPLACE FUNCTION increment_email_account_sent_count(account_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
  last_reset TIMESTAMP WITH TIME ZONE;
  now_utc TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
  -- Get current state
  SELECT current_daily_sent, last_daily_reset
  INTO current_count, last_reset
  FROM email_accounts
  WHERE id = account_id;
  
  -- If last_reset is not today (UTC) or never set, reset counter
  IF last_reset IS NULL OR date_trunc('day', last_reset) < date_trunc('day', now_utc) THEN
    current_count := 1;
    -- accurate reset time is technically start of day but for simplicity we timestamp when the first email is sent
    -- actually, let's just keep today's timestamp as the reset marker
  ELSE
    current_count := COALESCE(current_count, 0) + 1;
  END IF;

  -- Update record
  UPDATE email_accounts
  SET 
    current_daily_sent = current_count,
    last_daily_reset = now_utc, -- keep refreshing this so we know when last activity was
    updated_at = now_utc
  WHERE id = account_id;

  RETURN current_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
