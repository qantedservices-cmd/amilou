export interface SegmentData {
  id: string
  label: string
  labelAr?: string
  status: 'completed' | 'in_progress' | 'not_started'
  percentage: number
  totalItems: number
  completedItems: number
  specialLabel?: string
}

export interface HistoryEntry {
  date: string
  description: string
  verseStart?: number
  verseEnd?: number
  itemNumber?: number
  completedAt?: string
}

export type ColorScheme = 'memorization' | 'tafsir' | 'book'

export interface SegmentedProgressBarProps {
  segments: SegmentData[]
  cursorPosition?: number
  mode: 'compact' | 'full'
  colorScheme: ColorScheme
  onSegmentClick?: (segment: SegmentData) => void
  onBarClick?: () => void
  fetchHistory?: (segmentId: string) => Promise<HistoryEntry[]>
}
