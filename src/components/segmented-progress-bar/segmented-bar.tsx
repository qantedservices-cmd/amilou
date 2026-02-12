'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { SegmentData, ColorScheme } from './types'
import { calculateWidths, getSegmentCSSColor } from './utils'

interface SegmentedBarProps {
  segments: SegmentData[]
  cursorPosition?: number
  colorScheme: ColorScheme
  height: string // Tailwind class like h-6 or h-8
  zoomLevel: number
  onSegmentHover: (segment: SegmentData | null, rect: DOMRect | null) => void
  onSegmentClick?: (segment: SegmentData) => void
  onBarClick?: () => void
}

export function SegmentedBar({
  segments,
  cursorPosition,
  colorScheme,
  height,
  zoomLevel,
  onSegmentHover,
  onSegmentClick,
  onBarClick,
}: SegmentedBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widths = calculateWidths(segments)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDark()
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Calculate cursor position as percentage
  const cursorPercent = (() => {
    if (cursorPosition == null || cursorPosition < 0 || cursorPosition >= segments.length) return null
    let pos = 0
    for (let i = 0; i < cursorPosition; i++) {
      pos += widths[i]
    }
    // Position at the middle of the cursor segment
    pos += widths[cursorPosition] / 2
    return pos
  })()

  const handleSegmentEnter = useCallback(
    (segment: SegmentData, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      onSegmentHover(segment, rect)
    },
    [onSegmentHover]
  )

  const handleSegmentLeave = useCallback(() => {
    onSegmentHover(null, null)
  }, [onSegmentHover])

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex ${height} rounded-md overflow-hidden ${onBarClick ? 'cursor-pointer' : ''}`}
        style={{ width: `${100 * zoomLevel}%` }}
        onClick={onBarClick}
      >
        {segments.map((segment, i) => {
          const w = widths[i]
          const completedColor = getSegmentCSSColor(colorScheme, 'completed', isDark)
          const inProgressColor = getSegmentCSSColor(colorScheme, 'in_progress', isDark)
          const notStartedColor = getSegmentCSSColor(colorScheme, 'not_started', isDark)

          let bgStyle: React.CSSProperties
          if (segment.status === 'completed') {
            bgStyle = { backgroundColor: completedColor }
          } else if (segment.status === 'in_progress' && segment.percentage > 0) {
            // Gradient: completed portion then in-progress
            bgStyle = {
              background: `linear-gradient(to right, ${inProgressColor} ${segment.percentage}%, ${notStartedColor} ${segment.percentage}%)`,
            }
          } else {
            bgStyle = { backgroundColor: notStartedColor }
          }

          return (
            <div
              key={segment.id}
              className="relative transition-opacity hover:opacity-80"
              style={{
                width: `${w}%`,
                minWidth: '1px',
                ...bgStyle,
                // Add subtle borders between segments
                borderRight: i < segments.length - 1 ? '0.5px solid rgba(255,255,255,0.3)' : undefined,
              }}
              onMouseEnter={(e) => handleSegmentEnter(segment, e)}
              onMouseLeave={handleSegmentLeave}
              onClick={(e) => {
                if (onSegmentClick) {
                  e.stopPropagation()
                  onSegmentClick(segment)
                }
              }}
            />
          )
        })}
      </div>

      {/* Cursor marker */}
      {cursorPercent != null && (
        <div
          className="absolute -bottom-1 transform -translate-x-1/2"
          style={{ left: `${cursorPercent / zoomLevel}%` }}
        >
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-foreground" />
        </div>
      )}
    </div>
  )
}
