-- ============================================================================
-- Mr. Snowman 2.0 - Database Schema
-- ============================================================================
-- Version: 2.0 (Complete - includes all migrations)
-- Updated: 2026-01-28
--
-- This is the COMPLETE schema for Mr. Snowman 2.0
-- Execute this in your Supabase SQL Editor: https://app.supabase.com
--
-- QUICK START:
-- 1. Create a new Supabase project (or reset existing one)
-- 2. Copy this ENTIRE file
-- 3. Paste in Supabase SQL Editor
-- 4. Click RUN
-- 5. Done!
--
-- INCLUDES:
-- - 13 Tables with all columns
-- - All foreign key relationships
-- - All indexes for optimal performance
-- - All Row Level Security (RLS) policies
-- - Auto-create user_profiles on signup (critical!)
-- - Auto-update timestamps via triggers
-- - OAuth support (Gmail, Microsoft)
-- - Email warmup tracking
-- - Unified inbox
-- - Sender display name for deliverability
-- - Enhanced campaign steps (hours/minutes delay, multi-branch conditions)
-- ============================================================================

-- ============================================================================
-- SECTION 1: USER PROFILES
-- ============================================================================
-- Extends Supabase auth.users with additional profile data

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  company_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- SECTION 2: EMAIL ACCOUNTS
-- ============================================================================
-- Stores connected email accounts with IMAP/SMTP config and OAuth tokens

CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('gmail', 'outlook', 'zoho', 'aws_workmail', 'stalwart', 'custom')),

  -- Provider type (OAuth vs SMTP)
  provider_type TEXT DEFAULT 'smtp_direct' CHECK (provider_type IN ('gmail_oauth', 'microsoft_oauth', 'smtp_relay', 'smtp_direct')),

  -- IMAP Configuration
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_username TEXT NOT NULL,
  imap_password TEXT NOT NULL, -- Encrypted with AES-256-CBC

  -- SMTP Configuration
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL, -- Encrypted with AES-256-CBC

  -- OAuth Tokens (for Gmail/Microsoft OAuth)
  oauth_refresh_token TEXT,
  oauth_access_token TEXT,
  oauth_token_expires_at TIMESTAMP WITH TIME ZONE,
  oauth_scope TEXT,

  -- Account Settings
  sender_name TEXT, -- Display name for From header, e.g., "John Smith" improves deliverability
  daily_send_limit INTEGER DEFAULT 500,
  is_active BOOLEAN DEFAULT true,
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),

  -- Warmup Configuration
  warmup_enabled BOOLEAN DEFAULT false,
  is_warming_up BOOLEAN DEFAULT false,
  warmup_stage INTEGER DEFAULT 0,
  warmup_daily_limit INTEGER DEFAULT 20,
  warmup_current_day INTEGER DEFAULT 0,
  warmup_started_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Constraints
  UNIQUE(user_id, email_address)
);

-- Enable RLS
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email accounts" ON email_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_is_active ON email_accounts(is_active);
CREATE INDEX idx_email_accounts_warmup_enabled ON email_accounts(warmup_enabled);

-- Comments
COMMENT ON COLUMN email_accounts.provider_type IS
  'gmail_oauth: Gmail via OAuth API, microsoft_oauth: Outlook via Graph API, smtp_relay: Via relay server, smtp_direct: Direct SMTP';
COMMENT ON COLUMN email_accounts.warmup_enabled IS
  'Whether email warmup is active for this account';
COMMENT ON COLUMN email_accounts.warmup_daily_limit IS
  'Current daily sending limit during warmup (increases gradually)';
COMMENT ON COLUMN email_accounts.sender_name IS
  'Display name for From header, e.g., "John Smith" results in "John Smith <email@domain.com>"';

-- ============================================================================
-- SECTION 3: CONTACT LISTS
-- ============================================================================
-- Organizes contacts into named lists

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
-- SECTION 4: CONTACTS
-- ============================================================================
-- Individual email contacts within lists

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  company TEXT DEFAULT '',
  custom_fields JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'invalid')),
  unsubscribed_at TIMESTAMP WITH TIME ZONE, -- Timestamp when contact unsubscribed
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
-- SECTION 5: CAMPAIGNS
-- ============================================================================
-- Email campaign orchestration

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
  send_immediately BOOLEAN DEFAULT false,

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
-- SECTION 6: CAMPAIGN STEPS
-- ============================================================================
-- Sequential steps within campaigns (emails, waits, conditions)

CREATE TABLE IF NOT EXISTS campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('email', 'wait', 'condition')),

  -- Email step fields
  subject TEXT,
  body TEXT,

  -- Wait step fields (supports days, hours, and minutes)
  wait_days INTEGER DEFAULT 0,
  wait_hours INTEGER DEFAULT 0,
  wait_minutes INTEGER DEFAULT 0,

  -- Condition step fields
  -- Legacy single condition support
  condition_type TEXT CHECK (condition_type IN ('if_opened', 'if_not_opened', 'if_clicked', 'if_not_clicked', 'if_replied', 'if_not_replied')),
  next_step_if_true UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  next_step_if_false UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  -- Multi-branch condition support: [{condition: 'if_opened', next_step_id: 'uuid'}, ...]
  condition_branches JSONB,

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
-- SECTION 7: CAMPAIGN CONTACTS
-- ============================================================================
-- Tracks individual contact progress through a campaign

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'replied', 'unsubscribed')),
  next_send_time TIMESTAMP WITH TIME ZONE,
  emails_sent INTEGER DEFAULT 0,
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
-- SECTION 8: EMAIL EVENTS
-- ============================================================================
-- Tracks all email engagement events (opens, clicks, replies, etc.)

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
-- SECTION 9: WARMUP CONFIGURATION
-- ============================================================================
-- Configuration for email warmup automation

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
-- SECTION 10: WARMUP SEEDS
-- ============================================================================
-- Seed email addresses for the warmup network (admin-managed)

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

-- Note: This table is admin-managed, RLS not enabled by default
-- Add policies based on your requirements

CREATE INDEX idx_warmup_seeds_active ON warmup_seeds(is_active);

-- ============================================================================
-- SECTION 11: WARMUP THREADS
-- ============================================================================
-- Conversations between accounts in the warmup network

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
-- SECTION 12: WARMUP MESSAGES
-- ============================================================================
-- Individual messages in warmup threads

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
-- SECTION 13: INBOX MESSAGES
-- ============================================================================
-- Unified inbox for all incoming emails

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT, -- The unique IMAP/SMTP message ID
  from_name TEXT,
  from_address TEXT NOT NULL,
  subject TEXT,
  snippet TEXT, -- Short preview for the list view (first 100 chars)
  body_html TEXT,
  body_text TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(email_account_id, message_id)
);

ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own inbox messages" ON inbox_messages
  FOR ALL USING (
    email_account_id IN (
      SELECT id FROM email_accounts WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_inbox_account_created ON inbox_messages(email_account_id, received_at DESC);
CREATE INDEX idx_inbox_is_read ON inbox_messages(is_read);
CREATE INDEX idx_inbox_from_address ON inbox_messages(from_address);

-- ============================================================================
-- SECTION 14: FUNCTIONS
-- ============================================================================

-- Function to automatically create user_profiles when a new user signs up
-- CRITICAL: This prevents the issue where users can't add email accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 15: TRIGGERS
-- ============================================================================

-- Trigger to auto-create user_profiles on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers to auto-update updated_at columns
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_lists_updated_at
  BEFORE UPDATE ON contact_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_steps_updated_at
  BEFORE UPDATE ON campaign_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_contacts_updated_at
  BEFORE UPDATE ON campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warmup_configs_updated_at
  BEFORE UPDATE ON warmup_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warmup_seeds_updated_at
  BEFORE UPDATE ON warmup_seeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warmup_threads_updated_at
  BEFORE UPDATE ON warmup_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_messages_updated_at
  BEFORE UPDATE ON inbox_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHEMA SUMMARY
-- ============================================================================
--
-- Tables: 13
--   1. user_profiles      - User account profiles
--   2. email_accounts     - Connected email accounts (IMAP/SMTP/OAuth)
--   3. contact_lists      - Contact list organization
--   4. contacts           - Individual contacts
--   5. campaigns          - Email campaigns
--   6. campaign_steps     - Steps within campaigns
--   7. campaign_contacts  - Contact progress tracking
--   8. email_events       - Engagement tracking
--   9. warmup_configs     - Warmup configuration
--  10. warmup_seeds       - Warmup network seeds
--  11. warmup_threads     - Warmup conversations
--  12. warmup_messages    - Warmup messages
--  13. inbox_messages     - Unified inbox
--
-- Functions: 2
--   - handle_new_user()         - Auto-creates user profile on signup
--   - update_updated_at_column() - Auto-updates timestamps
--
-- Triggers: 12
--   - 1 for auto-creating user profiles
--   - 11 for auto-updating timestamps
--
-- Indexes: 22
--   - Optimized for common query patterns
--
-- RLS Policies: 14
--   - User isolation on all user-facing tables
--
-- ============================================================================
-- DONE!
-- ============================================================================
-- Schema created successfully.
--
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Configure your backend/.env file with Supabase credentials
-- 3. Generate an encryption key for password encryption:
--    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
-- 4. Start the backend server: npm run dev
-- ============================================================================
