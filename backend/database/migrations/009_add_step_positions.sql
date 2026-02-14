-- Migration 009: Add position columns to campaign_steps
-- These columns allow storing visual position of steps in the campaign flow editor

ALTER TABLE public.campaign_steps
ADD COLUMN IF NOT EXISTS position_x INTEGER DEFAULT 0;

ALTER TABLE public.campaign_steps
ADD COLUMN IF NOT EXISTS position_y INTEGER DEFAULT 0;

COMMENT ON COLUMN public.campaign_steps.position_x IS 'X coordinate position in the visual campaign flow editor';
COMMENT ON COLUMN public.campaign_steps.position_y IS 'Y coordinate position in the visual campaign flow editor';
