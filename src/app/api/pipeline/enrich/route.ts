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