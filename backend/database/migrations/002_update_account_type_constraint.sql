-- Migration: Update account_type constraint to support all email providers
-- This fixes the error: "new row for relation "email_accounts" violates check constraint "email_accounts_account_type_check""

-- Drop the old check constraint
ALTER TABLE email_accounts
  DROP CONSTRAINT IF EXISTS email_accounts_account_type_check;

-- Add the new check constraint with all supported account types
ALTER TABLE email_accounts
  ADD CONSTRAINT email_accounts_account_type_check
  CHECK (account_type IN ('gmail', 'outlook', 'zoho', 'aws_workmail', 'stalwart', 'custom'));

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Updated account_type constraint to support: gmail, outlook, zoho, aws_workmail, stalwart, custom';
END $$;
