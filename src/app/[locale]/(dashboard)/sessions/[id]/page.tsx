'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, BookOpen, Check, X, Plus, Trash2, ArrowLeft, Save } from 'lucide-react'

interface Surah {
  number: number
  nameFr: string
  nameAr: string
  totalVerses: number
}

interface User {
  id: string
  name: string | null
  email: string
}

interface Attendance {
  id: string
  userId: string
  present: boolean
  excused: boolean
  note: string | null
  user: User
}

interface Recitation {
  id: string
  userId: string
  surahNumber: number
  type: string
  verseStart: number
  verseEnd: number
  status: string
  comment: string | null
  user: { id: string; name: string | null }
  surah: { number: number; nameFr: string; nameAr: string; totalVerses: number }
}

interface GroupSession {
  id: string
  date: string
  weekNumber: number
  notes: string | null
  groupId: string
  group: {
    id: string
    name: string
  }
  attendance: Attendance[]
  recitations: Recitation[]
  myRole: string
}

interface RecitationEntry {
  odId?: string
  odUserId: string
  odSurahNumber: number
  odType: string
  odVerseStart: number
  odVerseEnd: number
  odStatus: string
  odComment: string
  isNew?: boolean
  toDelete?: boolean
  modified?: boolean
}

export default function SessionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const locale = useLocale()

  const [session, setSession] = useState<GroupSession | null>(null)
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // State for editing
  const [presentUserIds, setPresentUserIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [recitations, setRecitations] = useState<RecitationEntry[]>([])

  useEffect(() => {
    fetchSession()
    fetchSurahs()
  }, [id])

  async function fetchSession() {
    try {
      const res = await fetch(`/api/sessions/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Séance non trouvée')
        } else if (res.status === 403) {
          setError('Accès non autorisé')
        } else {
          setError('Erreur lors du chargement')
        }
        return
      }
      const data = await res.json()
      setSession(data)
      setNotes(data.notes || '')

      // Initialize present users
      const present = new Set<string>()
      data.attendance.forEach((att: Attendance) => {
        if (att.present) present.add(att.userId)
      })
      setPresentUserIds(present)

      // Initialize recitations
      const existingRecitations: RecitationEntry[] = (data.recitations || []).map((r: Recitation) => ({
        odId: r.id,
        odUserId: r.userId,
        odSurahNumber: r.surahNumber,
        odType: r.type,
        odVerseStart: r.verseStart,
        odVerseEnd: r.verseEnd,
        odStatus: r.status,
        odComment: r.comment || '',
        isNew: false,
        toDelete: false,
      }))
      setRecitations(existingRecitations)
    } catch (err) {
      console.error('Error fetching session:', err)
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSurahs() {
    try {
      const res = await fetch('/api/surahs')
      if (res.ok) {
        const data = await res.json()
        setSurahs(data)
      }
    } catch (err) {
      console.error('Error fetching surahs:', err)
    }
  }

  function togglePresent(userId: string) {
    setPresentUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  function addRecitation(userId: string) {
    setRecitations(prev => [...prev, {
      odUserId: userId,
      odSurahNumber: 1,
      odType: 'MEMORIZATION',
      odVerseStart: 1,
      odVerseEnd: 7,
      odStatus: 'AM',
      odComment: '',
      isNew: true,
      toDelete: false,
    }])
  }

  function updateRecitation(index: number, field: keyof RecitationEntry, value: string | number) {
    setRecitations(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        modified: !updated[index].isNew // Mark as modified if it's an existing recitation
      }
      return updated
    })
  }

  function removeRecitation(index: number) {
    setRecitations(prev => {
      const updated = [...prev]
      if (updated[index].isNew) {
        // New recitation, just remove from array
        updated.splice(index, 1)
      } else {
        // Existing recitation, mark for deletion
        updated[index] = { ...updated[index], toDelete: true }
      }
      return updated
    })
  }

  function getMaxVerses(surahNumber: number): number {
    const surah = surahs.find(s => s.number === surahNumber)
    return surah?.totalVerses || 286
  }

  async function handleSave() {
    if (!session) return

    setSaving(true)
    setError('')

    try {
      // 1. Update attendance and notes
      const attendanceData = session.attendance.map(att => ({
        userId: att.userId,
        present: presentUserIds.has(att.userId),
        excused: att.excused,
      }))

      const updateRes = await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance: attendanceData,
          notes: notes
        })
      })

      if (!updateRes.ok) {
        throw new Error('Erreur lors de la mise à jour de la séance')
      }

      // 2. Handle recitations
      // Delete marked recitations
      const toDelete = recitations.filter(r => r.toDelete && r.odId)
      for (const r of toDelete) {
        await fetch(`/api/sessions/${id}/recitations/${r.odId}`, {
          method: 'DELETE'
        })
      }

      // Update modified existing recitations
      const toUpdate = recitations.filter(r => r.modified && r.odId && !r.toDelete)
      for (const r of toUpdate) {
        await fetch(`/api/sessions/${id}/recitations/${r.odId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surahNumber: r.odSurahNumber,
            type: r.odType,
            verseStart: r.odVerseStart,
            verseEnd: r.odVerseEnd,
            status: r.odStatus,
            comment: r.odComment || null,
          })
        })
      }

      // Add new recitations
      const toAdd = recitations.filter(r => r.isNew && !r.toDelete)
      if (toAdd.length > 0) {
        const recitationsPayload = toAdd.map(r => ({
          userId: r.odUserId,
          surahNumber: r.odSurahNumber,
          type: r.odType,
          verseStart: r.odVerseStart,
          verseEnd: r.odVerseEnd,
          status: r.odStatus,
          comment: r.odComment || null,
        }))

        const recRes = await fetch(`/api/sessions/${id}/recitations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recitations: recitationsPayload })
        })

        if (!recRes.ok) {
          console.error('Error saving recitations')
        }
      }

      // Refresh data
      await fetchSession()

    } catch (err) {
      console.error('Error saving:', err)
      setError('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const canEdit = session?.myRole === 'ADMIN' || session?.myRole === 'REFERENT'
  const presentMembers = session?.attendance.filter(a => presentUserIds.has(a.userId)) || []

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/${locale}/sessions`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux séances
        </Button>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/sessions`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{session.group.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(session.date)} - Semaine {session.weekNumber}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Attendance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Présence ({presentUserIds.size}/{session.attendance.length})
          </CardTitle>
          <CardDescription>
            {canEdit ? 'Cochez les élèves présents' : 'Liste des présences'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {session.attendance.map((att) => (
              <div
                key={att.userId}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  presentUserIds.has(att.userId)
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-muted/30 border-transparent'
                }`}
              >
                <Checkbox
                  id={`present-${att.userId}`}
                  checked={presentUserIds.has(att.userId)}
                  onCheckedChange={() => canEdit && togglePresent(att.userId)}
                  disabled={!canEdit}
                />
                <label
                  htmlFor={`present-${att.userId}`}
                  className={`text-sm cursor-pointer ${
                    presentUserIds.has(att.userId) ? 'font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {att.user.name || att.user.email}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes de séance</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Notes générales sur la séance..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canEdit}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Recitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Récitations
          </CardTitle>
          <CardDescription>
            {canEdit ? 'Annotez les récitations des élèves présents' : 'Historique des récitations'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {presentMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Aucun élève présent. Cochez les présences ci-dessus.
            </p>
          ) : (
            presentMembers.map((att) => {
              const userRecitations = recitations.filter(
                r => r.odUserId === att.userId && !r.toDelete
              )

              return (
                <div key={att.userId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      {att.user.name || att.user.email}
                    </h4>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addRecitation(att.userId)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter récitation
                      </Button>
                    )}
                  </div>

                  {userRecitations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune récitation enregistrée</p>
                  ) : (
                    <div className="space-y-3">
                      {userRecitations.map((rec, idx) => {
                        const globalIdx = recitations.findIndex(
                          r => r === rec || (r.odId && r.odId === rec.odId)
                        )
                        const maxVerses = getMaxVerses(rec.odSurahNumber)

                        return (
                          <div key={rec.odId || `new-${idx}`} className="grid gap-3 p-3 bg-muted/30 rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {/* Surah */}
                              <div>
                                <Label className="text-xs">Sourate</Label>
                                <Select
                                  value={rec.odSurahNumber.toString()}
                                  onValueChange={(v) => updateRecitation(globalIdx, 'odSurahNumber', parseInt(v))}
                                  disabled={!canEdit}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {surahs.map((s) => (
                                      <SelectItem key={s.number} value={s.number.toString()}>
                                        {s.number}. {s.nameFr}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Type */}
                              <div>
                                <Label className="text-xs">Type</Label>
                                <Select
                                  value={rec.odType}
                                  onValueChange={(v) => updateRecitation(globalIdx, 'odType', v)}
                                  disabled={!canEdit}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MEMORIZATION">Mémorisation</SelectItem>
                                    <SelectItem value="REVISION">Révision</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Verses */}
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Label className="text-xs">Début</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={maxVerses}
                                    value={rec.odVerseStart}
                                    onChange={(e) => updateRecitation(globalIdx, 'odVerseStart', parseInt(e.target.value) || 1)}
                                    disabled={!canEdit}
                                  />
                                </div>
                                <div className="flex-1">
                                  <Label className="text-xs">Fin</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={maxVerses}
                                    value={rec.odVerseEnd}
                                    onChange={(e) => updateRecitation(globalIdx, 'odVerseEnd', parseInt(e.target.value) || 1)}
                                    disabled={!canEdit}
                                  />
                                </div>
                              </div>

                              {/* Status */}
                              <div>
                                <Label className="text-xs">Statut</Label>
                                <Select
                                  value={rec.odStatus}
                                  onValueChange={(v) => updateRecitation(globalIdx, 'odStatus', v)}
                                  disabled={!canEdit}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AM">AM - À mémoriser</SelectItem>
                                    <SelectItem value="PARTIAL">Partiel</SelectItem>
                                    <SelectItem value="VALIDATED">Validé</SelectItem>
                                    <SelectItem value="KNOWN">Acquis</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Comment */}
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">Commentaire</Label>
                                <Input
                                  placeholder="Note sur la récitation..."
                                  value={rec.odComment}
                                  onChange={(e) => updateRecitation(globalIdx, 'odComment', e.target.value)}
                                  disabled={!canEdit}
                                />
                              </div>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="mt-5 text-destructive hover:text-destructive"
                                  onClick={() => removeRecitation(globalIdx)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
