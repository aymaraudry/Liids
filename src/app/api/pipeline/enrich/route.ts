<<<<<<< HEAD
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
=======
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runEnrichmentBatch } from '@/lib/pipeline/orchestrator'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runEnrichmentBatch(5)
  return NextResponse.json(result)
}
>>>>>>> cd5fcad1e638430b46ef0eb30569c09d8f4b48b2
