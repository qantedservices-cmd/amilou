'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
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
import {
  Users,
  TrendingUp,
  Shield,
  Plus,
  Eye,
  UserCog,
  ShieldAlert
} from 'lucide-react'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  _count: {
    progressEntries: number
  }
}

interface Program {
  id: string
  code: string
  nameFr: string
}

interface Surah {
  number: number
  nameFr: string
  nameAr: string
  totalVerses: number
}

interface ProgressEntry {
  id: string
  date: string
  surahNumber: number
  verseStart: number
  verseEnd: number
  program: Program
  surah: Surah
  user: {
    id: string
    name: string | null
    email: string
  }
}

export default function AdminPage() {
  const t = useTranslations()
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [progress, setProgress] = useState<ProgressEntry[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedProgram, setSelectedProgram] = useState<string>('all')

  // Add progress dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formUser, setFormUser] = useState('')
  const [formProgram, setFormProgram] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formSurah, setFormSurah] = useState('')
  const [formVerseStart, setFormVerseStart] = useState('')
  const [formVerseEnd, setFormVerseEnd] = useState('')
  const [formRepetitions, setFormRepetitions] = useState('')
  const [formComment, setFormComment] = useState('')

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  async function checkAdminAndFetch() {
    try {
      // Fetch users (will fail if not admin)
      const usersRes = await fetch('/api/users')
      if (!usersRes.ok) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      setIsAdmin(true)
      const usersData = await usersRes.json()
      setUsers(Array.isArray(usersData) ? usersData : [])

      // Fetch other data
      const [progRes, surahRes, progressRes] = await Promise.all([
        fetch('/api/programs'),
        fetch('/api/surahs'),
        fetch('/api/progress?limit=200'),
      ])

      const progData = await progRes.json()
      const surahData = await surahRes.json()
      const progressData = await progressRes.json()

      setPrograms(Array.isArray(progData) ? progData : [])
      setSurahs(Array.isArray(surahData) ? surahData : [])
      setProgress(Array.isArray(progressData) ? progressData : [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  async function fetchProgress() {
    const params = new URLSearchParams()
    params.set('limit', '200')
    if (selectedUser !== 'all') params.set('userId', selectedUser)
    if (selectedProgram !== 'all') params.set('programId', selectedProgram)

    const res = await fetch(`/api/progress?${params}`)
    const data = await res.json()
    setProgress(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    if (isAdmin) {
      fetchProgress()
    }
  }, [selectedUser, selectedProgram, isAdmin])

  function resetForm() {
    setFormUser('')
    setFormProgram('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormSurah('')
    setFormVerseStart('')
    setFormVerseEnd('')
    setFormRepetitions('')
    setFormComment('')
  }

  const selectedSurahData = surahs.find(s => s.number === parseInt(formSurah))

  async function handleAddProgress() {
    if (!formUser || !formProgram || !formSurah || !formVerseStart || !formVerseEnd) return

    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: formUser,
          programId: formProgram,
          date: formDate,
          surahNumber: parseInt(formSurah),
          verseStart: parseInt(formVerseStart),
          verseEnd: parseInt(formVerseEnd),
          repetitions: formRepetitions ? parseInt(formRepetitions) : null,
          comment: formComment || null,
        }),
      })

      if (res.ok) {
        await fetchProgress()
        setDialogOpen(false)
        resetForm()
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur')
      }
    } catch (error) {
      console.error('Error adding progress:', error)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      }
    } catch (error) {
      console.error('Error updating role:', error)
    }
  }

  function getRoleBadgeColor(role: string) {
    const colors: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      MANAGER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      REFERENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      USER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
    }
    return colors[role] || colors.USER
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

  const totalVerses = progress.reduce((sum, e) => sum + (e.verseEnd - e.verseStart + 1), 0)

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">{t('admin.accessDenied')}</h1>
        <p className="text-muted-foreground">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
          <p className="text-muted-foreground">
            Gérez les utilisateurs et leurs progressions
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('progress.addEntry')}
          </Button>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t('admin.addProgressFor')}</DialogTitle>
              <DialogDescription>
                Enregistrez une progression pour un utilisateur
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Utilisateur</Label>
                <Select value={formUser} onValueChange={setFormUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Programme</Label>
                  <Select value={formProgram} onValueChange={setFormProgram}>
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
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('progress.surah')}</Label>
                <Select value={formSurah} onValueChange={(v) => {
                  setFormSurah(v)
                  setFormVerseStart('1')
                  const surah = surahs.find(s => s.number === parseInt(v))
                  if (surah) setFormVerseEnd(surah.totalVerses.toString())
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
                    value={formVerseStart}
                    onChange={(e) => setFormVerseStart(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('progress.verseEnd')}</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedSurahData?.totalVerses || 999}
                    value={formVerseEnd}
                    onChange={(e) => setFormVerseEnd(e.target.value)}
                    placeholder={selectedSurahData?.totalVerses.toString() || ''}
                  />
                </div>
              </div>

              {selectedSurahData && formVerseStart && formVerseEnd && (
                <p className="text-sm text-muted-foreground">
                  {parseInt(formVerseEnd) - parseInt(formVerseStart) + 1} versets sélectionnés
                </p>
              )}

              <div className="space-y-2">
                <Label>{t('progress.repetitions')} (optionnel)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formRepetitions}
                  onChange={(e) => setFormRepetitions(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('progress.comment')} (optionnel)</Label>
                <Input
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleAddProgress}
                disabled={!formUser || !formProgram || !formSurah || !formVerseStart || !formVerseEnd}
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
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.totalProgress')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total versets</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalVerses}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {t('admin.userManagement')}
          </CardTitle>
          <CardDescription>
            {users.length} utilisateurs enregistrés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>{t('admin.role')}</TableHead>
                <TableHead>Progressions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name || '-'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {t(`roles.${user.role.toLowerCase()}`)}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">{t('roles.user')}</SelectItem>
                        <SelectItem value="REFERENT">{t('roles.referent')}</SelectItem>
                        <SelectItem value="MANAGER">{t('roles.manager')}</SelectItem>
                        <SelectItem value="ADMIN">{t('roles.admin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="text-emerald-600 font-medium">
                      {user._count.progressEntries}
                    </span> {t('admin.entries')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUser(user.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t('admin.viewProgress')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Progress Table with Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('admin.progressManagement')}
          </CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="w-48">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.allUsers')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {progress.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune progression trouvée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('progress.date')}</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>{t('progress.surah')}</TableHead>
                  <TableHead>{t('progress.verses')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.slice(0, 50).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.date).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.user?.name || entry.user?.email || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getProgramColor(entry.program.code)}>
                        {entry.program.nameFr}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.surah.nameFr}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
