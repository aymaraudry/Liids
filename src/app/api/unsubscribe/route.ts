import { NextRequest, NextResponse } from 'next/server'
import { handleUnsubscribe } from '@/lib/outreach/tracking'
import { generateUnsubscribeToken } from '@/lib/outreach/templates'

const CRON_SECRET = process.env.CRON_SECRET ?? 'default_secret'

export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get('id')
  const token = request.nextUrl.searchParams.get('token')

  if (!contactId || !token) {
    return new NextResponse('Invalid unsubscribe link', { status: 400 })
  }

  // Verify the token
  const expectedToken = generateUnsubscribeToken(contactId, CRON_SECRET)
  if (token !== expectedToken) {
    return new NextResponse('Invalid unsubscribe token', { status: 400 })
  }

  await handleUnsubscribe(contactId)

  // Redirect to confirmation page or return HTML
  const redirectUrl = process.env.UNSUBSCRIBE_REDIRECT
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl)
  }

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head><title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;max-width:400px;margin:80px auto;text-align:center;color:#333}</style>
</head>
<body>
<h2>You've been unsubscribed</h2>
<p>You won't receive any more emails from us. We're sorry to see you go.</p>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
