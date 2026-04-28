'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { SenderAccountsManager } from '@/components/settings/sender-accounts'

interface Settings {
  id: string
  target_industry: string
  schedule_frequency: string
  schedule_time: string
  min_companies_per_run: number
  sending_limit_per_day: number
  sequence_delays: number[]
  warmup_mode: boolean
  blacklisted_domains: string[]
  compliance_address: string
  unsubscribe_redirect: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/settings')
    if (res.ok) setSettings(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!settings) return
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (res.ok) {
      toast.success('Settings saved')
    } else {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  function addBlacklist() {
    if (!newDomain.trim() || !settings) return
    setSettings({ ...settings, blacklisted_domains: [...settings.blacklisted_domains, newDomain.trim()] })
    setNewDomain('')
  }

  function removeBlacklist(domain: string) {
    if (!settings) return
    setSettings({ ...settings, blacklisted_domains: settings.blacklisted_domains.filter(d => d !== domain) })
  }

  if (!settings) return <div className="text-sm text-muted-foreground">Loading settings...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Configure pipeline behavior, scheduling, and compliance.</p>
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline Settings</CardTitle>
          <CardDescription className="text-xs">Control how the discovery pipeline runs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Target Industry</Label>
            <Input
              value={settings.target_industry}
              onChange={e => setSettings({ ...settings, target_industry: e.target.value })}
              placeholder="e.g. SaaS, project management software, CRM"
            />
            <p className="text-xs text-muted-foreground">Used as the search keyword across all 4 ad platforms.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Minimum Companies Per Run</Label>
            <Input
              type="number"
              value={settings.min_companies_per_run}
              onChange={e => setSettings({ ...settings, min_companies_per_run: parseInt(e.target.value) || 100 })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Schedule</CardTitle>
          <CardDescription className="text-xs">Set how often the pipeline runs automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Frequency</Label>
              <Select
                value={settings.schedule_frequency}
                onValueChange={v => setSettings({ ...settings, schedule_frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual only</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Run Time (UTC)</Label>
              <Input
                type="time"
                value={settings.schedule_time}
                onChange={e => setSettings({ ...settings, schedule_time: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outreach */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Outreach Settings</CardTitle>
          <CardDescription className="text-xs">Control sending volume and sequence timing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Daily Sending Limit</Label>
            <Input
              type="number"
              value={settings.sending_limit_per_day}
              onChange={e => setSettings({ ...settings, sending_limit_per_day: parseInt(e.target.value) || 100 })}
            />
            <p className="text-xs text-muted-foreground">Start at 100/day. Scale to 500/day as sender accounts warm up.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sequence Delays (days)</Label>
            <div className="flex gap-2 items-center">
              {settings.sequence_delays.map((delay, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Step {i + 1}</Label>
                  <Input
                    type="number"
                    className="w-20"
                    value={delay}
                    onChange={e => {
                      const newDelays = [...settings.sequence_delays]
                      newDelays[i] = parseInt(e.target.value) || 0
                      setSettings({ ...settings, sequence_delays: newDelays })
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Days after approval to send each step (0 = immediate).</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="warmup"
              checked={settings.warmup_mode}
              onChange={e => setSettings({ ...settings, warmup_mode: e.target.checked })}
              className="h-4 w-4"
            />
            <div>
              <Label htmlFor="warmup" className="text-xs cursor-pointer">Warmup Mode</Label>
              <p className="text-xs text-muted-foreground">Gradually increases daily send volume to protect sender reputation.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CAN-SPAM Compliance</CardTitle>
          <CardDescription className="text-xs">Required for legal cold email sending.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Physical Address (shown in email footer)</Label>
            <Input
              value={settings.compliance_address}
              onChange={e => setSettings({ ...settings, compliance_address: e.target.value })}
              placeholder="123 Main St, City, Country"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unsubscribe Redirect URL</Label>
            <Input
              value={settings.unsubscribe_redirect}
              onChange={e => setSettings({ ...settings, unsubscribe_redirect: e.target.value })}
              placeholder="https://yourdomain.com/unsubscribed"
            />
          </div>
        </CardContent>
      </Card>

      {/* Blacklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Domain Blacklist</CardTitle>
          <CardDescription className="text-xs">Domains that will never be contacted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              placeholder="competitor.com"
              onKeyDown={e => e.key === 'Enter' && addBlacklist()}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addBlacklist}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {settings.blacklisted_domains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.blacklisted_domains.map(domain => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs"
                >
                  {domain}
                  <button onClick={() => removeBlacklist(domain)}>
                    <X className="h-3 w-3 hover:text-destructive" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sender Accounts */}
      <SenderAccountsManager />

      <Button onClick={save} disabled={saving}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
