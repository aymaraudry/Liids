import type { DiscoveredCompany } from './meta'

export async function discoverFromGoogle(industry: string, limit = 25): Promise<DiscoveredCompany[]> {
  const results: DiscoveredCompany[] = []
  try {
    const url = `https://adstransparency.google.com/advertiser/search?query=${encodeURIComponent(industry)}&format=JSON`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; outreach-research/1.0)', Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`Google ${res.status}`)

    const text = await res.text()
    const clean = text.replace(/^\)\]\}'\n/, '')
    let json: Record<string, unknown>
    try { json = JSON.parse(clean) } catch { return [] }

    const advertisers: Record<string, unknown>[] = (json?.advertisers as Record<string, unknown>[]) ?? []
    for (const adv of advertisers.slice(0, limit)) {
      const rawDomain = (adv?.domain as string) ?? ''
      const name = (adv?.advertiserName as string) ?? rawDomain
      const domain = normalizeDomain(rawDomain || name)
      if (!domain) continue
      results.push({ name, domain, adPlatform: 'google' })
    }
  } catch (err) {
    console.error('[Google] Discovery failed:', err)
  }
  return results
}

function normalizeDomain(raw: string): string {
  if (!raw) return ''
  try {
    if (!raw.startsWith('http')) raw = `https://${raw}`
    return new URL(raw).hostname.replace('www.', '')
  } catch {
    return raw.replace('www.', '').split('/')[0]
  }
}
