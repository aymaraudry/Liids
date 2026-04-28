import { withKeyRotation } from '@/lib/pipeline/rotation'
import type { ApiKey } from '@/lib/supabase/types'

export type VerificationStatus = 'valid' | 'invalid' | 'risky' | 'unknown'

export interface VerificationResult {
  email: string
  status: VerificationStatus
  verified: boolean
}

const VERIFICATION_SERVICES = [
  'zerobounce', 'neverbounce', 'abstract_email',
  'reoon', 'bouncify', 'emaillistverify',
  'verifalia', 'kickbox', 'emailable',
  'clearout', 'debounce', 'hunter',
]

export async function verifyEmail(email: string): Promise<VerificationResult> {
  const result = await withKeyRotation<VerificationResult>(
    VERIFICATION_SERVICES,
    async (key: ApiKey) => {
      switch (key.service_name) {
        case 'zerobounce':     return verifyViaZeroBounce(email, key.key_value)
        case 'neverbounce':    return verifyViaNeverBounce(email, key.key_value)
        case 'abstract_email': return verifyViaAbstract(email, key.key_value)
        case 'reoon':          return verifyViaReoon(email, key.key_value)
        case 'kickbox':        return verifyViaKickbox(email, key.key_value)
        case 'emailable':      return verifyViaEmailable(email, key.key_value)
        case 'clearout':       return verifyViaClearout(email, key.key_value)
        case 'debounce':       return verifyViaDebounce(email, key.key_value)
        case 'verifalia':      return verifyViaVerifalia(email, key.key_value)
        case 'hunter':         return verifyViaHunter(email, key.key_value)
        default:               return null
      }
    }
  )
  return result ?? { email, status: 'unknown', verified: false }
}

async function verifyViaZeroBounce(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error(`ZeroBounce ${res.status}`)
  const json = await res.json()
  if (!json?.status) return null
  const statusMap: Record<string, VerificationStatus> = {
    valid: 'valid', invalid: 'invalid', 'catch-all': 'risky',
    unknown: 'unknown', spamtrap: 'invalid', abuse: 'invalid', do_not_mail: 'invalid',
  }
  return { email, status: statusMap[json.status] ?? 'unknown', verified: json.status === 'valid' }
}

async function verifyViaNeverBounce(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://api.neverbounce.com/v4/single/check?key=${apiKey}&email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error(`NeverBounce ${res.status}`)
  const json = await res.json()
  const statusMap: Record<string, VerificationStatus> = {
    valid: 'valid', invalid: 'invalid', disposable: 'invalid', catchall: 'risky', unknown: 'unknown',
  }
  return { email, status: statusMap[json.result] ?? 'unknown', verified: json.result === 'valid' }
}

async function verifyViaAbstract(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error(`Abstract ${res.status}`)
  const json = await res.json()
  if (!json?.deliverability) return null
  const status: VerificationStatus = json.deliverability === 'DELIVERABLE' ? 'valid' :
    json.deliverability === 'UNDELIVERABLE' ? 'invalid' : 'risky'
  return { email, status, verified: status === 'valid' }
}

async function verifyViaReoon(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://emailverifier.reoon.com/api/v1/verify?email=${encodeURIComponent(email)}&key=${apiKey}&mode=quick`)
  if (!res.ok) throw new Error(`Reoon ${res.status}`)
  const json = await res.json()
  const s: VerificationStatus = json?.status === 'valid' ? 'valid' : json?.status === 'invalid' ? 'invalid' : 'risky'
  return { email, status: s, verified: s === 'valid' }
}

async function verifyViaKickbox(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://open.kickbox.com/v1/disposable/${encodeURIComponent(email)}?apikey=${apiKey}`)
  if (!res.ok) throw new Error(`Kickbox ${res.status}`)
  const json = await res.json()
  return { email, status: json?.disposable ? 'invalid' : 'valid', verified: !json?.disposable }
}

async function verifyViaEmailable(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://api.emailable.com/v1/verify?email=${encodeURIComponent(email)}&api_key=${apiKey}`)
  if (!res.ok) throw new Error(`Emailable ${res.status}`)
  const json = await res.json()
  const s: VerificationStatus = json?.state === 'deliverable' ? 'valid' : json?.state === 'undeliverable' ? 'invalid' : 'risky'
  return { email, status: s, verified: s === 'valid' }
}

async function verifyViaClearout(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer:${apiKey}` },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error(`Clearout ${res.status}`)
  const json = await res.json()
  const s = json?.data?.status
  const status: VerificationStatus = s === 'valid' ? 'valid' : s === 'invalid' ? 'invalid' : 'risky'
  return { email, status, verified: status === 'valid' }
}

async function verifyViaDebounce(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://api.debounce.io/v1/?api=${apiKey}&email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error(`Debounce ${res.status}`)
  const json = await res.json()
  const code = json?.debounce?.code
  return { email, status: code === '1' ? 'valid' : code === '2' ? 'invalid' : 'risky', verified: code === '1' }
}

async function verifyViaVerifalia(email: string, apiKey: string): Promise<VerificationResult | null> {
  const [user, pass] = apiKey.split(':')
  const res = await fetch('https://api.verifalia.com/v2.4/email-validations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${user}:${pass ?? ''}`).toString('base64'),
    },
    body: JSON.stringify({ entries: [{ inputData: email }] }),
  })
  if (!res.ok) throw new Error(`Verifalia ${res.status}`)
  const json = await res.json()
  const cls = json?.entries?.data?.[0]?.classification
  return {
    email,
    status: cls === 'Deliverable' ? 'valid' : cls === 'Undeliverable' ? 'invalid' : 'risky',
    verified: cls === 'Deliverable',
  }
}

async function verifyViaHunter(email: string, apiKey: string): Promise<VerificationResult | null> {
  const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`)
  if (!res.ok) throw new Error(`Hunter verify ${res.status}`)
  const json = await res.json()
  const s = json?.data?.status
  return { email, status: s === 'valid' ? 'valid' : s === 'invalid' ? 'invalid' : 'risky', verified: s === 'valid' }
}
