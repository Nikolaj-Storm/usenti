-- Migration: Add campaign scheduling columns
-- Run this in Supabase SQL Editor to add missing columns

-- Add send_immediately column to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS send_immediately BOOLEAN DEFAULT false;

-- Add emails_sent column to campaign_contacts table
ALTER TABLE campaign_contacts
ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;

-- Verify the columns were added
SELECT
  'campaigns.send_immediately' as column_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'send_immediately'
  ) as exists
UNION ALL
SELECT
  'campaign_contacts.emails_sent' as column_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_contacts' AND column_name = 'emails_sent'
  ) as exists;
