-- Migration 015: Add is_answered column to inbox_messages
-- Tracks whether the user has replied to an inbox message

ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS is_answered BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_inbox_is_answered ON inbox_messages(is_answered);
