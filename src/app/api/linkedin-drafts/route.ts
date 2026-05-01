import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Contacts with no email, a LinkedIn URL, and a draft stored in notes
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, title, linkedin_url, notes, companies(name, domain)')
    .is('email', null)
    .not('linkedin_url', 'is', null)
    .like('notes', 'LinkedIn draft:%')
    .order('created_at', { ascending: false })

  const drafts = (contacts ?? []).map(c => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown',
    title: c.title,
    linkedin_url: c.linkedin_url,
    company: (c.companies as unknown as { name: string; domain: string } | null)?.name ?? '—',
    draft: c.notes?.replace('LinkedIn draft: ', '') ?? '',
  }))

  return NextResponse.json(drafts)
}
