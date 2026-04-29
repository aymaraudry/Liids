'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ExternalLink, Copy, Check, RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'

interface Draft {
  id: string
  name: string
  title: string | null
  linkedin_url: string
  company: string
  draft: string
}

export default function LinkedInDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/linkedin-drafts')
    if (res.ok) setDrafts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function copyDraft(id: string, text: string) {
    await navigator.clipboard.writeText(editing[id] ?? text)
    setCopiedId(id)
    toast.success('Draft copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  function exportCSV() {
    const rows = [
      ['Name', 'Title', 'Company', 'LinkedIn URL', 'Draft Message'],
      ...drafts.map(d => [d.name, d.title ?? '', d.company, d.linkedin_url, editing[d.id] ?? d.draft]),
    ]
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `linkedin-drafts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${drafts.length} drafts`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">LinkedIn Drafts</h2>
          <p className="text-muted-foreground">
            {drafts.length} contacts with no email — copy each draft and send manually on LinkedIn.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {drafts.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="py-4">
          <div className="flex gap-3 text-sm">
            <span className="text-2xl">💡</span>
            <div className="space-y-1">
              <p className="font-medium">How to use LinkedIn Drafts</p>
              <p className="text-muted-foreground">
                These contacts were discovered but have no email address. For each one: open their LinkedIn profile,
                click <strong>Connect</strong> or <strong>Message</strong>, paste the draft, and personalise if needed.
                Edit the drafts inline before copying.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading drafts...</div>
      ) : drafts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No LinkedIn drafts yet. Run the pipeline — contacts without emails will appear here automatically.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {drafts.map(draft => (
            <Card key={draft.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{draft.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {draft.title ?? 'Unknown Title'} · {draft.company}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a
                      href={draft.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Open <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => copyDraft(draft.id, draft.draft)}
                    >
                      {copiedId === draft.id
                        ? <><Check className="h-3 w-3 mr-1" /> Copied</>
                        : <><Copy className="h-3 w-3 mr-1" /> Copy</>
                      }
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Textarea
                  className="text-xs font-mono resize-none"
                  rows={5}
                  value={editing[draft.id] ?? draft.draft}
                  onChange={e => setEditing(prev => ({ ...prev, [draft.id]: e.target.value }))}
                />
                {editing[draft.id] && editing[draft.id] !== draft.draft && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 text-xs text-muted-foreground"
                    onClick={() => setEditing(prev => { const n = { ...prev }; delete n[draft.id]; return n })}
                  >
                    Reset to original
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
