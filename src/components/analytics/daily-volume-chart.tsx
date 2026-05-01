'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface DayData {
  date: string
  sent: number
  opened: number
  replied: number
  bounced: number
}

export function DailyVolumeChart({ data }: { data: DayData[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="sent"    stroke="#3b82f6" strokeWidth={2} dot={false} name="Sent" />
        <Line type="monotone" dataKey="opened"  stroke="#f59e0b" strokeWidth={2} dot={false} name="Opened" />
        <Line type="monotone" dataKey="replied" stroke="#22c55e" strokeWidth={2} dot={false} name="Replied" />
        <Line type="monotone" dataKey="bounced" stroke="#ef4444" strokeWidth={2} dot={false} name="Bounced" />
      </LineChart>
    </ResponsiveContainer>
  )
}
