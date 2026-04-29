import { discoverFromMeta } from './meta'
import { discoverFromGoogle } from './google'
import { discoverFromLinkedIn } from './linkedin-ads'
import { discoverFromTikTok } from './tiktok'
export type { DiscoveredCompany } from './meta'

export async function discoverCompanies(industry: string, minCompanies = 100) {
  const perPlatform = Math.ceil(minCompanies / 4)

  const [meta, google, linkedin, tiktok] = await Promise.allSettled([
    discoverFromMeta(industry, perPlatform),
    discoverFromGoogle(industry, perPlatform),
    discoverFromLinkedIn(industry, perPlatform),
    discoverFromTikTok(industry, perPlatform),
  ])

  const all = [
    ...(meta.status === 'fulfilled' ? meta.value : []),
    ...(google.status === 'fulfilled' ? google.value : []),
    ...(linkedin.status === 'fulfilled' ? linkedin.value : []),
    ...(tiktok.status === 'fulfilled' ? tiktok.value : []),
  ]

  const seen = new Set<string>()
  const deduped = all.filter(c => {
    if (!c.domain || seen.has(c.domain)) return false
    seen.add(c.domain)
    return true
  })

  console.log(`[Discovery] ${deduped.length} unique companies from ${all.length} total across 4 platforms`)
  return deduped
}
