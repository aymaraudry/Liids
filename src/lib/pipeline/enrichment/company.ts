import { withKeyRotation } from '@/lib/pipeline/rotation'
import type { ApiKey } from '@/lib/supabase/types'

export interface EnrichedCompany {
  name?: string
  website?: string
  appLink?: string
  industry?: string
  companySize?: string
  companyEmail?: string
  linkedinPage?: string
  location?: string
  socialHandles?: Record<string, string>
}

const ENRICHMENT_SERVICES = ['apollo', 'hunter', 'snov', 'clearbit']

export async function enrichCompany(domain: string): Promise<EnrichedCompany> {
  const result = await withKeyRotation<EnrichedCompany>(
    ENRICHMENT_SERVICES,
    async (key: ApiKey) => {
      switch (key.service_name) {
        case 'apollo':   return enrichViaApollo(domain, key.key_value)
        case 'hunter':   return enrichViaHunter(domain, key.key_value)
        case 'snov':     return enrichViaSnov(domain, key.key_value)
        case 'clearbit': return enrichViaClearbit(domain, key.key_value)
        default:         return null
      }
    }
  )
  return result ?? {}
}

async function enrichViaApollo(domain: string, apiKey: string): Promise<EnrichedCompany | null> {
  const res = await fetch('https://api.apollo.io/v1/organizations/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': apiKey },
    body: JSON.stringify({ domain }),
  })
  if (!res.ok) throw new Error(`Apollo company ${res.status}`)
  const json = await res.json()
  const org = json?.organization
  if (!org) return null
  return {
    name: org.name,
    website: org.website_url,
    industry: org.industry,
    companySize: org.estimated_num_employees?.toString(),
    linkedinPage: org.linkedin_url,
    location: [org.city, org.country].filter(Boolean).join(', '),
    socialHandles: { twitter: org.twitter_url ?? '', facebook: org.facebook_url ?? '' },
  }
}

async function enrichViaHunter(domain: string, apiKey: string): Promise<EnrichedCompany | null> {
  const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=1`)
  if (!res.ok) throw new Error(`Hunter company ${res.status}`)
  const json = await res.json()
  const data = json?.data
  if (!data) return null
  return {
    name: data.organization,
    website: `https://${domain}`,
    industry: data.industry,
    companySize: data.company_size,
    location: data.country,
    companyEmail: data.emails?.[0]?.value,
    linkedinPage: data.linkedin,
    socialHandles: { twitter: data.twitter ?? '' },
  }
}

async function enrichViaSnov(domain: string, apiKey: string): Promise<EnrichedCompany | null> {
  const [clientId, clientSecret] = apiKey.split(':')
  const tokenRes = await fetch('https://api.snov.io/v1/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  })
  if (!tokenRes.ok) throw new Error(`Snov auth ${tokenRes.status}`)
  const { access_token } = await tokenRes.json()

  const res = await fetch(`https://api.snov.io/v1/get-company-info?domain=${domain}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!res.ok) throw new Error(`Snov company ${res.status}`)
  const json = await res.json()
  if (!json?.data) return null
  return {
    name: json.data.name,
    website: json.data.website,
    industry: json.data.industry,
    companySize: json.data.size,
    location: json.data.country,
    linkedinPage: json.data.linkedInUrl,
  }
}

async function enrichViaClearbit(domain: string, apiKey: string): Promise<EnrichedCompany | null> {
  const res = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${domain}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Clearbit company ${res.status}`)
  const json = await res.json()
  if (!json?.name) return null
  return {
    name: json.name,
    website: json.url,
    industry: json.category?.industry,
    companySize: json.metrics?.employees?.toString(),
    location: json.geo?.country,
    linkedinPage: json.linkedin?.handle ? `https://linkedin.com/company/${json.linkedin.handle}` : undefined,
    socialHandles: {
      twitter: json.twitter?.handle ? `https://twitter.com/${json.twitter.handle}` : '',
      facebook: json.facebook?.handle ?? '',
    },
  }
}
