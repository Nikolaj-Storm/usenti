-- Migration: Add campaign step enhancements
-- Adds support for:
-- 1. Wait steps with hours and minutes (in addition to days)
-- 2. Condition steps with multiple branches (JSONB array)

-- ============================================================================
-- STEP 1: Add wait_hours and wait_minutes columns
-- ============================================================================

ALTER TABLE public.campaign_steps
ADD COLUMN IF NOT EXISTS wait_hours INTEGER DEFAULT 0;

ALTER TABLE public.campaign_steps
ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 0;

-- ============================================================================
-- STEP 2: Add condition_branches column for multi-branch conditions
-- ============================================================================

ALTER TABLE public.campaign_steps
ADD COLUMN IF NOT EXISTS condition_branches JSONB;

-- ============================================================================
-- STEP 3: Update condition_type constraint to include new condition types
-- ============================================================================

-- Drop old constraint if exists
ALTER TABLE public.campaign_steps
DROP CONSTRAINT IF EXISTS campaign_steps_condition_type_check;

-- Add updated constraint with all condition types
ALTER TABLE public.campaign_steps
ADD CONSTRAINT campaign_steps_condition_type_check
CHECK (condition_type IN (
  'if_opened',
  'if_not_opened',
  'if_clicked',
  'if_not_clicked',
  'if_replied',
  'if_not_replied'
));

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.campaign_steps.wait_hours IS
  'Hours to wait before proceeding to next step (0-23)';

COMMENT ON COLUMN public.campaign_steps.wait_minutes IS
  'Minutes to wait before proceeding to next step (0-59)';

COMMENT ON COLUMN public.campaign_steps.condition_branches IS
  'JSON array of condition branches: [{condition: "if_opened", next_step_id: "uuid"}, ...]';

-- ============================================================================
-- STEP 5: Migrate existing wait_days-only steps
-- ============================================================================

-- Convert existing steps with wait_days to use 0 hours/minutes
UPDATE public.campaign_steps
SET wait_hours = 0, wait_minutes = 0
WHERE step_type = 'wait'
  AND wait_hours IS NULL
  AND wait_minutes IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'campaign_steps'
  AND column_name IN ('wait_days', 'wait_hours', 'wait_minutes', 'condition_type', 'condition_branches')
ORDER BY column_name;
