'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TrendingUp, Plus, Pencil, Trash2, BookOpen, ArrowRight, User, Lock, Library, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { SegmentedProgressBar, SegmentData } from '@/components/segmented-progress-bar'

interface Program {
  id: string
  code: string
  nameAr: string
  nameFr: string
  nameEn: string
}

interface Surah {
  number: number
  nameAr: string
  nameFr: string
  nameEn: string
  totalVerses: number
}

interface ProgressEntry {
  id: string
  programId: string
  date: string
  surahNumber: number
  verseStart: number
  verseEnd: number
  repetitions: number | null
  comment: string | null
  program: Program
  surah: Surah
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

interface SurahStatsData {
  surahs: Array<{
    number: number
    nameFr: string
    nameAr: string
    totalVerses: number
    programs: Record<string, { covered: number; percentage: number }>
    overallPercentage: number
  }>
  totals: Record<string, { covered: number; percentage: number }>
}

interface UserBook {
  id: string
  title: string
  titleAr?: string
  author?: string
  type: string
  discipline: string
  totalItems: number
  completedItems?: number
  percentage?: number
}

interface BookChapter {
  id: string
  title: string
  titleAr?: string
  chapterNumber: number
  depth: number
  totalItems: number
  _count: { items: number }
  children?: BookChapter[]
}

interface BookItemData {
  id: string
  itemNumber: number
  title?: string
  textAr?: string
  textFr?: string
  textEn?: string
  userProgress: {
    completed: boolean
    completedAt?: string
  } | null
}

interface TafsirCoverage {
  global: {
    totalVerses: number
    coveredVerses: number
    percentage: number
    completedSurahs: number
    inProgressSurahs: number
    totalSurahs: number
  }
  allSurahs: Array<{
    surahNumber: number
    surahName: string
    surahNameAr: string
    totalVerses: number
    coveredVerses: number
    percentage: number
    isComplete: boolean
    entries: { id: string; date: string; verseStart: number; verseEnd: number }[]
  }>
}

export default function ProgressPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [entries, setEntries] = useState<ProgressEntry[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterProgram, setFilterProgram] = useState<string>('all')
  const [filterSurah, setFilterSurah] = useState<string>('all')

  // User selector
  const [manageableUsers, setManageableUsers] = useState<ManageableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  // Tafsir coverage + surah stats
  const [tafsirData, setTafsirData] = useState<TafsirCoverage | null>(null)
  const [surahStatsData, setSurahStatsData] = useState<SurahStatsData | null>(null)

  // Books section
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [openBookIds, setOpenBookIds] = useState<Set<string>>(new Set())
  const [bookChapters, setBookChapters] = useState<Record<string, BookChapter[]>>({})
  const [bookChapterProgress, setBookChapterProgress] = useState<Record<string, Record<string, number>>>({})
  const [bookChapterItems, setBookChapterItems] = useState<Record<string, BookItemData[]>>({})
  const [openChapterIds, setOpenChapterIds] = useState<Set<string>>(new Set())
  const [loadingBookIds, setLoadingBookIds] = useState<Set<string>>(new Set())
  const [loadingChapterIds, setLoadingChapterIds] = useState<Set<string>>(new Set())
  const [togglingItemIds, setTogglingItemIds] = useState<Set<string>>(new Set())

  // Form state
  const [selectedProgram, setSelectedProgram] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedSurah, setSelectedSurah] = useState('')
  const [verseStart, setVerseStart] = useState('')
  const [verseEnd, setVerseEnd] = useState('')
  const [comment, setComment] = useState('')

  // Load manageable users on mount
  useEffect(() => {
    async function init() {
      try {
        const [usersRes, progRes, surahRes] = await Promise.all([
          fetch('/api/users/manageable?dataType=progress'),
          fetch('/api/programs'),
          fetch('/api/surahs'),
        ])
        const users = await usersRes.json()
        const progData = await progRes.json()
        const surahData = await surahRes.json()
        setManageableUsers(Array.isArray(users) ? users : [])
        setPrograms(Array.isArray(progData) ? progData : [])
        setSurahs(Array.isArray(surahData) ? surahData : [])
        const selfUser = (users as ManageableUser[]).find(u => u.isSelf)
        if (selfUser) {
          setSelectedUserId(selfUser.id)
        }
      } catch (error) {
        console.error('Error initializing:', error)
        setLoading(false)
      }
    }
    init()
  }, [])

  // Reload data when selectedUserId changes
  useEffect(() => {
    if (selectedUserId) {
      fetchData()
      fetchUserBooks()
    }
  }, [selectedUserId])

  async function fetchData() {
    try {
      const [entRes, tafsirRes, surahStatsRes] = await Promise.all([
        fetch(`/api/progress?userId=${selectedUserId}&limit=500`),
        fetch('/api/tafsir'),
        fetch('/api/stats/surahs'),
      ])
      const entData = await entRes.json()
      setEntries(Array.isArray(entData) ? entData : [])
      if (tafsirRes.ok) {
        setTafsirData(await tafsirRes.json())
      }
      if (surahStatsRes.ok) {
        setSurahStatsData(await surahStatsRes.json())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Books functions
  async function fetchUserBooks() {
    try {
      const res = await fetch('/api/user/books')
      if (res.ok) setUserBooks(await res.json())
    } catch (e) {
      console.error('Error fetching user books:', e)
    }
  }

  async function toggleBook(bookId: string) {
    const isOpen = openBookIds.has(bookId)
    const next = new Set(openBookIds)
    if (isOpen) {
      next.delete(bookId)
      setOpenBookIds(next)
      return
    }
    next.add(bookId)
    setOpenBookIds(next)

    // Load chapters if not yet loaded
    if (!bookChapters[bookId]) {
      setLoadingBookIds(prev => new Set(prev).add(bookId))
      try {
        const [bookRes, progressRes] = await Promise.all([
          fetch(`/api/books/${bookId}`),
          fetch(`/api/books/${bookId}/progress`),
        ])
        if (bookRes.ok) {
          const data = await bookRes.json()
          setBookChapters(prev => ({ ...prev, [bookId]: data.chapters }))
        }
        if (progressRes.ok) {
          const data = await progressRes.json()
          setBookChapterProgress(prev => ({ ...prev, [bookId]: data.chapterProgress || {} }))
        }
      } catch (e) {
        console.error('Error loading book chapters:', e)
      } finally {
        setLoadingBookIds(prev => { const n = new Set(prev); n.delete(bookId); return n })
      }
    }
  }

  async function toggleChapterOpen(bookId: string, chapterId: string) {
    const isOpen = openChapterIds.has(chapterId)
    const next = new Set(openChapterIds)
    if (isOpen) {
      next.delete(chapterId)
      setOpenChapterIds(next)
      return
    }
    next.add(chapterId)
    setOpenChapterIds(next)

    // Load items if not yet loaded
    if (!bookChapterItems[chapterId]) {
      setLoadingChapterIds(prev => new Set(prev).add(chapterId))
      try {
        const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/items`)
        if (res.ok) {
          const items = await res.json()
          setBookChapterItems(prev => ({ ...prev, [chapterId]: items }))
        }
      } catch (e) {
        console.error('Error loading chapter items:', e)
      } finally {
        setLoadingChapterIds(prev => { const n = new Set(prev); n.delete(chapterId); return n })
      }
    }
  }

  async function toggleBookItem(bookId: string, chapterId: string, itemId: string, completed: boolean) {
    setTogglingItemIds(prev => new Set(prev).add(itemId))
    try {
      await fetch(`/api/books/${bookId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [itemId], completed }),
      })
      // Update local item state
      setBookChapterItems(prev => ({
        ...prev,
        [chapterId]: (prev[chapterId] || []).map(item =>
          item.id === itemId
            ? { ...item, userProgress: { completed, completedAt: completed ? new Date().toISOString() : undefined } }
            : item
        ),
      }))
      // Update chapter progress
      setBookChapterProgress(prev => {
        const bookProg = { ...(prev[bookId] || {}) }
        bookProg[chapterId] = (bookProg[chapterId] || 0) + (completed ? 1 : -1)
        return { ...prev, [bookId]: bookProg }
      })
      // Update book-level progress
      setUserBooks(prev => prev.map(b => {
        if (b.id !== bookId) return b
        const newCompleted = (b.completedItems || 0) + (completed ? 1 : -1)
        return {
          ...b,
          completedItems: Math.max(0, newCompleted),
          percentage: b.totalItems > 0 ? Math.round((Math.max(0, newCompleted) / b.totalItems) * 100) : 0,
        }
      }))
    } catch (e) {
      console.error('Error toggling book item:', e)
    } finally {
      setTogglingItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
    }
  }

  async function toggleBookChapterAll(bookId: string, chapterId: string, completed: boolean) {
    const items = bookChapterItems[chapterId]
    if (!items) return
    const itemIds = items.map(i => i.id)
    const changedCount = items.filter(i => (i.userProgress?.completed || false) !== completed).length
    try {
      await fetch(`/api/books/${bookId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, completed }),
      })
      setBookChapterItems(prev => ({
        ...prev,
        [chapterId]: prev[chapterId].map(item => ({
          ...item,
          userProgress: { completed, completedAt: completed ? new Date().toISOString() : undefined },
        })),
      }))
      setBookChapterProgress(prev => {
        const bookProg = { ...(prev[bookId] || {}) }
        const total = items.length
        bookProg[chapterId] = completed ? total : 0
        return { ...prev, [bookId]: bookProg }
      })
      setUserBooks(prev => prev.map(b => {
        if (b.id !== bookId) return b
        const delta = completed ? changedCount : -changedCount
        const newCompleted = Math.max(0, (b.completedItems || 0) + delta)
        return {
          ...b,
          completedItems: newCompleted,
          percentage: b.totalItems > 0 ? Math.round((newCompleted / b.totalItems) * 100) : 0,
        }
      }))
    } catch (e) {
      console.error('Error toggling chapter:', e)
    }
  }

  function resetForm() {
    setSelectedProgram('')
    setSelectedDate(new Date().toISOString().split('T')[0])
    setSelectedSurah('')
    setVerseStart('')
    setVerseEnd('')
    setComment('')
    setEditingId(null)
  }

  function openEditDialog(entry: ProgressEntry) {
    setEditingId(entry.id)
    setSelectedProgram(entry.programId)
    setSelectedDate(entry.date.split('T')[0])
    setSelectedSurah(entry.surahNumber.toString())
    setVerseStart(entry.verseStart.toString())
    setVerseEnd(entry.verseEnd.toString())
    setComment(entry.comment || '')
    setDialogOpen(true)
  }

  const selectedSurahData = surahs.find(s => s.number === parseInt(selectedSurah))

  async function handleSubmit() {
    if (!selectedProgram || !selectedSurah || !verseStart || !verseEnd) return

    const payload = {
      programId: selectedProgram,
      date: selectedDate,
      surahNumber: parseInt(selectedSurah),
      verseStart: parseInt(verseStart),
      verseEnd: parseInt(verseEnd),
      comment: comment || null,
    }

    try {
      const url = editingId ? `/api/progress/${editingId}` : '/api/progress'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await fetchData()
        setDialogOpen(false)
        resetForm()
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur')
      }
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette entrée ?')) return

    try {
      const res = await fetch(`/api/progress/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error deleting progress:', error)
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

  const filteredEntries = entries.filter(e => {
    if (filterProgram !== 'all' && e.programId !== filterProgram) return false
    if (filterSurah !== 'all' && e.surahNumber.toString() !== filterSurah) return false
    return true
  })

  const totalVerses = filteredEntries.reduce((sum, e) => sum + (e.verseEnd - e.verseStart + 1), 0)

  // Check if currently filtering on TAFSIR
  const isTafsirFilter = useMemo(() => {
    if (filterProgram === 'all') return false
    const prog = programs.find(p => p.id === filterProgram)
    return prog?.code === 'TAFSIR'
  }, [filterProgram, programs])

  // Tafsir segments for SegmentedProgressBar
  const tafsirSegments: SegmentData[] = useMemo(() => {
    if (!tafsirData?.allSurahs) return []
    return tafsirData.allSurahs.map(s => ({
      id: s.surahNumber.toString(),
      label: `${s.surahNumber}. ${s.surahName}`,
      labelAr: s.surahNameAr,
      status: s.isComplete
        ? 'completed' as const
        : s.coveredVerses > 0
          ? 'in_progress' as const
          : 'not_started' as const,
      percentage: s.percentage,
      totalItems: s.totalVerses,
      completedItems: s.coveredVerses,
    }))
  }, [tafsirData?.allSurahs])

  // Memorization segments from /api/stats/surahs (accurate, all entries)
  const memorizationSegments: SegmentData[] = useMemo(() => {
    if (!surahStatsData?.surahs) return []
    return surahStatsData.surahs.map(s => ({
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
  }, [surahStatsData])

  const fetchProgressHistory = useCallback(async (segmentId: string) => {
    const program = isTafsirFilter ? 'TAFSIR' : 'MEMORIZATION'
    const res = await fetch(`/api/progress/history?surahNumber=${segmentId}&program=${program}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.entries
  }, [isTafsirFilter])

  const isViewingSelf = manageableUsers.find(u => u.id === selectedUserId)?.isSelf ?? true
  const canEdit = isViewingSelf || manageableUsers.find(u => u.id === selectedUserId)?.canEdit

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('progress.title')}</h1>
          <p className="text-muted-foreground">
            {manageableUsers.find(u => u.id === selectedUserId)?.isSelf
              ? 'Enregistrez votre avancement quotidien'
              : `Avancement de ${manageableUsers.find(u => u.id === selectedUserId)?.name || 'Utilisateur'}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* User Selector */}
          {manageableUsers.length > 1 && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Selectionner" />
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
                          ? `Moi-meme (${user.name || user.email})`
                          : user.isPrivate
                            ? `${user.name || user.email} - Prive`
                            : (user.name || user.email)
                        }
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          {canEdit && (
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                {t('progress.addEntry')}
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingId ? t('common.edit') : t('progress.addEntry')}
              </DialogTitle>
              <DialogDescription>
                Enregistrez les versets que vous avez travaillés
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Programme</Label>
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((prog) => (
                        <SelectItem key={prog.id} value={prog.id}>
                          {prog.nameFr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('progress.date')}</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('progress.surah')}</Label>
                <Select value={selectedSurah} onValueChange={(v) => {
                  setSelectedSurah(v)
                  setVerseStart('1')
                  const surah = surahs.find(s => s.number === parseInt(v))
                  if (surah) setVerseEnd(surah.totalVerses.toString())
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une sourate" />
                  </SelectTrigger>
                  <SelectContent>
                    {surahs.map((surah) => (
                      <SelectItem key={surah.number} value={surah.number.toString()}>
                        {surah.number}. {surah.nameFr} ({surah.nameAr}) - {surah.totalVerses} v.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('progress.verseStart')}</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedSurahData?.totalVerses || 999}
                    value={verseStart}
                    onChange={(e) => setVerseStart(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('progress.verseEnd')}</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedSurahData?.totalVerses || 999}
                    value={verseEnd}
                    onChange={(e) => setVerseEnd(e.target.value)}
                    placeholder={selectedSurahData?.totalVerses.toString() || ''}
                  />
                </div>
              </div>

              {selectedSurahData && verseStart && verseEnd && (
                <p className="text-sm text-muted-foreground">
                  {parseInt(verseEnd) - parseInt(verseStart) + 1} versets sélectionnés
                  (sur {selectedSurahData.totalVerses})
                </p>
              )}

              <div className="space-y-2">
                <Label>{t('progress.comment')} (optionnel)</Label>
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Notes ou remarques"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedProgram || !selectedSurah || !verseStart || !verseEnd}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total entrées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total versets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalVerses}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tafsir Coverage */}
      {tafsirData && (isTafsirFilter || filterProgram === 'all') && (
        <Card className={isTafsirFilter
          ? 'bg-gradient-to-r from-rose-50 to-purple-50 dark:from-rose-950/30 dark:to-purple-950/30'
          : ''
        }>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-rose-600" />
                Couverture Tafsir
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-rose-600">{tafsirData.global.percentage}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => window.location.href = `/${locale}/tafsir`}
                >
                  Voir detail <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tafsirSegments.length > 0 ? (
                <SegmentedProgressBar
                  segments={tafsirSegments}
                  mode={isTafsirFilter ? 'full' : 'compact'}
                  colorScheme="tafsir"
                  onBarClick={isTafsirFilter ? undefined : () => window.location.href = `/${locale}/tafsir`}
                  fetchHistory={isTafsirFilter ? fetchProgressHistory : undefined}
                />
              ) : (
                <Progress value={tafsirData.global.percentage} className="h-3" />
              )}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{tafsirData.global.coveredVerses} versets couverts</span>
                <span>{tafsirData.global.completedSurahs} sourates completes</span>
                <span>{tafsirData.global.inProgressSurahs} en cours</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memorization Coverage (when filtered to all or memorization) */}
      {memorizationSegments.length > 0 && !isTafsirFilter && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Couverture Memorisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SegmentedProgressBar
              segments={memorizationSegments}
              mode="compact"
              colorScheme="memorization"
              fetchHistory={fetchProgressHistory}
            />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {t('progress.noEntries')}<br />
              Cliquez sur "Ajouter" pour enregistrer votre première entrée.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
            <CardDescription>Vos dernières entrées d'avancement</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('progress.date')}</TableHead>
                  <TableHead>
                    <Select value={filterProgram} onValueChange={setFilterProgram}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 w-auto gap-1 font-medium">
                        <SelectValue placeholder="Programme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les programmes</SelectItem>
                        {programs.map((prog) => (
                          <SelectItem key={prog.id} value={prog.id}>
                            {prog.nameFr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>
                    <Select value={filterSurah} onValueChange={setFilterSurah}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 w-auto gap-1 font-medium">
                        <SelectValue placeholder="Sourate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les sourates</SelectItem>
                        {(() => {
                          const usedSurahs = new Set(entries.map(e => e.surahNumber))
                          return surahs
                            .filter(s => usedSurahs.has(s.number))
                            .map((s) => (
                              <SelectItem key={s.number} value={s.number.toString()}>
                                {s.number}. {s.nameFr}
                              </SelectItem>
                            ))
                        })()}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>{t('progress.verses')}</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.date).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Badge className={getProgramColor(entry.program.code)}>
                        {entry.program.nameFr}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{entry.surah.nameFr}</span>
                      <span className="text-muted-foreground text-xs ml-1">
                        ({entry.surah.nameAr})
                      </span>
                    </TableCell>
                    <TableCell>
                      v.{entry.verseStart}-{entry.verseEnd}
                      <span className="text-muted-foreground text-xs ml-1">
                        ({entry.verseEnd - entry.verseStart + 1})
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lecture de livres */}
      {userBooks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Library className="h-4 w-4 text-blue-600" />
              Lecture de livres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {userBooks.map(book => {
              const isBookOpen = openBookIds.has(book.id)
              const pct = book.percentage || 0
              const chapters = bookChapters[book.id]
              const chapterProg = bookChapterProgress[book.id] || {}

              return (
                <div key={book.id} className="border rounded-lg">
                  {/* Book header */}
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleBook(book.id)}
                  >
                    {isBookOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{book.title}</span>
                        {book.titleAr && (
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline" dir="rtl">
                            {book.titleAr}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {book.completedItems || 0}/{book.totalItems}
                      </span>
                      {pct > 0 && (
                        <div className="w-16 flex items-center gap-1">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      )}
                    </div>
                    {loadingBookIds.has(book.id) && (
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full shrink-0" />
                    )}
                  </button>

                  {/* Chapters */}
                  {isBookOpen && chapters && (
                    <div className="border-t px-2 py-1 space-y-0.5">
                      {chapters.map(chapter => renderBookChapter(book.id, chapter, chapterProg, 0))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )

  function renderBookChapter(bookId: string, chapter: BookChapter, chapterProg: Record<string, number>, depth: number): React.ReactNode {
    const isChapterOpen = openChapterIds.has(chapter.id)
    const completedInChapter = chapterProg[chapter.id] || 0
    const totalInChapter = chapter.totalItems || chapter._count?.items || 0
    const chapterPct = totalInChapter > 0 ? Math.round((completedInChapter / totalInChapter) * 100) : 0
    const isComplete = totalInChapter > 0 && completedInChapter >= totalInChapter
    const items = bookChapterItems[chapter.id]

    return (
      <div key={chapter.id} className={depth > 0 ? 'ml-4 border-l border-muted pl-2' : ''}>
        {/* Chapter header */}
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-left"
          onClick={() => toggleChapterOpen(bookId, chapter.id)}
        >
          {isChapterOpen
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          {isComplete && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
          <span className="text-sm truncate flex-1">
            {chapter.chapterNumber}. {chapter.title}
          </span>
          {chapter.titleAr && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline" dir="rtl">
              {chapter.titleAr}
            </span>
          )}
          <Badge variant={isComplete ? 'default' : 'secondary'} className="text-[10px] shrink-0">
            {completedInChapter}/{totalInChapter}
          </Badge>
          {loadingChapterIds.has(chapter.id) && (
            <div className="animate-spin h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent rounded-full shrink-0" />
          )}
        </button>

        {/* Items */}
        {isChapterOpen && items && (
          <div className="ml-6 space-y-0.5 pb-1">
            {/* Batch actions */}
            {canEdit && items.length > 0 && (
              <div className="flex gap-2 py-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-6 px-2"
                  onClick={() => toggleBookChapterAll(bookId, chapter.id, true)}
                >
                  Tout cocher
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-6 px-2"
                  onClick={() => toggleBookChapterAll(bookId, chapter.id, false)}
                >
                  Tout décocher
                </Button>
              </div>
            )}
            {items.map(item => {
              const isCompleted = item.userProgress?.completed || false
              const hasText = item.textAr || item.textFr || item.textEn
              return (
                <div key={item.id}>
                  {hasText ? (
                    <Collapsible>
                      <div className="flex items-start gap-2 px-1 py-1 rounded hover:bg-muted/50">
                        <Checkbox
                          checked={isCompleted}
                          disabled={togglingItemIds.has(item.id) || !canEdit}
                          onCheckedChange={(checked) =>
                            toggleBookItem(bookId, chapter.id, item.id, checked as boolean)
                          }
                          className="mt-0.5"
                        />
                        <CollapsibleTrigger className="flex-1 text-left">
                          <div className="flex items-center gap-1">
                            <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                              {item.itemNumber}. {item.title || `#${item.itemNumber}`}
                            </span>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="ml-7 px-1 pb-1">
                        {item.textAr && (
                          <p className="text-sm leading-relaxed text-right mb-1" dir="rtl">
                            {item.textAr}
                          </p>
                        )}
                        {item.textFr && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.textFr}
                          </p>
                        )}
                        {item.textEn && !item.textFr && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.textEn}
                          </p>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <div className="flex items-start gap-2 px-1 py-1 rounded hover:bg-muted/50">
                      <Checkbox
                        checked={isCompleted}
                        disabled={togglingItemIds.has(item.id) || !canEdit}
                        onCheckedChange={(checked) =>
                          toggleBookItem(bookId, chapter.id, item.id, checked as boolean)
                        }
                        className="mt-0.5"
                      />
                      <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {item.itemNumber}. {item.title || `#${item.itemNumber}`}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Sub-chapters */}
        {isChapterOpen && chapter.children && chapter.children.length > 0 && (
          <div className="pb-1">
            {chapter.children.map(child => renderBookChapter(bookId, child, chapterProg, depth + 1))}
          </div>
        )}
      </div>
    )
  }
}
