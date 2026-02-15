-- Migration: Fix email_events RLS policy
-- The tracking pixel endpoint runs without auth context (public route),
-- so auth.uid() is NULL and the existing FOR ALL policy blocks inserts.
-- We need a separate policy that allows the service role to manage events.

-- Drop the existing overly-broad FOR ALL policy
DROP POLICY IF EXISTS "Users can view events for own campaigns" ON email_events;

-- Re-create as SELECT-only for authenticated user isolation
CREATE POLICY "Users can view events for own campaigns" ON email_events
  FOR SELECT USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

-- Allow service role full access (for tracking endpoints and campaign executor)
CREATE POLICY "Service role can manage email events" ON email_events
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to manage their own campaign events  
CREATE POLICY "Users can manage events for own campaigns" ON email_events
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );
