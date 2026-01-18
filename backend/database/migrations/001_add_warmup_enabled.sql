-- Migration: Add warmup_enabled column to email_accounts table
-- This fixes the error: "Could not find the 'warmup_enabled' column of 'email_accounts' in the schema cache"

-- Add the warmup_enabled column if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'email_accounts'
    AND column_name = 'warmup_enabled'
  ) THEN
    ALTER TABLE email_accounts
    ADD COLUMN warmup_enabled BOOLEAN DEFAULT false;

    RAISE NOTICE 'Column warmup_enabled added to email_accounts table';
  ELSE
    RAISE NOTICE 'Column warmup_enabled already exists in email_accounts table';
  END IF;
END $$;
