import type { DiscoveredCompany } from './meta'

export async function discoverFromLinkedIn(industry: string, limit = 25): Promise<DiscoveredCompany[]> {
  const results: DiscoveredCompany[] = []
  try {
    const url = `https://www.linkedin.com/ad-library/search?q=${encodeURIComponent(industry)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`LinkedIn Ads ${res.status}`)

    const html = await res.text()

    // Extract advertiser names from HTML data
    const nameMatches = [...html.matchAll(/"companyName"\s*:\s*"([^"]+)"/g)]
    const domainMatches = [...html.matchAll(/"landingPageUrl"\s*:\s*"([^"]+)"/g)]

    for (let i = 0; i < Math.min(nameMatches.length, limit); i++) {
      const name = nameMatches[i]?.[1]
      const rawUrl = domainMatches[i]?.[1]
      if (!name) continue

      let domain = ''
      if (rawUrl) {
        try { domain = new URL(rawUrl).hostname.replace('www.', '') } catch { /* skip */ }
      }
      if (!domain) {
        domain = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com'
      }

      results.push({ name, domain, adPlatform: 'linkedin' })
    }
  } catch (err) {
    console.error('[LinkedIn Ads] Discovery failed:', err)
  }
  return results
}
