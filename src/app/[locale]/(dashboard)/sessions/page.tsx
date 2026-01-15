'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Calendar, Plus, Users, Check, X, Clock } from 'lucide-react'

interface Group {
  id: string
  name: string
}

interface AttendanceRecord {
  id: string
  userId: string
  present: boolean
  excused: boolean
  note: string | null
  user: {
    id: string
    name: string
    email: string
  }
}

interface Session {
  id: string
  date: string
  notes: string | null
  group: Group
  attendance: AttendanceRecord[]
  myRole?: string
}

export default function SessionsPage() {
  const t = useTranslations()
  const [sessions, setSessions] = useState<Session[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [filterGroup, setFilterGroup] = useState<string>('all')

  // Create form
  const [newGroupId, setNewGroupId] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // Attendance edit
  const [editedAttendance, setEditedAttendance] = useState<AttendanceRecord[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [sessionsRes, groupsRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/groups'),
      ])

      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(Array.isArray(data) ? data : [])
      }

      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSession() {
    if (!newGroupId || !newDate) return
    setCreating(true)

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: newGroupId,
          date: newDate,
          notes: newNotes || null,
        }),
      })

      if (res.ok) {
        await fetchData()
        setCreateDialogOpen(false)
        setNewGroupId('')
        setNewDate(new Date().toISOString().split('T')[0])
        setNewNotes('')
      }
    } catch (error) {
      console.error('Error creating session:', error)
    } finally {
      setCreating(false)
    }
  }

  function openSessionDetails(session: Session) {
    setSelectedSession(session)
    setEditedAttendance([...session.attendance])
    setDetailDialogOpen(true)
  }

  function updateAttendance(userId: string, field: 'present' | 'excused', value: boolean) {
    setEditedAttendance(prev =>
      prev.map(a =>
        a.userId === userId
          ? {
              ...a,
              [field]: value,
              // If marking present, unmark excused and vice versa
              ...(field === 'present' && value ? { excused: false } : {}),
              ...(field === 'excused' && value ? { present: false } : {}),
            }
          : a
      )
    )
  }

  async function saveAttendance() {
    if (!selectedSession) return
    setSaving(true)

    try {
      const res = await fetch(`/api/sessions/${selectedSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance: editedAttendance.map(a => ({
            userId: a.userId,
            present: a.present,
            excused: a.excused,
          })),
        }),
      })

      if (res.ok) {
        await fetchData()
        setDetailDialogOpen(false)
      }
    } catch (error) {
      console.error('Error saving attendance:', error)
    } finally {
      setSaving(false)
    }
  }

  const filteredSessions = filterGroup === 'all'
    ? sessions
    : sessions.filter(s => s.group.id === filterGroup)

  // Get groups where user can create sessions (admin or referent)
  const creatableGroups = groups.filter(g => {
    const group = groups.find(gr => gr.id === g.id) as Group & { myRole?: string }
    return group?.myRole === 'ADMIN' || group?.myRole === 'REFERENT'
  })

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
          <h1 className="text-3xl font-bold tracking-tight">{t('sessions.title')}</h1>
          <p className="text-muted-foreground">Gérez les séances de vos groupes</p>
        </div>
        {groups.length > 0 && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle séance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une séance</DialogTitle>
                <DialogDescription>
                  Planifiez une nouvelle séance pour votre groupe
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Groupe</Label>
                  <Select value={newGroupId} onValueChange={setNewGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un groupe" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optionnel)</Label>
                  <Input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Notes sur la séance"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleCreateSession}
                  disabled={creating || !newGroupId || !newDate}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {creating ? t('common.loading') : 'Créer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter */}
      {groups.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label>Filtrer par groupe</Label>
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les groupes</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Vous devez d'abord rejoindre un groupe<br />
              pour gérer les séances.
            </p>
          </CardContent>
        </Card>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Aucune séance enregistrée.<br />
              Créez votre première séance.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const presentCount = session.attendance.filter(a => a.present).length
            const excusedCount = session.attendance.filter(a => a.excused).length
            const totalCount = session.attendance.length

            return (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openSessionDetails(session)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {new Date(session.date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </CardTitle>
                        <CardDescription>{session.group.name}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{presentCount} présents</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>{excusedCount} excusés</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <X className="h-4 w-4 text-red-600" />
                      <span>{totalCount - presentCount - excusedCount} absents</span>
                    </div>
                  </div>
                  {session.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{session.notes}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Session Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Séance du {new Date(selectedSession.date).toLocaleDateString('fr-FR')}
                </DialogTitle>
                <DialogDescription>
                  {selectedSession.group.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 max-h-[400px] overflow-auto">
                <p className="text-sm font-medium">Présence des membres</p>
                {editedAttendance.map((att) => (
                  <div
                    key={att.userId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{att.user.name || att.user.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`present-${att.userId}`}
                          checked={att.present}
                          onCheckedChange={(checked) =>
                            updateAttendance(att.userId, 'present', checked as boolean)
                          }
                        />
                        <Label htmlFor={`present-${att.userId}`} className="text-sm">
                          {t('sessions.present')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`excused-${att.userId}`}
                          checked={att.excused}
                          onCheckedChange={(checked) =>
                            updateAttendance(att.userId, 'excused', checked as boolean)
                          }
                        />
                        <Label htmlFor={`excused-${att.userId}`} className="text-sm">
                          {t('sessions.excused')}
                        </Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={saveAttendance}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
