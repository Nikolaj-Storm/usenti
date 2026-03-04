-- Add linkedin_url column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
