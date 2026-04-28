import { createClient } from '@/lib/supabase/server'
import { LeadsTable } from '@/components/leads/leads-table'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('*, contacts(id, title, email, email_verified, confidence_score, linkedin_url, status)')
    .in('status', ['enriched', 'approved', 'rejected'])
    .order('discovered_at', { ascending: false })
    .limit(300)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Leads Review</h2>
        <p className="text-muted-foreground">
          Review discovered companies and approve them to queue for outreach.
        </p>
      </div>
      <LeadsTable companies={(companies ?? []) as Parameters<typeof LeadsTable>[0]['companies']} />
    </div>
  )
}
