'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Users, Mail, Activity, Play, Loader2, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface RunLog {
  id: string
  started_at: string
  completed_at: string | null
  companies_discovered: number
  contacts_found: number
  emails_verified: number
  errors: Array<{ step: string; message: string }>
  status: 'running' | 'completed' | 'failed'
}

interface Stats {
  companies: number
  contacts: number
  leads: number
  sent: number
  industry: string
  schedule: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<RunLog[]>([])
  const [running, setRunning] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/dashboard-stats'),
        fetch('/api/run-logs'),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (logsRes.ok) {
        const logData: RunLog[] = await logsRes.json()
        setLogs(logData)
        setRunning(logData.some(l => l.status === 'running'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      if (running) loadData()
    }, 15000)
    return () => clearInterval(interval)
  }, [loadData, running])

  async function handleRun() {
    setRunning(true)
    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Pipeline started — discovery + first enrichment batch running')
        setTimeout(loadData, 5000)
      } else {
        toast.error(data.error ?? 'Failed to start pipeline')
        setRunning(false)
      }
    } catch {
      toast.error('Network error')
      setRunning(false)
    }
  }

  async function handleReset() {
    const res = await fetch('/api/pipeline/reset', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      toast.success(data.message)
      setRunning(false)
      await loadData()
    }
  }

  async function handleEnrichBatch() {
    toast.info('Running enrichment batch...')
    const res = await fetch('/api/pipeline/enrich', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Enriched ${data.processed} companies, found ${data.contactsFound} contacts`)
      await loadData()
    } else {
      toast.error(data.error ?? 'Enrichment batch failed')
    }
  }

  const statCards = [
    { label: 'Companies Found', value: stats?.companies ?? 0, icon: Building2, color: 'text-blue-500' },
    { label: 'Contacts Found',  value: stats?.contacts ?? 0,  icon: Users,     color: 'text-green-500' },
    { label: 'Leads Approved',  value: stats?.leads ?? 0,     icon: Activity,  color: 'text-purple-500' },
    { label: 'Emails Sent',     value: stats?.sent ?? 0,      icon: Mail,      color: 'text-orange-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Industry: <span className="font-medium text-foreground">{stats?.industry ?? '—'}</span>
            {' · '}
            Schedule: <span className="font-medium text-foreground">{stats?.schedule ?? 'manual'}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {running && (
            <Button variant="outline" size="sm" onClick={handleReset} className="text-destructive border-destructive hover:bg-destructive/10">
              Reset Stuck Run
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleEnrichBatch} disabled={running}>
            Enrich Batch
          </Button>
          <Button onClick={handleRun} disabled={running} size="sm">
            {running
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
              : <><Play className="h-4 w-4 mr-2" /> Run Pipeline</>
            }
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pipeline Run Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground space-y-2">
              <p>No pipeline runs yet.</p>
              <p className="text-xs">Add your <strong>Meta Ad Library</strong> key in API Keys, then click <strong>Run Pipeline</strong>.</p>
            </div>
          ) : logs.map(log => (
            <div key={log.id} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-3">
                  <Badge variant={
                    log.status === 'completed' ? 'default' :
                    log.status === 'failed'    ? 'destructive' : 'secondary'
                  } className="text-xs">
                    {log.status === 'running' ? '⟳ Running' : log.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.started_at).toLocaleString()}
                  </span>
                  {log.status === 'completed' && (
                    <span className="text-xs">
                      <span className="text-blue-500 font-medium">{log.companies_discovered} companies</span>
                      {' · '}
                      <span className="text-green-500 font-medium">{log.contacts_found} contacts</span>
                      {' · '}
                      <span className="text-muted-foreground">{log.emails_verified} verified</span>
                    </span>
                  )}
                  {log.errors?.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {log.errors.length} error{log.errors.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {expandedLog === log.id
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {expandedLog === log.id && (
                <div className="border-t bg-muted/20 p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-xs pb-2">
                    <div><p className="text-muted-foreground">Companies</p><p className="font-semibold text-base">{log.companies_discovered}</p></div>
                    <div><p className="text-muted-foreground">Contacts</p><p className="font-semibold text-base">{log.contacts_found}</p></div>
                    <div><p className="text-muted-foreground">Verified</p><p className="font-semibold text-base">{log.emails_verified}</p></div>
                  </div>
                  {log.errors?.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Errors:</p>
                      {log.errors.map((err, i) => (
                        <div key={i} className="text-xs bg-destructive/10 text-destructive rounded px-2 py-1 font-mono">
                          <span className="font-bold">[{err.step}]</span> {err.message}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-green-600">✓ No errors</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Setup Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-sm">
            {[
              { href: '/api-keys',  label: '1. Add API keys — especially Meta Ad Library (required) + Apollo + Hunter' },
              { href: '/settings',  label: '2. Set target industry in Settings (e.g. "SaaS", "CRM software")' },
              { href: '/settings',  label: '3. Add sender accounts (SendGrid / Resend / Brevo / Mailgun)' },
              { href: '/templates', label: '4. Load and edit your pitch templates' },
              { href: '/leads',     label: '5. After running pipeline → approve leads here' },
            ].map(({ href, label }) => (
              <a key={label} href={href} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors py-0.5">
                <span className="text-primary">→</span> {label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
