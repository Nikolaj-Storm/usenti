-- ============================================================================
-- Feature: Email Warmup System
-- Description: Adds tables to manage email warmup settings and logs.
-- ============================================================================

-- Table 1: Warmup Settings
CREATE TABLE IF NOT EXISTS email_warmup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'error')),
  
  -- Settings
  daily_send_limit INTEGER DEFAULT 40,
  ramp_up_per_day INTEGER DEFAULT 5,
  reply_rate_percent INTEGER DEFAULT 30, -- The % of incoming warmup emails this account will reply to
  
  -- Tracking
  current_daily_limit INTEGER DEFAULT 5, -- Starts at 5, goes up by ramp_up_per_day until daily_send_limit
  last_ramp_up_date DATE DEFAULT CURRENT_DATE,
  
  -- Technical
  warmup_tag TEXT DEFAULT 'usenti_warmup', -- Used to tag emails in subjects/headers
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(email_account_id)
);

ALTER TABLE email_warmup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own warmup settings" ON email_warmup_settings
  FOR ALL USING (
    email_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_email_warmup_settings_account ON email_warmup_settings(email_account_id);
CREATE INDEX idx_email_warmup_settings_status ON email_warmup_settings(status);

-- Table 2: Warmup Logs
CREATE TABLE IF NOT EXISTS email_warmup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  recipient_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  
  action_type TEXT NOT NULL CHECK (action_type IN ('sent', 'received', 'replied', 'marked_important', 'moved_from_spam')),
  message_id TEXT, -- The email message ID for tracking replies/threading
  
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE email_warmup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own warmup logs" ON email_warmup_logs
  FOR SELECT USING (
    sender_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    ) OR
    recipient_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_email_warmup_logs_sender ON email_warmup_logs(sender_account_id);
CREATE INDEX idx_email_warmup_logs_recipient ON email_warmup_logs(recipient_account_id);
CREATE INDEX idx_email_warmup_logs_created_at ON email_warmup_logs(created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_email_warmup_settings_updated_at 
  BEFORE UPDATE ON email_warmup_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
