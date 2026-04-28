export type CompanyStatus = 'pending_enrichment' | 'enriched' | 'approved' | 'rejected' | 'contacted'
export type ContactStatus = 'pending' | 'approved' | 'rejected' | 'contacted' | 'bounced' | 'replied' | 'unsubscribed'
export type OutreachStatus = 'queued' | 'in_progress' | 'completed' | 'paused'
export type RunStatus = 'running' | 'completed' | 'failed'
export type EmailProvider = 'sendgrid' | 'resend' | 'brevo' | 'mailgun'

export interface Company {
  id: string
  name: string | null
  domain: string
  website: string | null
  app_link: string | null
  industry: string | null
  company_size: string | null
  company_email: string | null
  linkedin_page: string | null
  social_handles: Record<string, string>
  location: string | null
  ad_platforms: string[]
  discovered_at: string
  status: CompanyStatus
}

export interface Contact {
  id: string
  company_id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  email: string | null
  email_verified: boolean
  linkedin_url: string | null
  confidence_score: number
  source_apis: string[]
  status: ContactStatus
  notes: string | null
  created_at: string
  last_contacted_at: string | null
}

export interface Lead {
  id: string
  company_id: string
  approved_at: string
  outreach_status: OutreachStatus
  notes: string | null
}

export interface PitchTemplate {
  id: string
  name: string
  industry: string
  step: 1 | 2 | 3
  subject: string
  body: string
  variant: 'A' | 'B'
  is_active: boolean
  created_at: string
}

export interface Sequence {
  id: string
  lead_id: string
  contact_id: string
  template_id: string
  step: 1 | 2 | 3
  scheduled_at: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  bounced_at: string | null
  sender_email: string | null
  personalized_opening: string | null
}

export interface ApiKey {
  id: string
  service_name: string
  key_value: string
  daily_limit: number
  used_today: number
  last_used_at: string | null
  is_active: boolean
  is_exhausted_today: boolean
}

export interface SenderAccount {
  id: string
  email: string
  provider: EmailProvider
  api_key_id: string
  daily_limit: number
  sent_today: number
  is_active: boolean
  is_warming_up: boolean
  warmup_day: number
}

export interface Settings {
  id: string
  target_industry: string
  schedule_frequency: 'daily' | 'weekly' | 'manual'
  schedule_time: string
  min_companies_per_run: number
  sending_limit_per_day: number
  sequence_delays: number[]
  warmup_mode: boolean
  blacklisted_domains: string[]
  compliance_address: string
  unsubscribe_redirect: string
  last_run_at: string | null
  next_run_at: string | null
}

export interface RunLog {
  id: string
  started_at: string
  completed_at: string | null
  companies_discovered: number
  contacts_found: number
  emails_verified: number
  errors: Array<{ service: string; message: string }>
  status: RunStatus
}
