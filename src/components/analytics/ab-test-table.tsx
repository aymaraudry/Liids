'use client'

import { Badge } from '@/components/ui/badge'

interface ABEntry {
  name: string
  step: number
  variant: string
  sent: number
  opened: number
  replied: number
  openRate: number
  replyRate: number
}

export function ABTestTable({ data }: { data: ABEntry[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No template data yet — send some emails first.</p>
  }

  return (
    <div className="space-y-2">
      {data.map((t, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            {i === 0 && <span title="Best performer">🏆</span>}
            <span className="font-medium truncate">{t.name}</span>
            <Badge variant="outline" className="text-xs shrink-0">Step {t.step}</Badge>
            <Badge variant="secondary" className="text-xs shrink-0">Variant {t.variant}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 ml-4">
            <span>{t.sent} sent</span>
            <span className="text-yellow-600 font-medium">{t.openRate}% open</span>
            <span className="text-green-600 font-medium">{t.replyRate}% reply</span>
          </div>
        </div>
      ))}
    </div>
  )
}
