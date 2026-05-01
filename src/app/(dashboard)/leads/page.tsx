import { createClient } from '@/lib/supabase/server'
import { LeadsTable } from '@/components/leads/leads-table'
import { ManualCompanyAdd } from '@/components/leads/manual-company-add'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain, industry, location, ad_platforms, status, manually_added, discovered_at, contacts(id, title, email, email_verified, confidence_score, linkedin_url, status)')
    .in('status', ['pending_enrichment', 'enriched', 'approved', 'rejected'])
    .order('discovered_at', { ascending: false })
    .limit(500)

  const stats = {
    total: companies?.length ?? 0,
    pending: companies?.filter(c => c.status === 'pending_enrichment').length ?? 0,
    enriched: companies?.filter(c => c.status === 'enriched').length ?? 0,
    approved: companies?.filter(c => c.status === 'approved').length ?? 0,
    withContacts: companies?.filter(c => (c.contacts?.length ?? 0) > 0).length ?? 0,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leads</h2>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="font-medium text-foreground">{stats.total}</span> companies ·{' '}
            <span className="text-yellow-600 font-medium">{stats.pending}</span> pending enrichment ·{' '}
            <span className="text-blue-600 font-medium">{stats.enriched}</span> enriched ·{' '}
            <span className="text-green-600 font-medium">{stats.approved}</span> approved ·{' '}
            <span className="font-medium">{stats.withContacts}</span> have contacts
          </p>
        </div>
      </div>

      {/* Manual company add */}
      <ManualCompanyAdd />

      {/* Leads table — shows everything including pending */}
      <LeadsTable companies={(companies ?? []) as Parameters<typeof LeadsTable>[0]['companies']} />
    </div>
  )
}
