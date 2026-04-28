import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPipeline } from '@/lib/pipeline/orchestrator'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Block concurrent runs
  const { data: activeRun } = await supabase
    .from('run_logs').select('id').eq('status', 'running').maybeSingle()
  if (activeRun) return NextResponse.json({ error: 'Pipeline already running' }, { status: 409 })

  // Fire and forget — returns immediately
  runPipeline().catch(console.error)
  return NextResponse.json({ message: 'Pipeline started' })
}
