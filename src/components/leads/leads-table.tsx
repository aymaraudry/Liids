'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, ExternalLink, Search } from 'lucide-react'
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
  contacts: Contact[]
}

export function LeadsTable({ companies: initial }: { companies: Company[] }) {
  const [companies, setCompanies] = useState(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'enriched' | 'approved' | 'rejected'>('all')

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
      toast.success(action === 'approve' ? '✅ Lead approved and queued for outreach' : 'Lead rejected')
    } else {
      toast.error('Action failed')
    }
  }

  async function bulkApprove() {
    const toApprove = filtered.filter(c => c.status === 'enriched' && c.contacts.some(ct => ct.confidence_score >= 4))
    if (toApprove.length === 0) { toast.info('No high-confidence leads to approve'); return }
    await Promise.all(toApprove.map(c => handleAction(c.id, 'approve')))
    toast.success(`Approved ${toApprove.length} high-confidence leads`)
  }

  const filtered = companies.filter(c => {
    const matchesSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.domain.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || c.status === filter
    return matchesSearch && matchesFilter
  })

  const statusCounts = {
    all: companies.length,
    enriched: companies.filter(c => c.status === 'enriched').length,
    approved: companies.filter(c => c.status === 'approved').length,
    rejected: companies.filter(c => c.status === 'rejected').length,
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'enriched', 'approved', 'rejected'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <Badge variant="secondary" className="ml-1.5 text-xs">{statusCounts[f]}</Badge>
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={bulkApprove}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Bulk Approve High-Confidence
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Ad Platforms</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Best Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  No leads found. Run the pipeline to discover companies.
                </TableCell>
              </TableRow>
            ) : filtered.map(company => {
              const isExpanded = expanded.has(company.id)
              const bestScore = Math.max(0, ...company.contacts.map(c => c.confidence_score))
              const verifiedCount = company.contacts.filter(c => c.email_verified).length

              return (
                <>
                  <TableRow
                    key={company.id}
                    className="cursor-pointer"
                    onClick={() => toggleExpand(company.id)}
                  >
                    <TableCell className="w-8">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{company.name ?? company.domain}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {company.domain}
                        <a
                          href={`https://${company.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3 hover:text-foreground" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{company.industry ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {company.ad_platforms.map(p => (
                          <Badge key={p} variant="outline" className="text-xs capitalize">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{company.contacts.length}</span>
                      {verifiedCount > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">({verifiedCount} verified)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className={`h-2 w-2 rounded-full ${i <= bestScore ? 'bg-primary' : 'bg-muted'}`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        company.status === 'approved' ? 'default' :
                        company.status === 'rejected' ? 'destructive' : 'secondary'
                      }>
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {company.status === 'enriched' && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleAction(company.id, 'approve')}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleAction(company.id, 'reject')}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded contacts */}
                  {isExpanded && company.contacts.map(contact => (
                    <TableRow key={contact.id} className="bg-muted/20 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={2} className="pl-10 py-2">
                        <div className="text-sm font-medium">{contact.title ?? 'Unknown Title'}</div>
                        <div className="text-xs text-muted-foreground">{contact.email ?? 'No email found'}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                          >
                            LinkedIn <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={contact.email_verified ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {contact.email_verified ? '✓ Verified' : 'Unverified'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={i}
                              className={`h-2 w-2 rounded-full ${i <= contact.confidence_score ? 'bg-primary' : 'bg-muted'}`}
                            />
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
        Showing {filtered.length} of {companies.length} companies
      </p>
    </div>
  )
}
