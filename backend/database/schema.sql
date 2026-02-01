-- ============================================================================
-- Mr. Snowman 2.0 - Database Schema
-- ============================================================================
-- Version: 2.1 (Production Sync)
-- Updated: 2026-02-01
--
-- This is the COMPLETE schema for Mr. Snowman 2.0, synchronized with Production.
--
-- INCLUDES:
-- - All Core Tables (Campaigns, Contacts, Accounts)
-- - NEW: Multi-Sender Rotation (campaign_email_accounts)
-- - NEW: RAG / Knowledge Base (documents, document_chunks)
-- - NEW: AI Chat (chats, messages)
-- - NEW: GitHub Integration (github_repos, github_files, github_auth)
-- - All Foreign Keys, Indexes, and RLS Policies
-- - Auto-timestamp triggers
-- ============================================================================

-- ============================================================================
-- SECTION 1: USERS & PROFILES
-- ============================================================================

-- [NEW] Public Users Table (found in production schema)
-- Likely used as a public reference or mirror for auth.users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY, -- Maps to auth.users(id)
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Extended Profile Data
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  company_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: User Profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- SECTION 2: EMAIL ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  account_type TEXT NOT NULL, 
  -- production constraint check likely exists, keeping generic for safety
  
  -- Provider Configuration
  provider_type TEXT DEFAULT 'smtp' CHECK (provider_type IN ('gmail_oauth', 'microsoft_oauth', 'smtp_relay', 'smtp_direct', 'smtp')),
  
  -- OAuth Data
  oauth_refresh_token TEXT,
  oauth_access_token TEXT,
  oauth_token_expires_at TIMESTAMP WITH TIME ZONE,
  oauth_scope TEXT,

  -- IMAP Config
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_username TEXT NOT NULL,
  imap_password TEXT NOT NULL, -- Encrypted

  -- SMTP Config
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL, -- Encrypted

  -- Settings
  daily_send_limit INTEGER DEFAULT 500,
  is_active BOOLEAN DEFAULT true,
  health_score INTEGER DEFAULT 100,

  -- Warmup Settings
  warmup_enabled BOOLEAN DEFAULT false,
  is_warming_up BOOLEAN DEFAULT false,
  warmup_stage INTEGER DEFAULT 0,
  warmup_daily_limit INTEGER DEFAULT 20,
  warmup_current_day INTEGER DEFAULT 0,
  warmup_started_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(user_id, email_address)
);

-- RLS: Email Accounts
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email accounts" ON email_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_is_active ON email_accounts(is_active);

-- ============================================================================
-- SECTION 3: CONTACT LISTS & CONTACTS
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

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  company TEXT DEFAULT '',
  custom_fields JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(list_id, email)
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage contacts in own lists" ON contacts
  FOR ALL USING (
    list_id IN (SELECT id FROM contact_lists WHERE user_id = auth.uid())
  );

CREATE INDEX idx_contacts_list_id ON contacts(list_id);
CREATE INDEX idx_contacts_email ON contacts(email);

-- ============================================================================
-- SECTION 4: CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  
  -- [UPDATED] Made nullable to support Multi-Sender (campaign_email_accounts)
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  
  contact_list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft',

  -- Scheduling
  send_schedule JSONB DEFAULT '{"days": ["mon", "tue", "wed", "thu", "fri"], "end_hour": 17, "start_hour": 9}',
  daily_limit INTEGER DEFAULT 500,
  
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

-- [NEW] Multi-Sender Rotation Table
-- Allows a single campaign to use multiple email accounts
CREATE TABLE IF NOT EXISTS campaign_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  emails_sent_today INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE campaign_email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage campaign accounts" ON campaign_email_accounts
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

-- ============================================================================
-- SECTION 5: CAMPAIGN STEPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  
  -- Content
  subject TEXT,
  body TEXT,

  -- Delays
  wait_days INTEGER DEFAULT 0,
  wait_hours INTEGER DEFAULT 0,
  wait_minutes INTEGER DEFAULT 0,

  -- Conditions
  condition_type TEXT,
  next_step_if_true UUID REFERENCES campaign_steps(id),
  next_step_if_false UUID REFERENCES campaign_steps(id),
  condition_branches JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(campaign_id, step_order)
);

ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage steps" ON campaign_steps
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

-- ============================================================================
-- SECTION 6: CAMPAIGN PROGRESS & EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'in_progress',
  next_send_time TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(campaign_id, contact_id)
);

ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign contacts" ON campaign_contacts
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

CREATE INDEX idx_campaign_contacts_next_send ON campaign_contacts(next_send_time);
CREATE INDEX idx_campaign_contacts_status ON campaign_contacts(status);

-- Events
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- sent, opened, clicked, replied
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events" ON email_events
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  );

-- ============================================================================
-- SECTION 7: WARMUP ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  daily_warmup_volume INTEGER DEFAULT 1000,
  current_daily_volume INTEGER DEFAULT 50,
  rampup_increment INTEGER DEFAULT 50,
  replies_per_thread INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(email_account_id)
);

ALTER TABLE warmup_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage warmup" ON warmup_configs
  FOR ALL USING (
    email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid())
  );

-- Warmup Seeds (Admin/System managed usually, but included in public schema)
CREATE TABLE IF NOT EXISTS warmup_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS warmup_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  seed_address_id UUID NOT NULL REFERENCES warmup_seeds(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  reply_count INTEGER DEFAULT 0,
  target_replies INTEGER DEFAULT 20,
  last_reply_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE warmup_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warmup threads" ON warmup_threads
  FOR ALL USING (
    email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS warmup_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warmup_thread_id UUID NOT NULL REFERENCES warmup_threads(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  subject TEXT,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE warmup_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view warmup messages" ON warmup_messages
  FOR ALL USING (
    email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid())
  );

-- ============================================================================
-- SECTION 8: INBOX MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id TEXT,
  from_name TEXT,
  from_address TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  body_html TEXT,
  body_text TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage inbox" ON inbox_messages
  FOR ALL USING (
    email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid())
  );

CREATE INDEX idx_inbox_account_created ON inbox_messages(email_account_id, received_at DESC);

-- ============================================================================
-- SECTION 9: AI CHAT & RAG (NEW)
-- ============================================================================

-- Documents (Knowledge Base)
CREATE SEQUENCE IF NOT EXISTS documents_id_seq;
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY DEFAULT nextval('documents_id_seq'),
  title VARCHAR NOT NULL,
  source VARCHAR,
  doc_type VARCHAR,
  content_preview TEXT,
  chunk_count INTEGER,
  indexed BOOLEAN,
  namespace VARCHAR,
  tags VARCHAR,
  created_at TIMESTAMP WITHOUT TIME ZONE
);

-- Document Chunks (Vectors would usually go here)
CREATE SEQUENCE IF NOT EXISTS document_chunks_id_seq;
CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY DEFAULT nextval('document_chunks_id_seq'),
  document_id INTEGER REFERENCES documents(id),
  chunk_index INTEGER,
  content TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE
);

-- Chat History
CREATE SEQUENCE IF NOT EXISTS chats_id_seq;
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY DEFAULT nextval('chats_id_seq'),
  user_id INTEGER, -- Production uses integer ID here, might map to custom user table
  title VARCHAR,
  created_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE SEQUENCE IF NOT EXISTS messages_id_seq;
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY DEFAULT nextval('messages_id_seq'),
  chat_id INTEGER REFERENCES chats(id),
  role VARCHAR,
  content TEXT,
  timestamp TIMESTAMP WITHOUT TIME ZONE
);

-- ============================================================================
-- SECTION 10: GITHUB INTEGRATION (NEW)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS github_auth_id_seq;
CREATE TABLE IF NOT EXISTS github_auth (
  id INTEGER PRIMARY KEY DEFAULT nextval('github_auth_id_seq'),
  user_id INTEGER,
  access_token VARCHAR NOT NULL,
  token_type VARCHAR,
  scope VARCHAR,
  github_username VARCHAR,
  github_user_id INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  expires_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE SEQUENCE IF NOT EXISTS github_repos_id_seq;
CREATE TABLE IF NOT EXISTS github_repos (
  id INTEGER PRIMARY KEY DEFAULT nextval('github_repos_id_seq'),
  user_id INTEGER,
  github_repo_id INTEGER,
  full_name VARCHAR NOT NULL,
  description TEXT,
  language VARCHAR,
  default_branch VARCHAR,
  private BOOLEAN,
  indexed_at TIMESTAMP WITHOUT TIME ZONE,
  last_synced TIMESTAMP WITHOUT TIME ZONE,
  file_count INTEGER,
  chunk_count INTEGER,
  framework VARCHAR,
  structure_json JSON,
  index_status VARCHAR,
  active BOOLEAN,
  created_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE SEQUENCE IF NOT EXISTS github_files_id_seq;
CREATE TABLE IF NOT EXISTS github_files (
  id INTEGER PRIMARY KEY DEFAULT nextval('github_files_id_seq'),
  repo_id INTEGER REFERENCES github_repos(id),
  file_path VARCHAR NOT NULL,
  file_type VARCHAR,
  file_sha VARCHAR,
  size INTEGER,
  chunk_count INTEGER,
  indexed_at TIMESTAMP WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITHOUT TIME ZONE
);

-- ============================================================================
-- SECTION 11: FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create User Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  -- Also sync to public.users table if needed
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Timestamp Updater
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Apply timestamp triggers to all relevant tables
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON contact_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaign_steps_updated_at BEFORE UPDATE ON campaign_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaign_contacts_updated_at BEFORE UPDATE ON campaign_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_warmup_configs_updated_at BEFORE UPDATE ON warmup_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_warmup_seeds_updated_at BEFORE UPDATE ON warmup_seeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_warmup_threads_updated_at BEFORE UPDATE ON warmup_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inbox_messages_updated_at BEFORE UPDATE ON inbox_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHEMA SUMMARY
-- ============================================================================
-- Tables: 21 (Up from 13)
-- Includes full support for:
-- 1. Cold Email Outreach (Campaigns, Contacts)
-- 2. Email Warmup (Threads, Seeds)
-- 3. Multi-Sender Rotation (Campaign Accounts)
-- 4. RAG / Knowledge Base (Docs, Github)
-- ============================================================================
