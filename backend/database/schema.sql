-- ============================================================================
-- Mr. Snowman Database Schema
-- ============================================================================
-- This schema is designed for Supabase (PostgreSQL)
-- Execute this in your Supabase SQL Editor: https://app.supabase.com

-- ============================================================================
-- USERS (Managed by Supabase Auth, but we can extend with a profile table)
-- ============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- EMAIL ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('gmail', 'outlook', 'zoho', 'aws_workmail', 'stalwart', 'custom')),

  -- IMAP Configuration
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_username TEXT NOT NULL,
  imap_password TEXT NOT NULL, -- Encrypted

  -- SMTP Configuration
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL, -- Encrypted

  -- Settings
  daily_send_limit INTEGER DEFAULT 500,
  is_active BOOLEAN DEFAULT true,
  is_warming_up BOOLEAN DEFAULT false,
  warmup_stage INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(user_id, email_address)
);

-- Enable RLS
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email accounts" ON email_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_is_active ON email_accounts(is_active);

-- ============================================================================
-- CONTACT LISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  total_contacts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contact lists" ON contact_lists
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_contact_lists_user_id ON contact_lists(user_id);

-- ============================================================================
-- CONTACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  company TEXT DEFAULT '',
  custom_fields JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'invalid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(list_id, email)
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contacts in own lists" ON contacts
  FOR ALL USING (
    list_id IN (
      SELECT id FROM contact_lists WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_contacts_list_id ON contacts(list_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);

-- ============================================================================
-- CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  contact_list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'failed')),

  -- Scheduling
  send_schedule JSONB DEFAULT '{"days": ["mon", "tue", "wed", "thu", "fri"], "start_hour": 9, "end_hour": 17}',
  daily_limit INTEGER DEFAULT 500,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaigns" ON campaigns
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_email_account ON campaigns(email_account_id);

-- ============================================================================
-- CAMPAIGN STEPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('email', 'wait', 'condition')),

  -- Email step fields
  subject TEXT,
  body TEXT,

  -- Wait step fields
  wait_days INTEGER,

  -- Condition step fields
  condition_type TEXT CHECK (condition_type IN ('if_opened', 'if_not_opened', 'if_clicked', 'if_replied', 'if_not_replied')),
  next_step_if_true UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  next_step_if_false UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(campaign_id, step_order)
);

ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage steps in own campaigns" ON campaign_steps
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_campaign_steps_campaign_id ON campaign_steps(campaign_id);
CREATE INDEX idx_campaign_steps_order ON campaign_steps(campaign_id, step_order);

-- ============================================================================
-- CAMPAIGN CONTACTS (Tracking individual contact progress through campaign)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'replied', 'unsubscribed')),
  next_send_time TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(campaign_id, contact_id)
);

ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign contacts for own campaigns" ON campaign_contacts
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX idx_campaign_contacts_next_send ON campaign_contacts(next_send_time);

-- ============================================================================
-- EMAIL EVENTS (Tracking opens, clicks, replies, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'unsubscribed')),
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for own campaigns" ON email_events
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX idx_email_events_contact_id ON email_events(contact_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_created_at ON email_events(created_at DESC);

-- ============================================================================
-- WARM-UP CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  daily_warmup_volume INTEGER DEFAULT 1000, -- Target daily volume
  current_daily_volume INTEGER DEFAULT 50, -- Current volume (ramps up)
  rampup_increment INTEGER DEFAULT 50, -- How much to increase daily
  replies_per_thread INTEGER DEFAULT 20, -- How many replies per conversation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(email_account_id)
);

ALTER TABLE warmup_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage warmup for own email accounts" ON warmup_configs
  FOR ALL USING (
    email_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_warmup_configs_email_account ON warmup_configs(email_account_id);

-- ============================================================================
-- WARM-UP SEED ADDRESSES (Other accounts in the warm-up network)
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmup_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL UNIQUE,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL, -- Encrypted
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: This table might not need RLS if it's managed by admins
-- You can add RLS policies based on your requirements

CREATE INDEX idx_warmup_seeds_active ON warmup_seeds(is_active);

-- ============================================================================
-- WARM-UP THREADS (Conversations between accounts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmup_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  seed_address_id UUID NOT NULL REFERENCES warmup_seeds(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  reply_count INTEGER DEFAULT 0,
  target_replies INTEGER DEFAULT 20,
  last_reply_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE warmup_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warmup threads for own accounts" ON warmup_threads
  FOR ALL USING (
    email_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_warmup_threads_email_account ON warmup_threads(email_account_id);
CREATE INDEX idx_warmup_threads_status ON warmup_threads(status);

-- ============================================================================
-- WARM-UP MESSAGES (Individual messages in warm-up threads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmup_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warmup_thread_id UUID NOT NULL REFERENCES warmup_threads(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
  subject TEXT,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE warmup_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warmup messages for own accounts" ON warmup_messages
  FOR ALL USING (
    email_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_warmup_messages_thread ON warmup_messages(warmup_thread_id);
CREATE INDEX idx_warmup_messages_email_account ON warmup_messages(email_account_id);
CREATE INDEX idx_warmup_messages_created_at ON warmup_messages(created_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to automatically create user_profiles when a new user signs up
-- CRITICAL: This prevents the issue where users can't add email accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user_profiles on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update_updated_at trigger to all tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON contact_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_steps_updated_at BEFORE UPDATE ON campaign_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_contacts_updated_at BEFORE UPDATE ON campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warmup_configs_updated_at BEFORE UPDATE ON warmup_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warmup_seeds_updated_at BEFORE UPDATE ON warmup_seeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warmup_threads_updated_at BEFORE UPDATE ON warmup_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL SEED DATA (Optional)
-- ============================================================================

-- You can add some initial warmup seed addresses here if you have a warm-up network
-- INSERT INTO warmup_seeds (email_address, smtp_host, smtp_port, smtp_username, smtp_password) VALUES
-- ('seed1@example.com', 'smtp.example.com', 587, 'seed1@example.com', 'encrypted_password_here'),
-- ('seed2@example.com', 'smtp.example.com', 587, 'seed2@example.com', 'encrypted_password_here');

-- ============================================================================
-- DONE!
-- ============================================================================
-- Schema created successfully.
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Configure your backend/.env file with Supabase credentials
-- 3. Generate an encryption key for password encryption
-- 4. Start the backend server
-- ============================================================================
