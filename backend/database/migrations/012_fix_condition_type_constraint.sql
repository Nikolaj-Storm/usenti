-- Migration 012: Fix condition_type CHECK constraint
-- Problem: Migration 006 created a CHECK constraint that only allows
--          'if_opened', 'if_not_opened', etc. But the new frontend (PR #114)
--          uses 'email_opened', 'email_clicked', 'email_replied' values.
-- Fix: Drop the old constraint entirely. The application layer validates values.

ALTER TABLE public.campaign_steps
DROP CONSTRAINT IF EXISTS campaign_steps_condition_type_check;

-- Verify the constraint is dropped
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'campaign_steps'
  AND con.contype = 'c';
