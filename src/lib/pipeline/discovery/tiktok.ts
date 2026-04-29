import type { DiscoveredCompany } from './meta'

/**
 * Discovers SaaS companies from Capterra's public category pages
 * and the free SaaS directories. These companies are actively
 * paying for listings — proxy for ad spend.
 */
export async function discoverFromTikTok(industry: string, limit = 25): Promise<DiscoveredCompany[]> {
  const results: DiscoveredCompany[] = []

  try {
    // Capterra category search — public, no auth, returns structured data
    const slug = industry.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const categories = [slug, `${slug}-software`, `${slug}-tools`]

    for (const cat of categories) {
      if (results.length >= limit) break

      const res = await fetch(
        `https://www.capterra.com/resources/api/categories/${cat}/products?limit=${limit}`,
        {
          headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        }
      )

      if (!res.ok) continue
      const json = await res.json()
      const products = json?.data ?? json?.products ?? []

      for (const p of products) {
        const website = p?.website ?? p?.url ?? p?.website_url ?? ''
        if (!website) continue
        try {
          const domain = new URL(website.startsWith('http') ? website : `https://${website}`)
            .hostname.replace('www.', '')
          results.push({
            name: p?.name ?? p?.product_name ?? domain,
            domain,
            adPlatform: 'tiktok',
            adPreviewText: p?.tagline ?? p?.description?.slice(0, 100) ?? '',
          })
        } catch { continue }
        if (results.length >= limit) break
      }
    }
  } catch (err) {
    console.error('[TikTok/Capterra] Discovery failed:', err)
  }

  // Fallback: AlternativeTo public API
  if (results.length < 10) {
    try {
      const res = await fetch(
        `https://alternativeto.net/browse/search/?q=${encodeURIComponent(industry)}&license=commercial&platform=web`,
        {
          headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        }
      )
      if (res.ok) {
        const html = await res.text()
        const matches = [...html.matchAll(/href="https:\/\/alternativeto\.net\/software\/([^/]+)\//g)]
        const slugs = [...new Set(matches.map(m => m[1]))].slice(0, limit - results.length)
        for (const s of slugs) {
          const domain = `${s}.com`
          const name = s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          results.push({ name, domain, adPlatform: 'tiktok' })
        }
      }
    } catch { /* silent */ }
  }

  return results.slice(0, limit)
}
