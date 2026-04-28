-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies discovered from ad platforms
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  domain text UNIQUE NOT NULL,
  website text,
  app_link text,
  industry text,
  company_size text,
  company_email text,
  linkedin_page text,
  social_handles jsonb DEFAULT '{}',
  location text,
  ad_platforms text[] DEFAULT '{}',
  discovered_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending_enrichment'
    CHECK (status IN ('pending_enrichment','enriched','approved','rejected','contacted'))
);

-- Contacts (decision makers) per company
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  title text,
  email text,
  email_verified boolean DEFAULT false,
  linkedin_url text,
  confidence_score int DEFAULT 1 CHECK (confidence_score BETWEEN 1 AND 5),
  source_apis text[] DEFAULT '{}',
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','contacted','bounced','replied','unsubscribed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  last_contacted_at timestamptz
);

-- Approved leads
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  approved_at timestamptz DEFAULT now(),
  outreach_status text DEFAULT 'queued'
    CHECK (outreach_status IN ('queued','in_progress','completed','paused')),
  notes text
);

-- Pitch email templates
CREATE TABLE pitch_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  industry text DEFAULT 'all',
  step int NOT NULL CHECK (step IN (1,2,3)),
  subject text NOT NULL,
  body text NOT NULL,
  variant text DEFAULT 'A' CHECK (variant IN ('A','B')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Email sequences per contact
CREATE TABLE sequences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  template_id uuid REFERENCES pitch_templates(id),
  step int NOT NULL CHECK (step IN (1,2,3)),
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  bounced_at timestamptz,
  sender_email text,
  personalized_opening text
);

-- API keys pool
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name text NOT NULL,
  key_value text NOT NULL,
  daily_limit int DEFAULT 100,
  used_today int DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  is_exhausted_today boolean DEFAULT false
);

-- Sender email accounts
CREATE TABLE sender_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('sendgrid','resend','brevo','mailgun')),
  api_key_id uuid REFERENCES api_keys(id),
  daily_limit int DEFAULT 100,
  sent_today int DEFAULT 0,
  is_active boolean DEFAULT true,
  is_warming_up boolean DEFAULT false,
  warmup_day int DEFAULT 1
);

-- Global settings (single row)
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_industry text DEFAULT 'SaaS',
  schedule_frequency text DEFAULT 'manual'
    CHECK (schedule_frequency IN ('daily','weekly','manual')),
  schedule_time text DEFAULT '08:00',
  min_companies_per_run int DEFAULT 100,
  sending_limit_per_day int DEFAULT 100,
  sequence_delays int[] DEFAULT '{0,3,7}',
  warmup_mode boolean DEFAULT true,
  blacklisted_domains text[] DEFAULT '{}',
  compliance_address text DEFAULT '',
  unsubscribe_redirect text DEFAULT '',
  last_run_at timestamptz,
  next_run_at timestamptz
);

-- Insert default settings row
INSERT INTO settings DEFAULT VALUES;

-- Run logs
CREATE TABLE run_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  companies_discovered int DEFAULT 0,
  contacts_found int DEFAULT 0,
  emails_verified int DEFAULT 0,
  errors jsonb DEFAULT '[]',
  status text DEFAULT 'running'
    CHECK (status IN ('running','completed','failed'))
);

-- Blacklist (unsubscribes + hard bounces)
CREATE TABLE blacklist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text,
  domain text,
  reason text CHECK (reason IN ('unsubscribe','hard_bounce','manual')),
  added_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_sequences_contact ON sequences(contact_id);
CREATE INDEX idx_sequences_scheduled ON sequences(scheduled_at);
CREATE INDEX idx_api_keys_service ON api_keys(service_name);
CREATE INDEX idx_blacklist_email ON blacklist(email);
CREATE INDEX idx_blacklist_domain ON blacklist(domain);

-- Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies: only authenticated users
CREATE POLICY "auth_only" ON companies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON sequences FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON pitch_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON api_keys FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON sender_accounts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON run_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_only" ON blacklist FOR ALL USING (auth.role() = 'authenticated');
