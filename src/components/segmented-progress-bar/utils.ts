import { ColorScheme, SegmentData } from './types'

const COLOR_MAP: Record<ColorScheme, Record<string, { bg: string; bgDark: string }>> = {
  memorization: {
    completed: { bg: 'bg-emerald-500', bgDark: 'dark:bg-emerald-600' },
    in_progress: { bg: 'bg-amber-400', bgDark: 'dark:bg-amber-500' },
    not_started: { bg: 'bg-gray-200', bgDark: 'dark:bg-gray-700' },
  },
  tafsir: {
    completed: { bg: 'bg-rose-500', bgDark: 'dark:bg-rose-600' },
    in_progress: { bg: 'bg-rose-300', bgDark: 'dark:bg-rose-400' },
    not_started: { bg: 'bg-gray-200', bgDark: 'dark:bg-gray-700' },
  },
  book: {
    completed: { bg: 'bg-emerald-500', bgDark: 'dark:bg-emerald-600' },
    in_progress: { bg: 'bg-blue-400', bgDark: 'dark:bg-blue-500' },
    not_started: { bg: 'bg-gray-200', bgDark: 'dark:bg-gray-700' },
  },
}

// CSS color values for inline styles (gradient segments)
const CSS_COLORS: Record<ColorScheme, Record<string, { light: string; dark: string }>> = {
  memorization: {
    completed: { light: '#10b981', dark: '#059669' },
    in_progress: { light: '#fbbf24', dark: '#f59e0b' },
    not_started: { light: '#e5e7eb', dark: '#374151' },
  },
  tafsir: {
    completed: { light: '#f43f5e', dark: '#e11d48' },
    in_progress: { light: '#fda4af', dark: '#fb7185' },
    not_started: { light: '#e5e7eb', dark: '#374151' },
  },
  book: {
    completed: { light: '#10b981', dark: '#059669' },
    in_progress: { light: '#60a5fa', dark: '#3b82f6' },
    not_started: { light: '#e5e7eb', dark: '#374151' },
  },
}

export function getSegmentClasses(colorScheme: ColorScheme, status: string) {
  const colors = COLOR_MAP[colorScheme][status] || COLOR_MAP[colorScheme].not_started
  return `${colors.bg} ${colors.bgDark}`
}

export function getSegmentCSSColor(colorScheme: ColorScheme, status: string, isDark: boolean) {
  const colors = CSS_COLORS[colorScheme][status] || CSS_COLORS[colorScheme].not_started
  return isDark ? colors.dark : colors.light
}

export function calculateWidths(segments: SegmentData[]) {
  const totalItems = segments.reduce((sum, s) => sum + s.totalItems, 0)
  if (totalItems === 0) return segments.map(() => 0)

  // Calculate proportional widths with a minimum of 0.3% for visibility
  const minWidth = 0.3
  const rawWidths = segments.map(s => (s.totalItems / totalItems) * 100)

  // Count segments below minimum
  const belowMin = rawWidths.filter(w => w < minWidth).length
  const adjustedTotal = 100 - belowMin * minWidth
  const aboveMinTotal = rawWidths
    .filter(w => w >= minWidth)
    .reduce((sum, w) => sum + w, 0)

  return rawWidths.map(w => {
    if (w < minWidth) return minWidth
    return (w / aboveMinTotal) * adjustedTotal
  })
}

export function calculateGlobalPercentage(segments: SegmentData[]) {
  const totalItems = segments.reduce((sum, s) => sum + s.totalItems, 0)
  const completedItems = segments.reduce((sum, s) => sum + s.completedItems, 0)
  if (totalItems === 0) return 0
  return Math.round((completedItems / totalItems) * 1000) / 10
}
