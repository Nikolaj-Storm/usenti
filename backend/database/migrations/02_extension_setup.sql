-- ============================================================================
-- Usenti 2.0 - Chrome Extension Schema Update
-- ============================================================================

-- Table to track connected extension browsers per user
CREATE TABLE IF NOT EXISTS users_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extension_id TEXT NOT NULL,
  last_ping TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disconnected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, extension_id)
);

ALTER TABLE users_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their connected extensions" ON users_extensions
  FOR ALL USING (auth.uid() = user_id);

-- Queue for background outreach tasks executed by the Chrome Extension
CREATE TABLE IF NOT EXISTS task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_step_id UUID REFERENCES campaign_steps(id) ON DELETE CASCADE,
  
  action_type TEXT NOT NULL CHECK (action_type IN ('linkedin_dm', 'linkedin_connection_request', 'linkedin_profile_view')),
  payload JSONB DEFAULT '{}', -- E.g. {"linkedin_url": "...", "message": "..."}
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE task_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their task queue" ON task_queue
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_task_queue_user_id ON task_queue(user_id);
CREATE INDEX idx_task_queue_status ON task_queue(status);
CREATE INDEX idx_task_queue_campaign ON task_queue(campaign_id);

-- Trigger for auto-updating timestamps
CREATE TRIGGER update_task_queue_updated_at
  BEFORE UPDATE ON task_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_extensions_updated_at
  BEFORE UPDATE ON users_extensions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
