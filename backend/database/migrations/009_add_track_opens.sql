-- Migration: Add track_opens column to campaigns table
-- Default to false for ePrivacy compliance (open tracking must be explicitly enabled)

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS track_opens BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.campaigns.track_opens IS
  'Whether open tracking pixel is enabled for this campaign. Default false for ePrivacy/GDPR compliance.';
