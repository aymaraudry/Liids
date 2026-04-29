import { createServiceClient } from '@/lib/supabase/server'
import { generatePersonalizedOpening } from './personalization'
import { renderTemplate, buildUnsubscribeLink, generateUnsubscribeToken } from './templates'
import { sendEmail } from './sender'
import { pickTemplateForStep } from './ab-test'

const CRON_SECRET = process.env.CRON_SECRET ?? 'default_secret'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://outreach-engine.vercel.app'

/**
 * Called after a lead is approved.
 * Creates sequence rows (step 1, 2, 3) for every approved contact under that lead.
 */
export async function createSequencesForLead(leadId: string): Promise<void> {
  const supabase = await createServiceClient()

  // Get settings for delays
  const { data: settings } = await supabase.from('settings').select('sequence_delays').single()
  const delays: number[] = settings?.sequence_delays ?? [0, 3, 7]

  // Get the lead + company + contacts
  const { data: lead } = await supabase
    .from('leads')
    .select('*, companies(*, contacts(*))')
    .eq('id', leadId)
    .single()

  if (!lead) return

  const company = lead.companies as Record<string, unknown>
  const contacts = (company?.contacts as Record<string, unknown>[]) ?? []
  const approvedContacts = contacts.filter(c => c.status === 'approved')

  for (let contactIdx = 0; contactIdx < approvedContacts.length; contactIdx++) {
    const contact = approvedContacts[contactIdx]
    for (let stepIndex = 0; stepIndex < 3; stepIndex++) {
      const step = stepIndex + 1
      const delayDays = delays[stepIndex] ?? stepIndex * 3

      // A/B split: pick template based on contact index
      const templateId = await pickTemplateForStep(step, contactIdx)
      if (!templateId) continue

      const scheduledAt = new Date()
      scheduledAt.setDate(scheduledAt.getDate() + delayDays)

      await supabase.from('sequences').insert({
        lead_id: leadId,
        contact_id: contact.id,
        template_id: templateId,
        step,
        scheduled_at: scheduledAt.toISOString(),
      })
    }
  }

  // Update lead status
  await supabase.from('leads').update({ outreach_status: 'queued' }).eq('id', leadId)
  console.log(`[Sequence] Created sequences for lead ${leadId} — ${approvedContacts.length} contacts × 3 steps`)
}

/**
 * Processes all due sequences — sends emails that are scheduled for now or earlier.
 * Called by the cron job or manually.
 */
export async function processDueSequences(): Promise<{ sent: number; skipped: number; errors: number }> {
  const supabase = await createServiceClient()
  let sent = 0; let skipped = 0; let errors = 0

  // Load all due unsent sequences with their full context
  const { data: dueSequences } = await supabase
    .from('sequences')
    .select(`
      *,
      pitch_templates(*),
      contacts(*, companies(name, domain, ad_platforms, industry)),
      leads(company_id)
    `)
    .is('sent_at', null)
    .is('replied_at', null)
    .is('bounced_at', null)
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(200)

  if (!dueSequences?.length) {
    console.log('[Sequence] No due sequences')
    return { sent, skipped, errors }
  }

  console.log(`[Sequence] Processing ${dueSequences.length} due sequences`)

  for (const seq of dueSequences) {
    try {
      const contact = seq.contacts as Record<string, unknown>
      const template = seq.pitch_templates as Record<string, unknown>
      const company = (contact?.companies as Record<string, unknown>) ?? {}

      if (!contact?.email || !template) { skipped++; continue }

      // Skip if earlier steps in this sequence haven't been sent yet (enforce ordering)
      if (seq.step > 1) {
        const { data: prevStep } = await supabase
          .from('sequences')
          .select('id, sent_at, replied_at, bounced_at')
          .eq('contact_id', seq.contact_id)
          .eq('lead_id', seq.lead_id)
          .eq('step', seq.step - 1)
          .single()

        if (!prevStep?.sent_at) { skipped++; continue }
        if (prevStep.replied_at || prevStep.bounced_at) {
          // Cancel this and all future steps
          await supabase.from('sequences')
            .update({ sent_at: null })
            .eq('contact_id', seq.contact_id)
            .gte('step', seq.step)
          skipped++
          continue
        }
      }

      // Check if contact has replied or bounced at any earlier step
      const { data: anyReply } = await supabase
        .from('sequences')
        .select('id')
        .eq('contact_id', seq.contact_id)
        .not('replied_at', 'is', null)
        .limit(1)
        .maybeSingle()

      if (anyReply) { skipped++; continue }

      // Generate AI personalized opening for step 1
      let aiOpening = ''
      if (seq.step === 1) {
        aiOpening = await generatePersonalizedOpening(
          company.name as string ?? 'your company',
          contact.title as string ?? 'Marketing Leader',
          (company.ad_platforms as string[]) ?? [],
          company.industry as string ?? 'SaaS'
        )
        // Cache it on the sequence
        await supabase.from('sequences').update({ personalized_opening: aiOpening }).eq('id', seq.id)
      } else {
        // Use cached opening from step 1
        const { data: step1 } = await supabase
          .from('sequences')
          .select('personalized_opening')
          .eq('contact_id', seq.contact_id)
          .eq('lead_id', seq.lead_id)
          .eq('step', 1)
          .single()
        aiOpening = step1?.personalized_opening ?? ''
      }

      // Build unsubscribe link
      const unsubToken = generateUnsubscribeToken(contact.id as string, CRON_SECRET)
      const unsubLink = buildUnsubscribeLink(APP_URL, contact.id as string, unsubToken)

      // Get settings for compliance address
      const { data: settings } = await supabase.from('settings').select('compliance_address').single()
      const complianceAddr = settings?.compliance_address ?? ''

      // Render template
      const vars = {
        first_name: contact.first_name as string ?? '',
        last_name: contact.last_name as string ?? '',
        company: company.name as string ?? '',
        title: contact.title as string ?? '',
        ai_opening: aiOpening,
        unsubscribe_link: unsubLink,
      }

      const renderedSubject = renderTemplate(template.subject as string, vars)
      const bodyBase = renderTemplate(template.body as string, vars)
      const renderedBody = complianceAddr
        ? `${bodyBase}\n\n---\n${complianceAddr}`
        : bodyBase

      // Send
      const result = await sendEmail({
        to: contact.email as string,
        subject: renderedSubject,
        body: renderedBody,
        sequenceId: seq.id,
      })

      if (result.success) {
        sent++
        await supabase.from('contacts').update({ last_contacted_at: new Date().toISOString(), status: 'contacted' }).eq('id', seq.contact_id)
        console.log(`[Sequence] ✓ Sent step ${seq.step} to ${contact.email} via ${result.provider}`)

        // Small delay between sends to avoid spam flags
        await sleep(1200)
      } else {
        if (result.error === 'Daily sending limit reached') {
          console.log('[Sequence] Daily limit reached — stopping')
          break
        }
        errors++
        console.error(`[Sequence] ✗ Failed to send to ${contact.email}: ${result.error}`)
      }
    } catch (err) {
      errors++
      console.error('[Sequence] Error processing sequence:', err)
    }
  }

  console.log(`[Sequence] Done — sent: ${sent}, skipped: ${skipped}, errors: ${errors}`)
  return { sent, skipped, errors }
}

/**
 * Handles the fallback outreach chain:
 * 1. No personal email → send to company email requesting right contact
 * 2. No email at all → generate LinkedIn draft message and store it
 */
export async function processFallbackOutreach(leadId: string): Promise<void> {
  const supabase = await createServiceClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('*, companies(*, contacts(*))')
    .eq('id', leadId)
    .single()

  if (!lead) return

  const company = lead.companies as Record<string, unknown>
  const contacts = (company?.contacts as Record<string, unknown>[]) ?? []

  // Contacts with no email but LinkedIn URL → generate draft
  const noEmailContacts = contacts.filter(c => !c.email && c.linkedin_url)
  for (const contact of noEmailContacts) {
    const draft = generateLinkedInDraft(
      contact.first_name as string ?? '',
      company.name as string ?? 'your company'
    )
    await supabase.from('contacts').update({ notes: `LinkedIn draft: ${draft}` }).eq('id', contact.id)
  }

  // If company has email but no contacts with email → send to company email
  const hasPersonalEmails = contacts.some(c => c.email)
  if (!hasPersonalEmails && company.company_email) {
    await sendEmail({
      to: company.company_email as string,
      subject: `UGC content partnership — who should I speak to?`,
      body: `Hi,

I'm reaching out because I run a UGC content studio working with SaaS brands to produce authentic video content for paid ads.

I couldn't find the right person at ${company.name as string} to speak with. Could you point me in the direction of whoever handles marketing or content?

Thanks so much,
Aymar`,
    })
  }
}

function generateLinkedInDraft(firstName: string, companyName: string): string {
  return `Hi ${firstName || 'there'}, I noticed ${companyName} is investing in paid ads and thought there might be a great fit for UGC video content. My studio works with SaaS brands to produce authentic creator content that converts. Would love to connect and share some examples if you're open to it.`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
