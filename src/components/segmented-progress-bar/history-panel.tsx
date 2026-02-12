'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SegmentData, HistoryEntry } from './types'

interface HistoryPanelProps {
  segment: SegmentData | null
  open: boolean
  onClose: () => void
  fetchHistory?: (segmentId: string) => Promise<HistoryEntry[]>
}

export function HistoryPanel({ segment, open, onClose, fetchHistory }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && segment && fetchHistory) {
      setLoading(true)
      fetchHistory(segment.id)
        .then((data) => setEntries(data))
        .catch(() => setEntries([]))
        .finally(() => setLoading(false))
    }
  }, [open, segment, fetchHistory])

  if (!segment) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{segment.label}</span>
            {segment.labelAr && (
              <span className="text-sm text-muted-foreground font-normal" dir="rtl">
                {segment.labelAr}
              </span>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {segment.completedItems}/{segment.totalItems} — {segment.percentage}%
          </p>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun historique disponible
          </p>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b last:border-0"
              >
                <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                  {new Date(entry.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-sm">{entry.description}</div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
