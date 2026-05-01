'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

export function ManualCompanyAdd() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { toast.error('Enter at least one company name or domain'); return }

    setLoading(true)

    const companies = lines.map(line => {
      // If it has a dot, treat as domain. Otherwise treat as company name.
      const hasDot = line.includes('.')
      return hasDot
        ? { domain: line, name: line.split('.')[0] }
        : { name: line, domain: line.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') }
    })

    const res = await fetch('/api/companies/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies }),
    })

    const data = await res.json()
    if (res.ok) {
      toast.success(`Added ${data.added} companies · ${data.skipped} already existed`)
      setInput('')
      setOpen(false)
      // Reload page to show new companies
      window.location.reload()
    } else {
      toast.error(data.error ?? 'Failed to add companies')
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader
        className="py-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Manually Add Companies</CardTitle>
            <CardDescription className="text-xs">
              Paste company names or domains to find contacts for specific companies
            </CardDescription>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3 pt-0">
          <Textarea
            placeholder={`One per line. You can paste:\n• Company names: Notion, Linear, Figma\n• Domains: notion.so, linear.app, figma.com\n• Mixed: fine too`}
            rows={6}
            value={input}
            onChange={e => setInput(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {input.split('\n').filter(l => l.trim()).length} companies entered
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setInput('') }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={loading}>
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
                  : <><Plus className="h-4 w-4 mr-2" /> Add & Queue Enrichment</>
                }
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
            💡 After adding, go to Dashboard → click <strong>Enrich Batch</strong> to fetch contacts for these companies immediately.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
