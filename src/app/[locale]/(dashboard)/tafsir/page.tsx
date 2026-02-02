'use client'

import { useState, useEffect } from 'react'
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
import { ArrowLeft, BookOpen, Plus, CheckCircle } from 'lucide-react'

interface SurahStat {
  surahNumber: number
  surahName: string
  surahNameAr: string
  totalVerses: number
  coveredVerses: number
  percentage: number
  isComplete: boolean
  entries: { date: string; verseStart: number; verseEnd: number }[]
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
            <Progress value={data?.global.percentage || 0} className="h-4" />
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
              {displaySurahs?.map((surah) => (
                <TableRow key={surah.surahNumber} className={surah.isComplete ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}>
                  <TableCell className="font-medium">{surah.surahNumber}</TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{surah.surahName}</span>
                      <span className="text-muted-foreground text-sm ml-2 font-arabic">{surah.surahNameAr}</span>
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
                      onClick={() => openDialogForSurah(surah.surahNumber)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
    </div>
  )
}
