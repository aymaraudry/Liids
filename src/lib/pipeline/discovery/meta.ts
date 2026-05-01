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
    console.warn('[Meta] No API key found — add one in API Keys with service name: meta_ad_library')
    return []
  }

  const params = new URLSearchParams({
    access_token: key.key_value,
    search_terms: industry,
    ad_type: 'ALL',
    ad_reached_countries: '["US","GB","CA","AU"]',
    fields: 'page_name,page_id,ad_creative_bodies,ad_creative_link_captions,snapshot',
    limit: String(Math.min(limit * 3, 100)),
  })

  try {
    const url = `https://graph.facebook.com/v19.0/ads_archive?${params}`
    console.log('[Meta] Requesting ad library...')

    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[Meta] API error:', res.status, errBody)
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        await markKeyExhausted(key.id)
      }
      return []
    }

    const json = await res.json()
    if (json.error) {
      console.error('[Meta] API returned error:', json.error)
      return []
    }

    const ads: Record<string, unknown>[] = json.data ?? []
    console.log(`[Meta] Got ${ads.length} ads from API`)

    const results: DiscoveredCompany[] = []
    const seen = new Set<string>()

    for (const ad of ads) {
      if (results.length >= limit) break
      const domain = extractDomain(ad)
      if (!domain || seen.has(domain)) continue
      seen.add(domain)
      results.push({
        name: (ad.page_name as string) ?? domain,
        domain,
        adPlatform: 'meta',
        adPreviewText: (ad.ad_creative_bodies as string[])?.[0]?.slice(0, 150) ?? '',
      })
    }

    console.log(`[Meta] Extracted ${results.length} domains`)
    return results

  } catch (err) {
    console.error('[Meta] Discovery failed:', err)
    return []
  }
}

function extractDomain(ad: Record<string, unknown>): string | null {
  // 1. snapshot.link_url — actual ad landing page
  const snap = ad.snapshot as Record<string, unknown> | undefined
  if (snap) {
    const d = parseDomain((snap.link_url as string) ?? (snap.page_website as string) ?? '')
    if (d) return d
    for (const card of (snap.cards as Record<string, unknown>[]) ?? []) {
      const d2 = parseDomain(card.link_url as string ?? '')
      if (d2) return d2
    }
  }

  // 2. ad_creative_link_captions — often "company.com"
  for (const caption of (ad.ad_creative_link_captions as string[]) ?? []) {
    const m = caption.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i)
    if (m) {
      const d = m[1].toLowerCase().replace('www.', '')
      if (isValidDomain(d)) return d
    }
  }

  // 3. page_name slug as last resort
  const name = (ad.page_name as string ?? '').toLowerCase().trim()
  if (!name) return null
  const slug = name.replace(/[^a-z0-9]/g, '')
  if (slug.length >= 3 && slug.length <= 25) return `${slug}.com`
  return null
}

function parseDomain(url: string): string | null {
  if (!url) return null
  try {
    if (!url.startsWith('http')) url = `https://${url}`
    const h = new URL(url).hostname.replace('www.', '').toLowerCase()
    return isValidDomain(h) ? h : null
  } catch { return null }
}

function isValidDomain(d: string): boolean {
  if (!d || !d.includes('.') || d.length < 4) return false
  const blocked = ['facebook.com','fb.com','instagram.com','google.com',
    'youtube.com','twitter.com','linkedin.com','tiktok.com',
    'apple.com','amazon.com','bit.ly','doubleclick.net']
  return !blocked.some(b => d === b || d.endsWith(`.${b}`))
}
