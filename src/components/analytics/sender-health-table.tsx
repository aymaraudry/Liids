'use client'

import { Badge } from '@/components/ui/badge'

interface SenderEntry {
  email: string
  provider: string
  used: number
  capacity: number
  utilization: number
  status: string
}

export function SenderHealthTable({ data }: { data: SenderEntry[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No sender accounts configured yet.</p>
  }

  return (
    <div className="space-y-2">
      {data.map((s, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{s.email}</span>
            <Badge variant="outline" className="text-xs capitalize">{s.provider}</Badge>
          </div>
          <div className="flex items-center gap-4">
            {/* Usage bar */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    s.utilization >= 90 ? 'bg-destructive' :
                    s.utilization >= 70 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(s.utilization, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">
                {s.used}/{s.capacity}
              </span>
            </div>
            <Badge
              variant={
                s.status === 'active' ? 'default' :
                s.status === 'paused' ? 'destructive' : 'secondary'
              }
              className="text-xs w-20 text-center"
            >
              {s.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
