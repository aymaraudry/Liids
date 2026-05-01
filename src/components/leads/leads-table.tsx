'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, ExternalLink, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Contact {
  id: string
  title: string | null
  email: string | null
  email_verified: boolean
  confidence_score: number
  linkedin_url: string | null
  status: string
}

interface Company {
  id: string
  name: string | null
  domain: string
  industry: string | null
  location: string | null
  ad_platforms: string[]
  status: string
  manually_added?: boolean
  contacts: Contact[]
}

export function LeadsTable({ companies: initial }: { companies: Company[] }) {
  const [companies, setCompanies] = useState(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending_enrichment' | 'enriched' | 'approved' | 'rejected'>('all')
  const [refreshing, setRefreshing] = useState(false)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleRefresh() {
    setRefreshing(true)
    window.location.reload()
  }

  async function handleAction(companyId: string, action: 'approve' | 'reject') {
    const res = await fetch('/api/leads/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action }),
    })
    if (res.ok) {
      setCompanies(prev => prev.map(c =>
        c.id === companyId
          ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' }
          : c
      ))
      toast.success(action === 'approve' ? '✅ Lead approved — sequences queued' : 'Lead rejected')
    } else {
      toast.error('Action failed')
    }
  }

  async function bulkApprove() {
    const toApprove = filtered.filter(c =>
      c.status === 'enriched' && c.contacts.some(ct => ct.confidence_score >= 4)
    )
    if (!toApprove.length) { toast.info('No high-confidence leads to approve'); return }
    await Promise.all(toApprove.map(c => handleAction(c.id, 'approve')))
    toast.success(`Approved ${toApprove.length} leads`)
  }

  const filtered = companies.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.domain.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  const counts = {
    all: companies.length,
    pending_enrichment: companies.filter(c => c.status === 'pending_enrichment').length,
    enriched: companies.filter(c => c.status === 'enriched').length,
    approved: companies.filter(c => c.status === 'approved').length,
    rejected: companies.filter(c => c.status === 'rejected').length,
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search companies..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'pending_enrichment', 'enriched', 'approved', 'rejected'] as const).map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm"
              onClick={() => setFilter(f)} className="text-xs">
              {f === 'pending_enrichment' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
              <Badge variant="secondary" className="ml-1.5 text-xs">{counts[f]}</Badge>
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={bulkApprove}>
          <CheckCircle className="h-4 w-4 mr-2" /> Bulk Approve
        </Button>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  {companies.length === 0
                    ? 'No companies yet — run the pipeline or add companies manually above.'
                    : 'No matches for current filter.'}
                </TableCell>
              </TableRow>
            ) : filtered.map(company => {
              const isPending = company.status === 'pending_enrichment'
              const isExpanded = expanded.has(company.id)
              const bestScore = Math.max(0, ...company.contacts.map(c => c.confidence_score))
              const verifiedCount = company.contacts.filter(c => c.email_verified).length

              return (
                <>
                  <TableRow
                    key={company.id}
                    className={`cursor-pointer ${isPending ? 'opacity-60' : ''}`}
                    onClick={() => !isPending && toggleExpand(company.id)}
                  >
                    <TableCell>
                      {isPending
                        ? <div className="h-3 w-3 rounded-full bg-yellow-400 animate-pulse ml-0.5" />
                        : isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm flex items-center gap-1.5">
                        {company.name ?? company.domain}
                        {company.manually_added && <Badge variant="secondary" className="text-xs">manual</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {company.domain}
                        <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="h-3 w-3 hover:text-foreground" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{company.industry ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {company.ad_platforms.map(p => (
                          <Badge key={p} variant={p === 'manual' ? 'secondary' : 'outline'} className="text-xs capitalize">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPending
                        ? <span className="text-xs text-muted-foreground italic">pending...</span>
                        : <span className="text-sm font-medium">
                            {company.contacts.length}
                            {verifiedCount > 0 && <span className="text-xs text-green-600 ml-1">({verifiedCount} ✓)</span>}
                          </span>
                      }
                    </TableCell>
                    <TableCell>
                      {!isPending && (
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`h-2 w-2 rounded-full ${i <= bestScore ? 'bg-primary' : 'bg-muted'}`} />
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        company.status === 'approved' ? 'default' :
                        company.status === 'rejected' ? 'destructive' :
                        company.status === 'pending_enrichment' ? 'secondary' : 'outline'
                      } className="text-xs">
                        {isPending ? 'pending' : company.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {company.status === 'enriched' && (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleAction(company.id, 'approve')}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction(company.id, 'reject')}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {isExpanded && company.contacts.map(contact => (
                    <TableRow key={contact.id} className="bg-muted/20 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={2} className="pl-10 py-2">
                        <div className="text-sm font-medium">{contact.title ?? 'Unknown Title'}</div>
                        <div className="text-xs text-muted-foreground">{contact.email ?? 'No email found'}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        {contact.linkedin_url
                          ? <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                              LinkedIn <ExternalLink className="h-3 w-3" />
                            </a>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={contact.email_verified ? 'default' : 'secondary'} className="text-xs">
                          {contact.email_verified ? '✓ Verified' : 'Unverified'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`h-2 w-2 rounded-full ${i <= contact.confidence_score ? 'bg-primary' : 'bg-muted'}`} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell colSpan={2} className="py-2">
                        <Badge variant="outline" className="text-xs">{contact.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {companies.length} ·{' '}
        <span className="text-yellow-600">●</span> = awaiting enrichment
      </p>
    </div>
  )
}
