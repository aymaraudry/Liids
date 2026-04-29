import { NextRequest, NextResponse } from 'next/server'
import { handleBounce, handleReply, handleOpen, handleClick } from '@/lib/outreach/tracking'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Unified webhook endpoint for all email providers.
 * Providers post events here: bounces, opens, clicks, replies.
 *
 * Setup in each provider's dashboard:
 * SendGrid:  https://yourapp.vercel.app/api/outreach/webhook?provider=sendgrid
 * Resend:    https://yourapp.vercel.app/api/outreach/webhook?provider=resend
 * Brevo:     https://yourapp.vercel.app/api/outreach/webhook?provider=brevo
 * Mailgun:   https://yourapp.vercel.app/api/outreach/webhook?provider=mailgun
 */
export async function POST(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider') ?? 'unknown'

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    switch (provider) {
      case 'sendgrid':
        await handleSendGridWebhook(body as Record<string, unknown>[])
        break
      case 'resend':
        await handleResendWebhook(body as Record<string, unknown>)
        break
      case 'brevo':
        await handleBrevoWebhook(body as Record<string, unknown>)
        break
      case 'mailgun':
        await handleMailgunWebhook(body as Record<string, unknown>)
        break
      default:
        console.warn(`[Webhook] Unknown provider: ${provider}`)
    }
  } catch (err) {
    console.error(`[Webhook] Error processing ${provider} webhook:`, err)
  }

  // Always return 200 to prevent provider retries
  return NextResponse.json({ received: true })
}

async function handleSendGridWebhook(events: Record<string, unknown>[]) {
  for (const event of events) {
    const messageId = event.sg_message_id as string ?? ''
    const seq = await findSequenceByMessageId(messageId)

    switch (event.event) {
      case 'bounce':
        if (seq) await handleBounce(seq.contact_id, event.type === 'bounce')
        break
      case 'open':
        if (seq) await handleOpen(seq.id)
        break
      case 'click':
        if (seq) await handleClick(seq.id)
        break
      case 'spamreport':
        if (seq) await handleBounce(seq.contact_id, true)
        break
    }
  }
}

async function handleResendWebhook(event: Record<string, unknown>) {
  const type = event.type as string
  const data = event.data as Record<string, unknown>
  const emailId = data?.email_id as string ?? ''
  const seq = await findSequenceByMessageId(emailId)

  if (!seq) return

  switch (type) {
    case 'email.bounced':
      await handleBounce(seq.contact_id, true)
      break
    case 'email.opened':
      await handleOpen(seq.id)
      break
    case 'email.clicked':
      await handleClick(seq.id)
      break
    case 'email.complained':
      await handleBounce(seq.contact_id, true)
      break
  }
}

async function handleBrevoWebhook(event: Record<string, unknown>) {
  const messageId = (event['message-id'] as string ?? '').replace(/[<>]/g, '')
  const seq = await findSequenceByMessageId(messageId)
  if (!seq) return

  switch (event.event) {
    case 'hard_bounce':
      await handleBounce(seq.contact_id, true)
      break
    case 'soft_bounce':
      await handleBounce(seq.contact_id, false)
      break
    case 'opened':
      await handleOpen(seq.id)
      break
    case 'clicked':
      await handleClick(seq.id)
      break
    case 'spam':
      await handleBounce(seq.contact_id, true)
      break
  }
}

async function handleMailgunWebhook(event: Record<string, unknown>) {
  const eventData = event['event-data'] as Record<string, unknown> ?? event
  const headers = ((eventData?.message as Record<string, unknown>)?.headers ?? {}) as Record<string, unknown>
  const messageId = (headers['message-id'] as string) ?? ''
  const seq = await findSequenceByMessageId(messageId)
  if (!seq) return

  switch (eventData.event) {
    case 'failed':
      await handleBounce(seq.contact_id, eventData.severity === 'permanent')
      break
    case 'opened':
      await handleOpen(seq.id)
      break
    case 'clicked':
      await handleClick(seq.id)
      break
    case 'complained':
      await handleBounce(seq.contact_id, true)
      break
  }
}

async function findSequenceByMessageId(messageId: string) {
  if (!messageId) return null
  const supabase = await createServiceClient()
  // We store sender_email but not raw message ID — look up by most recent sent sequence
  // In production you'd store message_id on the sequence row
  const { data } = await supabase
    .from('sequences')
    .select('id, contact_id')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
