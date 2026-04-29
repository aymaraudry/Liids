'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const SERVICES = [
  { group: 'Contact Finders', items: [
    { value: 'apollo', label: 'Apollo.io' },
    { value: 'hunter', label: 'Hunter.io' },
    { value: 'snov', label: 'Snov.io (format: clientId:secret)' },
    { value: 'findymail', label: 'Findymail' },
    { value: 'skrapp', label: 'Skrapp.io' },
    { value: 'rocketreach', label: 'RocketReach' },
    { value: 'lusha', label: 'Lusha' },
    { value: 'voilanorbert', label: 'Voila Norbert' },
    { value: 'anymailfinder', label: 'AnyMailFinder' },
    { value: 'getprospect', label: 'GetProspect' },
    { value: 'datagma', label: 'Datagma' },
    { value: 'contactout', label: 'ContactOut' },
    { value: 'wiza', label: 'Wiza' },
    { value: 'tomba', label: 'Tomba.io (format: key:secret)' },
    { value: 'enrow', label: 'Enrow' },
    { value: 'prospeo', label: 'Prospeo' },
    { value: 'icypeas', label: 'Icypeas' },
    { value: 'seamless', label: 'Seamless.ai' },
    { value: 'fullenrich', label: 'FullEnrich' },
    { value: 'kaspr', label: 'Kaspr' },
  ]},
  { group: 'Email Verifiers', items: [
    { value: 'zerobounce', label: 'ZeroBounce' },
    { value: 'neverbounce', label: 'NeverBounce' },
    { value: 'abstract_email', label: 'Abstract API (Email)' },
    { value: 'reoon', label: 'Reoon' },
    { value: 'bouncify', label: 'Bouncify' },
    { value: 'emaillistverify', label: 'EmailListVerify' },
    { value: 'verifalia', label: 'Verifalia (format: user:pass)' },
    { value: 'kickbox', label: 'Kickbox' },
    { value: 'emailable', label: 'Emailable' },
    { value: 'clearout', label: 'Clearout' },
    { value: 'debounce', label: 'Debounce' },
  ]},
  { group: 'Ad Intelligence', items: [
    { value: 'meta_ad_library', label: 'Meta Ad Library' },
  ]},
  { group: 'Email Sending', items: [
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'resend', label: 'Resend' },
    { value: 'brevo', label: 'Brevo' },
    { value: 'mailgun', label: 'Mailgun' },
  ]},
  { group: 'AI', items: [
    { value: 'gemini', label: 'Google Gemini' },
  ]},
  { group: 'Company Enrichment', items: [
    { value: 'clearbit', label: 'Clearbit' },
  ]},
]

const ALL_SERVICES = SERVICES.flatMap(g => g.items)

interface ApiKeyRow {
  id: string
  service_name: string
  daily_limit: number
  used_today: number
  is_active: boolean
  is_exhausted_today: boolean
  last_used_at: string | null
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [service, setService] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [dailyLimit, setDailyLimit] = useState('100')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const loadKeys = useCallback(async () => {
    setFetching(true)
    const res = await fetch('/api/keys')
    const data = await res.json()
    setKeys(Array.isArray(data) ? data : [])
    setFetching(false)
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  async function addKey() {
    if (!service || !keyValue.trim()) { toast.error('Select a service and enter a key'); return }
    setLoading(true)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_name: service, key_value: keyValue.trim(), daily_limit: parseInt(dailyLimit) || 100 }),
    })
    if (res.ok) {
      toast.success('API key added successfully')
      setKeyValue('')
      setService('')
      await loadKeys()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to add key')
    }
    setLoading(false)
  }

  async function deleteKey(id: string) {
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    toast.success('Key removed')
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  const grouped = keys.reduce((acc, key) => {
    if (!acc[key.service_name]) acc[key.service_name] = []
    acc[key.service_name].push(key)
    return acc
  }, {} as Record<string, ApiKeyRow[]>)

  const totalKeys = keys.length
  const activeKeys = keys.filter(k => k.is_active && !k.is_exhausted_today).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground">
            {totalKeys} keys total · {activeKeys} active today · Keys are stored encrypted and never exposed
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadKeys}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Add Key Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add New Key</CardTitle>
          <CardDescription className="text-xs">
            You can add up to 10+ keys per service. Rotation picks the least-used key automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[200px]">
              <Label className="text-xs">Service</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select service..." />
                </SelectTrigger>
                <SelectContent>
                  {SERVICES.map(group => (
                    <div key={group.group}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.group}
                      </div>
                      {group.items.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[280px]">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                value={keyValue}
                onChange={e => setKeyValue(e.target.value)}
                placeholder="Paste your API key here..."
                onKeyDown={e => e.key === 'Enter' && addKey()}
              />
            </div>
            <div className="space-y-1 w-28">
              <Label className="text-xs">Daily Limit</Label>
              <Input
                value={dailyLimit}
                onChange={e => setDailyLimit(e.target.value)}
                type="number"
                min="1"
              />
            </div>
            <Button onClick={addKey} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              {loading ? 'Adding...' : 'Add Key'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keys grouped by service */}
      {fetching ? (
        <div className="text-sm text-muted-foreground">Loading keys...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No API keys added yet. Add your first key above to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([serviceName, serviceKeys]) => {
            const label = ALL_SERVICES.find(s => s.value === serviceName)?.label?.split(' (')[0] ?? serviceName
            const exhaustedCount = serviceKeys.filter(k => k.is_exhausted_today).length

            return (
              <Card key={serviceName}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{label}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {serviceKeys.length} key{serviceKeys.length > 1 ? 's' : ''}
                      </Badge>
                      {exhaustedCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {exhaustedCount} exhausted
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {serviceKeys.reduce((sum, k) => sum + k.used_today, 0)} used today /
                      {serviceKeys.reduce((sum, k) => sum + k.daily_limit, 0)} total capacity
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-4">
                  <div className="space-y-1">
                    {serviceKeys.map((key, i) => (
                      <div key={key.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                        <span className="text-muted-foreground font-mono text-xs">
                          Key #{i + 1} &nbsp;••••••••••••••••
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {key.used_today}/{key.daily_limit} today
                          </span>
                          <Badge
                            variant={key.is_exhausted_today ? 'destructive' : key.is_active ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {key.is_exhausted_today ? 'Exhausted' : key.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteKey(key.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
