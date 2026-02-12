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
import { TrendingUp, Plus, Pencil, Trash2, BookOpen, ArrowRight } from 'lucide-react'
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

  // Tafsir coverage
  const [tafsirData, setTafsirData] = useState<TafsirCoverage | null>(null)

  // Form state
  const [selectedProgram, setSelectedProgram] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedSurah, setSelectedSurah] = useState('')
  const [verseStart, setVerseStart] = useState('')
  const [verseEnd, setVerseEnd] = useState('')
  const [repetitions, setRepetitions] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [entRes, progRes, surahRes, tafsirRes] = await Promise.all([
        fetch('/api/progress'),
        fetch('/api/programs'),
        fetch('/api/surahs'),
        fetch('/api/tafsir'),
      ])
      const entData = await entRes.json()
      const progData = await progRes.json()
      const surahData = await surahRes.json()
      setEntries(Array.isArray(entData) ? entData : [])
      setPrograms(Array.isArray(progData) ? progData : [])
      setSurahs(Array.isArray(surahData) ? surahData : [])
      if (tafsirRes.ok) {
        setTafsirData(await tafsirRes.json())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setSelectedProgram('')
    setSelectedDate(new Date().toISOString().split('T')[0])
    setSelectedSurah('')
    setVerseStart('')
    setVerseEnd('')
    setRepetitions('')
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
    setRepetitions(entry.repetitions?.toString() || '')
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
      repetitions: repetitions ? parseInt(repetitions) : null,
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

  const filteredEntries = filterProgram === 'all'
    ? entries
    : entries.filter(e => e.programId === filterProgram)

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

  // Memorization segments
  const memorizationSegments: SegmentData[] = useMemo(() => {
    if (!surahs.length || !entries.length) return []
    const memEntries = entries.filter(e => e.program.code === 'MEMORIZATION')
    if (!memEntries.length) return []
    // Build coverage per surah
    const coverage: Record<number, Set<number>> = {}
    for (const e of memEntries) {
      if (!coverage[e.surahNumber]) coverage[e.surahNumber] = new Set()
      for (let v = e.verseStart; v <= e.verseEnd; v++) coverage[e.surahNumber].add(v)
    }
    return surahs.map(s => {
      const covered = coverage[s.number]?.size || 0
      const pct = s.totalVerses > 0 ? Math.round((covered / s.totalVerses) * 100) : 0
      return {
        id: s.number.toString(),
        label: `${s.number}. ${s.nameFr}`,
        labelAr: s.nameAr,
        status: pct >= 100 ? 'completed' as const : pct > 0 ? 'in_progress' as const : 'not_started' as const,
        percentage: pct,
        totalItems: s.totalVerses,
        completedItems: covered,
      }
    })
  }, [surahs, entries])

  const fetchProgressHistory = useCallback(async (segmentId: string) => {
    const program = isTafsirFilter ? 'TAFSIR' : 'MEMORIZATION'
    const res = await fetch(`/api/progress/history?surahNumber=${segmentId}&program=${program}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.entries
  }, [isTafsirFilter])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('progress.title')}</h1>
          <p className="text-muted-foreground">
            Enregistrez votre avancement quotidien
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              {t('progress.addEntry')}
            </Button>
          </DialogTrigger>
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
                <Label>{t('progress.repetitions')} (optionnel)</Label>
                <Input
                  type="number"
                  min="1"
                  value={repetitions}
                  onChange={(e) => setRepetitions(e.target.value)}
                  placeholder="Nombre de répétitions"
                />
              </div>

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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filtrer par programme</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger>
                <SelectValue />
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
                  <TableHead>Programme</TableHead>
                  <TableHead>{t('progress.surah')}</TableHead>
                  <TableHead>{t('progress.verses')}</TableHead>
                  <TableHead>{t('progress.repetitions')}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell>
                      {entry.repetitions || '-'}
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
