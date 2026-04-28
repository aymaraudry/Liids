import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Users, Mail, Activity, Play } from 'lucide-react'
import { RunPipelineButton } from '@/components/dashboard/run-pipeline-button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: companiesCount },
    { count: contactsCount },
    { count: leadsCount },
    { count: sentCount },
    { data: lastRun },
    { data: settings }
  ] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('sequences').select('*', { count: 'exact', head: true }).not('sent_at', 'is', null),
    supabase.from('run_logs').select('*').order('started_at', { ascending: false }).limit(1).single(),
    supabase.from('settings').select('target_industry, schedule_frequency, last_run_at').single(),
  ])

  const stats = [
    { title: 'Companies Found', value: companiesCount ?? 0, icon: Building2, color: 'text-blue-500' },
    { title: 'Contacts Found', value: contactsCount ?? 0, icon: Users, color: 'text-green-500' },
    { title: 'Leads Approved', value: leadsCount ?? 0, icon: Activity, color: 'text-purple-500' },
    { title: 'Emails Sent', value: sentCount ?? 0, icon: Mail, color: 'text-orange-500' },
  ]

  const isRunning = lastRun?.status === 'running'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Industry: <span className="font-medium text-foreground">{settings?.target_industry ?? 'SaaS'}</span>
            {' · '}
            Schedule: <span className="font-medium text-foreground">{settings?.schedule_frequency ?? 'manual'}</span>
          </p>
        </div>
        <RunPipelineButton isRunning={isRunning} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ title, value, icon: Icon, color }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Last Pipeline Run</CardTitle>
          </CardHeader>
          <CardContent>
            {lastRun ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant={
                    lastRun.status === 'completed' ? 'default' :
                    lastRun.status === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {lastRun.status === 'running' ? '⟳ Running...' : lastRun.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(lastRun.started_at).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Companies</p>
                    <p className="font-semibold">{lastRun.companies_discovered}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contacts</p>
                    <p className="font-semibold">{lastRun.contacts_found}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Verified</p>
                    <p className="font-semibold">{lastRun.emails_verified}</p>
                  </div>
                </div>
                {lastRun.errors?.length > 0 && (
                  <p className="text-xs text-destructive">{lastRun.errors.length} error(s) logged</p>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>No runs yet.</p>
                <p>Add your API keys, configure settings, then run the pipeline.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: '/api-keys', label: '🔑 Add API keys to start finding contacts' },
              { href: '/settings', label: '⚙️ Configure industry and schedule' },
              { href: '/leads', label: '✅ Review and approve leads' },
              { href: '/templates', label: '✉️ Edit your pitch templates' },
            ].map(({ href, label }) => (
              <a key={href} href={href} className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1">
                {label}
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
