import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // --- Sequence performance over last 30 days ---
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: sequences } = await supabase
    .from('sequences')
    .select('sent_at, opened_at, clicked_at, replied_at, bounced_at, template_id, step')
    .not('sent_at', 'is', null)
    .gte('sent_at', thirtyDaysAgo.toISOString())

  // --- Daily send volume (last 14 days) ---
  const dailyMap: Record<string, { sent: number; opened: number; replied: number; bounced: number }> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = { sent: 0, opened: 0, replied: 0, bounced: 0 }
  }

  for (const seq of sequences ?? []) {
    const day = seq.sent_at?.slice(0, 10)
    if (!day || !dailyMap[day]) continue
    dailyMap[day].sent++
    if (seq.opened_at) dailyMap[day].opened++
    if (seq.replied_at) dailyMap[day].replied++
    if (seq.bounced_at) dailyMap[day].bounced++
  }

  const dailyChart = Object.entries(dailyMap).map(([date, vals]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...vals,
  }))

  // --- Template A/B performance ---
  const { data: templates } = await supabase
    .from('pitch_templates')
    .select('id, name, step, variant')

  const templateMap: Record<string, { name: string; step: number; variant: string; sent: number; opened: number; replied: number }> = {}
  for (const t of templates ?? []) {
    templateMap[t.id] = { name: t.name, step: t.step, variant: t.variant, sent: 0, opened: 0, replied: 0 }
  }

  const { data: allSeqs } = await supabase
    .from('sequences')
    .select('template_id, sent_at, opened_at, replied_at')
    .not('sent_at', 'is', null)

  for (const seq of allSeqs ?? []) {
    if (!seq.template_id || !templateMap[seq.template_id]) continue
    templateMap[seq.template_id].sent++
    if (seq.opened_at) templateMap[seq.template_id].opened++
    if (seq.replied_at) templateMap[seq.template_id].replied++
  }

  const abData = Object.values(templateMap)
    .filter(t => t.sent > 0)
    .map(t => ({
      ...t,
      openRate: t.sent ? Math.round((t.opened / t.sent) * 100) : 0,
      replyRate: t.sent ? Math.round((t.replied / t.sent) * 100) : 0,
    }))
    .sort((a, b) => b.replyRate - a.replyRate)

  // --- Industry breakdown ---
  const { data: companies } = await supabase
    .from('companies')
    .select('industry, status')

  const industryMap: Record<string, { total: number; approved: number }> = {}
  for (const c of companies ?? []) {
    const ind = c.industry ?? 'Unknown'
    if (!industryMap[ind]) industryMap[ind] = { total: 0, approved: 0 }
    industryMap[ind].total++
    if (c.status === 'approved' || c.status === 'contacted') industryMap[ind].approved++
  }

  const industryChart = Object.entries(industryMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 8)
    .map(([name, vals]) => ({ name, ...vals }))

  // --- Sender account health ---
  const { data: senders } = await supabase
    .from('sender_accounts')
    .select('email, provider, sent_today, daily_limit, is_active, is_warming_up, warmup_day')

  const senderHealth = (senders ?? []).map(s => ({
    email: s.email,
    provider: s.provider,
    used: s.sent_today,
    capacity: s.daily_limit,
    utilization: s.daily_limit ? Math.round((s.sent_today / s.daily_limit) * 100) : 0,
    status: !s.is_active ? 'paused' : s.is_warming_up ? `warmup d${s.warmup_day}` : 'active',
  }))

  // --- Pipeline run history ---
  const { data: runLogs } = await supabase
    .from('run_logs')
    .select('started_at, companies_discovered, contacts_found, emails_verified, status')
    .order('started_at', { ascending: false })
    .limit(10)

  const runChart = (runLogs ?? [])
    .filter(r => r.status === 'completed')
    .reverse()
    .map(r => ({
      date: new Date(r.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      companies: r.companies_discovered,
      contacts: r.contacts_found,
      verified: r.emails_verified,
    }))

  // --- Top-level KPIs ---
  const [
    { count: totalCompanies },
    { count: totalContacts },
    { count: verifiedContacts },
    { count: approvedLeads },
    { count: totalSent },
    { count: totalReplied },
  ] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('email_verified', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('sequences').select('*', { count: 'exact', head: true }).not('sent_at', 'is', null),
    supabase.from('sequences').select('*', { count: 'exact', head: true }).not('replied_at', 'is', null),
  ])

  return NextResponse.json({
    kpis: {
      totalCompanies: totalCompanies ?? 0,
      totalContacts: totalContacts ?? 0,
      verifiedContacts: verifiedContacts ?? 0,
      approvedLeads: approvedLeads ?? 0,
      totalSent: totalSent ?? 0,
      totalReplied: totalReplied ?? 0,
      verifyRate: totalContacts ? Math.round(((verifiedContacts ?? 0) / totalContacts) * 100) : 0,
      replyRate: totalSent ? Math.round(((totalReplied ?? 0) / (totalSent ?? 1)) * 100) : 0,
    },
    dailyChart,
    abData,
    industryChart,
    senderHealth,
    runChart,
  })
}
