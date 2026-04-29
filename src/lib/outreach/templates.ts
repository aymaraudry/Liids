export interface TemplateVars {
  first_name?: string
  last_name?: string
  company?: string
  title?: string
  ai_opening?: string
  unsubscribe_link?: string
}

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text
    .replace(/\{\{first_name\}\}/g, vars.first_name ?? 'there')
    .replace(/\{\{last_name\}\}/g, vars.last_name ?? '')
    .replace(/\{\{company\}\}/g, vars.company ?? 'your company')
    .replace(/\{\{title\}\}/g, vars.title ?? '')
    .replace(/\{\{ai_opening\}\}/g, vars.ai_opening ?? '')
    .replace(/\{\{unsubscribe_link\}\}/g, vars.unsubscribe_link ?? '#')
    .trim()
}

export function buildUnsubscribeLink(baseUrl: string, contactId: string, token: string): string {
  return `${baseUrl}/api/unsubscribe?id=${contactId}&token=${token}`
}

export function generateUnsubscribeToken(contactId: string, secret: string): string {
  // Simple HMAC-like token using available Node crypto
  const crypto = require('crypto')
  return crypto.createHmac('sha256', secret).update(contactId).digest('hex').slice(0, 32)
}
