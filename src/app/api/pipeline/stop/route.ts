import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Set stop flag — pipeline checks this between each company
  await supabase
    .from('settings')
    .update({ pipeline_stop_requested: true })
    .gt('id', '00000000-0000-0000-0000-000000000000')

  // Also mark any running log as stopped
  await supabase
    .from('run_logs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [{ step: 'pipeline', message: 'Stopped by user' }],
    })
    .eq('status', 'running')

  return NextResponse.json({ message: 'Stop signal sent — pipeline will halt after current company' })
}
