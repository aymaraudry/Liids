import { NextRequest, NextResponse } from 'next/server'
import { runPipeline } from '@/lib/pipeline/orchestrator'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runPipeline()
  return NextResponse.json(result)
}
