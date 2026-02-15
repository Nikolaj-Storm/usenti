-- Migration 011: Add condition block support
-- Adds condition branching to campaign steps

-- 1. Update step_type CHECK constraint to include 'condition'
ALTER TABLE public.campaign_steps DROP CONSTRAINT IF EXISTS campaign_steps_step_type_check;
ALTER TABLE public.campaign_steps ADD CONSTRAINT campaign_steps_step_type_check
  CHECK (step_type IN ('email', 'wait', 'condition'));

-- 2. Add condition_type column (what condition to evaluate)
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS condition_type TEXT;
-- e.g., 'email_opened', 'email_clicked', 'email_replied'

-- 3. Add parent_step_id for branch membership (links sub-steps to their parent condition)
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS parent_step_id UUID REFERENCES public.campaign_steps(id) ON DELETE CASCADE;

-- 4. Add branch column to identify which branch a step belongs to ('yes' or 'no')
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS branch TEXT;

-- 5. Drop the UNIQUE constraint on (campaign_id, step_order) since branch steps
--    can share step_order values across different branches
ALTER TABLE public.campaign_steps DROP CONSTRAINT IF EXISTS campaign_steps_campaign_id_step_order_key;

-- 6. Add index for efficient branch lookups
CREATE INDEX IF NOT EXISTS idx_campaign_steps_parent ON public.campaign_steps(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_branch ON public.campaign_steps(parent_step_id, branch);
