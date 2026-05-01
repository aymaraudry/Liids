import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Mark all stuck "running" logs as failed
  const { data } = await supabase
    .from('run_logs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [{ step: 'pipeline', message: 'Timed out — Vercel 10s function limit on free tier' }],
    })
    .eq('status', 'running')
    .select()

  return NextResponse.json({
    message: `Reset ${data?.length ?? 0} stuck run(s)`,
    reset: data?.length ?? 0,
  })
}
