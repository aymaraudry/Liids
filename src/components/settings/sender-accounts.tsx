'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface SenderAccount {
  id: string
  email: string
  provider: string
  daily_limit: number
  sent_today: number
  is_active: boolean
  is_warming_up: boolean
  warmup_day: number
}

interface ApiKeyOption {
  id: string
  service_name: string
}

export function SenderAccountsManager() {
  const [senders, setSenders] = useState<SenderAccount[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKeyOption[]>([])
  const [email, setEmail] = useState('')
  const [provider, setProvider] = useState('')
  const [apiKeyId, setApiKeyId] = useState('')
  const [dailyLimit, setDailyLimit] = useState('100')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [sRes, kRes] = await Promise.all([fetch('/api/senders'), fetch('/api/keys')])
    if (sRes.ok) setSenders(await sRes.json())
    if (kRes.ok) {
      const keys = await kRes.json()
      setApiKeys(keys.filter((k: ApiKeyOption) =>
        ['sendgrid', 'resend', 'brevo', 'mailgun'].includes(k.service_name)
      ))
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addSender() {
    if (!email || !provider || !apiKeyId) { toast.error('Fill in all fields'); return }
    setLoading(true)
    const res = await fetch('/api/senders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, provider, api_key_id: apiKeyId, daily_limit: parseInt(dailyLimit) || 100 }),
    })
    if (res.ok) {
      toast.success('Sender account added')
      setEmail(''); setProvider(''); setApiKeyId('')
      await load()
    } else {
      toast.error('Failed to add sender')
    }
    setLoading(false)
  }

  async function deleteSender(id: string) {
    await fetch('/api/senders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSenders(prev => prev.filter(s => s.id !== id))
    toast.success('Sender removed')
  }

  const totalCapacity = senders.reduce((sum, s) => sum + s.daily_limit, 0)
  const sentToday = senders.reduce((sum, s) => sum + s.sent_today, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sender Accounts</CardTitle>
        <CardDescription className="text-xs">
          Email accounts for outreach sending. Capacity: {sentToday}/{totalCapacity} sent today.
          Add multiple accounts across providers for higher daily volume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add sender form */}
        <div className="flex flex-wrap gap-3 items-end p-3 bg-muted/40 rounded-lg">
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label className="text-xs">From Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourdomain.com" />
          </div>
          <div className="space-y-1 w-36">
            <Label className="text-xs">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="brevo">Brevo</SelectItem>
                <SelectItem value="mailgun">Mailgun</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[160px]">
            <Label className="text-xs">API Key</Label>
            <Select value={apiKeyId} onValueChange={setApiKeyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select key..." />
              </SelectTrigger>
              <SelectContent>
                {apiKeys.length === 0
                  ? <SelectItem value="none" disabled>No sending keys — add in API Keys page</SelectItem>
                  : apiKeys.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.service_name} ••••••••</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-24">
            <Label className="text-xs">Daily Limit</Label>
            <Input type="number" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} />
          </div>
          <Button size="sm" onClick={addSender} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Sender list */}
        {senders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sender accounts yet. Add your first above.</p>
        ) : (
          <div className="space-y-2">
            {senders.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                <div>
                  <span className="font-medium">{s.email}</span>
                  <Badge variant="outline" className="ml-2 text-xs capitalize">{s.provider}</Badge>
                  {s.is_warming_up && (
                    <Badge variant="secondary" className="ml-1 text-xs">Warmup day {s.warmup_day}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{s.sent_today}/{s.daily_limit} today</span>
                  <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-xs">
                    {s.is_active ? 'Active' : 'Paused'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSender(s.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
