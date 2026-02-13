-- ============================================================================
-- Migration: Add Inbox Messages Table
-- Version: 005
-- Description: Creates inbox_messages table to store all incoming emails
--              for the unified inbox feature
-- ============================================================================

-- Create inbox_messages table
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT, -- The unique IMAP/SMTP message ID
  from_name TEXT,
  from_address TEXT NOT NULL,
  subject TEXT,
  snippet TEXT, -- Short preview for the list view (first 100 chars)
  body_html TEXT,
  body_text TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(email_account_id, message_id)
);

-- Enable Row Level Security
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see inbox messages from their own email accounts
CREATE POLICY "Users can manage own inbox messages" ON inbox_messages
  FOR ALL USING (
    email_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    )
  );

-- Index for fast sorting/filtering by account and received date
CREATE INDEX idx_inbox_account_created ON inbox_messages(email_account_id, received_at DESC);

-- Index for fast filtering by read/unread status
CREATE INDEX idx_inbox_is_read ON inbox_messages(is_read);

-- Index for fast searching by sender email
CREATE INDEX idx_inbox_from_address ON inbox_messages(from_address);

-- ============================================================================
-- Migration Complete
-- ============================================================================
