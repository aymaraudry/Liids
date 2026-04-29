import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase
    .from('sender_accounts')
    .select('id, email, provider, daily_limit, sent_today, is_active, is_warming_up, warmup_day')
    .order('provider')
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { email, provider, api_key_id, daily_limit, is_warming_up } = body
  if (!email || !provider || !api_key_id) {
    return NextResponse.json({ error: 'email, provider, api_key_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sender_accounts')
    .insert({ email, provider, api_key_id, daily_limit: daily_limit ?? 100, is_warming_up: is_warming_up ?? true })
    .select('id, email, provider, daily_limit, sent_today, is_active, is_warming_up, warmup_day')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  await supabase.from('sender_accounts').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
