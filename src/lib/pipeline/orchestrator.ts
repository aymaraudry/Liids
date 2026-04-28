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

export async function runPipeline(): Promise<PipelineResult> {
  const supabase = await createServiceClient()
  const errors: Array<{ step: string; message: string }> = []
  let companiesDiscovered = 0
  let contactsFound = 0
  let emailsVerified = 0

  // Create run log
  const { data: runLog } = await supabase
    .from('run_logs')
    .insert({ status: 'running' })
    .select()
    .single()
  const logId = runLog?.id

  try {
    // Load settings
    const { data: settings } = await supabase.from('settings').select('*').single()
    const industry = settings?.target_industry ?? 'SaaS'
    const minCompanies = settings?.min_companies_per_run ?? 100
    const blacklistedDomains = new Set<string>(settings?.blacklisted_domains ?? [])

    console.log(`[Pipeline] Starting run — industry: ${industry}, target: ${minCompanies} companies`)

    // Step 1: Discover
    const discovered = await discoverCompanies(industry, minCompanies)

    // Step 2: Filter known + blacklisted
    const { data: existingRows } = await supabase.from('companies').select('domain')
    const knownDomains = new Set((existingRows ?? []).map((c: { domain: string }) => c.domain))

    const newCompanies = discovered.filter(c =>
      c.domain && !knownDomains.has(c.domain) && !blacklistedDomains.has(c.domain)
    )
    console.log(`[Pipeline] ${newCompanies.length} new companies to process`)

    // Step 3: Enrich + find contacts per company
    for (const company of newCompanies) {
      try {
        // Enrich company
        const enriched = await enrichCompany(company.domain)

        const { data: saved, error: saveErr } = await supabase
          .from('companies')
          .insert({
            name: enriched.name ?? company.name,
            domain: company.domain,
            website: enriched.website ?? `https://${company.domain}`,
            app_link: enriched.appLink ?? null,
            industry: enriched.industry ?? industry,
            company_size: enriched.companySize ?? null,
            company_email: enriched.companyEmail ?? null,
            linkedin_page: enriched.linkedinPage ?? null,
            social_handles: enriched.socialHandles ?? {},
            location: enriched.location ?? null,
            ad_platforms: [company.adPlatform],
            status: 'enriched',
          })
          .select()
          .single()

        if (saveErr || !saved) {
          errors.push({ step: 'company_save', message: `${company.domain}: ${saveErr?.message ?? 'unknown'}` })
          continue
        }
        companiesDiscovered++

        // Find contacts
        const contacts = await findContacts(company.domain, saved.name ?? company.name)

        // Verify + save each contact
        for (const contact of contacts) {
          let verified = false
          if (contact.email) {
            try {
              const vResult = await verifyEmail(contact.email)
              verified = vResult.verified
              if (verified) emailsVerified++
            } catch (err) {
              errors.push({ step: 'verify', message: `${contact.email}: ${String(err)}` })
            }
          }

          const score = calculateConfidenceScore(contact, verified)
          const sources = contact.sourceApi.split(',').filter(Boolean)

          const { error: contactErr } = await supabase.from('contacts').insert({
            company_id: saved.id,
            first_name: contact.firstName || null,
            last_name: contact.lastName || null,
            title: contact.title || null,
            email: contact.email ?? null,
            email_verified: verified,
            linkedin_url: contact.linkedinUrl ?? null,
            confidence_score: score,
            source_apis: sources,
            status: 'pending',
          })

          if (!contactErr) contactsFound++
        }
      } catch (err) {
        errors.push({ step: 'enrichment', message: `${company.domain}: ${String(err)}` })
      }
    }

    // Update run log — completed
    if (logId) {
      await supabase.from('run_logs').update({
        completed_at: new Date().toISOString(),
        companies_discovered: companiesDiscovered,
        contacts_found: contactsFound,
        emails_verified: emailsVerified,
        errors,
        status: 'completed',
      }).eq('id', logId)
    }

    await supabase.from('settings').update({ last_run_at: new Date().toISOString() }).gt('id', '00000000-0000-0000-0000-000000000000')

    console.log(`[Pipeline] Done — ${companiesDiscovered} companies, ${contactsFound} contacts, ${emailsVerified} verified`)
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr)
    errors.push({ step: 'pipeline', message: msg })
    if (logId) {
      await supabase.from('run_logs').update({
        completed_at: new Date().toISOString(),
        errors,
        status: 'failed',
      }).eq('id', logId)
    }
  }

  return { companiesDiscovered, contactsFound, emailsVerified, errors }
}
