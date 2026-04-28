import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProcessSequencesButton } from '@/components/outreach/process-sequences-button'

export default async function OutreachPage() {
  const supabase = await createClient()

  const { data: sequences } = await supabase
    .from('sequences')
    .select(`
      id, step, scheduled_at, sent_at, opened_at, clicked_at, replied_at, bounced_at,
      sender_email,
      contacts(first_name, last_name, email, title),
      leads(id, companies(name, domain))
    `)
    .order('scheduled_at', { ascending: true })
    .limit(300)

  const stats = {
    total:   sequences?.length ?? 0,
    pending: sequences?.filter(s => !s.sent_at && !s.bounced_at).length ?? 0,
    sent:    sequences?.filter(s => s.sent_at).length ?? 0,
    opened:  sequences?.filter(s => s.opened_at).length ?? 0,
    clicked: sequences?.filter(s => s.clicked_at).length ?? 0,
    replied: sequences?.filter(s => s.replied_at).length ?? 0,
    bounced: sequences?.filter(s => s.bounced_at).length ?? 0,
  }

  const openRate  = stats.sent ? Math.round((stats.opened  / stats.sent) * 100) : 0
  const replyRate = stats.sent ? Math.round((stats.replied / stats.sent) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Outreach</h2>
          <p className="text-muted-foreground">
            {openRate}% open rate · {replyRate}% reply rate
          </p>
        </div>
        <ProcessSequencesButton />
      </div>

      <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Queued',  value: stats.pending },
          { label: 'Sent',    value: stats.sent },
          { label: 'Opened',  value: stats.opened },
          { label: 'Clicked', value: stats.clicked },
          { label: 'Replied', value: stats.replied },
          { label: 'Bounced', value: stats.bounced },
          { label: 'Total',   value: stats.total },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Sent via</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!sequences?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  No sequences yet — approve leads to automatically queue outreach.
                </TableCell>
              </TableRow>
            ) : sequences.map(seq => {
              const contact = seq.contacts as unknown as { first_name: string; last_name: string; email: string; title: string } | null
              const company = (seq.leads as unknown as { companies: { name: string; domain: string } } | null)?.companies
              const status = seq.replied_at ? 'replied' : seq.bounced_at ? 'bounced'
                : seq.clicked_at ? 'clicked' : seq.opened_at ? 'opened'
                : seq.sent_at ? 'sent' : 'queued'
              const variantMap: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
                replied: 'default', bounced: 'destructive', clicked: 'secondary',
                opened: 'secondary', sent: 'outline', queued: 'outline',
              }
              return (
                <TableRow key={seq.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{[contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || '—'}</div>
                    <div className="text-xs text-muted-foreground">{contact?.email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{company?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{company?.domain}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">Step {seq.step}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {seq.scheduled_at ? new Date(seq.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{seq.sender_email ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={variantMap[status]} className="text-xs capitalize">{status}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
