import { createServiceClient } from '@/lib/supabase/server'
import type { ApiKey } from '@/lib/supabase/types'

export async function getNextApiKey(serviceName: string): Promise<ApiKey | null> {
  const supabase = await createServiceClient()
  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('service_name', serviceName)
    .eq('is_active', true)
    .eq('is_exhausted_today', false)
    .order('used_today', { ascending: true })
    .limit(1)

  if (error || !keys || keys.length === 0) return null
  const key = keys[0]

  await supabase.from('api_keys').update({
    used_today: key.used_today + 1,
    last_used_at: new Date().toISOString(),
    is_exhausted_today: key.used_today + 1 >= key.daily_limit,
  }).eq('id', key.id)

  return key
}

export async function markKeyExhausted(keyId: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.from('api_keys').update({ is_exhausted_today: true }).eq('id', keyId)
}

export async function resetDailyKeyCounters(): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.from('api_keys').update({ used_today: 0, is_exhausted_today: false }).gt('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('sender_accounts').update({ sent_today: 0 }).gt('id', '00000000-0000-0000-0000-000000000000')
}

export async function withKeyRotation<T>(
  services: string[],
  callback: (key: ApiKey) => Promise<T | null>
): Promise<T | null> {
  for (const service of services) {
    const key = await getNextApiKey(service)
    if (!key) continue
    try {
      const result = await callback(key)
      if (result !== null) return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('limit') || msg.includes('403')
      if (isQuota) await markKeyExhausted(key.id)
      continue
    }
  }
  return null
}
