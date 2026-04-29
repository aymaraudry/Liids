import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSequencesForLead, processFallbackOutreach } from '@/lib/outreach/sequence'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyId, action } = await request.json()
  if (!companyId || !action) return NextResponse.json({ error: 'companyId and action required' }, { status: 400 })

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  await supabase.from('companies').update({ status: newStatus }).eq('id', companyId)

  if (action === 'approve') {
    // Create lead record
    const { data: lead } = await supabase
      .from('leads')
      .insert({ company_id: companyId })
      .select()
      .single()

    // Approve all pending contacts
    await supabase.from('contacts')
      .update({ status: 'approved' })
      .eq('company_id', companyId)
      .eq('status', 'pending')

    // Auto-create email sequences for the lead
    if (lead?.id) {
      createSequencesForLead(lead.id).catch(console.error)
      processFallbackOutreach(lead.id).catch(console.error)
    }
  }

  return NextResponse.json({ success: true })
}
