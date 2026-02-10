-- Migration: Add campaign step enhancements
-- Adds support for wait steps with hours and minutes (in addition to days)

-- ============================================================================
-- STEP 1: Add wait_hours and wait_minutes columns
-- ============================================================================

ALTER TABLE public.campaign_steps
ADD COLUMN IF NOT EXISTS wait_hours INTEGER DEFAULT 0;

ALTER TABLE public.campaign_steps
ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 0;

-- ============================================================================
-- STEP 2: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.campaign_steps.wait_hours IS
  'Hours to wait before proceeding to next step (0-23)';

COMMENT ON COLUMN public.campaign_steps.wait_minutes IS
  'Minutes to wait before proceeding to next step (0-59)';

-- ============================================================================
-- STEP 3: Migrate existing wait_days-only steps
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
  AND column_name IN ('wait_days', 'wait_hours', 'wait_minutes')
ORDER BY column_name;
