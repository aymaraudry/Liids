import type { DiscoveredCompany } from './meta'

export async function discoverFromTikTok(industry: string, limit = 25): Promise<DiscoveredCompany[]> {
  const results: DiscoveredCompany[] = []
  try {
    const url = `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?keyword=${encodeURIComponent(industry)}&industry=&objective=&period=7`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://ads.tiktok.com/',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`TikTok ${res.status}`)

    const json = await res.json()
    const ads: Record<string, unknown>[] = (json?.data?.list as Record<string, unknown>[]) ?? []

    for (const ad of ads.slice(0, limit)) {
      const info = ad?.advertiser_info as Record<string, unknown> | undefined
      const rawUrl = info?.profile_website as string | undefined
      const name = (info?.advertiser_name as string) ?? ''

      let domain = ''
      if (rawUrl) {
        domain = rawUrl.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
      }
      if (!domain && name) {
        domain = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com'
      }
      if (!domain) continue

      results.push({
        name,
        domain,
        adPlatform: 'tiktok',
        adPreviewText: (ad?.video_info as Record<string, unknown>)?.desc as string ?? '',
      })
    }
  } catch (err) {
    console.error('[TikTok] Discovery failed:', err)
  }
  return results
}
