'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { SegmentedProgressBar, SegmentData } from '@/components/segmented-progress-bar'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BookOpen, Calendar, TrendingUp, Target, CheckCircle, Circle, AlertCircle, Award, FileText, Flame, ArrowUp, ArrowDown, CalendarDays, RefreshCw, BookMarked, RotateCcw, Plus, Loader2, Pencil, Trash2, X, Check, User, Lock, ChevronLeft, ChevronRight, Library } from 'lucide-react'
import { toast } from 'sonner'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fr } from 'date-fns/locale'

interface Program {
  id: string
  code: string
  nameFr: string
}

interface Surah {
  number: number
  nameFr: string
  nameAr: string
}

interface ProgressEntry {
  id: string
  date: string
  verseStart: number
  verseEnd: number
  program: Program
  surah: Surah
}

interface Objective {
  id: string
  dailyTarget: number
  program: Program
}

interface ObjectiveVsRealized {
  programId: string
  programCode: string
  programName: string
  objective: {
    quantity: number
    unit: string
    period: string
  } | null
  realized: {
    quantity: number
    unit: string
  } | null
}

interface GlobalProgress {
  memorizedVerses: number
  memorizedPages: number
  memorizedSurahs: number
  percentage: number
  totalVerses: number
  totalPages: number
  totalSurahs: number
}

interface WeeklyAttendanceEntry {
  id: string
  date: string
  weekNumber: number
  year: number
  sunday: number
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  comment: string | null
  daysActive: number
  totalScore: number
  score: number
}

interface EvolutionData {
  week: string
  weekStart: string
  MEMORIZATION: number
  CONSOLIDATION: number
  REVISION: number
  READING: number
  TAFSIR: number
  total: number
}

interface AttendanceStats {
  rate: number
  activeWeeks?: number
  weeksWithSubmission?: number
  totalWeeks: number
}

interface ProgramStat {
  code: string
  name: string
  daysCompleted: number
  totalDays: number
  rate: number
}

interface WeeklyObjectiveStatus {
  id: string
  name: string
  isCustom: boolean
  completed: boolean
}

interface WeeklyObjectiveStat {
  id: string
  name: string
  isCustom: boolean
  completedWeeks: number
  totalWeeks: number
  rate: number
}

interface TodayProgram {
  code: string
  name: string
  completed: boolean
}

interface Stats {
  period: string
  selectedYear: number
  selectedMonth: number
  availableYears: number[]
  globalProgress: GlobalProgress
  totalVerses: number
  totalPages: number
  uniqueSurahs: number
  groupsCount: number
  // New structured attendance
  dailyAttendance?: AttendanceStats
  weeklyAttendance?: AttendanceStats
  // Legacy fields
  attendanceRate: number
  activeWeeksCount: number
  totalWeeksInPeriod: number
  recentProgress: ProgressEntry[]
  objectives: Objective[]
  progressByProgram: Record<string, number>
  objectivesVsRealized: ObjectiveVsRealized[]
  evolutionData: EvolutionData[]
  weeklyAttendanceDetails: WeeklyAttendanceEntry[]
  // NEW: Program completion stats
  todayPrograms: TodayProgram[]
  weekGrid: Record<string, boolean[]>
  weekProgramStats: ProgramStat[]
  periodProgramStats: ProgramStat[]
  weekStartDate: string
  weekNumber: number
  weekYear: number
  weekOffset: number
  canGoForward: boolean
  // NEW: Weekly objectives
  weeklyObjectivesStatus: WeeklyObjectiveStatus[]
  weeklyObjectivesStats: WeeklyObjectiveStat[]
  // NEW: Streaks
  dailyStreak: number
  weeklyStreak: number
  // NEW: Trend
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
  // NEW: Completion Cycles
  completionCycles: {
    revision: {
      totalCycles: number
      lastDate: string | null
      daysSinceLast: number | null
      averageDays: number | null
      lastHizbCount: number | null
    }
    lecture: {
      totalCycles: number
      lastDate: string | null
      daysSinceLast: number | null
      averageDays: number | null
    }
  }
  // NEW: Tafsir Coverage
  tafsirCoverage: {
    percentage: number
    coveredVerses: number
    completedSurahs: number
  }
}

interface ManageableUser {
  id: string
  name: string | null
  email: string
  isSelf: boolean
  isPrivate: boolean
  canEdit: boolean
  canView: boolean
}

type PeriodType = 'year' | 'month' | 'global'

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const year = d.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay()
  const firstSunday = new Date(year, 0, 1 - jan1Day)
  const diffDays = Math.floor((d.getTime() - firstSunday.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.floor(diffDays / 7) + 1
  return { week, year }
}

interface ProgramInfo {
  id: string
  code: string
  nameFr: string
}

export default function DashboardPage() {
  const t = useTranslations()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const urlUserId = searchParams.get('userId')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [period, setPeriod] = useState<PeriodType>('year')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)

  // Completion cycle dialog (add new)
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false)
  const [cycleType, setCycleType] = useState<'REVISION' | 'LECTURE'>('REVISION')
  const [cycleDate, setCycleDate] = useState(new Date().toISOString().split('T')[0])
  const [cycleNotes, setCycleNotes] = useState('')
  const [cycleSaving, setCycleSaving] = useState(false)

  // Cycle history dialog
  const [cycleHistoryOpen, setCycleHistoryOpen] = useState(false)
  const [cycleHistoryType, setCycleHistoryType] = useState<'REVISION' | 'LECTURE'>('REVISION')
  const [cycleHistory, setCycleHistory] = useState<Array<{
    id: string
    type: string
    completedAt: string
    daysToComplete: number | null
    hizbCount: number | null
    notes: string | null
  }>>([])
  const [loadingCycleHistory, setLoadingCycleHistory] = useState(false)
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [editCycleDate, setEditCycleDate] = useState('')
  const [editCycleNotes, setEditCycleNotes] = useState('')
  const [editCycleHizbCount, setEditCycleHizbCount] = useState<number | null>(null)
  const [savingCycleEdit, setSavingCycleEdit] = useState(false)

  // New cycle dialog hizbCount
  const [cycleHizbCount, setCycleHizbCount] = useState<number | null>(null)
  const [needsMemorizationInput, setNeedsMemorizationInput] = useState(false)
  const [memorizationSurah, setMemorizationSurah] = useState<number | null>(null)
  const [memorizationVerse, setMemorizationVerse] = useState<number | null>(null)

  // Interactive today programs
  const [localTodayPrograms, setLocalTodayPrograms] = useState<TodayProgram[]>([])
  const [programsMap, setProgramsMap] = useState<Record<string, string>>({}) // code -> id

  // Interactive week grid
  const [localWeekGrid, setLocalWeekGrid] = useState<Record<string, boolean[]>>({})
  const [togglingWeekCell, setTogglingWeekCell] = useState<string | null>(null) // "CODE-dayIndex"
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekNumber, setWeekNumber] = useState<number | null>(null)
  const [weekYear, setWeekYear] = useState<number | null>(null)
  const [weekStartDate, setWeekStartDate] = useState<string | null>(null)
  const [loadingWeek, setLoadingWeek] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

  // User selector for Programmes Journaliers
  const [manageableUsers, setManageableUsers] = useState<ManageableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [viewingOtherUser, setViewingOtherUser] = useState(false)
  const [weekGridCanEdit, setWeekGridCanEdit] = useState(true)

  // Interactive weekly objectives
  const [localWeeklyObjectives, setLocalWeeklyObjectives] = useState<WeeklyObjectiveStatus[]>([])
  const [togglingObjective, setTogglingObjective] = useState<string | null>(null)

  // Surah progress
  const [surahStats, setSurahStats] = useState<{
    surahs: Array<{
      number: number
      nameFr: string
      nameAr: string
      totalVerses: number
      programs: Record<string, { covered: number; percentage: number }>
      overallPercentage: number
    }>
    totals: Record<string, { covered: number; percentage: number }>
    programs: string[]
  } | null>(null)
  const [selectedSurahProgram, setSelectedSurahProgram] = useState<string>('MEMORIZATION')
  const [surahsExpanded, setSurahsExpanded] = useState(false)

  // Group ranking
  const [groupRanking, setGroupRanking] = useState<{
    groups: Array<{
      groupId: string
      groupName: string
      members: Array<{
        userId: string
        name: string
        image: string | null
        memorizedVerses: number
        memorizedPages: number
        memorizedJuz: number
        percentage: number
        rank: number
      }>
      currentUserRank: number | null
      totalMembers: number
    }>
  } | null>(null)

  // User books for segmented bar
  const [userBooks, setUserBooks] = useState<Array<{
    id: string
    title: string
    titleAr?: string
    sourceRef?: string | null
    totalItems: number
    completedItems: number
    percentage: number
  }>>([])

  // Inactivity alerts
  const [inactiveAlerts, setInactiveAlerts] = useState<Array<{
    userId: string
    name: string
    weeksSinceActivity: number
    lastActivityDate: string | null
    groupName: string
  }>>([])

  // Global user selector (replaces limited selectedUserId for Programmes Journaliers)
  const [globalUserId, setGlobalUserId] = useState<string>('')
  const [globalUserName, setGlobalUserName] = useState<string>('')
  const [isViewingSelf, setIsViewingSelf] = useState(true)
  const [globalCanEdit, setGlobalCanEdit] = useState(true)

  async function fetchSurahStats(targetUserId?: string) {
    try {
      const params = targetUserId ? `?userId=${targetUserId}` : ''
      const res = await fetch(`/api/stats/surahs${params}`)
      if (res.ok) {
        const data = await res.json()
        setSurahStats(data)
      }
    } catch (error) {
      console.error('Error fetching surah stats:', error)
    }
  }

  async function fetchUserBooks(targetUserId?: string) {
    try {
      const params = targetUserId ? `?userId=${targetUserId}` : ''
      const res = await fetch(`/api/user/books${params}`)
      if (res.ok) {
        const data = await res.json()
        setUserBooks(data)
      }
    } catch (error) {
      console.error('Error fetching user books:', error)
    }
  }

  async function fetchInactiveAlerts() {
    try {
      const res = await fetch('/api/alerts/inactive-students?threshold=2')
      if (res.ok) {
        const data = await res.json()
        setInactiveAlerts(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching inactive alerts:', error)
    }
  }

  async function fetchGroupRanking() {
    try {
      const res = await fetch('/api/stats/group-ranking')
      if (res.ok) {
        const data = await res.json()
        setGroupRanking(data)
      }
    } catch (error) {
      console.error('Error fetching group ranking:', error)
    }
  }

  async function fetchStats(showLoader = true, targetUserId?: string) {
    // Save scroll position before fetching (for non-initial loads)
    const scrollY = window.scrollY
    const shouldRestoreScroll = !isInitialLoad

    // On initial load, show full loader; otherwise show subtle refresh indicator
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      params.set('year', selectedYear.toString())
      if (period === 'month') {
        params.set('month', selectedMonth.toString())
      }
      params.set('weekOffset', weekOffset.toString())
      if (targetUserId) {
        params.set('userId', targetUserId)
      }
      const res = await fetch(`/api/stats?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        // Update week-specific state
        setWeekNumber(data.weekNumber)
        setWeekYear(data.weekYear)
        setWeekStartDate(data.weekStartDate)
        // Only update week grid if viewing self
        if (!viewingOtherUser) {
          setLocalWeekGrid(data.weekGrid || {})
        }
        setCanGoForward(data.canGoForward || false)
        // Update selected date to match the week
        if (data.weekStartDate) {
          setSelectedDate(new Date(data.weekStartDate))
        }
        // Restore scroll position after state update
        if (shouldRestoreScroll) {
          requestAnimationFrame(() => {
            window.scrollTo(0, scrollY)
          })
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      setIsInitialLoad(false)
    }
  }

  async function fetchWeekData(offset: number) {
    setLoadingWeek(true)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      params.set('year', selectedYear.toString())
      if (period === 'month') {
        params.set('month', selectedMonth.toString())
      }
      params.set('weekOffset', offset.toString())
      const res = await fetch(`/api/stats?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setWeekNumber(data.weekNumber)
        setWeekYear(data.weekYear)
        setWeekStartDate(data.weekStartDate)
        setCanGoForward(data.canGoForward || false)
        // Update selected date to match the week
        if (data.weekStartDate) {
          setSelectedDate(new Date(data.weekStartDate))
        }
        // If viewing another user, fetch their grid for this week
        const selfUser = manageableUsers.find(u => u.isSelf)
        if (selectedUserId && selfUser && selectedUserId !== selfUser.id) {
          const otherParams = new URLSearchParams()
          if (data.weekStartDate) {
            otherParams.set('weekStart', data.weekStartDate)
          }
          otherParams.set('userId', selectedUserId)
          const otherRes = await fetch(`/api/attendance/programs?${otherParams.toString()}`)
          if (otherRes.ok) {
            const otherData = await otherRes.json()
            const programs: Array<{ id: string; code: string }> = otherData.programs || []
            const completions: Record<string, Record<number, boolean>> = otherData.completions || {}
            const grid: Record<string, boolean[]> = {}
            for (const prog of programs) {
              grid[prog.code] = [false, false, false, false, false, false, false]
              if (completions[prog.id]) {
                for (let i = 0; i < 7; i++) {
                  grid[prog.code][i] = completions[prog.id][i] || false
                }
              }
            }
            setLocalWeekGrid(grid)
          }
        } else {
          setLocalWeekGrid(data.weekGrid || {})
        }
      }
    } catch (error) {
      console.error('Error fetching week data:', error)
    } finally {
      setLoadingWeek(false)
    }
  }

  // Reset week offset when period changes
  useEffect(() => {
    setWeekOffset(0)
    setWeekOffsetChanged(false)
  }, [period, selectedYear, selectedMonth])

  useEffect(() => {
    const selfUser = manageableUsers.find(u => u.isSelf)
    const targetId = (globalUserId && selfUser && globalUserId !== selfUser.id) ? globalUserId : undefined
    fetchStats(true, targetId)
  }, [period, selectedYear, selectedMonth])

  // Fetch week data when weekOffset changes (without full page reload)
  // Skip on initial mount - stats already has current week data
  const [weekOffsetChanged, setWeekOffsetChanged] = useState(false)
  useEffect(() => {
    if (weekOffsetChanged && stats) {
      fetchWeekData(weekOffset)
    }
  }, [weekOffset, weekOffsetChanged])

  function changeWeekOffset(delta: number) {
    setWeekOffsetChanged(true)
    setWeekOffset(prev => prev + delta)
  }

  function resetToCurrentWeek() {
    setWeekOffsetChanged(true)
    setWeekOffset(0)
    setSelectedDate(new Date())
  }

  // Get week start date (Sunday) for a given date
  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    return d
  }

  // Calculate base week for the current period
  function getBaseWeekForPeriod(): Date {
    const now = new Date()
    const currentWeekStart = getWeekStart(now)

    if (period === 'global') {
      return currentWeekStart
    } else if (period === 'month') {
      const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === (now.getMonth() + 1)
      if (isCurrentMonth) {
        return currentWeekStart
      } else {
        const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0)
        return getWeekStart(lastDayOfMonth)
      }
    } else {
      const isCurrentYear = selectedYear === now.getFullYear()
      if (isCurrentYear) {
        return currentWeekStart
      } else {
        const lastDayOfYear = new Date(selectedYear, 11, 31)
        return getWeekStart(lastDayOfYear)
      }
    }
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) return
    setSelectedDate(date)
    setCalendarOpen(false)

    // Calculate the week offset from base week
    const baseWeek = getBaseWeekForPeriod()
    const selectedWeekStart = getWeekStart(date)
    const diffMs = selectedWeekStart.getTime() - baseWeek.getTime()
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))

    setWeekOffsetChanged(true)
    setWeekOffset(diffWeeks)
  }

  useEffect(() => {
    fetchSurahStats()
    fetchGroupRanking()
    fetchUserBooks()
    fetchInactiveAlerts()
  }, [])

  // Fetch manageable users for global selector
  useEffect(() => {
    async function fetchManageableUsers() {
      try {
        const res = await fetch('/api/users/manageable')
        if (res.ok) {
          const users = await res.json()
          setManageableUsers(Array.isArray(users) ? users : [])
          const selfUser = users.find((u: ManageableUser) => u.isSelf)
          // If URL has userId param and user is allowed to see them, use that
          const targetUser = urlUserId && users.find((u: ManageableUser) => u.id === urlUserId && u.canView)
          const initialUser = targetUser || selfUser
          if (initialUser) {
            setSelectedUserId(initialUser.id)
            setGlobalUserId(initialUser.id)
            setGlobalUserName(initialUser.name || initialUser.email)
          }
        }
      } catch (error) {
        console.error('Error fetching manageable users:', error)
      }
    }
    fetchManageableUsers()
  }, [])

  // Fetch program IDs for today's toggle
  useEffect(() => {
    async function fetchProgramIds() {
      try {
        const res = await fetch('/api/attendance/programs')
        if (res.ok) {
          const data = await res.json()
          const map: Record<string, string> = {}
          for (const prog of data.programs || []) {
            map[prog.code] = prog.id
          }
          setProgramsMap(map)
        }
      } catch (error) {
        console.error('Error fetching program IDs:', error)
      }
    }
    fetchProgramIds()
  }, [])

  // Sync local today programs with stats
  useEffect(() => {
    if (stats?.todayPrograms) {
      setLocalTodayPrograms(stats.todayPrograms)
    }
  }, [stats?.todayPrograms])

  // Sync local week grid with stats (only when viewing self)
  useEffect(() => {
    if (stats?.weekGrid && !viewingOtherUser) {
      setLocalWeekGrid(stats.weekGrid)
    }
  }, [stats?.weekGrid])

  // Sync local weekly objectives with stats
  useEffect(() => {
    if (stats?.weeklyObjectivesStatus) {
      setLocalWeeklyObjectives(stats.weeklyObjectivesStatus)
    }
  }, [stats?.weeklyObjectivesStatus])

  // Handle user selector change for Programmes Journaliers (synced with global)
  useEffect(() => {
    if (!selectedUserId) return
    const selfUser = manageableUsers.find(u => u.isSelf)
    const isSelf = selfUser?.id === selectedUserId
    setViewingOtherUser(!isSelf)
    const selected = manageableUsers.find(u => u.id === selectedUserId)
    setWeekGridCanEdit(selected?.canEdit ?? true)

    if (isSelf) {
      // Restore self data from stats
      if (stats?.weekGrid) {
        setLocalWeekGrid(stats.weekGrid)
      }
    } else {
      // Fetch other user's week grid
      fetchOtherUserWeekGrid(selectedUserId)
    }
  }, [selectedUserId])

  // Handle global user selector change — reloads all dashboard data
  useEffect(() => {
    if (!globalUserId) return
    const selfUser = manageableUsers.find(u => u.isSelf)
    const isSelf = selfUser?.id === globalUserId
    setIsViewingSelf(isSelf)
    const selected = manageableUsers.find(u => u.id === globalUserId)
    setGlobalUserName(selected?.name || '')
    setGlobalCanEdit(selected?.canEdit ?? true)

    // Sync with programmes journaliers selector
    setSelectedUserId(globalUserId)

    // Skip if this is the initial load (data already being fetched)
    if (!stats) return

    // Refetch all data for the selected user
    const targetId = isSelf ? undefined : globalUserId
    fetchStats(true, targetId)
    fetchSurahStats(targetId)
    fetchUserBooks(targetId)
  }, [globalUserId])

  async function fetchOtherUserWeekGrid(userId: string) {
    setLoadingWeek(true)
    try {
      const currentWeekStart = weekStartDate || stats?.weekStartDate
      const params = new URLSearchParams()
      if (currentWeekStart) {
        params.set('weekStart', currentWeekStart)
      }
      params.set('userId', userId)
      const res = await fetch(`/api/attendance/programs?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        // Convert completions matrix {programId: {dayIndex: bool}} to weekGrid {code: bool[]}
        const programs: Array<{ id: string; code: string }> = data.programs || []
        const completions: Record<string, Record<number, boolean>> = data.completions || {}
        const grid: Record<string, boolean[]> = {}
        for (const prog of programs) {
          grid[prog.code] = [false, false, false, false, false, false, false]
          if (completions[prog.id]) {
            for (let i = 0; i < 7; i++) {
              grid[prog.code][i] = completions[prog.id][i] || false
            }
          }
        }
        setLocalWeekGrid(grid)
      }
    } catch (error) {
      console.error('Error fetching other user week grid:', error)
    } finally {
      setLoadingWeek(false)
    }
  }

  // Helper to format date as YYYY-MM-DD (timezone-safe)
  function formatDateLocal(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  async function toggleWeekGridCell(code: string, dayIndex: number) {
    const programId = programsMap[code]
    if (!programId || togglingWeekCell) return
    // Block if viewing another user without edit permission
    if (viewingOtherUser && !weekGridCanEdit) return

    const cellKey = `${code}-${dayIndex}`
    setTogglingWeekCell(cellKey)

    const currentCompleted = localWeekGrid[code]?.[dayIndex] || false
    const newCompleted = !currentCompleted

    // Optimistic update
    setLocalWeekGrid(prev => ({
      ...prev,
      [code]: prev[code]?.map((v, i) => i === dayIndex ? newCompleted : v) || []
    }))

    // Also update today programs if it's today and viewing self
    if (!viewingOtherUser && dayIndex === new Date().getDay()) {
      setLocalTodayPrograms(prev =>
        prev.map(p => p.code === code ? { ...p, completed: newCompleted } : p)
      )
    }

    try {
      // Calculate the date for this day index (use current weekStartDate from state or stats)
      const currentWeekStart = weekStartDate || stats?.weekStartDate
      const weekStartObj = currentWeekStart ? new Date(currentWeekStart) : new Date()
      const targetDate = new Date(weekStartObj)
      targetDate.setDate(weekStartObj.getDate() + dayIndex)

      const payload: Record<string, unknown> = {
        completions: {
          [programId]: {
            [dayIndex]: {
              date: formatDateLocal(targetDate),
              completed: newCompleted
            }
          }
        }
      }
      // Pass userId when editing another user's data
      if (viewingOtherUser) {
        payload.userId = selectedUserId
      }

      const res = await fetch('/api/attendance/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const programName = stats?.weekProgramStats?.find(p => p.code === code)?.name || code
        toast.success(newCompleted ? `${programName} (${DAY_NAMES[dayIndex]}) ✓` : `${programName} (${DAY_NAMES[dayIndex]}) retiré`)
      } else {
        // Revert
        setLocalWeekGrid(prev => ({
          ...prev,
          [code]: prev[code]?.map((v, i) => i === dayIndex ? currentCompleted : v) || []
        }))
        if (!viewingOtherUser && dayIndex === new Date().getDay()) {
          setLocalTodayPrograms(prev =>
            prev.map(p => p.code === code ? { ...p, completed: currentCompleted } : p)
          )
        }
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Error toggling week cell:', error)
      setLocalWeekGrid(prev => ({
        ...prev,
        [code]: prev[code]?.map((v, i) => i === dayIndex ? currentCompleted : v) || []
      }))
      if (!viewingOtherUser && dayIndex === new Date().getDay()) {
        setLocalTodayPrograms(prev =>
          prev.map(p => p.code === code ? { ...p, completed: currentCompleted } : p)
        )
      }
      toast.error('Erreur de connexion')
    } finally {
      setTogglingWeekCell(null)
    }
  }

  async function toggleWeeklyObjective(objectiveId: string) {
    if (togglingObjective) return

    setTogglingObjective(objectiveId)

    const objective = localWeeklyObjectives.find(o => o.id === objectiveId)
    const newCompleted = !objective?.completed

    // Optimistic update
    setLocalWeeklyObjectives(prev =>
      prev.map(o => o.id === objectiveId ? { ...o, completed: newCompleted } : o)
    )

    try {
      // Get current week start (Sunday)
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)

      const res = await fetch('/api/attendance/weekly-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectiveId,
          weekStart: weekStart.toISOString(),
          completed: newCompleted
        })
      })

      if (res.ok) {
        toast.success(newCompleted ? `${objective?.name} complété ✓` : `${objective?.name} retiré`)
      } else {
        setLocalWeeklyObjectives(prev =>
          prev.map(o => o.id === objectiveId ? { ...o, completed: !newCompleted } : o)
        )
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Error toggling objective:', error)
      setLocalWeeklyObjectives(prev =>
        prev.map(o => o.id === objectiveId ? { ...o, completed: !newCompleted } : o)
      )
      toast.error('Erreur de connexion')
    } finally {
      setTogglingObjective(null)
    }
  }

  async function handleSaveCycle() {
    setCycleSaving(true)
    try {
      const payload: {
        type: string
        completedAt: string
        notes: string | null
        hizbCount?: number | null
        surahNumber?: number
        verseNumber?: number
      } = {
        type: cycleType,
        completedAt: cycleDate,
        notes: cycleNotes || null
      }

      // Add hizbCount for REVISION cycles
      if (cycleType === 'REVISION') {
        if (cycleHizbCount !== null) {
          payload.hizbCount = cycleHizbCount
        } else if (memorizationSurah && memorizationVerse) {
          payload.surahNumber = memorizationSurah
          payload.verseNumber = memorizationVerse
        }
      }

      const res = await fetch('/api/completion-cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      // Check if API needs memorization input
      if (data.needsMemorizationInput) {
        setNeedsMemorizationInput(true)
        setCycleSaving(false)
        return
      }

      if (res.ok && data.id) {
        setCycleDialogOpen(false)
        toast.success('Cycle enregistré')
        setCycleNotes('')
        setCycleHizbCount(null)
        setNeedsMemorizationInput(false)
        setMemorizationSurah(null)
        setMemorizationVerse(null)
        fetchStats()
      }
    } catch (error) {
      console.error('Error saving cycle:', error)
    } finally {
      setCycleSaving(false)
    }
  }

  function openCycleDialog(type: 'REVISION' | 'LECTURE') {
    setCycleType(type)
    setCycleDate(new Date().toISOString().split('T')[0])
    setCycleNotes('')
    setCycleHizbCount(null)
    setNeedsMemorizationInput(false)
    setMemorizationSurah(null)
    setMemorizationVerse(null)
    setCycleDialogOpen(true)
  }

  async function fetchCycleHistory(type: 'REVISION' | 'LECTURE') {
    setLoadingCycleHistory(true)
    try {
      const res = await fetch(`/api/completion-cycles?type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setCycleHistory(data.cycles || [])
      }
    } catch (error) {
      console.error('Error fetching cycle history:', error)
    } finally {
      setLoadingCycleHistory(false)
    }
  }

  function openCycleHistory(type: 'REVISION' | 'LECTURE') {
    setCycleHistoryType(type)
    setCycleHistoryOpen(true)
    fetchCycleHistory(type)
  }

  function startEditCycle(cycle: { id: string; completedAt: string; notes: string | null; hizbCount: number | null }) {
    setEditingCycleId(cycle.id)
    setEditCycleDate(new Date(cycle.completedAt).toISOString().split('T')[0])
    setEditCycleNotes(cycle.notes || '')
    setEditCycleHizbCount(cycle.hizbCount)
  }

  function cancelEditCycle() {
    setEditingCycleId(null)
    setEditCycleDate('')
    setEditCycleNotes('')
    setEditCycleHizbCount(null)
  }

  async function saveEditCycle() {
    if (!editingCycleId) return
    setSavingCycleEdit(true)
    try {
      const res = await fetch('/api/completion-cycles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCycleId,
          completedAt: editCycleDate,
          notes: editCycleNotes || null,
          hizbCount: editCycleHizbCount
        })
      })
      if (res.ok) {
        cancelEditCycle()
        fetchCycleHistory(cycleHistoryType)
        fetchStats()
        fetchStats()
        toast.success('Cycle modifié')
      } else {
        toast.error('Erreur lors de la modification')
      }
    } catch (error) {
      console.error('Error saving cycle edit:', error)
      toast.error('Erreur de connexion')
    } finally {
      setSavingCycleEdit(false)
    }
  }

  async function deleteCycle(id: string) {
    if (!confirm('Supprimer ce cycle ?')) return
    try {
      const res = await fetch(`/api/completion-cycles?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchCycleHistory(cycleHistoryType)
        fetchStats()
        toast.success('Cycle supprimé')
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting cycle:', error)
      toast.error('Erreur de connexion')
    }
  }

  function getProgramColor(code: string) {
    const colors: Record<string, string> = {
      MEMORIZATION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
      CONSOLIDATION: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      REVISION: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
      READING: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      TAFSIR: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
    }
    return colors[code] || 'bg-gray-100 text-gray-800'
  }

  const UNITS: Record<string, string> = {
    PAGE: 'Page(s)',
    QUART: 'Quart(s)',
    DEMI_HIZB: 'Demi-hizb',
    HIZB: 'Hizb',
    JUZ: 'Juz',
  }

  const UNITS_COMPACT: Record<string, string> = {
    PAGE: 'page',
    QUART: 'quart',
    DEMI_HIZB: '½ hizb',
    HIZB: 'hizb',
    JUZ: 'juz',
  }

  const PERIODS: Record<string, string> = {
    DAY: '/jour',
    WEEK: '/semaine',
    MONTH: '/mois',
    YEAR: '/an',
  }

  const PERIODS_COMPACT: Record<string, string> = {
    DAY: ' / jour',
    WEEK: ' / sem',
    MONTH: ' / mois',
    YEAR: ' / an',
  }

  function getObjectiveForProgram(programCode: string) {
    const item = stats?.objectivesVsRealized?.find(o => o.programCode === programCode)
    return item?.objective || null
  }

  function formatObjectiveCompact(obj: { quantity: number; unit: string; period: string } | null) {
    if (!obj) return null
    const unitLabel = UNITS_COMPACT[obj.unit] || obj.unit
    const periodLabel = PERIODS_COMPACT[obj.period] || ''
    // Pluralize if needed
    const unitText = obj.quantity > 1 && unitLabel === 'page' ? 'pages' : unitLabel
    return `${obj.quantity} ${unitText}${periodLabel}`
  }

  function formatQuantityUnit(quantity: number, unit: string) {
    return `${quantity} ${UNITS[unit] || unit}`
  }

  function formatObjective(obj: ObjectiveVsRealized['objective']) {
    if (!obj) return 'Non défini'
    return `${obj.quantity} ${UNITS[obj.unit] || obj.unit}${PERIODS[obj.period] || ''}`
  }

  function getCompletionStatus(item: ObjectiveVsRealized) {
    if (!item.objective) return 'none'
    if (!item.realized) return 'pending'
    if (item.realized.quantity >= item.objective.quantity && item.realized.unit === item.objective.unit) {
      return 'complete'
    }
    return 'partial'
  }

  function getPeriodLabel() {
    if (period === 'global') return 'Global (tout)'
    if (period === 'month') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`
    return `Année ${selectedYear}`
  }

  const PROGRAM_ORDER = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING', 'TAFSIR']

  const PROGRAM_TEXT_COLORS: Record<string, string> = {
    MEMORIZATION: 'text-emerald-600 dark:text-emerald-400',
    CONSOLIDATION: 'text-blue-600 dark:text-blue-400',
    REVISION: 'text-amber-600 dark:text-amber-400',
    READING: 'text-purple-600 dark:text-purple-400',
    TAFSIR: 'text-rose-600 dark:text-rose-400',
  }

  const CHART_COLORS = {
    MEMORIZATION: '#10b981',
    CONSOLIDATION: '#3b82f6',
    REVISION: '#f59e0b',
    READING: '#8b5cf6',
    TAFSIR: '#f43f5e',
  }

  // Transform surahStats into SegmentData[] for memorization
  const memorizationSegments: SegmentData[] = useMemo(() => {
    if (!surahStats?.surahs) return []
    return surahStats.surahs.map(s => ({
      id: s.number.toString(),
      label: `${s.number}. ${s.nameFr}`,
      labelAr: s.nameAr,
      status: s.programs.MEMORIZATION?.percentage >= 100
        ? 'completed' as const
        : s.programs.MEMORIZATION?.percentage > 0
          ? 'in_progress' as const
          : 'not_started' as const,
      percentage: s.programs.MEMORIZATION?.percentage || 0,
      totalItems: s.totalVerses,
      completedItems: s.programs.MEMORIZATION?.covered || 0,
    }))
  }, [surahStats])

  // Transform surahStats into SegmentData[] for tafsir
  const tafsirSegments: SegmentData[] = useMemo(() => {
    if (!surahStats?.surahs) return []
    return surahStats.surahs.map(s => ({
      id: s.number.toString(),
      label: `${s.number}. ${s.nameFr}`,
      labelAr: s.nameAr,
      status: s.programs.TAFSIR?.percentage >= 100
        ? 'completed' as const
        : s.programs.TAFSIR?.percentage > 0
          ? 'in_progress' as const
          : 'not_started' as const,
      percentage: s.programs.TAFSIR?.percentage || 0,
      totalItems: s.totalVerses,
      completedItems: s.programs.TAFSIR?.covered || 0,
    }))
  }, [surahStats])

  // Transform userBooks into SegmentData[] for book progress bar
  const bookSegments: SegmentData[] = useMemo(() => {
    if (!userBooks.length) return []
    return userBooks.map(b => ({
      id: b.id,
      label: b.title,
      labelAr: b.titleAr,
      status: b.percentage >= 100
        ? 'completed' as const
        : b.percentage > 0
          ? 'in_progress' as const
          : 'not_started' as const,
      percentage: b.percentage || 0,
      totalItems: b.totalItems,
      completedItems: b.completedItems || 0,
    }))
  }, [userBooks])

  // Calculate cursor position for memorization (last surah with data)
  const memorizationCursor = useMemo(() => {
    if (!memorizationSegments.length) return undefined
    let lastIdx = -1
    for (let i = memorizationSegments.length - 1; i >= 0; i--) {
      if (memorizationSegments[i].status !== 'not_started') {
        lastIdx = i
        break
      }
    }
    return lastIdx >= 0 ? lastIdx : undefined
  }, [memorizationSegments])

  // Fetch history for a surah
  const fetchSurahHistory = useCallback(async (segmentId: string) => {
    const res = await fetch(`/api/progress/history?surahNumber=${segmentId}&program=MEMORIZATION`)
    if (!res.ok) return []
    const data = await res.json()
    return data.entries
  }, [])

  const fetchTafsirHistory = useCallback(async (segmentId: string) => {
    const res = await fetch(`/api/progress/history?surahNumber=${segmentId}&program=TAFSIR`)
    if (!res.ok) return []
    const data = await res.json()
    return data.entries
  }, [])

  const statCards = [
    {
      title: t('dashboard.stats.totalVerses'),
      value: stats?.globalProgress?.memorizedVerses || 0,
      description: `sur ${stats?.globalProgress?.totalVerses || 6236} versets`,
      icon: BookOpen,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900',
    },
    {
      title: t('dashboard.stats.totalPages'),
      value: stats?.globalProgress?.memorizedPages || 0,
      description: `sur ${stats?.globalProgress?.totalPages || 604} pages`,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      title: 'Série quotidienne',
      value: stats?.dailyStreak || 0,
      description: 'jours consécutifs',
      icon: Flame,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900',
    },
    {
      title: 'Série hebdo',
      value: stats?.weeklyStreak || 0,
      description: 'semaines consécutives',
      icon: Award,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900',
    },
  ]

  const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  const PROGRAM_BG_COLORS: Record<string, string> = {
    MEMORIZATION: 'bg-emerald-500',
    CONSOLIDATION: 'bg-blue-500',
    REVISION: 'bg-amber-500',
    READING: 'bg-purple-500',
  }

  if (loading && !stats) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.overview')}</p>
        </div>
      </div>

      {/* Sticky Period Selector */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Type */}
          <div className="flex rounded-md border">
            {(['year', 'month', 'global'] as PeriodType[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'ghost'}
                size="sm"
                className={`h-8 px-3 rounded-none first:rounded-l-md last:rounded-r-md ${
                  period === p ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                }`}
                onClick={() => setPeriod(p)}
              >
                {p === 'year' ? 'Année' : p === 'month' ? 'Mois' : 'Global'}
              </Button>
            ))}
          </div>

          {/* Year Selector */}
          {period !== 'global' && (
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(stats?.availableYears || [new Date().getFullYear()]).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Month Selector */}
          {period === 'month' && (
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, idx) => (
                  <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Period Label */}
          <span className="text-sm text-muted-foreground ml-2">
            {getPeriodLabel()}
          </span>

          {/* Global User Selector (admin/referent) */}
          {manageableUsers.length > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={globalUserId} onValueChange={setGlobalUserId}>
                <SelectTrigger className="w-44 md:w-52 h-8">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {manageableUsers.map((user) => (
                    <SelectItem
                      key={user.id}
                      value={user.id}
                      disabled={user.isPrivate}
                      className={user.isPrivate ? 'text-muted-foreground' : ''}
                    >
                      <span className="flex items-center gap-2">
                        {user.isPrivate && <Lock className="h-3 w-3" />}
                        {user.isSelf
                          ? `Moi-même (${user.name || user.email})`
                          : user.isPrivate
                            ? `${user.name || user.email} - Privé`
                            : (user.name || user.email)
                        }
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Refresh Indicator */}
          {isRefreshing && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />
          )}
        </div>

        {/* Banner when viewing another user */}
        {!isViewingSelf && (
          <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <User className="h-4 w-4 shrink-0" />
            <span>Consultation des données de <strong>{globalUserName}</strong></span>
            {!globalCanEdit && (
              <Badge variant="secondary" className="ml-2">Lecture seule</Badge>
            )}
          </div>
        )}
      </div>

      {/* Inactivity Alerts (admin/referent only) */}
      {isViewingSelf && inactiveAlerts.length > 0 && (
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-orange-800 dark:text-orange-200">
              <AlertCircle className="h-5 w-5" />
              Élèves inactifs ({inactiveAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.userId}
                  className="flex items-center justify-between text-sm p-2 rounded bg-white/50 dark:bg-black/20"
                >
                  <div>
                    <span className="font-medium">{alert.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({alert.groupName})</span>
                  </div>
                  <Badge variant="outline" className="text-orange-700 dark:text-orange-300 border-orange-300">
                    {alert.weeksSinceActivity >= 999 ? 'Aucune activité' : `${alert.weeksSinceActivity} sem.`}
                  </Badge>
                </div>
              ))}
              {inactiveAlerts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  Et {inactiveAlerts.length - 5} autres...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mes Objectifs - Résumé compact */}
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-purple-600" />
              Mes Objectifs
            </CardTitle>
            {isViewingSelf && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-purple-600 hover:text-purple-700"
                onClick={() => window.location.href = `/${locale}/settings`}
              >
                Configurer
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {stats?.objectivesVsRealized?.map((item) => (
              <div
                key={item.programId}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  item.objective
                    ? 'bg-muted/50'
                    : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span className={`font-medium ${PROGRAM_TEXT_COLORS[item.programCode] || ''}`}>
                  {item.programName}:
                </span>
                {item.objective ? (
                  <span className="text-muted-foreground">
                    {item.objective.quantity} {UNITS[item.objective.unit] || item.objective.unit}{PERIODS[item.objective.period] || ''}
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    À définir
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Global Progress Bar */}
      <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 border-emerald-200 dark:border-emerald-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-emerald-600" />
            Mon Avancement Global - Mémorisation
          </CardTitle>
          <CardDescription>
            Progression dans la mémorisation du Coran
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-bold text-emerald-600 text-lg">
                {stats?.globalProgress?.percentage || 0}%
              </span>
            </div>
            {memorizationSegments.length > 0 ? (
              <SegmentedProgressBar
                segments={memorizationSegments}
                cursorPosition={memorizationCursor}
                mode="compact"
                colorScheme="memorization"
                onBarClick={() => window.location.href = `/${locale}/progress`}
              />
            ) : (
              <Progress
                value={stats?.globalProgress?.percentage || 0}
                className="h-4 bg-emerald-100 dark:bg-emerald-900"
              />
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats?.globalProgress?.memorizedPages || 0} pages</span>
              <span>{stats?.globalProgress?.memorizedSurahs || 0} sourates</span>
              <span>{stats?.globalProgress?.memorizedVerses || 0} versets</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Cette Semaine - Grille Programmes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              Programmes Journaliers
              {viewingOtherUser && (
                <Badge variant="outline" className="ml-1">{manageableUsers.find(u => u.id === selectedUserId)?.name || 'Autre'}</Badge>
              )}
              {viewingOtherUser && !weekGridCanEdit && (
                <Badge variant="secondary" className="ml-1">Lecture seule</Badge>
              )}
              {stats?.trend && stats.trend !== 'stable' && (
                <Badge variant="outline" className={`ml-auto ${
                  stats.trend === 'up' ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'
                }`}>
                  {stats.trend === 'up' ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                  {stats.trendPercentage > 0 ? '+' : ''}{stats.trendPercentage}%
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Week Navigation with Calendar */}
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => changeWeekOffset(-1)} disabled={loadingWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-auto py-1 px-3 flex flex-col items-center gap-0"
                    disabled={loadingWeek}
                  >
                    <span className="font-bold text-lg">S{weekNumber || stats?.weekNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {weekStartDate || stats?.weekStartDate
                        ? new Date(weekStartDate || stats?.weekStartDate || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: (weekYear || stats?.weekYear) !== new Date().getFullYear() ? '2-digit' : undefined })
                        : ''}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    showWeekNumber
                    locale={fr}
                    defaultMonth={selectedDate}
                    disabled={(date) => date > new Date()}
                    captionLayout="dropdown"
                    fromYear={2020}
                    toYear={new Date().getFullYear()}
                  />
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        resetToCurrentWeek()
                        setCalendarOpen(false)
                      }}
                    >
                      Aujourd'hui
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => changeWeekOffset(1)} disabled={loadingWeek || !canGoForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {loadingWeek && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <CardDescription>
            {viewingOtherUser && !weekGridCanEdit
              ? 'Consultation des données en lecture seule'
              : 'Cliquez pour marquer comme complété'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Banner if no objectives defined */}
          {stats?.objectivesVsRealized && !stats.objectivesVsRealized.some(o => o.objective) && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <Target className="h-4 w-4 shrink-0" />
              <span>Définissez vos objectifs dans <a href="/fr/settings" className="underline font-medium hover:text-amber-900">Paramètres</a> pour suivre votre progression</span>
            </div>
          )}
          {/* Week Grid */}
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-sm w-32">Programme</th>
                  {DAY_NAMES.map((day, i) => (
                    <th key={day} className={`text-center py-2 px-1 font-medium text-sm w-10 ${
                      i === new Date().getDay() ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded' : 'text-muted-foreground'
                    }`}>
                      {day}
                    </th>
                  ))}
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-sm w-16">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats?.weekProgramStats?.map((prog) => {
                  const gridRow = localWeekGrid[prog.code] || [false, false, false, false, false, false, false]
                  const completedCount = gridRow.filter(Boolean).length
                  const objective = getObjectiveForProgram(prog.code)
                  const objectiveText = formatObjectiveCompact(objective)
                  return (
                    <tr key={prog.code} className="border-b last:border-0">
                      <td className="py-3 px-2">
                        <div className="space-y-1">
                          <Badge className={getProgramColor(prog.code)}>{prog.name}</Badge>
                          <div className={`text-xs flex items-center gap-1 ${objective ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                            <Target className="h-3 w-3" />
                            <span className="font-medium">{objectiveText || '-'}</span>
                          </div>
                        </div>
                      </td>
                      {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                        const completed = gridRow[dayIndex] || false
                        const cellKey = `${prog.code}-${dayIndex}`
                        const isToggling = togglingWeekCell === cellKey
                        return (
                          <td key={dayIndex} className={`text-center py-2 px-1 ${
                            dayIndex === new Date().getDay() ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''
                          }`}>
                            <button
                              onClick={() => toggleWeekGridCell(prog.code, dayIndex)}
                              disabled={isToggling || !programsMap[prog.code] || (viewingOtherUser && !weekGridCanEdit)}
                              className={`p-1 rounded transition-all duration-200 hover:bg-muted/50 ${
                                isToggling ? 'opacity-50' : ''
                              } ${(!programsMap[prog.code] || (viewingOtherUser && !weekGridCanEdit)) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {isToggling ? (
                                <Loader2 className="h-5 w-5 text-emerald-600 mx-auto animate-spin" />
                              ) : completed ? (
                                <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground/30 mx-auto hover:text-muted-foreground" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                      <td className="text-center py-2 px-2">
                        <span className={`font-bold ${completedCount >= 5 ? 'text-emerald-600' : completedCount >= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {completedCount}/7
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {/* Weekly Objectives as optional rows */}
                {localWeeklyObjectives.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={9} className="pt-2 pb-1">
                        <div className="border-t border-dashed border-purple-200 dark:border-purple-800" />
                      </td>
                    </tr>
                    {localWeeklyObjectives.map((obj) => (
                      <tr key={obj.id} className="border-b last:border-0 bg-purple-50/30 dark:bg-purple-950/10">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-purple-500 shrink-0" />
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium truncate max-w-[100px]">
                              {obj.name}
                            </span>
                            {obj.isCustom && (
                              <span className="text-[10px] text-purple-400 dark:text-purple-500">*</span>
                            )}
                          </div>
                        </td>
                        <td colSpan={7} className="text-center py-1 px-1">
                          <span className="text-[10px] text-purple-400 dark:text-purple-500">objectif hebdo</span>
                        </td>
                        <td className="text-center py-1 px-2">
                          <button
                            onClick={() => toggleWeeklyObjective(obj.id)}
                            disabled={togglingObjective === obj.id || (!isViewingSelf && !globalCanEdit)}
                            className={`p-1 rounded transition-all duration-200 hover:bg-purple-100 dark:hover:bg-purple-900/30 ${
                              togglingObjective === obj.id ? 'opacity-50' : ''
                            } ${(!isViewingSelf && !globalCanEdit) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {togglingObjective === obj.id ? (
                              <Loader2 className="h-4 w-4 text-purple-600 mx-auto animate-spin" />
                            ) : obj.completed ? (
                              <CheckCircle className="h-4 w-4 text-purple-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-purple-300 mx-auto hover:text-purple-400" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats?.weekProgramStats?.map((prog) => (
              <div key={prog.code} className="text-center">
                <div className="text-2xl font-bold" style={{ color: CHART_COLORS[prog.code as keyof typeof CHART_COLORS] }}>
                  {prog.rate}%
                </div>
                <div className="text-xs text-muted-foreground">{prog.name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Programmes Journaliers - Stats Période */}
      {stats?.periodProgramStats && stats.periodProgramStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Programmes Journaliers - {getPeriodLabel()}
            </CardTitle>
            <CardDescription>
              Taux de complétion par programme sur la période
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.periodProgramStats.map((prog) => (
                <div key={prog.code} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={getProgramColor(prog.code)}>{prog.name}</Badge>
                    <span className="text-sm">
                      <span className="font-bold">{prog.daysCompleted}</span>
                      <span className="text-muted-foreground">/{prog.totalDays} jours</span>
                      <span className={`ml-2 font-bold ${prog.rate >= 70 ? 'text-emerald-600' : prog.rate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        ({prog.rate}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${PROGRAM_BG_COLORS[prog.code] || 'bg-gray-500'}`}
                      style={{ width: `${prog.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cycles de Complétion (Révision & Lecture) */}
      <Card className="border-2 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            Cycles de Complétion
          </CardTitle>
          <CardDescription>
            Suivi des révisions et lectures complètes du Coran
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Révision */}
            <div
              className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
              onClick={() => openCycleHistory('REVISION')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">Révision</span>
                </div>
                {isViewingSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); openCycleDialog('REVISION'); }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Ajouter
                  </Button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cycles terminés</span>
                  <span className="font-bold text-lg">{stats?.completionCycles?.revision?.totalCycles || 0}</span>
                </div>
                {stats?.completionCycles?.revision?.lastHizbCount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dernier cycle</span>
                    <span className="font-medium text-blue-600">{stats.completionCycles.revision.lastHizbCount} Hizbs</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{stats?.completionCycles?.revision?.lastHizbCount ? 'Date' : 'Dernier cycle'}</span>
                  <span className="font-medium">
                    {stats?.completionCycles?.revision?.lastDate
                      ? new Date(stats.completionCycles.revision.lastDate).toLocaleDateString('fr-FR')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jours depuis</span>
                  <span className={`font-bold ${
                    (stats?.completionCycles?.revision?.daysSinceLast || 0) > 30
                      ? 'text-red-600'
                      : (stats?.completionCycles?.revision?.daysSinceLast || 0) > 14
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}>
                    {stats?.completionCycles?.revision?.daysSinceLast ?? '-'} j
                  </span>
                </div>
                {stats?.completionCycles?.revision?.averageDays && stats.completionCycles.revision.averageDays > 0 && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Moyenne</span>
                    <span className="font-medium">{stats.completionCycles.revision.averageDays} jours</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground mt-3 pt-2 border-t">
                Cliquez pour voir l'historique
              </p>
            </div>

            {/* Lecture */}
            <div
              className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
              onClick={() => openCycleHistory('LECTURE')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookMarked className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-800 dark:text-purple-200">Lecture</span>
                </div>
                {isViewingSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); openCycleDialog('LECTURE'); }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Ajouter
                  </Button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cycles terminés</span>
                  <span className="font-bold text-lg">{stats?.completionCycles?.lecture?.totalCycles || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dernier cycle</span>
                  <span className="font-medium">
                    {stats?.completionCycles?.lecture?.lastDate
                      ? new Date(stats.completionCycles.lecture.lastDate).toLocaleDateString('fr-FR')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jours depuis</span>
                  <span className={`font-bold ${
                    (stats?.completionCycles?.lecture?.daysSinceLast || 0) > 60
                      ? 'text-red-600'
                      : (stats?.completionCycles?.lecture?.daysSinceLast || 0) > 30
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}>
                    {stats?.completionCycles?.lecture?.daysSinceLast ?? '-'} j
                  </span>
                </div>
                {stats?.completionCycles?.lecture?.averageDays && stats.completionCycles.lecture.averageDays > 0 && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Moyenne</span>
                    <span className="font-medium">{stats.completionCycles.lecture.averageDays} jours</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground mt-3 pt-2 border-t">
                Cliquez pour voir l'historique
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tafsir Coverage */}
      <Card className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-rose-600" />
            Mon Avancement Global - Tafsir
          </CardTitle>
          <CardDescription>
            Versets étudiés avec explication (Tafsir)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-bold text-rose-600 text-lg">{stats?.tafsirCoverage?.percentage || 0}%</span>
            </div>
            {tafsirSegments.length > 0 ? (
              <SegmentedProgressBar
                segments={tafsirSegments}
                mode="compact"
                colorScheme="tafsir"
                onBarClick={() => window.location.href = `/${locale}/tafsir`}
              />
            ) : (
              <Progress value={stats?.tafsirCoverage?.percentage || 0} className="h-3" />
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats?.tafsirCoverage?.coveredVerses || 0} versets</span>
              <span>{stats?.tafsirCoverage?.completedSurahs || 0} sourates</span>
              <span>6236 total</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 40 Hadiths Nawawi */}
      {(() => {
        const nawawi = userBooks.find(b => b.sourceRef === 'nawawi40')
        if (!nawawi) return null
        return (
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-amber-600" />
                40 Hadiths An-Nawawi
              </CardTitle>
              <CardDescription>
                Progression dans la mémorisation des hadiths
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-bold text-amber-600 text-lg">{nawawi.percentage || 0}%</span>
                </div>
                <div className="h-3 bg-amber-100 dark:bg-amber-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                    style={{ width: `${nawawi.percentage || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{nawawi.completedItems || 0} hadiths mémorisés</span>
                  <span>{nawawi.totalItems} total</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Mes Livres */}
      {bookSegments.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Library className="h-5 w-5 text-blue-600" />
              Mes Livres
            </CardTitle>
            <CardDescription>
              Progression dans les livres d'étude
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {userBooks.filter(b => (b.percentage || 0) >= 100).length}/{userBooks.length} livres complétés
                </span>
                <span className="font-bold text-blue-600 text-lg">
                  {userBooks.length > 0
                    ? Math.round(userBooks.reduce((sum, b) => sum + (b.percentage || 0), 0) / userBooks.length)
                    : 0}%
                </span>
              </div>
              <SegmentedProgressBar
                segments={bookSegments}
                mode="compact"
                colorScheme="book"
                onBarClick={() => window.location.href = `/${locale}/books`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {userBooks.slice(0, 3).map(b => (
                  <span key={b.id} className="truncate max-w-[30%]">{b.title}: {b.percentage}%</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avancement par Sourate */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                Avancement par Sourate
              </CardTitle>
              <CardDescription>
                Progression détaillée des 114 sourates
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSurahsExpanded(!surahsExpanded)}
            >
              {surahsExpanded ? 'Réduire' : 'Voir tout'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Program tabs - only MEMORIZATION and TAFSIR (CONSOLIDATION is tracked by attendance only) */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {['MEMORIZATION', 'TAFSIR'].map(code => (
              <Button
                key={code}
                variant={selectedSurahProgram === code ? 'default' : 'outline'}
                size="sm"
                className={selectedSurahProgram === code ? getProgramColor(code).replace('bg-', 'bg-').replace('text-', '') : ''}
                onClick={() => setSelectedSurahProgram(code)}
              >
                {code === 'MEMORIZATION' && 'Mémorisation'}
                {code === 'TAFSIR' && 'Tafsir'}
              </Button>
            ))}
          </div>

          {/* Total for selected program */}
          {surahStats?.totals && (
            <div className="mb-4 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Total {selectedSurahProgram === 'MEMORIZATION' ? 'Mémorisation' : selectedSurahProgram === 'CONSOLIDATION' ? 'Consolidation' : 'Tafsir'}</span>
                <span className="font-bold text-lg" style={{ color: CHART_COLORS[selectedSurahProgram as keyof typeof CHART_COLORS] }}>
                  {surahStats.totals[selectedSurahProgram]?.percentage || 0}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${surahStats.totals[selectedSurahProgram]?.percentage || 0}%`,
                    backgroundColor: CHART_COLORS[selectedSurahProgram as keyof typeof CHART_COLORS]
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {surahStats.totals[selectedSurahProgram]?.covered || 0} / 6236 versets
              </p>
            </div>
          )}

          {/* Surah list */}
          {surahStats?.surahs && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(surahsExpanded ? surahStats.surahs : surahStats.surahs.slice(0, 10)).map(surah => {
                const progress = surah.programs[selectedSurahProgram]
                return (
                  <div key={surah.number} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                    {/* Numéro de sourate - badge circulaire */}
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-foreground">
                        {surah.number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">
                          <span className="text-muted-foreground">{surah.nameAr}</span>
                          <span className="mx-1">-</span>
                          {surah.nameFr}
                        </span>
                        <span className="text-xs ml-2 whitespace-nowrap">
                          <span className="font-medium" style={{ color: CHART_COLORS[selectedSurahProgram as keyof typeof CHART_COLORS] }}>
                            {progress?.covered || 0}
                          </span>
                          <span className="text-muted-foreground">/{surah.totalVerses} v.</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${progress?.percentage || 0}%`,
                            backgroundColor: CHART_COLORS[selectedSurahProgram as keyof typeof CHART_COLORS]
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-12 text-right text-sm font-bold" style={{ color: CHART_COLORS[selectedSurahProgram as keyof typeof CHART_COLORS] }}>
                      {progress?.percentage || 0}%
                    </span>
                  </div>
                )
              })}
              {!surahsExpanded && surahStats.surahs.length > 10 && (
                <Button
                  variant="ghost"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => setSurahsExpanded(true)}
                >
                  Voir les {surahStats.surahs.length - 10} autres sourates...
                </Button>
              )}
            </div>
          )}

          {!surahStats && (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              Chargement...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classement Groupe */}
      {groupRanking?.groups && groupRanking.groups.length > 0 && (
        <Card className="border-2 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              Classement Groupe - Mémorisation
            </CardTitle>
            <CardDescription>
              Challenge entre membres du groupe
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupRanking.groups.map(group => (
              <div key={group.groupId} className="mb-6 last:mb-0">
                {groupRanking.groups.length > 1 && (
                  <h4 className="font-medium text-sm text-muted-foreground mb-3">{group.groupName}</h4>
                )}
                <div className="space-y-2">
                  {group.members.slice(0, 10).map((member, index) => {
                    const isCurrentUser = groupRanking.groups[0]?.members.find(m => m.rank === group.currentUserRank)?.userId === member.userId
                    return (
                      <div
                        key={member.userId}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          isCurrentUser
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800'
                            : 'bg-muted/30'
                        }`}
                      >
                        {/* Rank medal */}
                        <div className="w-8 text-center">
                          {member.rank === 1 && <span className="text-2xl">🥇</span>}
                          {member.rank === 2 && <span className="text-2xl">🥈</span>}
                          {member.rank === 3 && <span className="text-2xl">🥉</span>}
                          {member.rank > 3 && (
                            <span className="text-lg font-bold text-muted-foreground">#{member.rank}</span>
                          )}
                        </div>

                        {/* Avatar or initial */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          member.rank === 1 ? 'bg-amber-500' :
                          member.rank === 2 ? 'bg-gray-400' :
                          member.rank === 3 ? 'bg-amber-700' :
                          'bg-emerald-500'
                        }`}>
                          {member.image ? (
                            <img src={member.image} alt={member.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        {/* Name and stats */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isCurrentUser ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                            {member.name}
                            {isCurrentUser && <span className="ml-2 text-xs text-emerald-600">(Vous)</span>}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{member.memorizedJuz} juz</span>
                            <span>{member.memorizedPages} pages</span>
                            <span>{member.memorizedVerses} versets</span>
                          </div>
                        </div>

                        {/* Percentage */}
                        <div className="text-right">
                          <span className={`text-lg font-bold ${
                            member.rank === 1 ? 'text-amber-600' :
                            member.rank === 2 ? 'text-gray-500' :
                            member.rank === 3 ? 'text-amber-700' :
                            'text-emerald-600'
                          }`}>
                            {member.percentage}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {group.totalMembers > 10 && (
                  <p className="text-sm text-muted-foreground text-center mt-3">
                    Et {group.totalMembers - 10} autres membres...
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Assiduité Programmes - Résumé */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Assiduité Programmes
              </CardTitle>
              <CardDescription>
                Taux de réalisation par programme
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `/${locale}/attendance`}
            >
              Voir détails
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Période summary */}
          <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-muted/30">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {stats?.weekProgramStats?.reduce((sum, p) => sum + p.rate, 0)
                  ? Math.round((stats.weekProgramStats.reduce((sum, p) => sum + p.rate, 0) / stats.weekProgramStats.length))
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Cette semaine</p>
            </div>
            <div className="text-center border-x">
              <p className="text-2xl font-bold text-purple-600">
                {stats?.periodProgramStats?.length && period === 'month'
                  ? Math.round(stats.periodProgramStats.reduce((sum, p) => sum + p.rate, 0) / stats.periodProgramStats.length)
                  : '-'}%
              </p>
              <p className="text-xs text-muted-foreground">Ce mois</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {stats?.periodProgramStats?.length && period === 'year'
                  ? Math.round(stats.periodProgramStats.reduce((sum, p) => sum + p.rate, 0) / stats.periodProgramStats.length)
                  : '-'}%
              </p>
              <p className="text-xs text-muted-foreground">Cette année</p>
            </div>
          </div>

          {/* Programme breakdown */}
          <div className="space-y-3">
            {stats?.weekProgramStats?.map((prog) => {
              const periodProg = stats?.periodProgramStats?.find(p => p.code === prog.code)
              return (
                <div key={prog.code} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <Badge className={getProgramColor(prog.code)}>{prog.name}</Badge>
                    <div className="flex items-center gap-3 text-xs">
                      <span title="Cette semaine">
                        <span className="font-bold text-blue-600">{prog.rate}%</span>
                        <span className="text-muted-foreground ml-1">sem</span>
                      </span>
                      {periodProg && (
                        <span title={period === 'month' ? 'Ce mois' : 'Cette année'}>
                          <span className="font-bold text-purple-600">{periodProg.rate}%</span>
                          <span className="text-muted-foreground ml-1">{period === 'month' ? 'mois' : 'an'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${PROGRAM_BG_COLORS[prog.code] || 'bg-gray-500'}`}
                      style={{ width: `${prog.rate}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Évolution sur 12 semaines
          </CardTitle>
          <CardDescription>
            Pages travaillées par programme (toutes activités confondues)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.evolutionData && stats.evolutionData.some(d => d.total > 0) ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-2">{label}</p>
                            {payload.map((entry, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span>{entry.name}: {Number(entry.value).toFixed(1)} pages</span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="MEMORIZATION" name="Mémorisation" stackId="1" stroke={CHART_COLORS.MEMORIZATION} fill={CHART_COLORS.MEMORIZATION} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="CONSOLIDATION" name="Consolidation" stackId="1" stroke={CHART_COLORS.CONSOLIDATION} fill={CHART_COLORS.CONSOLIDATION} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="REVISION" name="Révision" stackId="1" stroke={CHART_COLORS.REVISION} fill={CHART_COLORS.REVISION} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="READING" name="Lecture" stackId="1" stroke={CHART_COLORS.READING} fill={CHART_COLORS.READING} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="TAFSIR" name="Tafsir" stackId="1" stroke={CHART_COLORS.TAFSIR} fill={CHART_COLORS.TAFSIR} fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Pas encore de données d'activité
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Progression par programme - {getPeriodLabel()}
          </CardTitle>
          <CardDescription>Versets travaillés</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.progressByProgram && Object.keys(stats.progressByProgram).length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PROGRAM_ORDER
                .filter(code => stats.progressByProgram[code] !== undefined)
                .map(code => (
                  <div key={code} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <Badge className={getProgramColor(code)}>
                      {code === 'MEMORIZATION' && 'Mémorisation'}
                      {code === 'CONSOLIDATION' && 'Consolidation'}
                      {code === 'REVISION' && 'Révision'}
                      {code === 'READING' && 'Lecture'}
                      {code === 'TAFSIR' && 'Tafsir'}
                    </Badge>
                    <span className={`font-bold text-lg ${PROGRAM_TEXT_COLORS[code] || 'text-emerald-600'}`}>
                      {stats.progressByProgram[code]}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              Aucune activité - {getPeriodLabel()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Progress */}
      <Card>
        <CardHeader>
          <CardTitle>{t('progress.title')}</CardTitle>
          <CardDescription>Vos dernières entrées - {getPeriodLabel()}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentProgress && stats.recentProgress.length > 0 ? (
            <div className="space-y-3">
              {stats.recentProgress.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge className={getProgramColor(entry.program.code)}>
                      {entry.program.nameFr}
                    </Badge>
                    <div>
                      <span className="font-medium">{entry.surah.nameFr}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        v.{entry.verseStart}-{entry.verseEnd}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              {t('progress.noEntries')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cycle Completion Dialog */}
      <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {cycleType === 'REVISION' ? 'Fin de cycle Révision' : 'Fin de cycle Lecture'}
            </DialogTitle>
            <DialogDescription>
              {cycleType === 'REVISION'
                ? 'Enregistrez la fin d\'une boucle complète de révision (de la Fatiha au dernier Hizb mémorisé)'
                : 'Enregistrez la fin d\'une lecture complète du Coran'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Date de complétion</Label>
              <Input
                type="date"
                value={cycleDate}
                onChange={(e) => setCycleDate(e.target.value)}
              />
            </div>

            {/* HizbCount input for REVISION only */}
            {cycleType === 'REVISION' && (
              <>
                {needsMemorizationInput ? (
                  <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Aucune donnée de mémorisation trouvée. Veuillez indiquer votre position actuelle ou le nombre de Hizbs.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Sourate</Label>
                        <Input
                          type="number"
                          min={1}
                          max={114}
                          value={memorizationSurah || ''}
                          onChange={(e) => setMemorizationSurah(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="1-114"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Verset</Label>
                        <Input
                          type="number"
                          min={1}
                          value={memorizationVerse || ''}
                          onChange={(e) => setMemorizationVerse(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="N° verset"
                        />
                      </div>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">ou</div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre de Hizbs directement</Label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={cycleHizbCount || ''}
                        onChange={(e) => setCycleHizbCount(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="1-60"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Nombre de Hizbs (optionnel)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={cycleHizbCount || ''}
                      onChange={(e) => setCycleHizbCount(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="Calculé automatiquement si vide"
                    />
                    <p className="text-xs text-muted-foreground">
                      Laissez vide pour calculer depuis votre avancement en mémorisation
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Input
                value={cycleNotes}
                onChange={(e) => setCycleNotes(e.target.value)}
                placeholder={cycleType === 'REVISION' ? 'Ex: Bonne révision, fluide...' : 'Ex: Lecture complète...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCycleDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveCycle}
              disabled={cycleSaving || (needsMemorizationInput && !cycleHizbCount && (!memorizationSurah || !memorizationVerse))}
              className={cycleType === 'REVISION' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}
            >
              {cycleSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cycle History Dialog */}
      <Dialog open={cycleHistoryOpen} onOpenChange={setCycleHistoryOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cycleHistoryType === 'REVISION' ? (
                <>
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  Historique Révision
                </>
              ) : (
                <>
                  <BookMarked className="h-5 w-5 text-purple-600" />
                  Historique Lecture
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {cycleHistory.length} cycle{cycleHistory.length > 1 ? 's' : ''} terminé{cycleHistory.length > 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {loadingCycleHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : cycleHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun cycle terminé
              </div>
            ) : (
              <div className="space-y-3">
                {cycleHistory.map((cycle, index) => (
                  <div
                    key={cycle.id}
                    className={`p-3 rounded-lg border ${
                      cycleHistoryType === 'REVISION'
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                        : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
                    }`}
                  >
                    {editingCycleId === cycle.id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-16">Date:</span>
                          <Input
                            type="date"
                            value={editCycleDate}
                            onChange={(e) => setEditCycleDate(e.target.value)}
                            className="h-8 flex-1"
                          />
                        </div>
                        {cycleHistoryType === 'REVISION' && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium w-16">Hizbs:</span>
                            <Input
                              type="number"
                              min={1}
                              max={60}
                              value={editCycleHizbCount || ''}
                              onChange={(e) => setEditCycleHizbCount(e.target.value ? parseInt(e.target.value) : null)}
                              placeholder="1-60"
                              className="h-8 flex-1"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-16">Notes:</span>
                          <Input
                            value={editCycleNotes}
                            onChange={(e) => setEditCycleNotes(e.target.value)}
                            placeholder="Notes optionnelles"
                            className="h-8 flex-1"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditCycle}
                            disabled={savingCycleEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveEditCycle}
                            disabled={savingCycleEdit}
                            className={cycleHistoryType === 'REVISION' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}
                          >
                            {savingCycleEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <span className="font-medium">
                              #{cycleHistory.length - index}
                            </span>
                            {cycleHistoryType === 'REVISION' && cycle.hizbCount && (
                              <Badge className="bg-blue-600 text-white text-xs">
                                {cycle.hizbCount} Hizbs
                              </Badge>
                            )}
                            <span className="text-sm">
                              {new Date(cycle.completedAt).toLocaleDateString('fr-FR', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            {cycle.daysToComplete && cycle.daysToComplete > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {cycle.daysToComplete} jours
                              </Badge>
                            )}
                          </div>
                          {cycle.notes && (
                            <p className="text-sm text-muted-foreground italic">
                              {cycle.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEditCycle(cycle)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteCycle(cycle.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCycleHistoryOpen(false)
                openCycleDialog(cycleHistoryType)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un cycle
            </Button>
            <Button variant="ghost" onClick={() => setCycleHistoryOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}