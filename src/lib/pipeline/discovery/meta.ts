import { getNextApiKey, markKeyExhausted } from '@/lib/pipeline/rotation'

export interface DiscoveredCompany {
  name: string
  domain: string
  adPlatform: string
  adPreviewText?: string
}

export async function discoverFromMeta(industry: string, limit = 25): Promise<DiscoveredCompany[]> {
  const key = await getNextApiKey('meta_ad_library')
  if (!key) {
    console.warn('[Meta] No API key available')
    return []
  }

  const params = new URLSearchParams({
    access_token: key.key_value,
    search_terms: industry,
    ad_type: 'ALL',
    ad_reached_countries: '["US","GB","CA","AU"]',
    fields: 'page_name,page_id,ad_snapshot_url,ad_creative_bodies,advertiser_profile',
    limit: String(limit * 2),
  })

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/ads_archive?${params}`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) await markKeyExhausted(key.id)
      throw new Error(`Meta API ${res.status}`)
    }

    const json = await res.json()
    const results: DiscoveredCompany[] = []

    for (const ad of json.data ?? []) {
      const domain = extractDomainFromMetaAd(ad)
      if (!domain) continue
      results.push({
        name: ad.page_name ?? domain,
        domain,
        adPlatform: 'meta',
        adPreviewText: ad.ad_creative_bodies?.[0] ?? '',
      })
      if (results.length >= limit) break
    }
    return results
  } catch (err) {
    console.error('[Meta] Discovery failed:', err)
    return []
  }
}

function extractDomainFromMetaAd(ad: Record<string, unknown>): string | null {
  const pageName = (ad.page_name as string ?? '').toLowerCase().trim()
  if (!pageName) return null
  const slug = pageName.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  return slug ? `${slug}.com` : null
}
