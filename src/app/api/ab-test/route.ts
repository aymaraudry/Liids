import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reassignABVariants } from '@/lib/outreach/ab-test'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId } = await request.json()
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

  const updated = await reassignABVariants(leadId)
  return NextResponse.json({ updated })
}
