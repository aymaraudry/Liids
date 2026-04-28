'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  industry: string
  step: number
  subject: string
  body: string
  variant: string
  is_active: boolean
}

const STEP_LABELS: Record<number, string> = {
  1: 'Step 1 — Initial Pitch',
  2: 'Step 2 — Follow-up (Day 3)',
  3: 'Step 3 — Breakup (Day 7)',
}

const VARIABLES = ['{{first_name}}', '{{last_name}}', '{{company}}', '{{title}}', '{{ai_opening}}', '{{unsubscribe_link}}']

const DEFAULT_TEMPLATES = [
  {
    name: 'UGC Pitch — Initial',
    industry: 'SaaS',
    step: 1,
    variant: 'A',
    subject: 'Quick question about {{company}}\'s content',
    body: `Hi {{first_name}},

{{ai_opening}}

I run a UGC content studio and I help SaaS brands like {{company}} create authentic video content that actually converts — the kind your customers trust more than polished ads.

I'd love to show you what we've done for similar companies. Would you be open to a quick 15-minute call this week?

Best,
Aymar

—
To unsubscribe: {{unsubscribe_link}}`,
  },
  {
    name: 'UGC Pitch — Follow-up',
    industry: 'SaaS',
    step: 2,
    variant: 'A',
    subject: 'Re: Quick question about {{company}}\'s content',
    body: `Hi {{first_name}},

Just following up on my last message. I know your inbox is busy.

I work with SaaS marketing teams to produce UGC video content that boosts conversion on paid channels. Most clients see a 20–40% lift in ad performance within the first month.

Worth a quick chat?

Best,
Aymar

—
To unsubscribe: {{unsubscribe_link}}`,
  },
  {
    name: 'UGC Pitch — Breakup',
    industry: 'SaaS',
    step: 3,
    variant: 'A',
    subject: 'Closing the loop — {{company}}',
    body: `Hi {{first_name}},

I'll keep this short — I've reached out a couple of times about UGC content for {{company}} and haven't heard back.

I won't keep following up after this, but if you're ever curious about what authentic creator content could do for your paid performance, you know where to find me.

Wishing you and the team at {{company}} the best.

Aymar

—
To unsubscribe: {{unsubscribe_link}}`,
  },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '', industry: 'SaaS', step: '1', variant: 'A', subject: '', body: '',
  })

  const load = useCallback(async () => {
    const res = await fetch('/api/templates')
    if (res.ok) setTemplates(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  async function seedDefaults() {
    for (const t of DEFAULT_TEMPLATES) {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      })
    }
    toast.success('Default templates created')
    await load()
  }

  async function saveNew() {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body) {
      toast.error('Fill in all fields')
      return
    }
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTemplate, step: parseInt(newTemplate.step) }),
    })
    if (res.ok) {
      toast.success('Template created')
      setCreating(false)
      setNewTemplate({ name: '', industry: 'SaaS', step: '1', variant: 'A', subject: '', body: '' })
      await load()
    }
  }

  async function saveEdit() {
    if (!editing) return
    const res = await fetch(`/api/templates/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    if (res.ok) {
      toast.success('Template updated')
      setEditing(null)
      await load()
    }
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast.success('Template deleted')
  }

  const grouped = [1, 2, 3].map(step => ({
    step,
    label: STEP_LABELS[step],
    templates: templates.filter(t => t.step === step),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
          <p className="text-muted-foreground">Edit your pitch email sequences. Supports A/B variants.</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedDefaults}>
              Load Default Templates
            </Button>
          )}
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        </div>
      </div>

      {/* Variable reference */}
      <Card className="bg-muted/40">
        <CardContent className="py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Available Variables:</p>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map(v => (
              <code key={v} className="text-xs bg-background border rounded px-1.5 py-0.5">{v}</code>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create form */}
      {creating && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-sm">New Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Template Name</Label>
                <Input value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} placeholder="e.g. UGC Pitch A" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Step</Label>
                <Select value={newTemplate.step} onValueChange={v => setNewTemplate({ ...newTemplate, step: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Step 1 — Initial</SelectItem>
                    <SelectItem value="2">Step 2 — Follow-up</SelectItem>
                    <SelectItem value="3">Step 3 — Breakup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Variant</Label>
                <Select value={newTemplate.variant} onValueChange={v => setNewTemplate({ ...newTemplate, variant: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject Line</Label>
              <Input value={newTemplate.subject} onChange={e => setNewTemplate({ ...newTemplate, subject: e.target.value })} placeholder="Subject..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email Body</Label>
              <Textarea rows={10} value={newTemplate.body} onChange={e => setNewTemplate({ ...newTemplate, body: e.target.value })} placeholder="Write your pitch here..." className="font-mono text-xs" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNew}><Save className="h-4 w-4 mr-2" /> Save Template</Button>
              <Button size="sm" variant="outline" onClick={() => setCreating(false)}><X className="h-4 w-4 mr-2" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates grouped by step */}
      {grouped.map(({ step, label, templates: stepTemplates }) => (
        <div key={step} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
          {stepTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-4 text-center text-xs text-muted-foreground">
                No templates for this step yet.
              </CardContent>
            </Card>
          ) : stepTemplates.map(t => (
            editing?.id === t.id ? (
              <Card key={t.id} className="border-primary">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Industry</Label>
                      <Input value={editing.industry} onChange={e => setEditing({ ...editing, industry: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Variant</Label>
                      <Select value={editing.variant} onValueChange={v => setEditing({ ...editing, variant: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Input value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Body</Label>
                    <Textarea rows={12} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} className="font-mono text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}><Save className="h-4 w-4 mr-2" /> Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="h-4 w-4 mr-2" /> Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card key={t.id}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{t.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">Variant {t.variant}</Badge>
                      <Badge variant="secondary" className="text-xs">{t.industry}</Badge>
                      {!t.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1">Subject: {t.subject}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans line-clamp-4">{t.body}</pre>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      ))}
    </div>
  )
}
