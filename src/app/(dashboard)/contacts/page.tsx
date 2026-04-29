import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExternalLink } from 'lucide-react'

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, companies(name, domain)')
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
        <p className="text-muted-foreground">{contacts?.length ?? 0} decision makers found</p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!contacts?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No contacts yet. Run the pipeline to discover decision makers.
                </TableCell>
              </TableRow>
            ) : contacts.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                </TableCell>
                <TableCell className="text-sm">{c.title ?? '—'}</TableCell>
                <TableCell className="text-sm">
                  <div>{(c.companies as { name: string; domain: string } | null)?.name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">{(c.companies as { name: string; domain: string } | null)?.domain}</div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1">
                    {c.email ?? <span className="text-muted-foreground">Not found</span>}
                    {c.email_verified && <span className="text-green-500 text-xs">✓</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {c.linkedin_url ? (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-2 w-2 rounded-full ${i <= c.confidence_score ? 'bg-primary' : 'bg-muted'}`} />
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    c.status === 'approved' ? 'default' :
                    c.status === 'bounced' || c.status === 'rejected' ? 'destructive' :
                    c.status === 'replied' ? 'default' : 'secondary'
                  } className="text-xs">
                    {c.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
