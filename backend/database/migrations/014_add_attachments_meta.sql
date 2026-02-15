-- ============================================================================
-- Migration: Add attachments_meta column to inbox_messages
-- Version: 014
-- Description: Stores attachment metadata (filename, contentType, size) as
--              JSONB so the content endpoint can return it without re-fetching
--              from IMAP.
-- ============================================================================

ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS attachments_meta JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- Migration Complete
-- ============================================================================
