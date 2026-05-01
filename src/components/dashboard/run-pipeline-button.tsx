'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function RunPipelineButton({ isRunning: initialRunning }: { isRunning: boolean }) {
  const [loading, setLoading] = useState(initialRunning)

  async function handleRun() {
    setLoading(true)
    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Pipeline started! Check back in a few minutes.')
      } else {
        toast.error(data.error ?? 'Failed to start pipeline')
        setLoading(false)
      }
    } catch {
      toast.error('Network error')
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleRun} disabled={loading} size="sm">
      {loading ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
      ) : (
        <><Play className="h-4 w-4 mr-2" /> Run Pipeline</>
      )}
    </Button>
  )
}
