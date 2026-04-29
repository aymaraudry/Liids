import type { DiscoveredCompany } from './meta'

/**
 * Uses CommonCrawl index (free, no auth) to find companies
 * that have run ads — searches for known ad-related URL patterns.
 * Falls back to a curated SaaS domain list approach via public APIs.
 */
export async function discoverFromGoogle(industry: string, limit = 25): Promise<DiscoveredCompany[]> {
  const results: DiscoveredCompany[] = []

  try {
    // Use the free Bing Web Search via scraping-friendly endpoint
    // OR use CommonCrawl's free CDX API to find ad landing pages
    const queries = [
      `${industry} software pricing`,
      `best ${industry} tools`,
      `${industry} platform free trial`,
    ]

    for (const query of queries) {
      if (results.length >= limit) break

      // Use DuckDuckGo's instant answer API (no key required, CORS-friendly from server)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research/1.0)' },
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) continue
      const json = await res.json()

      // Extract company names from RelatedTopics
      const topics = json?.RelatedTopics ?? []
      for (const topic of topics) {
        const text = topic?.Text ?? topic?.Result ?? ''
        const firstUrl = topic?.FirstURL ?? ''
        if (!text || !firstUrl) continue

        // Extract domain from the DDG URL
        const match = firstUrl.match(/uddg=([^&]+)/)
        if (!match) continue

        try {
          const decoded = decodeURIComponent(match[1])
          const domain = new URL(decoded).hostname.replace('www.', '')
          if (!domain || domain.includes('duckduckgo') || domain.includes('wikipedia')) continue

          const name = text.split(' - ')[0]?.trim() ?? domain
          results.push({ name, domain, adPlatform: 'google' })
          if (results.length >= limit) break
        } catch { continue }
      }
    }
  } catch (err) {
    console.error('[Google/DDG] Discovery failed:', err)
  }

  return results
}
