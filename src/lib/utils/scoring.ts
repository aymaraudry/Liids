import type { FoundContact } from '@/lib/pipeline/enrichment/contacts'

export function calculateConfidenceScore(contact: FoundContact, emailVerified: boolean): number {
  const sourceCount = contact.sourceApi.split(',').filter(Boolean).length
  if (emailVerified && sourceCount >= 3) return 5
  if (emailVerified && sourceCount === 2) return 4
  if (emailVerified && sourceCount === 1) return 3
  if (!emailVerified && sourceCount >= 2) return 2
  return 1
}
