'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface RunData {
  date: string
  companies: number
  contacts: number
  verified: number
}

export function PipelineRunChart({ data }: { data: RunData[] }) {
  if (!data.length) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
        No pipeline runs yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
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
        <Bar dataKey="companies" fill="#8b5cf6" name="Companies"  radius={[3, 3, 0, 0]} />
        <Bar dataKey="contacts"  fill="#3b82f6" name="Contacts"   radius={[3, 3, 0, 0]} />
        <Bar dataKey="verified"  fill="#22c55e" name="Verified"   radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
