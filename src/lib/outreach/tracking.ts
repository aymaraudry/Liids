import { createServiceClient } from '@/lib/supabase/server'

/**
 * Marks a contact as bounced, cancels their remaining sequences,
 * and adds their email/domain to the blacklist.
 */
export async function handleBounce(contactId: string, isHard: boolean): Promise<void> {
  const supabase = await createServiceClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('email')
    .eq('id', contactId)
    .single()

  if (!contact?.email) return

  // Update contact status
  await supabase.from('contacts')
    .update({ status: 'bounced' })
    .eq('id', contactId)

  // Mark all unsent sequences for this contact as cancelled (set scheduled_at to null)
  await supabase.from('sequences')
    .update({ bounced_at: new Date().toISOString() })
    .eq('contact_id', contactId)
    .is('sent_at', null)

  if (isHard) {
    const domain = contact.email.split('@')[1]

    // Add to blacklist
    await supabase.from('blacklist').insert([
      { email: contact.email, reason: 'hard_bounce' },
      { domain, reason: 'hard_bounce' },
    ])

    console.log(`[Tracking] Hard bounce — blacklisted ${contact.email} and ${domain}`)
  }
}

/**
 * Marks a contact as having replied, cancels all remaining sequence steps.
 */
export async function handleReply(contactId: string): Promise<void> {
  const supabase = await createServiceClient()

  await supabase.from('contacts')
    .update({ status: 'replied' })
    .eq('id', contactId)

  // Mark the most recent sent sequence step as replied
  const { data: lastSent } = await supabase
    .from('sequences')
    .select('id')
    .eq('contact_id', contactId)
    .not('sent_at', 'is', null)
    .is('replied_at', null)
    .order('step', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastSent) {
    await supabase.from('sequences')
      .update({ replied_at: new Date().toISOString() })
      .eq('id', lastSent.id)
  }

  console.log(`[Tracking] Reply recorded for contact ${contactId} — sequence cancelled`)
}

/**
 * Handles unsubscribe: adds to blacklist, updates contact, cancels sequences.
 */
export async function handleUnsubscribe(contactId: string): Promise<void> {
  const supabase = await createServiceClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('email')
    .eq('id', contactId)
    .single()

  await supabase.from('contacts')
    .update({ status: 'unsubscribed' })
    .eq('id', contactId)

  if (contact?.email) {
    const domain = contact.email.split('@')[1]
    await supabase.from('blacklist').insert([
      { email: contact.email, reason: 'unsubscribe' },
      { domain, reason: 'unsubscribe' },
    ])
  }

  // Cancel all unsent sequences
  await supabase.from('sequences')
    .update({ bounced_at: new Date().toISOString() })
    .eq('contact_id', contactId)
    .is('sent_at', null)

  console.log(`[Tracking] Unsubscribed contact ${contactId}`)
}

/**
 * Records an email open event.
 */
export async function handleOpen(sequenceId: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.from('sequences')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', sequenceId)
    .is('opened_at', null) // only set first open
}

/**
 * Records a link click event.
 */
export async function handleClick(sequenceId: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.from('sequences')
    .update({ clicked_at: new Date().toISOString() })
    .eq('id', sequenceId)
    .is('clicked_at', null)
}
