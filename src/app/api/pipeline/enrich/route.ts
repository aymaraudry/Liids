import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runEnrichmentBatch } from '@/lib/pipeline/orchestrator'

export async function POST() {
  // Auth check — must be logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Run enrichment batch server-side — no need to pass CRON_SECRET
  const result = await runEnrichmentBatch(5)
  return NextResponse.json(result)
}
