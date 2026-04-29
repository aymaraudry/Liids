import { createServiceClient } from '@/lib/supabase/server'

export interface SendEmailParams {
  to: string
  subject: string
  body: string
  fromName?: string
  fromEmail?: string
  sequenceId?: string
}

export interface SendResult {
  success: boolean
  messageId?: string
  provider?: string
  error?: string
}

export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const supabase = await createServiceClient()

  // Get settings for daily limit
  const { data: settings } = await supabase.from('settings').select('sending_limit_per_day').single()
  const dailyLimit = settings?.sending_limit_per_day ?? 100

  // Count today's sends
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const { count: sentToday } = await supabase
    .from('sequences')
    .select('*', { count: 'exact', head: true })
    .not('sent_at', 'is', null)
    .gte('sent_at', today.toISOString())

  if ((sentToday ?? 0) >= dailyLimit) {
    return { success: false, error: 'Daily sending limit reached' }
  }

  // Check blacklist
  const emailDomain = params.to.split('@')[1]
  const { data: blacklisted } = await supabase
    .from('blacklist')
    .select('id')
    .or(`email.eq.${params.to},domain.eq.${emailDomain}`)
    .limit(1)
    .maybeSingle()

  if (blacklisted) {
    return { success: false, error: 'Email or domain is blacklisted' }
  }

  // Get active sender account with remaining capacity
  const { data: senders } = await supabase
    .from('sender_accounts')
    .select('*, api_keys(key_value, is_exhausted_today)')
    .eq('is_active', true)
    .lt('sent_today', 999) // filter in JS below
    .order('sent_today', { ascending: true })

  const availableSenders = (senders ?? []).filter(
    (s: Record<string, unknown>) => {
      const key = s.api_keys as { key_value: string; is_exhausted_today: boolean } | null
      return (s.sent_today as number) < (s.daily_limit as number) && key && !key.is_exhausted_today
    }
  )

  if (!availableSenders.length) {
    return { success: false, error: 'No sender accounts available' }
  }

  const sender = availableSenders[0] as {
    id: string; email: string; provider: string; warmup_mode: boolean; warmup_day: number; sent_today: number; daily_limit: number;
    api_keys: { key_value: string }
  }

  const fromEmail = params.fromEmail ?? sender.email
  const fromName = params.fromName ?? 'Aymar'
  const apiKey = sender.api_keys.key_value

  let result: SendResult

  switch (sender.provider) {
    case 'sendgrid':
      result = await sendViaSendGrid(params.to, subject(params.subject), params.body, fromEmail, fromName, apiKey)
      break
    case 'resend':
      result = await sendViaResend(params.to, params.subject, params.body, fromEmail, fromName, apiKey)
      break
    case 'brevo':
      result = await sendViaBrevo(params.to, params.subject, params.body, fromEmail, fromName, apiKey)
      break
    case 'mailgun':
      result = await sendViaMailgun(params.to, params.subject, params.body, fromEmail, fromName, apiKey)
      break
    default:
      result = { success: false, error: `Unknown provider: ${sender.provider}` }
  }

  if (result.success) {
    // Increment sender usage
    await supabase
      .from('sender_accounts')
      .update({ sent_today: sender.sent_today + 1 })
      .eq('id', sender.id)

    // Store sender on sequence if provided
    if (params.sequenceId) {
      await supabase
        .from('sequences')
        .update({ sent_at: new Date().toISOString(), sender_email: fromEmail })
        .eq('id', params.sequenceId)
    }

    result.provider = sender.provider
  }

  return result
}

function subject(s: string): string { return s }

async function sendViaSendGrid(
  to: string, subject: string, body: string,
  fromEmail: string, fromName: string, apiKey: string
): Promise<SendResult> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [
        { type: 'text/plain', value: body },
        { type: 'text/html', value: bodyToHtml(body) },
      ],
      tracking_settings: {
        click_tracking: { enable: true },
        open_tracking: { enable: true },
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SendGrid ${res.status}: ${err}`)
  }
  const messageId = res.headers.get('x-message-id') ?? undefined
  return { success: true, messageId }
}

async function sendViaResend(
  to: string, subject: string, body: string,
  fromEmail: string, fromName: string, apiKey: string
): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text: body,
      html: bodyToHtml(body),
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}`)
  const json = await res.json()
  return { success: true, messageId: json?.id }
}

async function sendViaBrevo(
  to: string, subject: string, body: string,
  fromEmail: string, fromName: string, apiKey: string
): Promise<SendResult> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      textContent: body,
      htmlContent: bodyToHtml(body),
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}`)
  const json = await res.json()
  return { success: true, messageId: json?.messageId }
}

async function sendViaMailgun(
  to: string, subject: string, body: string,
  fromEmail: string, fromName: string, apiKey: string
): Promise<SendResult> {
  // Mailgun API key format: "domain:key"
  const [domain, key] = apiKey.split(':')
  const formData = new FormData()
  formData.append('from', `${fromName} <${fromEmail}>`)
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('text', body)
  formData.append('html', bodyToHtml(body))

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}` },
    body: formData,
  })
  if (!res.ok) throw new Error(`Mailgun ${res.status}`)
  const json = await res.json()
  return { success: true, messageId: json?.id }
}

function bodyToHtml(text: string): string {
  return `<html><body><p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p></body></html>`
}
