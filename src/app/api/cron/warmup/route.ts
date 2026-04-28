import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Warmup schedule — daily send limits per warmup day:
 * Day 1–3:   10/day  (very low, establish reputation)
 * Day 4–7:   25/day
 * Day 8–14:  50/day
 * Day 15–21: 100/day
 * Day 22–30: 200/day
 * Day 31+:   500/day (fully warmed up)
 */
function getWarmupLimit(day: number): number {
  if (day <= 3)  return 10
  if (day <= 7)  return 25
  if (day <= 14) return 50
  if (day <= 21) return 100
  if (day <= 30) return 200
  return 500
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const { data: warmingAccounts } = await supabase
    .from('sender_accounts')
    .select('id, warmup_day, daily_limit, email, is_warming_up')
    .eq('is_warming_up', true)
    .eq('is_active', true)

  if (!warmingAccounts?.length) {
    return NextResponse.json({ message: 'No accounts in warmup', updated: 0 })
  }

  let updated = 0
  const results: Array<{ email: string; day: number; newLimit: number }> = []

  for (const account of warmingAccounts) {
    const newDay = account.warmup_day + 1
    const newLimit = getWarmupLimit(newDay)
    const isFullyWarmed = newDay > 31

    await supabase
      .from('sender_accounts')
      .update({
        warmup_day: newDay,
        daily_limit: newLimit,
        is_warming_up: !isFullyWarmed,
      })
      .eq('id', account.id)

    updated++
    results.push({ email: account.email, day: newDay, newLimit })

    if (isFullyWarmed) {
      console.log(`[Warmup] ${account.email} fully warmed up after ${newDay} days — limit: ${newLimit}/day`)
    } else {
      console.log(`[Warmup] ${account.email} day ${newDay} — new limit: ${newLimit}/day`)
    }
  }

  return NextResponse.json({ updated, results })
}
