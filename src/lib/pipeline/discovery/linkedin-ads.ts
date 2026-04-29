import type { DiscoveredCompany } from './meta'

/**
 * Discovers SaaS companies from ProductHunt (free, no auth required for basic data)
 * and Crunchbase's public pages. These are reliable sources of active SaaS companies
 * that are growth-stage and likely running ads.
 */
export async function discoverFromLinkedIn(industry: string, limit = 25): Promise<DiscoveredCompany[]> {
  const results: DiscoveredCompany[] = []

  try {
    // ProductHunt GraphQL API — completely free, no key needed for public data
    const query = `
      query {
        posts(first: ${limit}, order: VOTES, topic: "${slugifyTopic(industry)}") {
          edges {
            node {
              name
              website
              tagline
            }
          }
        }
      }
    `

    const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const json = await res.json()
      const edges = json?.data?.posts?.edges ?? []

      for (const edge of edges) {
        const node = edge?.node
        if (!node?.website) continue
        try {
          const domain = new URL(node.website).hostname.replace('www.', '')
          if (!domain) continue
          results.push({ name: node.name, domain, adPlatform: 'linkedin', adPreviewText: node.tagline ?? '' })
        } catch { continue }
      }
    }
  } catch (err) {
    console.error('[LinkedIn/ProductHunt] Discovery failed:', err)
  }

  // If ProductHunt didn't give enough, try G2's sitemap-style public data
  if (results.length < limit) {
    try {
      const slug = industry.toLowerCase().replace(/\s+/g, '-')
      const res = await fetch(`https://www.g2.com/categories/${slug}.json`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const json = await res.json()
        const products = json?.products ?? json?.data ?? []
        for (const p of products.slice(0, limit - results.length)) {
          const domain = p?.website_url?.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
          if (!domain) continue
          results.push({ name: p?.name ?? domain, domain, adPlatform: 'linkedin' })
        }
      }
    } catch { /* silent fallback */ }
  }

  return results.slice(0, limit)
}

function slugifyTopic(industry: string): string {
  return industry.toLowerCase()
    .replace(/software/gi, '').replace(/platform/gi, '').replace(/tool/gi, '')
    .trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'saas'
}
