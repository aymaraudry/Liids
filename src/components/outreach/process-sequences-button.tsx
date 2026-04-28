'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function ProcessSequencesButton() {
  const [loading, setLoading] = useState(false)

  async function handleProcess() {
    setLoading(true)
    try {
      const res = await fetch('/api/cron/process-sequences', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Sent ${data.sent} emails · Skipped ${data.skipped} · ${data.errors} errors`)
      } else {
        toast.error(data.error ?? 'Failed to process sequences')
      }
    } catch {
      toast.error('Network error')
    }
    setLoading(false)
  }

  return (
    <Button onClick={handleProcess} disabled={loading} size="sm" variant="outline">
      {loading
        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
        : <><Send className="h-4 w-4 mr-2" /> Send Due Emails</>
      }
    </Button>
  )
}
