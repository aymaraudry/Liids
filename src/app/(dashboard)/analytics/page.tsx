'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { DailyVolumeChart } from '@/components/analytics/daily-volume-chart'
import { IndustryChart } from '@/components/analytics/industry-chart'
import { PipelineRunChart } from '@/components/analytics/pipeline-run-chart'
import { ABTestTable } from '@/components/analytics/ab-test-table'
import { SenderHealthTable } from '@/components/analytics/sender-health-table'

interface AnalyticsData {
  kpis: {
    totalCompanies: number
    totalContacts: number
    verifiedContacts: number
    approvedLeads: number
    totalSent: number
    totalReplied: number
    verifyRate: number
    replyRate: number
  }
  dailyChart: Array<{ date: string; sent: number; opened: number; replied: number; bounced: number }>
  abData: Array<{ name: string; step: number; variant: string; sent: number; opened: number; replied: number; openRate: number; replyRate: number }>
  industryChart: Array<{ name: string; total: number; approved: number }>
  senderHealth: Array<{ email: string; provider: string; used: number; capacity: number; utilization: number; status: string }>
  runChart: Array<{ date: string; companies: number; contacts: number; verified: number }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/analytics')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const kpis = data?.kpis

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">Pipeline performance, outreach metrics, and A/B results.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Companies Found',  value: kpis?.totalCompanies  ?? '—', sub: 'from ad platforms' },
          { label: 'Contacts Found',   value: kpis?.totalContacts   ?? '—', sub: `${kpis?.verifyRate ?? 0}% verified` },
          { label: 'Leads Approved',   value: kpis?.approvedLeads   ?? '—', sub: 'queued for outreach' },
          { label: 'Emails Sent',      value: kpis?.totalSent       ?? '—', sub: `${kpis?.replyRate ?? 0}% reply rate` },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-5">
              <p className="text-3xl font-bold">{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: Daily volume + Industry breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Email Activity — Last 14 Days</CardTitle>
            <CardDescription className="text-xs">Sent, opened, replied, and bounced by day</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <DailyVolumeChart data={data.dailyChart} /> : <SkeletonChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Companies by Industry</CardTitle>
            <CardDescription className="text-xs">Discovered vs approved across top industries</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <IndustryChart data={data.industryChart} /> : <SkeletonChart />}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Pipeline runs + A/B test */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pipeline Run History</CardTitle>
            <CardDescription className="text-xs">Companies, contacts, and verified emails per run</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <PipelineRunChart data={data.runChart} /> : <SkeletonChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Template A/B Performance</CardTitle>
            <CardDescription className="text-xs">Best performing templates ranked by reply rate</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? <ABTestTable data={data.abData} /> : <p className="text-sm text-muted-foreground">Loading...</p>}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Sender health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sender Account Health</CardTitle>
          <CardDescription className="text-xs">
            Daily usage per account — red means near limit, yellow means moderate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data ? <SenderHealthTable data={data.senderHealth} /> : <p className="text-sm text-muted-foreground">Loading...</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="h-[260px] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
