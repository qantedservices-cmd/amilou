'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, BookOpen, Plus, CheckCircle, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SegmentedProgressBar, SegmentData } from '@/components/segmented-progress-bar'

interface SurahStat {
  surahNumber: number
  surahName: string
  surahNameAr: string
  totalVerses: number
  coveredVerses: number
  percentage: number
  isComplete: boolean
  entries: { id: string; date: string; verseStart: number; verseEnd: number }[]
}

interface TafsirData {
  global: {
    totalVerses: number
    coveredVerses: number
    percentage: number
    completedSurahs: number
    inProgressSurahs: number
    totalSurahs: number
  }
  surahs: SurahStat[]
  allSurahs: SurahStat[]
}

interface Surah {
  number: number
  nameFr: string
  nameAr: string
  totalVerses: number
}

export default function TafsirPage() {
  const router = useRouter()
  const [data, setData] = useState<TafsirData | null>(null)
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSurah, setSelectedSurah] = useState('')
  const [verseStart, setVerseStart] = useState('')
  const [verseEnd, setVerseEnd] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  // Edit mode
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editVerseStart, setEditVerseStart] = useState('')
  const [editVerseEnd, setEditVerseEnd] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Delete confirmation
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Expanded surah rows (show entries)
  const [expandedSurahs, setExpandedSurahs] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchData()
    fetchSurahs()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/tafsir')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error('Error fetching tafsir data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSurahs() {
    try {
      const res = await fetch('/api/surahs')
      if (res.ok) {
        const json = await res.json()
        setSurahs(json)
      }
    } catch (error) {
      console.error('Error fetching surahs:', error)
    }
  }

  const selectedSurahData = surahs.find(s => s.number === parseInt(selectedSurah))

  async function handleSave() {
    if (!selectedSurah || !verseStart || !verseEnd) return

    setSaving(true)
    try {
      const res = await fetch('/api/tafsir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surahNumber: parseInt(selectedSurah),
          verseStart: parseInt(verseStart),
          verseEnd: parseInt(verseEnd),
          date: entryDate
        })
      })

      if (res.ok) {
        setDialogOpen(false)
        setSelectedSurah('')
        setVerseStart('')
        setVerseEnd('')
        fetchData()
      }
    } catch (error) {
      console.error('Error saving tafsir entry:', error)
    } finally {
      setSaving(false)
    }
  }

  function openDialogForSurah(surahNumber: number) {
    const surah = surahs.find(s => s.number === surahNumber)
    setSelectedSurah(surahNumber.toString())
    setVerseStart('1')
    setVerseEnd(surah?.totalVerses.toString() || '')
    setEntryDate(new Date().toISOString().split('T')[0])
    setDialogOpen(true)
  }

  function toggleSurahExpand(surahNumber: number) {
    setExpandedSurahs(prev => {
      const next = new Set(prev)
      if (next.has(surahNumber)) {
        next.delete(surahNumber)
      } else {
        next.add(surahNumber)
      }
      return next
    })
  }

  function startEdit(entry: { id: string; date: string; verseStart: number; verseEnd: number }) {
    setEditingEntryId(entry.id)
    setEditVerseStart(entry.verseStart.toString())
    setEditVerseEnd(entry.verseEnd.toString())
    setEditDate(entry.date)
  }

  function cancelEdit() {
    setEditingEntryId(null)
    setEditVerseStart('')
    setEditVerseEnd('')
    setEditDate('')
  }

  async function handleEditSave() {
    if (!editingEntryId || !editVerseStart || !editVerseEnd || !editDate) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/progress/${editingEntryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verseStart: parseInt(editVerseStart),
          verseEnd: parseInt(editVerseEnd),
          date: editDate,
        }),
      })
      if (res.ok) {
        toast.success('Entree modifiee')
        cancelEdit()
        fetchData()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur lors de la modification')
    } finally {
      setEditSaving(false)
    }
  }

  function confirmDelete(entryId: string) {
    setDeleteEntryId(entryId)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleteEntryId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/progress/${deleteEntryId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Entree supprimee')
        setDeleteDialogOpen(false)
        setDeleteEntryId(null)
        fetchData()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  // Transform data into segments for SegmentedProgressBar
  const tafsirSegments: SegmentData[] = useMemo(() => {
    if (!data?.allSurahs) return []
    return data.allSurahs.map(s => ({
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
  }, [data?.allSurahs])

  const fetchTafsirHistory = useCallback(async (segmentId: string) => {
    // Use entries from data instead of API call
    const surahNum = parseInt(segmentId)
    const surah = data?.allSurahs?.find(s => s.surahNumber === surahNum)
    if (!surah?.entries?.length) return []
    return surah.entries.map(e => ({
      date: e.date,
      description: `Versets ${e.verseStart}–${e.verseEnd}`,
      verseStart: e.verseStart,
      verseEnd: e.verseEnd,
    }))
  }, [data?.allSurahs])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
      </div>
    )
  }

  const displaySurahs = showAll ? data?.allSurahs : data?.surahs

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">Suivi Tafsir</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-rose-600 hover:bg-rose-700">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter entrée
        </Button>
      </div>

      {/* Global Stats */}
      <Card className="bg-gradient-to-r from-rose-50 to-purple-50 dark:from-rose-950/30 dark:to-purple-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-rose-600" />
            Progression Globale Tafsir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Couverture du Coran</span>
              <span className="font-bold text-2xl text-rose-600">{data?.global.percentage || 0}%</span>
            </div>
            {tafsirSegments.length > 0 ? (
              <SegmentedProgressBar
                segments={tafsirSegments}
                mode="full"
                colorScheme="tafsir"
                fetchHistory={fetchTafsirHistory}
              />
            ) : (
              <Progress value={data?.global.percentage || 0} className="h-4" />
            )}
            <div className="grid grid-cols-4 gap-4 pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-rose-600">{data?.global.coveredVerses || 0}</p>
                <p className="text-xs text-muted-foreground">Versets couverts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{data?.global.totalVerses || 6236}</p>
                <p className="text-xs text-muted-foreground">Total versets</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{data?.global.completedSurahs || 0}</p>
                <p className="text-xs text-muted-foreground">Sourates complètes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{data?.global.inProgressSurahs || 0}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Surahs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Détail par Sourate</CardTitle>
              <CardDescription>
                {showAll ? 'Toutes les 114 sourates' : `${data?.surahs?.length || 0} sourates avec progression`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Afficher en cours' : 'Afficher tout'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Sourate</TableHead>
                <TableHead className="text-center">Versets</TableHead>
                <TableHead className="text-center">Couverture</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySurahs?.map((surah) => {
                const isExpanded = expandedSurahs.has(surah.surahNumber)
                const hasEntries = surah.entries && surah.entries.length > 0
                return (
                  <React.Fragment key={surah.surahNumber}>
                    <TableRow
                      className={`${surah.isComplete ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''} ${hasEntries ? 'cursor-pointer' : ''}`}
                      onClick={() => hasEntries && toggleSurahExpand(surah.surahNumber)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {hasEntries && (
                            isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          )}
                          {surah.surahNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{surah.surahName}</span>
                          <span className="text-muted-foreground text-sm ml-2 font-arabic">{surah.surahNameAr}</span>
                          {hasEntries && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({surah.entries.length} {surah.entries.length === 1 ? 'entree' : 'entrees'})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{surah.coveredVerses}</span>
                        <span className="text-muted-foreground">/{surah.totalVerses}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={surah.percentage} className="h-2 flex-1" />
                          <span className={`text-sm font-medium w-12 text-right ${
                            surah.percentage === 100 ? 'text-emerald-600' :
                            surah.percentage > 0 ? 'text-amber-600' : 'text-muted-foreground'
                          }`}>
                            {surah.percentage}%
                          </span>
                          {surah.isComplete && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openDialogForSurah(surah.surahNumber) }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {/* Expanded entries */}
                    {isExpanded && surah.entries.map((entry) => (
                      <TableRow key={entry.id} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell colSpan={2}>
                          {editingEntryId === entry.id ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-36 h-8 text-xs"
                              />
                              <span className="text-xs">v.</span>
                              <Input
                                type="number"
                                min={1}
                                max={surah.totalVerses}
                                value={editVerseStart}
                                onChange={(e) => setEditVerseStart(e.target.value)}
                                className="w-16 h-8 text-xs"
                              />
                              <span className="text-xs">-</span>
                              <Input
                                type="number"
                                min={1}
                                max={surah.totalVerses}
                                value={editVerseEnd}
                                onChange={(e) => setEditVerseEnd(e.target.value)}
                                className="w-16 h-8 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' — '}Versets {entry.verseStart}–{entry.verseEnd}
                              <span className="text-xs ml-1">({entry.verseEnd - entry.verseStart + 1}v)</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell>
                          {editingEntryId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={handleEditSave} disabled={editSaving} className="h-7 px-2">
                                <CheckCircle className="h-3 w-3 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 px-2">
                                <ArrowLeft className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0">
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); startEdit(entry) }} className="h-7 px-2">
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); confirmDelete(entry.id) }} className="h-7 px-2 text-destructive hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ajouter entrée Tafsir</DialogTitle>
            <DialogDescription>
              Enregistrez les versets étudiés avec Tafsir
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Sourate</Label>
              <Select value={selectedSurah} onValueChange={(v) => {
                setSelectedSurah(v)
                const surah = surahs.find(s => s.number === parseInt(v))
                if (surah) {
                  setVerseStart('1')
                  setVerseEnd(surah.totalVerses.toString())
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une sourate" />
                </SelectTrigger>
                <SelectContent>
                  {surahs.map((surah) => (
                    <SelectItem key={surah.number} value={surah.number.toString()}>
                      {surah.number}. {surah.nameFr} ({surah.nameAr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Verset début</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedSurahData?.totalVerses || 999}
                  value={verseStart}
                  onChange={(e) => setVerseStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Verset fin</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedSurahData?.totalVerses || 999}
                  value={verseEnd}
                  onChange={(e) => setVerseEnd(e.target.value)}
                />
              </div>
            </div>

            {selectedSurahData && verseStart && verseEnd && (
              <p className="text-sm text-muted-foreground">
                {parseInt(verseEnd) - parseInt(verseStart) + 1} versets sélectionnés
              </p>
            )}

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedSurah || !verseStart || !verseEnd}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. L'entree de progression tafsir sera definitivement supprimee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
