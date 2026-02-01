'use client'

import { useState, useEffect } from 'react'
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
import { Calendar, Users, BookOpen, Plus, Trash2, Save, ArrowLeft } from 'lucide-react'

interface Group {
  id: string
  name: string
  members: {
    id: string
    userId: string
    role: string
    user: { id: string; name: string }
  }[]
}

interface Surah {
  number: number
  nameAr: string
  nameFr: string
  totalVerses: number
}

interface RecitationEntry {
  id: string
  surahNumber: number
  surahName: string
  type: 'MEMORIZATION' | 'REVISION'
  verseStart: number
  verseEnd: number
  status: 'AM' | 'PARTIAL' | 'VALIDATED' | 'KNOWN'
  comment: string
}

interface StudentRecitations {
  [userId: string]: RecitationEntry[]
}

const STATUS_OPTIONS = [
  { value: 'AM', label: 'AM - À mémoriser', color: 'bg-blue-100 text-blue-800' },
  { value: 'PARTIAL', label: 'Partiel - À reprendre', color: 'bg-orange-100 text-orange-800' },
  { value: 'VALIDATED', label: 'Validé', color: 'bg-green-100 text-green-800' },
  { value: 'KNOWN', label: 'Connu (acquis)', color: 'bg-purple-100 text-purple-800' },
]

const TYPE_OPTIONS = [
  { value: 'MEMORIZATION', label: 'Mémorisation' },
  { value: 'REVISION', label: 'Révision' },
]

export default function NewSessionPage() {
  const router = useRouter()
  const locale = useLocale()
  const [groups, setGroups] = useState<Group[]>([])
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionNotes, setSessionNotes] = useState('')
  const [presentUserIds, setPresentUserIds] = useState<Set<string>>(new Set())
  const [studentRecitations, setStudentRecitations] = useState<StudentRecitations>({})
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)

  useEffect(() => {
    fetchGroups()
    fetchSurahs()
  }, [])

  async function fetchGroups() {
    try {
      const res = await fetch('/api/groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(data)
        if (data.length > 0) {
          setSelectedGroupId(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
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
    } catch (error) {
      console.error('Error fetching surahs:', error)
    }
  }

  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  // Filter out REFERENT and ADMIN (teachers) from attendance list - only show students (MEMBER)
  const members = (selectedGroup?.members || []).filter(m => m.role === 'MEMBER')

  function togglePresence(userId: string) {
    const newSet = new Set(presentUserIds)
    if (newSet.has(userId)) {
      newSet.delete(userId)
      // Clear recitations for this user
      const newRecitations = { ...studentRecitations }
      delete newRecitations[userId]
      setStudentRecitations(newRecitations)
      if (activeStudentId === userId) {
        setActiveStudentId(null)
      }
    } else {
      newSet.add(userId)
    }
    setPresentUserIds(newSet)
  }

  function addRecitation(userId: string) {
    const newEntry: RecitationEntry = {
      id: `temp-${Date.now()}`,
      surahNumber: 114,
      surahName: 'An-Nâs',
      type: 'MEMORIZATION',
      verseStart: 1,
      verseEnd: 6,
      status: 'AM',
      comment: '',
    }

    setStudentRecitations(prev => ({
      ...prev,
      [userId]: [...(prev[userId] || []), newEntry]
    }))
  }

  function updateRecitation(userId: string, entryId: string, field: string, value: unknown) {
    setStudentRecitations(prev => ({
      ...prev,
      [userId]: prev[userId].map(entry => {
        if (entry.id === entryId) {
          const updated = { ...entry, [field]: value }
          // Update surah name when surah number changes
          if (field === 'surahNumber') {
            const surah = surahs.find(s => s.number === value)
            if (surah) {
              updated.surahName = surah.nameFr
              updated.verseEnd = Math.min(updated.verseEnd, surah.totalVerses)
            }
          }
          return updated
        }
        return entry
      })
    }))
  }

  function removeRecitation(userId: string, entryId: string) {
    setStudentRecitations(prev => ({
      ...prev,
      [userId]: prev[userId].filter(entry => entry.id !== entryId)
    }))
  }

  async function handleSave() {
    if (!selectedGroupId) return

    setSaving(true)
    try {
      // 1. Create session
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          date: sessionDate,
          notes: sessionNotes,
        })
      })

      if (!sessionRes.ok) {
        throw new Error('Erreur création séance')
      }

      const session = await sessionRes.json()

      // 2. Update attendance
      const attendanceData = members.map(member => ({
        userId: member.user.id,
        present: presentUserIds.has(member.user.id),
        excused: false,
      }))

      await fetch(`/api/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance: attendanceData })
      })

      // 3. Create recitations
      const allRecitations = []
      for (const userId of presentUserIds) {
        const recitations = studentRecitations[userId] || []
        for (const rec of recitations) {
          allRecitations.push({
            userId,
            surahNumber: rec.surahNumber,
            type: rec.type,
            verseStart: rec.verseStart,
            verseEnd: rec.verseEnd,
            status: rec.status,
            comment: rec.comment,
          })
        }
      }

      if (allRecitations.length > 0) {
        await fetch(`/api/sessions/${session.id}/recitations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(allRecitations)
        })
      }

      router.push(`/${locale}/sessions`)
    } catch (error) {
      console.error('Error saving session:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/sessions`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nouvelle séance</h1>
          <p className="text-muted-foreground">Saisie des présences et récitations</p>
        </div>
      </div>

      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Informations séance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Groupe</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un groupe" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.members?.length || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Input
                placeholder="Notes de la séance..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Présences ({presentUserIds.size}/{members.length})
          </CardTitle>
          <CardDescription>Cochez les élèves présents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {members.map(member => (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  presentUserIds.has(member.user.id)
                    ? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => togglePresence(member.user.id)}
              >
                <Checkbox
                  checked={presentUserIds.has(member.user.id)}
                  onCheckedChange={() => togglePresence(member.user.id)}
                />
                <span className={presentUserIds.has(member.user.id) ? 'font-medium' : ''}>
                  {member.user.name}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recitations for present students */}
      {presentUserIds.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Récitations
            </CardTitle>
            <CardDescription>Cliquez sur un élève pour ajouter ses récitations</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Student tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {members
                .filter(m => presentUserIds.has(m.user.id))
                .map(member => {
                  const recCount = (studentRecitations[member.user.id] || []).length
                  return (
                    <Button
                      key={member.user.id}
                      variant={activeStudentId === member.user.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveStudentId(
                        activeStudentId === member.user.id ? null : member.user.id
                      )}
                    >
                      {member.user.name}
                      {recCount > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {recCount}
                        </Badge>
                      )}
                    </Button>
                  )
                })}
            </div>

            {/* Active student recitations */}
            {activeStudentId && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    {members.find(m => m.user.id === activeStudentId)?.user.name}
                  </h4>
                  <Button size="sm" onClick={() => addRecitation(activeStudentId)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter sourate
                  </Button>
                </div>

                {(studentRecitations[activeStudentId] || []).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Aucune récitation. Cliquez sur &quot;Ajouter sourate&quot; pour commencer.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(studentRecitations[activeStudentId] || []).map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="grid gap-3 p-3 bg-background rounded-lg border"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Récitation {idx + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => removeRecitation(activeStudentId, entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                          {/* Surah */}
                          <div className="space-y-1">
                            <Label className="text-xs">Sourate</Label>
                            <Select
                              value={entry.surahNumber.toString()}
                              onValueChange={(v) => updateRecitation(
                                activeStudentId, entry.id, 'surahNumber', parseInt(v)
                              )}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {surahs.map(s => (
                                  <SelectItem key={s.number} value={s.number.toString()}>
                                    {s.number}. {s.nameFr}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Type */}
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={entry.type}
                              onValueChange={(v) => updateRecitation(
                                activeStudentId, entry.id, 'type', v
                              )}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TYPE_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Verses */}
                          <div className="space-y-1">
                            <Label className="text-xs">Versets</Label>
                            <div className="flex gap-1 items-center">
                              <Input
                                type="number"
                                min={1}
                                className="h-9 w-16"
                                value={entry.verseStart}
                                onChange={(e) => updateRecitation(
                                  activeStudentId, entry.id, 'verseStart', parseInt(e.target.value) || 1
                                )}
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                type="number"
                                min={1}
                                max={surahs.find(s => s.number === entry.surahNumber)?.totalVerses || 999}
                                className="h-9 w-16"
                                value={entry.verseEnd}
                                onChange={(e) => updateRecitation(
                                  activeStudentId, entry.id, 'verseEnd', parseInt(e.target.value) || 1
                                )}
                              />
                            </div>
                          </div>

                          {/* Status */}
                          <div className="space-y-1">
                            <Label className="text-xs">Statut</Label>
                            <Select
                              value={entry.status}
                              onValueChange={(v) => updateRecitation(
                                activeStudentId, entry.id, 'status', v
                              )}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Comment */}
                        <div className="space-y-1">
                          <Label className="text-xs">Commentaire</Label>
                          <Textarea
                            placeholder="Remarques sur la récitation..."
                            className="min-h-[60px]"
                            value={entry.comment}
                            onChange={(e) => updateRecitation(
                              activeStudentId, entry.id, 'comment', e.target.value
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(`/${locale}/sessions`)}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={saving || !selectedGroupId}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer la séance'}
        </Button>
      </div>
    </div>
  )
}
