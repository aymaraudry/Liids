import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { count: companies },
    { count: contacts },
    { count: leads },
    { count: sent },
    { data: settings },
  ] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('sequences').select('*', { count: 'exact', head: true }).not('sent_at', 'is', null),
    supabase.from('settings').select('target_industry, schedule_frequency').single(),
  ])

  return NextResponse.json({
    companies: companies ?? 0,
    contacts: contacts ?? 0,
    leads: leads ?? 0,
    sent: sent ?? 0,
    industry: settings?.target_industry ?? 'SaaS',
    schedule: settings?.schedule_frequency ?? 'manual',
  })
}
