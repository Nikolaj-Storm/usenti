-- Migration: Add branch_context to campaign_contacts
-- Tracks progress through condition branch steps so the executor can
-- resume processing multi-step branches across execution cycles.
--
-- Structure: { condition_step_id: "uuid", branch_index: 0, branch_step_index: 0 }

ALTER TABLE public.campaign_contacts
ADD COLUMN IF NOT EXISTS branch_context JSONB;

COMMENT ON COLUMN public.campaign_contacts.branch_context IS
  'Tracks progress through condition branch steps: {condition_step_id, branch_index, branch_step_index}';
