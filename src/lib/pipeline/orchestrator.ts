import { discoverCompanies } from './discovery'
import { enrichCompany } from './enrichment/company'
import { findContacts } from './enrichment/contacts'
import { verifyEmail } from './verification/email'
import { calculateConfidenceScore } from '@/lib/utils/scoring'
import { createServiceClient } from '@/lib/supabase/server'

export interface PipelineResult {
  companiesDiscovered: number
  contactsFound: number
  emailsVerified: number
  errors: Array<{ step: string; message: string }>
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<null>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    const result = await Promise.race([promise, timeout]) as T
    clearTimeout(timer!)
    return result
  } catch (err) {
    console.warn(`[Pipeline] ${label}:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * PHASE 1 — Discovery only.
 * Finds companies from ad platforms and saves them as pending_enrichment.
 * Fast enough to complete within Vercel's 10s limit.
 */
export async function runDiscovery(): Promise<{ found: number; errors: string[] }> {
  const supabase = await createServiceClient()
  const errors: string[] = []

  const { data: settings } = await supabase.from('settings').select('*').single()
  const industry = settings?.target_industry ?? 'SaaS'
  const minCompanies = settings?.min_companies_per_run ?? 100
  const blacklistedDomains = new Set<string>(settings?.blacklisted_domains ?? [])

  console.log(`[Discovery] Starting for: "${industry}"`)

  const discovered = await withTimeout(
    discoverCompanies(industry, minCompanies),
    8000,
    'discoverCompanies'
  ) ?? []

  console.log(`[Discovery] Found ${discovered.length} companies`)

  if (discovered.length === 0) {
    errors.push('No companies discovered — verify Meta Ad Library API key is active')
    return { found: 0, errors }
  }

  // Filter already known + blacklisted
  const { data: existingRows } = await supabase.from('companies').select('domain')
  const knownDomains = new Set((existingRows ?? []).map((c: { domain: string }) => c.domain))

  const newCompanies = discovered.filter(c =>
    c.domain && !knownDomains.has(c.domain) && !blacklistedDomains.has(c.domain)
  )

  // Save all new companies as pending_enrichment
  let saved = 0
  for (const company of newCompanies) {
    const { error } = await supabase.from('companies').insert({
      name: company.name,
      domain: company.domain,
      website: `https://${company.domain}`,
      industry,
      ad_platforms: [company.adPlatform],
      status: 'pending_enrichment',
    }).select().single()

    if (!error) saved++
  }

  console.log(`[Discovery] Saved ${saved} new companies`)
  return { found: saved, errors }
}

/**
 * PHASE 2 — Enrich a small batch of pending companies.
 * Processes 5 at a time — safe for Vercel's 10s limit.
 * Called repeatedly by cron until all companies are enriched.
 */
export async function runEnrichmentBatch(batchSize = 5): Promise<{ processed: number; contactsFound: number; errors: string[] }> {
  const supabase = await createServiceClient()
  const errors: string[] = []
  let processed = 0
  let contactsFound = 0

  // Grab next batch of pending companies
  const { data: pending } = await supabase
    .from('companies')
    .select('id, name, domain, industry, ad_platforms')
    .eq('status', 'pending_enrichment')
    .order('discovered_at', { ascending: true })
    .limit(batchSize)

  if (!pending?.length) {
    console.log('[Enrichment] No pending companies')
    return { processed: 0, contactsFound: 0, errors: [] }
  }

  console.log(`[Enrichment] Processing ${pending.length} companies`)

  for (const company of pending) {
    try {
      // Enrich company details
      const enriched = await withTimeout(
        enrichCompany(company.domain),
        5000,
        `enrich:${company.domain}`
      ) ?? {}

      // Update company record
      await supabase.from('companies').update({
        name: enriched.name ?? company.name,
        website: enriched.website ?? `https://${company.domain}`,
        industry: enriched.industry ?? company.industry,
        company_size: enriched.companySize ?? null,
        company_email: enriched.companyEmail ?? null,
        linkedin_page: enriched.linkedinPage ?? null,
        social_handles: enriched.socialHandles ?? {},
        location: enriched.location ?? null,
        status: 'enriched',
      }).eq('id', company.id)

      processed++

      // Find contacts
      const contacts = await withTimeout(
        findContacts(company.domain, enriched.name ?? company.name),
        6000,
        `contacts:${company.domain}`
      ) ?? []

      console.log(`[Enrichment] ${company.domain} → ${contacts.length} contacts`)

      for (const contact of contacts) {
        let verified = false
        if (contact.email) {
          const vResult = await withTimeout(
            verifyEmail(contact.email),
            4000,
            `verify:${contact.email}`
          )
          verified = vResult?.verified ?? false
        }

        const score = calculateConfidenceScore(contact, verified)

        const { error: contactErr } = await supabase.from('contacts').insert({
          company_id: company.id,
          first_name: contact.firstName || null,
          last_name: contact.lastName || null,
          title: contact.title || null,
          email: contact.email ?? null,
          email_verified: verified,
          linkedin_url: contact.linkedinUrl ?? null,
          confidence_score: score,
          source_apis: contact.sourceApi.split(',').filter(Boolean),
          status: 'pending',
        })

        if (!contactErr) contactsFound++
      }

    } catch (err) {
      errors.push(`${company.domain}: ${String(err)}`)
      // Mark as enriched anyway so we don't keep retrying
      await supabase.from('companies').update({ status: 'enriched' }).eq('id', company.id)
    }
  }

  console.log(`[Enrichment] Done — ${processed} companies, ${contactsFound} contacts`)
  return { processed, contactsFound, errors }
}

/**
 * Main pipeline entry point — runs discovery then one enrichment batch.
 * Designed to complete within Vercel's 10s function timeout.
 */
export async function runPipeline(): Promise<PipelineResult> {
  const supabase = await createServiceClient()
  const errors: Array<{ step: string; message: string }> = []

  const { data: runLog } = await supabase
    .from('run_logs')
    .insert({ status: 'running' })
    .select()
    .single()
  const logId = runLog?.id

  let companiesDiscovered = 0
  let contactsFound = 0
  let emailsVerified = 0

  try {
    // Run discovery
    const discoveryResult = await runDiscovery()
    companiesDiscovered = discoveryResult.found
    discoveryResult.errors.forEach(e => errors.push({ step: 'discovery', message: e }))

    // Run one enrichment batch immediately
    const enrichResult = await runEnrichmentBatch(5)
    contactsFound = enrichResult.contactsFound
    enrichResult.errors.forEach(e => errors.push({ step: 'enrichment', message: e }))

  } catch (fatalErr) {
    errors.push({ step: 'pipeline', message: String(fatalErr) })
  }

  // Always mark complete — never leave as "running"
  await supabase.from('run_logs').update({
    completed_at: new Date().toISOString(),
    companies_discovered: companiesDiscovered,
    contacts_found: contactsFound,
    emails_verified: emailsVerified,
    errors,
    status: errors.some(e => e.step === 'pipeline') ? 'failed' : 'completed',
  }).eq('id', logId)

  await supabase.from('settings')
    .update({ last_run_at: new Date().toISOString() })
    .gt('id', '00000000-0000-0000-0000-000000000000')

  return { companiesDiscovered, contactsFound, emailsVerified, errors }
}

