-- Migration 013: Add missing columns to campaign_steps
-- Your database has the core table but is missing several columns
-- that the application code needs. Run this in Supabase SQL Editor.
--
-- This adds: wait_hours, wait_minutes, position_x, position_y,
--            condition_type, branch
--
-- Safe to run multiple times (uses IF NOT EXISTS).

-- 1. Wait step granularity (hours + minutes in addition to days)
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS wait_hours INTEGER DEFAULT 0;
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 0;

-- 2. Visual canvas positions for the campaign flow editor
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS position_x INTEGER DEFAULT 0;
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS position_y INTEGER DEFAULT 0;

-- 3. Condition block support
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS condition_type TEXT;
-- e.g., 'email_opened', 'email_clicked', 'email_replied'

-- 4. Branch membership ('yes' or 'no' - which branch of a condition this step belongs to)
ALTER TABLE public.campaign_steps ADD COLUMN IF NOT EXISTS branch TEXT;

-- 5. Ensure step_type CHECK constraint includes 'condition'
ALTER TABLE public.campaign_steps DROP CONSTRAINT IF EXISTS campaign_steps_step_type_check;
ALTER TABLE public.campaign_steps ADD CONSTRAINT campaign_steps_step_type_check
  CHECK (step_type IN ('email', 'wait', 'condition'));

-- 6. Drop UNIQUE constraint on (campaign_id, step_order) if it exists,
--    since branch steps can share step_order values across branches
ALTER TABLE public.campaign_steps DROP CONSTRAINT IF EXISTS campaign_steps_campaign_id_step_order_key;

-- 7. Add indexes for efficient branch lookups
CREATE INDEX IF NOT EXISTS idx_campaign_steps_parent ON public.campaign_steps(parent_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_branch ON public.campaign_steps(parent_id, branch);

-- 8. Backfill existing wait steps with 0 hours/minutes
UPDATE public.campaign_steps
SET wait_hours = 0, wait_minutes = 0
WHERE step_type = 'wait'
  AND wait_hours IS NULL
  AND wait_minutes IS NULL;
