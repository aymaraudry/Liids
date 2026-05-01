import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companies } = await request.json()
  // companies = [{ name: string, domain: string }]

  if (!Array.isArray(companies) || companies.length === 0) {
    return NextResponse.json({ error: 'companies array required' }, { status: 400 })
  }

  const results = { added: 0, skipped: 0, errors: [] as string[] }

  for (const c of companies) {
    const rawDomain = c.domain?.trim() || c.name?.trim()
    if (!rawDomain) continue

    // Normalize domain
    let domain = rawDomain.toLowerCase()
      .replace('https://', '').replace('http://', '').replace('www.', '')
      .split('/')[0].trim()

    // If no dot, assume .com
    if (!domain.includes('.')) domain = `${domain}.com`

    const name = c.name?.trim() || domain

    const { error } = await supabase.from('companies').insert({
      name,
      domain,
      website: `https://${domain}`,
      industry: 'SaaS',
      ad_platforms: ['manual'],
      status: 'pending_enrichment',
    })

    if (error) {
      if (error.code === '23505') {
        results.skipped++ // duplicate domain
      } else {
        results.errors.push(`${domain}: ${error.message}`)
      }
    } else {
      results.added++
    }
  }

  return NextResponse.json(results)
}
