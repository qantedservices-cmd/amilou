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
import { Calendar, Users, BookOpen, Check, X, Plus, Trash2, ArrowLeft, Save, HelpCircle, LayoutGrid, Search, Info } from 'lucide-react'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RecitationStatus {
  id: string
  code: string
  label: string
  tooltip: string
  color: string | null
  sortOrder: number
  isDefault: boolean
}

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

interface SessionTafsirEntry {
  type: 'SENS' | 'TAFSIR'
  surahNumber: number
  verseStart: number
  verseEnd: number
}

interface ResearchTopicItem {
  id: string
  assignedTo: string
  question: string
  answer: string | null
  isValidated: boolean
}

interface GroupSession {
  id: string
  date: string
  weekNumber: number
  notes: string | null
  tafsirEntries: SessionTafsirEntry[] | null
  groupId: string
  group: {
    id: string
    name: string
  }
  attendance: Attendance[]
  recitations: Recitation[]
  researchTopics: ResearchTopicItem[]
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
  const [statuses, setStatuses] = useState<RecitationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // State for editing
  const [presentUserIds, setPresentUserIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [recitations, setRecitations] = useState<RecitationEntry[]>([])

  // Tafsir / Sens entries
  const [tafsirEntries, setTafsirEntries] = useState<SessionTafsirEntry[]>([])

  // Research topics
  const [researchTopics, setResearchTopics] = useState<ResearchTopicItem[]>([])
  const [newResearchAssignedTo, setNewResearchAssignedTo] = useState('')
  const [newResearchQuestion, setNewResearchQuestion] = useState('')
  const [addingResearch, setAddingResearch] = useState(false)
  const [deletingResearchId, setDeletingResearchId] = useState<string | null>(null)

  useEffect(() => {
    fetchSession()
    fetchSurahs()
    fetchStatuses()
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

      // Initialize tafsir entries
      setTafsirEntries((data.tafsirEntries as SessionTafsirEntry[]) || [])

      // Initialize research topics
      setResearchTopics(data.researchTopics || [])
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

  async function fetchStatuses() {
    try {
      const res = await fetch('/api/recitation-statuses')
      if (res.ok) {
        const data = await res.json()
        setStatuses(data)
      }
    } catch (err) {
      console.error('Error fetching statuses:', err)
    }
  }

  function getStatusInfo(code: string): { label: string; tooltip: string; color: string } {
    const status = statuses.find(s => s.code === code)
    if (status) {
      return {
        label: status.label,
        tooltip: status.tooltip,
        color: status.color || '#6B7280'
      }
    }
    // Fallback for unknown codes
    return {
      label: code,
      tooltip: code,
      color: '#6B7280'
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

  function addTafsirEntry(type: 'SENS' | 'TAFSIR') {
    setTafsirEntries(prev => [...prev, {
      type,
      surahNumber: 1,
      verseStart: 1,
      verseEnd: 7,
    }])
  }

  function updateTafsirEntry(index: number, field: keyof SessionTafsirEntry, value: number) {
    setTafsirEntries(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function removeTafsirEntry(index: number) {
    setTafsirEntries(prev => prev.filter((_, i) => i !== index))
  }

  async function handleAddResearchTopic() {
    if (!session || !newResearchAssignedTo.trim() || !newResearchQuestion.trim()) return
    setAddingResearch(true)
    try {
      const res = await fetch(`/api/groups/${session.groupId}/research-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          assignedTo: newResearchAssignedTo.trim(),
          question: newResearchQuestion.trim(),
        })
      })
      if (res.ok) {
        setNewResearchAssignedTo('')
        setNewResearchQuestion('')
        await fetchSession()
      }
    } catch (err) {
      console.error('Error adding research topic:', err)
    } finally {
      setAddingResearch(false)
    }
  }

  async function handleDeleteResearchTopic(topicId: string) {
    if (!session) return
    setDeletingResearchId(topicId)
    try {
      await fetch(`/api/groups/${session.groupId}/research-topics?id=${topicId}`, {
        method: 'DELETE'
      })
      await fetchSession()
    } catch (err) {
      console.error('Error deleting research topic:', err)
    } finally {
      setDeletingResearchId(null)
    }
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
          notes: notes,
          tafsirEntries: tafsirEntries
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/${locale}/groups/${session.groupId}/mastery`)}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            Grille de suivi
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          )}
        </div>
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

      {/* Lecture sens des versets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-violet-600" />
            Lecture du sens des versets
          </CardTitle>
          <CardDescription>
            Sourates dont le sens a été lu en groupe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tafsirEntries.filter(e => e.type === 'SENS').length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-2">Aucune entrée</p>
          ) : (
            tafsirEntries.map((entry, idx) => {
              if (entry.type !== 'SENS') return null
              const maxVerses = getMaxVerses(entry.surahNumber)
              return (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-xs">Sourate</Label>
                    <Select
                      value={entry.surahNumber.toString()}
                      onValueChange={(v) => updateTafsirEntry(idx, 'surahNumber', parseInt(v))}
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
                  <div>
                    <Label className="text-xs">Verset début</Label>
                    <Input
                      type="number"
                      min={1}
                      max={maxVerses}
                      value={entry.verseStart}
                      onChange={(e) => updateTafsirEntry(idx, 'verseStart', parseInt(e.target.value) || 1)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Verset fin</Label>
                    <Input
                      type="number"
                      min={1}
                      max={maxVerses}
                      value={entry.verseEnd}
                      onChange={(e) => updateTafsirEntry(idx, 'verseEnd', parseInt(e.target.value) || 1)}
                      disabled={!canEdit}
                    />
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeTafsirEntry(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => addTafsirEntry('SENS')}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tafsir en groupe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-pink-600" />
            Tafsir en groupe
          </CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            Sera ajouté à l&apos;avancement tafsir de chaque élève présent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tafsirEntries.filter(e => e.type === 'TAFSIR').length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-2">Aucune entrée</p>
          ) : (
            tafsirEntries.map((entry, idx) => {
              if (entry.type !== 'TAFSIR') return null
              const maxVerses = getMaxVerses(entry.surahNumber)
              return (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-xs">Sourate</Label>
                    <Select
                      value={entry.surahNumber.toString()}
                      onValueChange={(v) => updateTafsirEntry(idx, 'surahNumber', parseInt(v))}
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
                  <div>
                    <Label className="text-xs">Verset début</Label>
                    <Input
                      type="number"
                      min={1}
                      max={maxVerses}
                      value={entry.verseStart}
                      onChange={(e) => updateTafsirEntry(idx, 'verseStart', parseInt(e.target.value) || 1)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Verset fin</Label>
                    <Input
                      type="number"
                      min={1}
                      max={maxVerses}
                      value={entry.verseEnd}
                      onChange={(e) => updateTafsirEntry(idx, 'verseEnd', parseInt(e.target.value) || 1)}
                      disabled={!canEdit}
                    />
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeTafsirEntry(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => addTafsirEntry('TAFSIR')}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sujets de recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-amber-600" />
            Sujets de recherche
          </CardTitle>
          <CardDescription>
            Sujets de recherche liés à cette séance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {researchTopics.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-2">Aucun sujet de recherche</p>
          ) : (
            researchTopics.map((topic) => (
              <div key={topic.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{topic.assignedTo}</Badge>
                    {topic.isValidated && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Validé</Badge>}
                  </div>
                  <p className="text-sm font-medium">{topic.question}</p>
                  {topic.answer && (
                    <p className="text-sm text-muted-foreground">{topic.answer}</p>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDeleteResearchTopic(topic.id)}
                    disabled={deletingResearchId === topic.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
          {canEdit && (
            <div className="border rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Attribué à</Label>
                  <Input
                    placeholder="Nom de l'élève ou Tous"
                    value={newResearchAssignedTo}
                    onChange={(e) => setNewResearchAssignedTo(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Question / Sujet</Label>
                  <Input
                    placeholder="Sujet de recherche..."
                    value={newResearchQuestion}
                    onChange={(e) => setNewResearchQuestion(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddResearchTopic}
                disabled={addingResearch || !newResearchAssignedTo.trim() || !newResearchQuestion.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                {addingResearch ? 'Ajout...' : 'Ajouter un sujet'}
              </Button>
            </div>
          )}
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                                <div className="flex-1 min-w-[70px]">
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
                                <div className="flex-1 min-w-[70px]">
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
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs">Statut</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <p className="text-xs">{getStatusInfo(rec.odStatus).tooltip}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Select
                                  value={rec.odStatus}
                                  onValueChange={(v) => updateRecitation(globalIdx, 'odStatus', v)}
                                  disabled={!canEdit}
                                >
                                  <SelectTrigger>
                                    <SelectValue>
                                      <span
                                        className="inline-flex items-center gap-1.5"
                                        style={{ color: getStatusInfo(rec.odStatus).color }}
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: getStatusInfo(rec.odStatus).color }}
                                        />
                                        {rec.odStatus}
                                      </span>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statuses.map((s) => (
                                      <SelectItem key={s.code} value={s.code}>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="inline-flex items-center gap-2">
                                                <span
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: s.color || '#6B7280' }}
                                                />
                                                <span style={{ color: s.color || '#6B7280' }}>
                                                  {s.code}
                                                </span>
                                                <span className="text-muted-foreground">- {s.label}</span>
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                              <p className="text-xs">{s.tooltip}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Comment */}
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">Commentaire</Label>
                                <RichTextEditor
                                  placeholder="Note sur la récitation..."
                                  value={rec.odComment}
                                  onChange={(value) => updateRecitation(globalIdx, 'odComment', value)}
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
