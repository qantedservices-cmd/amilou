'use client'

import { useState, useRef, useCallback } from 'react'
import { SegmentedProgressBarProps, SegmentData } from './types'
import { SegmentedBar } from './segmented-bar'
import { HistoryPanel } from './history-panel'
import { calculateWidths } from './utils'

export function SegmentedProgressBar({
  segments,
  cursorPosition,
  mode,
  colorScheme,
  onSegmentClick,
  onBarClick,
  fetchHistory,
}: SegmentedProgressBarProps) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [hoveredSegment, setHoveredSegment] = useState<SegmentData | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [historySegment, setHistorySegment] = useState<SegmentData | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const barContainerRef = useRef<HTMLDivElement>(null)

  const isCompact = mode === 'compact'
  const height = isCompact ? 'h-6' : 'h-8'

  const handleSegmentHover = useCallback(
    (segment: SegmentData | null, rect: DOMRect | null) => {
      setHoveredSegment(segment)
      if (rect) {
        setTooltipPos({
          x: rect.left + rect.width / 2,
          y: rect.top,
        })
      } else {
        setTooltipPos(null)
      }
    },
    []
  )

  const handleSegmentClick = useCallback(
    (segment: SegmentData) => {
      if (isCompact) {
        onSegmentClick?.(segment)
      } else if (fetchHistory) {
        setHistorySegment(segment)
        setHistoryOpen(true)
      }
      onSegmentClick?.(segment)
    },
    [isCompact, onSegmentClick, fetchHistory]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isCompact) return
      e.preventDefault()
      setZoomLevel((prev) => {
        const delta = e.deltaY < 0 ? 0.5 : -0.5
        return Math.max(1, Math.min(8, prev + delta))
      })
    },
    [isCompact]
  )

  // Calculate minimap viewport for zoomed state
  const widths = calculateWidths(segments)
  const viewportFraction = 1 / zoomLevel

  return (
    <div className="space-y-1" ref={barContainerRef}>
      {/* Main bar with optional scroll */}
      <div
        ref={scrollContainerRef}
        className={`relative ${!isCompact && zoomLevel > 1 ? 'overflow-x-auto' : 'overflow-hidden'}`}
        onWheel={handleWheel}
      >
        <SegmentedBar
          segments={segments}
          cursorPosition={cursorPosition}
          colorScheme={colorScheme}
          height={height}
          zoomLevel={isCompact ? 1 : zoomLevel}
          onSegmentHover={handleSegmentHover}
          onSegmentClick={handleSegmentClick}
          onBarClick={onBarClick}
        />
      </div>

      {/* Tooltip */}
      {hoveredSegment && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-popover text-popover-foreground border rounded-md shadow-md px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium">
              {hoveredSegment.label}
              {hoveredSegment.labelAr && (
                <span className="ml-2 text-muted-foreground" dir="rtl">
                  {hoveredSegment.labelAr}
                </span>
              )}
            </div>
            <div className="text-muted-foreground">
              {hoveredSegment.completedItems}/{hoveredSegment.totalItems} — {hoveredSegment.percentage}%
              {hoveredSegment.specialLabel && (
                <span className="ml-1 font-medium text-foreground">
                  ({hoveredSegment.specialLabel})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zoom controls + minimap (full mode only) */}
      {!isCompact && zoomLevel > 1 && (
        <div className="space-y-1">
          {/* Minimap */}
          <div className="relative h-2 rounded-full overflow-hidden bg-muted">
            {segments.map((segment, i) => {
              const w = widths[i]
              return (
                <div
                  key={segment.id}
                  className={`absolute top-0 h-full ${
                    segment.status === 'completed'
                      ? colorScheme === 'tafsir'
                        ? 'bg-rose-400'
                        : 'bg-emerald-400'
                      : segment.status === 'in_progress'
                        ? colorScheme === 'tafsir'
                          ? 'bg-rose-200'
                          : colorScheme === 'book'
                            ? 'bg-blue-300'
                            : 'bg-amber-300'
                        : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  style={{
                    left: `${widths.slice(0, i).reduce((a, b) => a + b, 0)}%`,
                    width: `${w}%`,
                  }}
                />
              )
            })}
            {/* Viewport indicator */}
            <div
              className="absolute top-0 h-full border-2 border-foreground/50 rounded-sm"
              style={{
                width: `${viewportFraction * 100}%`,
                left: `${(scrollContainerRef.current?.scrollLeft ?? 0) / ((scrollContainerRef.current?.scrollWidth ?? 1) / 100)}%`,
              }}
            />
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-primary"
            />
            <span>{zoomLevel}x</span>
          </div>
        </div>
      )}

      {/* History panel */}
      <HistoryPanel
        segment={historySegment}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        fetchHistory={fetchHistory}
      />
    </div>
  )
}
