import { NextRequest, NextResponse } from 'next/server'
import { processDueSequences } from '@/lib/outreach/sequence'
import { resetDailyKeyCounters } from '@/lib/pipeline/rotation'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Reset daily API key counters at the start of the cron window
  const hour = new Date().getUTCHours()
  if (hour === 0) {
    await resetDailyKeyCounters()
    console.log('[Cron] Daily key counters reset')
  }

  const result = await processDueSequences()
  return NextResponse.json(result)
}
