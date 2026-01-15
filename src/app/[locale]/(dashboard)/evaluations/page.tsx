'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClipboardCheck, Plus, Star, MessageSquare, BookOpen } from 'lucide-react'

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
  surahNumber: number
  verseStart: number
  verseEnd: number
  program: Program
  surah: Surah
  user?: {
    id: string
    name: string
    email: string
  }
}

interface Evaluation {
  id: string
  verseNumber: number
  comment: string
  rating: number | null
  createdAt: string
  progress: ProgressEntry
  evaluator: {
    id: string
    name: string
    email: string
  }
  evaluated: {
    id: string
    name: string
    email: string
  }
  surah: Surah
}

export default function EvaluationsPage() {
  const t = useTranslations()
  const { data: session } = useSession()
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form state
  const [selectedProgress, setSelectedProgress] = useState('')
  const [verseNumber, setVerseNumber] = useState('')
  const [comment, setComment] = useState('')
  const [rating, setRating] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [evalRes, progRes] = await Promise.all([
        fetch('/api/evaluations'),
        fetch('/api/progress'),
      ])

      if (evalRes.ok) {
        const data = await evalRes.json()
        setEvaluations(Array.isArray(data) ? data : [])
      }

      if (progRes.ok) {
        const data = await progRes.json()
        setProgressEntries(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateEvaluation() {
    if (!selectedProgress || !verseNumber || !comment) return
    setCreating(true)

    const progress = progressEntries.find(p => p.id === selectedProgress)
    if (!progress) return

    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progressId: selectedProgress,
          evaluatedId: session?.user?.id,
          surahNumber: progress.surahNumber,
          verseNumber: parseInt(verseNumber),
          comment,
          rating: rating ? parseInt(rating) : null,
        }),
      })

      if (res.ok) {
        await fetchData()
        setDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error creating evaluation:', error)
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setSelectedProgress('')
    setVerseNumber('')
    setComment('')
    setRating('')
  }

  const selectedProgressData = progressEntries.find(p => p.id === selectedProgress)

  const receivedEvaluations = evaluations.filter(e => e.evaluated.id === session?.user?.id)
  const givenEvaluations = evaluations.filter(e => e.evaluator.id === session?.user?.id)

  function getRatingColor(rating: number | null) {
    if (!rating) return 'bg-gray-100 text-gray-800'
    if (rating >= 4) return 'bg-emerald-100 text-emerald-800'
    if (rating >= 3) return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

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
          <h1 className="text-3xl font-bold tracking-tight">{t('evaluations.title')}</h1>
          <p className="text-muted-foreground">Suivez vos évaluations et remarques</p>
        </div>
        {progressEntries.length > 0 && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                {t('evaluations.addEvaluation')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('evaluations.addEvaluation')}</DialogTitle>
                <DialogDescription>
                  Ajoutez une remarque sur un verset spécifique
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Entrée de progression</Label>
                  <Select value={selectedProgress} onValueChange={setSelectedProgress}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une entrée" />
                    </SelectTrigger>
                    <SelectContent>
                      {progressEntries.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.surah.nameFr} (v.{entry.verseStart}-{entry.verseEnd}) -{' '}
                          {new Date(entry.date).toLocaleDateString('fr-FR')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProgressData && (
                  <div className="space-y-2">
                    <Label>{t('evaluations.verse')}</Label>
                    <Select value={verseNumber} onValueChange={setVerseNumber}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un verset" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: selectedProgressData.verseEnd - selectedProgressData.verseStart + 1 },
                          (_, i) => selectedProgressData.verseStart + i
                        ).map((v) => (
                          <SelectItem key={v} value={v.toString()}>
                            Verset {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t('evaluations.rating')} (optionnel)</Label>
                  <Select value={rating} onValueChange={setRating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Note (1-5)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 - Excellent</SelectItem>
                      <SelectItem value="4">4 - Très bien</SelectItem>
                      <SelectItem value="3">3 - Bien</SelectItem>
                      <SelectItem value="2">2 - À améliorer</SelectItem>
                      <SelectItem value="1">1 - Difficile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('evaluations.comment')}</Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Remarque ou point d'attention..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleCreateEvaluation}
                  disabled={creating || !selectedProgress || !verseNumber || !comment}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {creating ? t('common.loading') : t('common.save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total évaluations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reçues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{receivedEvaluations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Données</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{givenEvaluations.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Evaluations List */}
      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Reçues ({receivedEvaluations.length})</TabsTrigger>
          <TabsTrigger value="given">Données ({givenEvaluations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4">
          {receivedEvaluations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Aucune évaluation reçue
                </p>
              </CardContent>
            </Card>
          ) : (
            receivedEvaluations.map((evaluation) => (
              <EvaluationCard key={evaluation.id} evaluation={evaluation} type="received" />
            ))
          )}
        </TabsContent>

        <TabsContent value="given" className="space-y-4">
          {givenEvaluations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Aucune évaluation donnée
                </p>
              </CardContent>
            </Card>
          ) : (
            givenEvaluations.map((evaluation) => (
              <EvaluationCard key={evaluation.id} evaluation={evaluation} type="given" />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EvaluationCard({ evaluation, type }: { evaluation: Evaluation; type: 'received' | 'given' }) {
  const t = useTranslations()

  function getRatingStars(rating: number | null) {
    if (!rating) return null
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
              <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">
                {evaluation.surah.nameFr} - Verset {evaluation.verseNumber}
              </CardTitle>
              <CardDescription>
                {type === 'received' ? (
                  <>Par {evaluation.evaluator.name || evaluation.evaluator.email}</>
                ) : (
                  <>Pour {evaluation.evaluated.name || evaluation.evaluated.email}</>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            {getRatingStars(evaluation.rating)}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(evaluation.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm">{evaluation.comment}</p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">{evaluation.progress.program.nameFr}</Badge>
          <span className="text-xs text-muted-foreground">
            Progression du {new Date(evaluation.progress.date).toLocaleDateString('fr-FR')}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
