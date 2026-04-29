import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('api_keys')
    .select('id, service_name, daily_limit, used_today, last_used_at, is_active, is_exhausted_today')
    .order('service_name')
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { service_name, key_value, daily_limit } = body
  if (!service_name || !key_value) {
    return NextResponse.json({ error: 'service_name and key_value are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ service_name, key_value, daily_limit: daily_limit ?? 100 })
    .select('id, service_name, daily_limit, used_today, is_active, is_exhausted_today')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await supabase.from('api_keys').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
