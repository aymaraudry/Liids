import { getNextApiKey } from '@/lib/pipeline/rotation'
import type { ApiKey } from '@/lib/supabase/types'

export interface FoundContact {
  firstName: string
  lastName: string
  title: string
  email?: string
  linkedinUrl?: string
  sourceApi: string
}

export const TARGET_TITLES = [
  'CMO', 'Chief Marketing Officer',
  'VP Marketing', 'VP of Marketing',
  'Head of Marketing', 'Marketing Director', 'Director of Marketing',
  'Growth Lead', 'Head of Growth', 'VP Growth', 'VP of Growth',
  'CEO', 'Chief Executive Officer', 'Founder', 'Co-Founder',
]

const CONTACT_SERVICES = [
  'apollo', 'hunter', 'snov', 'findymail', 'skrapp',
  'rocketreach', 'lusha', 'voilanorbert', 'anymailfinder',
  'getprospect', 'datagma', 'contactout', 'wiza',
  'tomba', 'enrow', 'prospeo', 'icypeas',
  'seamless', 'fullenrich', 'kaspr',
]

export async function findContacts(domain: string, companyName: string): Promise<FoundContact[]> {
  const allContacts: FoundContact[] = []

  for (const service of CONTACT_SERVICES) {
    if (allContacts.length >= 15) break
    const key = await getNextApiKey(service)
    if (!key) continue
    try {
      const contacts = await findViaService(service, key, domain, companyName)
      allContacts.push(...contacts)
    } catch {
      continue
    }
  }

  return deduplicateContacts(allContacts)
}

async function findViaService(service: string, key: ApiKey, domain: string, companyName: string): Promise<FoundContact[]> {
  switch (service) {
    case 'apollo':        return findViaApollo(domain, key.key_value)
    case 'hunter':        return findViaHunter(domain, key.key_value)
    case 'snov':          return findViaSnov(domain, key.key_value)
    case 'findymail':     return findViaFindymail(domain, key.key_value)
    case 'skrapp':        return findViaSkrapp(domain, key.key_value)
    case 'tomba':         return findViaTomba(domain, key.key_value)
    case 'anymailfinder': return findViaAnyMailFinder(domain, key.key_value)
    case 'getprospect':   return findViaGetProspect(domain, key.key_value)
    case 'wiza':          return findViaWiza(domain, key.key_value)
    case 'enrow':         return findViaEnrow(domain, key.key_value)
    case 'prospeo':       return findViaProspeo(domain, key.key_value)
    case 'icypeas':       return findViaIcypeas(domain, key.key_value)
    case 'rocketreach':   return findViaRocketReach(domain, key.key_value)
    case 'lusha':         return findViaLusha(domain, key.key_value)
    case 'voilanorbert':  return findViaVoilaNorbert(domain, key.key_value)
    default:              return []
  }
}

async function findViaApollo(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ organization_domains: [domain], person_titles: TARGET_TITLES, page: 1, per_page: 10 }),
  })
  if (!res.ok) throw new Error(`Apollo contacts ${res.status}`)
  const json = await res.json()
  return (json?.people ?? []).map((p: Record<string, unknown>) => ({
    firstName: p.first_name as string ?? '',
    lastName: p.last_name as string ?? '',
    title: p.title as string ?? '',
    email: p.email as string | undefined,
    linkedinUrl: p.linkedin_url as string | undefined,
    sourceApi: 'apollo',
  }))
}

async function findViaHunter(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=10`)
  if (!res.ok) throw new Error(`Hunter contacts ${res.status}`)
  const json = await res.json()
  return (json?.data?.emails ?? [])
    .filter((e: Record<string, unknown>) => isTargetTitle(e.position as string ?? ''))
    .map((e: Record<string, unknown>) => ({
      firstName: e.first_name as string ?? '',
      lastName: e.last_name as string ?? '',
      title: e.position as string ?? '',
      email: e.value as string,
      linkedinUrl: e.linkedin as string | undefined,
      sourceApi: 'hunter',
    }))
}

async function findViaSnov(domain: string, apiKey: string): Promise<FoundContact[]> {
  const [clientId, clientSecret] = apiKey.split(':')
  const tokenRes = await fetch('https://api.snov.io/v1/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  })
  if (!tokenRes.ok) throw new Error(`Snov auth ${tokenRes.status}`)
  const { access_token } = await tokenRes.json()
  const res = await fetch(`https://api.snov.io/v1/get-domain-emails-with-info?domain=${domain}&type=personal&limit=10`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!res.ok) throw new Error(`Snov contacts ${res.status}`)
  const json = await res.json()
  return (json?.data ?? [])
    .filter((e: Record<string, unknown>) => isTargetTitle(e.position as string ?? ''))
    .map((e: Record<string, unknown>) => ({
      firstName: e.firstName as string ?? '',
      lastName: e.lastName as string ?? '',
      title: e.position as string ?? '',
      email: e.email as string | undefined,
      sourceApi: 'snov',
    }))
}

async function findViaFindymail(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch('https://app.findymail.com/api/search/domain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ domain, limit: 10 }),
  })
  if (!res.ok) throw new Error(`Findymail ${res.status}`)
  const json = await res.json()
  return (json?.contacts ?? [])
    .filter((c: Record<string, unknown>) => isTargetTitle(c.title as string ?? ''))
    .map((c: Record<string, unknown>) => ({
      firstName: c.first_name as string ?? '',
      lastName: c.last_name as string ?? '',
      title: c.title as string ?? '',
      email: c.email as string | undefined,
      linkedinUrl: c.linkedin_url as string | undefined,
      sourceApi: 'findymail',
    }))
}

async function findViaSkrapp(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.skrapp.io/api/v2/find?domain=${domain}`, {
    headers: { 'X-Access-Key': apiKey },
  })
  if (!res.ok) throw new Error(`Skrapp ${res.status}`)
  const json = await res.json()
  return (json?.emails ?? [])
    .filter((e: Record<string, unknown>) => isTargetTitle(e.role as string ?? ''))
    .map((e: Record<string, unknown>) => ({
      firstName: e.first_name as string ?? '',
      lastName: e.last_name as string ?? '',
      title: e.role as string ?? '',
      email: e.email as string | undefined,
      linkedinUrl: e.linkedin as string | undefined,
      sourceApi: 'skrapp',
    }))
}

async function findViaTomba(domain: string, apiKey: string): Promise<FoundContact[]> {
  const [key, secret] = apiKey.split(':')
  const res = await fetch(`https://api.tomba.io/v1/domain-search/${domain}`, {
    headers: { 'X-Tomba-Key': key, 'X-Tomba-Secret': secret ?? '' },
  })
  if (!res.ok) throw new Error(`Tomba ${res.status}`)
  const json = await res.json()
  return (json?.data?.emails ?? [])
    .filter((e: Record<string, unknown>) => isTargetTitle(e.position as string ?? ''))
    .map((e: Record<string, unknown>) => ({
      firstName: e.first_name as string ?? '',
      lastName: e.last_name as string ?? '',
      title: e.position as string ?? '',
      email: e.email as string | undefined,
      linkedinUrl: e.linkedin as string | undefined,
      sourceApi: 'tomba',
    }))
}

async function findViaAnyMailFinder(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.anymailfinder.com/v5.0/search/company.json?domain=${domain}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`AnyMailFinder ${res.status}`)
  const json = await res.json()
  return (json?.result?.emails ?? []).map((e: Record<string, unknown>) => ({
    firstName: e.first_name as string ?? '',
    lastName: e.last_name as string ?? '',
    title: e.position as string ?? '',
    email: e.email as string | undefined,
    sourceApi: 'anymailfinder',
  }))
}

async function findViaGetProspect(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://app.getprospect.com/api/v1/person/find?domain=${domain}`, {
    headers: { token: apiKey },
  })
  if (!res.ok) throw new Error(`GetProspect ${res.status}`)
  const json = await res.json()
  return (json?.persons ?? [])
    .filter((p: Record<string, unknown>) => isTargetTitle(p.position as string ?? ''))
    .map((p: Record<string, unknown>) => ({
      firstName: p.firstName as string ?? '',
      lastName: p.lastName as string ?? '',
      title: p.position as string ?? '',
      email: p.email as string | undefined,
      linkedinUrl: p.linkedinUrl as string | undefined,
      sourceApi: 'getprospect',
    }))
}

async function findViaWiza(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch('https://wiza.co/api/prospecting/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ company_domain: domain, seniority: ['c_suite', 'director', 'vp'] }),
  })
  if (!res.ok) throw new Error(`Wiza ${res.status}`)
  const json = await res.json()
  return (json?.data ?? [])
    .filter((p: Record<string, unknown>) => isTargetTitle(p.title as string ?? ''))
    .map((p: Record<string, unknown>) => ({
      firstName: p.first_name as string ?? '',
      lastName: p.last_name as string ?? '',
      title: p.title as string ?? '',
      email: p.email as string | undefined,
      linkedinUrl: p.linkedin_url as string | undefined,
      sourceApi: 'wiza',
    }))
}

async function findViaEnrow(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.enrow.io/v1/find?domain=${domain}`, {
    headers: { 'x-api-key': apiKey },
  })
  if (!res.ok) throw new Error(`Enrow ${res.status}`)
  const json = await res.json()
  return (json?.emails ?? [])
    .filter((e: Record<string, unknown>) => isTargetTitle(e.job_title as string ?? ''))
    .map((e: Record<string, unknown>) => ({
      firstName: e.first_name as string ?? '',
      lastName: e.last_name as string ?? '',
      title: e.job_title as string ?? '',
      email: e.email as string | undefined,
      linkedinUrl: e.linkedin_profile as string | undefined,
      sourceApi: 'enrow',
    }))
}

async function findViaProspeo(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.prospeo.io/domain-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-KEY': apiKey },
    body: JSON.stringify({ company: domain, limit: 10 }),
  })
  if (!res.ok) throw new Error(`Prospeo ${res.status}`)
  const json = await res.json()
  return (json?.response ?? [])
    .filter((p: Record<string, unknown>) => isTargetTitle(p.job_title as string ?? ''))
    .map((p: Record<string, unknown>) => ({
      firstName: p.first_name as string ?? '',
      lastName: p.last_name as string ?? '',
      title: p.job_title as string ?? '',
      email: p.email as string | undefined,
      linkedinUrl: p.linkedin_url as string | undefined,
      sourceApi: 'prospeo',
    }))
}

async function findViaIcypeas(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://app.icypeas.com/api/bulk-single-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ domainOrCompany: domain }),
  })
  if (!res.ok) throw new Error(`Icypeas ${res.status}`)
  const json = await res.json()
  return (json?.items ?? [])
    .filter((p: Record<string, unknown>) => isTargetTitle(p.position as string ?? ''))
    .map((p: Record<string, unknown>) => ({
      firstName: p.firstname as string ?? '',
      lastName: p.lastname as string ?? '',
      title: p.position as string ?? '',
      email: (p.emails as string[])?.[0],
      linkedinUrl: p.linkedin as string | undefined,
      sourceApi: 'icypeas',
    }))
}

async function findViaRocketReach(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.rocketreach.co/v2/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
    body: JSON.stringify({ query: { current_employer: [domain], titles: TARGET_TITLES }, start: 1, pageSize: 5 }),
  })
  if (!res.ok) throw new Error(`RocketReach ${res.status}`)
  const json = await res.json()
  return (json?.profiles ?? []).map((p: Record<string, unknown>) => ({
    firstName: p.first_name as string ?? '',
    lastName: p.last_name as string ?? '',
    title: p.current_title as string ?? '',
    email: (p.emails as string[])?.[0],
    linkedinUrl: p.linkedin_url as string | undefined,
    sourceApi: 'rocketreach',
  }))
}

async function findViaLusha(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.lusha.com/prospect?company=${encodeURIComponent(domain)}`, {
    headers: { api_key: apiKey },
  })
  if (!res.ok) throw new Error(`Lusha ${res.status}`)
  const json = await res.json()
  return (json?.data ?? [])
    .filter((p: Record<string, unknown>) => isTargetTitle(p.jobTitle as string ?? ''))
    .map((p: Record<string, unknown>) => ({
      firstName: p.firstName as string ?? '',
      lastName: p.lastName as string ?? '',
      title: p.jobTitle as string ?? '',
      email: p.emailAddress as string | undefined,
      linkedinUrl: p.linkedinUrl as string | undefined,
      sourceApi: 'lusha',
    }))
}

async function findViaVoilaNorbert(domain: string, apiKey: string): Promise<FoundContact[]> {
  const res = await fetch(`https://api.voilanorbert.com/2018-01-08/search/domain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`any:${apiKey}`).toString('base64')}` },
    body: JSON.stringify({ domain, limit: 5 }),
  })
  if (!res.ok) throw new Error(`VoilaNorbert ${res.status}`)
  const json = await res.json()
  return (json?.results ?? []).map((p: Record<string, unknown>) => ({
    firstName: (p.name as string ?? '').split(' ')[0] ?? '',
    lastName: (p.name as string ?? '').split(' ').slice(1).join(' '),
    title: p.title as string ?? '',
    email: p.email as string | undefined,
    sourceApi: 'voilanorbert',
  }))
}

export function isTargetTitle(title: string): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  return TARGET_TITLES.some(t => lower.includes(t.toLowerCase()))
}

export function deduplicateContacts(contacts: FoundContact[]): FoundContact[] {
  const map = new Map<string, FoundContact & { sources: string[] }>()
  for (const c of contacts) {
    const key = (c.email ?? `${c.firstName}_${c.lastName}`).toLowerCase()
    if (!key) continue
    if (map.has(key)) {
      map.get(key)!.sources.push(c.sourceApi)
    } else {
      map.set(key, { ...c, sources: [c.sourceApi] })
    }
  }
  return Array.from(map.values()).map(({ sources, ...c }) => ({
    ...c,
    sourceApi: [...new Set(sources)].join(','),
  }))
}
