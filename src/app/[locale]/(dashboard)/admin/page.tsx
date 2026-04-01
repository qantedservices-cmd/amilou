'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Switch } from '@/components/ui/switch'
import {
  Users,
  TrendingUp,
  Shield,
  Plus,
  Eye,
  UserCog,
  ShieldAlert,
  Trophy,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  Pencil,
  Search,
  Trash2,
  Loader2,
  FolderOpen,
  Mail,
  Copy,
  CheckCircle,
} from 'lucide-react'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  _count: { progressEntries: number }
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
  user: { id: string; name: string | null; email: string }
}

interface UserRanking {
  id: string
  name: string
  email: string
  totalPages: number
  totalVerses: number
  attendanceRate: number
  activeWeeksCount: number
  trend: 'up' | 'stable' | 'down'
  status: 'active' | 'medium' | 'alert'
  isInactive: boolean
}

interface GroupData {
  id: string
  name: string
  members: Array<{
    id: string
    userId: string
    role: string
    isStudent: boolean
    isActive: boolean
    user: { id: string; name: string | null; email: string }
  }>
}

interface AdminStats {
  users: UserRanking[]
  globalAttendanceRate: number
  inactiveUsersCount: number
  totalUsers: number
  groups: { id: string; name: string }[]
}

export default function AdminPage() {
  const t = useTranslations()
  const locale = useLocale()
  const { data: session } = useSession()
  const router = useRouter()
  const { startImpersonation } = useImpersonation()

  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<GroupData[]>([])
  const [progress, setProgress] = useState<ProgressEntry[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Search & filters
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState('all')
  const [selectedProgram, setSelectedProgram] = useState('all')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)

  // Edit user dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('')

  // Add user dialog
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('USER')
  const [newGroupId, setNewGroupId] = useState('')
  const [addingUser, setAddingUser] = useState(false)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('USER')
  const [inviteGroupId, setInviteGroupId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; inviteUrl: string } | null>(null)

  // Group member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addMemberGroupId, setAddMemberGroupId] = useState('')
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState('MEMBER')
  const [addMemberIsStudent, setAddMemberIsStudent] = useState(true)

  // Progress form
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formUser, setFormUser] = useState('')
  const [formProgram, setFormProgram] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formSurah, setFormSurah] = useState('')
  const [formVerseStart, setFormVerseStart] = useState('')
  const [formVerseEnd, setFormVerseEnd] = useState('')
  const [formComment, setFormComment] = useState('')

  useEffect(() => { checkAdminAndFetch() }, [])

  useEffect(() => {
    if (isAdmin) fetchAdminStats()
  }, [isAdmin, selectedGroup])

  useEffect(() => {
    if (isAdmin) fetchProgress()
  }, [selectedUser, selectedProgram, isAdmin])

  async function checkAdminAndFetch() {
    try {
      const usersRes = await fetch('/api/users')
      if (!usersRes.ok) { setIsAdmin(false); setLoading(false); return }
      setIsAdmin(true)
      const usersData = await usersRes.json()
      setUsers(Array.isArray(usersData) ? usersData : [])

      const [progRes, surahRes, progressRes, groupsRes] = await Promise.all([
        fetch('/api/programs'),
        fetch('/api/surahs'),
        fetch('/api/progress?limit=200'),
        fetch('/api/admin/groups'),
      ])
      const progData = await progRes.json()
      const surahData = await surahRes.json()
      const progressData = await progressRes.json()
      const groupsData = await groupsRes.json()
      setPrograms(Array.isArray(progData) ? progData : [])
      setSurahs(Array.isArray(surahData) ? surahData : [])
      setProgress(Array.isArray(progressData) ? progressData : [])
      setGroups(Array.isArray(groupsData) ? groupsData : [])
    } catch { setIsAdmin(false) } finally { setLoading(false) }
  }

  async function fetchAdminStats() {
    try {
      const params = new URLSearchParams()
      if (selectedGroup !== 'all') params.set('groupId', selectedGroup)
      const res = await fetch(`/api/admin/stats?${params}`)
      if (res.ok) setAdminStats(await res.json())
    } catch (e) { console.error(e) }
  }

  async function fetchProgress() {
    const params = new URLSearchParams({ limit: '200' })
    if (selectedUser !== 'all') params.set('userId', selectedUser)
    if (selectedProgram !== 'all') params.set('programId', selectedProgram)
    const res = await fetch(`/api/progress?${params}`)
    const data = await res.json()
    setProgress(Array.isArray(data) ? data : [])
  }

  async function fetchGroups() {
    const res = await fetch('/api/admin/groups')
    const data = await res.json()
    setGroups(Array.isArray(data) ? data : [])
  }

  // User actions
  function openEditDialog(user: User) {
    setEditingUser(user)
    setEditName(user.name || '')
    setEditEmail(user.email)
    setEditRole(user.role)
    setEditDialogOpen(true)
  }

  async function handleSaveUser() {
    if (!editingUser) return
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...updated } : u))
        setEditDialogOpen(false)
      } else { alert((await res.json()).error || 'Erreur') }
    } catch { alert('Erreur réseau') }
  }

  async function handleAddUser() {
    if (!newName || !newEmail || !newPassword) return
    setAddingUser(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
      })
      if (res.ok) {
        const user = await res.json()
        setUsers(prev => [...prev, user])
        // Assign to group if selected
        if (newGroupId) {
          await fetch('/api/admin/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'addMember', groupId: newGroupId, userId: user.id, role: 'MEMBER', isStudent: true }),
          })
          await fetchGroups()
        }
        setAddUserOpen(false)
        setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('USER'); setNewGroupId('')
      } else { alert((await res.json()).error || 'Erreur') }
    } catch { alert('Erreur réseau') }
    setAddingUser(false)
  }

  // Invite by email
  async function handleInvite() {
    if (!inviteName || !inviteEmail) return
    setInviting(true)
    setInviteResult(null)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inviteName, email: inviteEmail, role: inviteRole, groupId: inviteGroupId || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setInviteResult({ emailSent: data.emailSent, inviteUrl: data.inviteUrl })
        await checkAdminAndFetch()
      } else { alert(data.error || 'Erreur') }
    } catch { alert('Erreur réseau') }
    setInviting(false)
  }

  // Group member actions
  async function handleAddMember() {
    if (!addMemberGroupId || !addMemberUserId) return
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addMember',
          groupId: addMemberGroupId,
          userId: addMemberUserId,
          role: addMemberRole,
          isStudent: addMemberIsStudent,
        }),
      })
      if (res.ok) {
        await fetchGroups()
        setAddMemberOpen(false)
        setAddMemberUserId(''); setAddMemberRole('MEMBER'); setAddMemberIsStudent(true)
      } else { alert((await res.json()).error || 'Erreur') }
    } catch { alert('Erreur réseau') }
  }

  async function handleRemoveMember(groupId: string, userId: string) {
    if (!confirm('Retirer ce membre du groupe ?')) return
    try {
      await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeMember', groupId, userId }),
      })
      await fetchGroups()
    } catch { alert('Erreur') }
  }

  async function handleToggleStudent(groupId: string, userId: string, isStudent: boolean) {
    try {
      await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateMember', groupId, userId, isStudent }),
      })
      await fetchGroups()
    } catch { alert('Erreur') }
  }

  async function handleAddProgress() {
    if (!formUser || !formProgram || !formSurah || !formVerseStart || !formVerseEnd) return
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: formUser, programId: formProgram, date: formDate,
          surahNumber: parseInt(formSurah), verseStart: parseInt(formVerseStart),
          verseEnd: parseInt(formVerseEnd), comment: formComment || null,
        }),
      })
      if (res.ok) {
        await fetchProgress()
        setDialogOpen(false)
        setFormUser(''); setFormProgram(''); setFormSurah(''); setFormVerseStart(''); setFormVerseEnd(''); setFormComment('')
      } else { alert((await res.json()).error || 'Erreur') }
    } catch { alert('Erreur') }
  }

  // Helpers
  function getRoleBadgeColor(role: string) {
    return { ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100', REFERENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100', USER: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' }[role] || 'bg-gray-100 text-gray-800'
  }
  function getProgramColor(code: string) {
    return { MEMORIZATION: 'bg-emerald-100 text-emerald-800', CONSOLIDATION: 'bg-blue-100 text-blue-800', REVISION: 'bg-amber-100 text-amber-800', READING: 'bg-purple-100 text-purple-800', TAFSIR: 'bg-rose-100 text-rose-800' }[code] || 'bg-gray-100 text-gray-800'
  }

  const filteredUsers = useMemo(() =>
    users.filter(u => {
      if (!userSearch) return true
      const s = userSearch.toLowerCase()
      return (u.name || '').toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    }),
  [users, userSearch])

  // Get user's groups for display
  function getUserGroups(userId: string) {
    return groups.filter(g => g.members.some(m => m.userId === userId)).map(g => g.name)
  }

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (!isAdmin) return <div className="flex h-[50vh] flex-col items-center justify-center gap-4"><ShieldAlert className="h-16 w-16 text-destructive" /><h1 className="text-2xl font-bold">{t('admin.accessDenied')}</h1></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
          <p className="text-muted-foreground">{users.length} utilisateurs — {groups.length} groupes</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{adminStats?.totalUsers || users.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Assiduité globale</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{adminStats?.globalAttendanceRate || 0}%</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Inactifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{adminStats?.inactiveUsersCount || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Groupes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{groups.length}</div></CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-1"><Users className="h-4 w-4" />Utilisateurs</TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-1"><FolderOpen className="h-4 w-4" />Groupes</TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-1"><Trophy className="h-4 w-4" />Classement</TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Progressions</TabsTrigger>
        </TabsList>

        {/* ===== USERS TAB ===== */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher par nom ou email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setAddUserOpen(true)}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
                  <Button variant="outline" onClick={() => { setInviteOpen(true); setInviteResult(null); setInviteName(''); setInviteEmail(''); setInviteRole('USER'); setInviteGroupId('') }}><Mail className="h-4 w-4 mr-1" />Inviter</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Groupes</TableHead>
                    <TableHead>Entrées</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell><Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getUserGroups(user.id).map(g => (
                            <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
                          ))}
                          {getUserGroups(user.id).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell><span className="text-emerald-600 font-medium">{user._count.progressEntries}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} title="Modifier"><Pencil className="h-3.5 w-3.5" /></Button>
                          {user.id !== session?.user?.id && (
                            <Button variant="ghost" size="sm" onClick={() => startImpersonation(user.id)} className="text-amber-600" title="Voir en tant que"><Eye className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== GROUPS TAB ===== */}
        <TabsContent value="groups">
          <div className="grid gap-4">
            {groups.map(group => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription>{group.members.length} membres</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setAddMemberGroupId(group.id); setAddMemberOpen(true) }}>
                      <Plus className="h-4 w-4 mr-1" />Ajouter un membre
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.members.map(member => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.user.name || member.user.email}</TableCell>
                          <TableCell><Badge className={getRoleBadgeColor(member.role)}>{member.role}</Badge></TableCell>
                          <TableCell>
                            <Switch
                              checked={member.isStudent}
                              onCheckedChange={(v) => handleToggleStudent(group.id, member.userId, v)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveMember(group.id, member.userId)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ===== RANKING TAB ===== */}
        <TabsContent value="ranking">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />Classement</CardTitle>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Filtrer par groupe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les groupes</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {adminStats?.users && adminStats.users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-right">Pages</TableHead>
                      <TableHead className="text-right">Taux</TableHead>
                      <TableHead className="text-center">Tendance</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminStats.users.map((user, i) => (
                      <TableRow key={user.id} className={user.isInactive ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                        <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <span className="font-medium">{user.name}</span>
                          {user.isInactive && <AlertTriangle className="inline ml-2 h-4 w-4 text-amber-500" />}
                        </TableCell>
                        <TableCell className="text-right font-medium">{user.totalPages}</TableCell>
                        <TableCell className="text-right">{user.attendanceRate}%</TableCell>
                        <TableCell className="text-center">
                          {user.trend === 'up' ? <ArrowUp className="inline h-4 w-4 text-emerald-600" /> : user.trend === 'down' ? <ArrowDown className="inline h-4 w-4 text-red-500" /> : <Minus className="inline h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={user.status === 'active' ? 'bg-emerald-100 text-emerald-800' : user.status === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}>
                            {user.status === 'active' ? 'Actif' : user.status === 'medium' ? 'Moyen' : 'Alerte'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">Aucune donnée</p>}
            </CardContent>
          </Card>

          {/* Inactive users */}
          {adminStats?.inactiveUsersCount && adminStats.inactiveUsersCount > 0 && (
            <Card className="mt-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-5 w-5" />Inactifs ({adminStats.inactiveUsersCount})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {adminStats.users.filter(u => u.isInactive).map(u => <Badge key={u.id} variant="outline" className="border-amber-300 text-amber-700">{u.name}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== PROGRESS TAB ===== */}
        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Progressions</CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Utilisateur" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Programme" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.nameFr}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Sourate</TableHead>
                    <TableHead>Versets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progress.slice(0, 50).map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">{new Date(entry.date).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="font-medium">{entry.user.name || entry.user.email}</TableCell>
                      <TableCell><Badge className={getProgramColor(entry.program.code)}>{entry.program.nameFr}</Badge></TableCell>
                      <TableCell className="text-sm">{entry.surah.nameAr} {entry.surah.nameFr}</TableCell>
                      <TableCell className="text-sm">{entry.verseStart}-{entry.verseEnd}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {progress.length > 50 && <p className="text-center text-sm text-muted-foreground mt-2">Affichage des 50 premières entrées sur {progress.length}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== DIALOGS ===== */}

      {/* Edit user dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nom</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
            <div>
              <Label>Rôle</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Utilisateur</SelectItem>
                  <SelectItem value="REFERENT">Référent</SelectItem>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveUser}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add user dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>Créer un nouveau compte et l'assigner à un groupe</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nom</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Prénom Nom" /></div>
            <div><Label>Email</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
            <div><Label>Mot de passe</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
            <div>
              <Label>Rôle</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Utilisateur</SelectItem>
                  <SelectItem value="REFERENT">Référent</SelectItem>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Groupe (optionnel)</Label>
              <Select value={newGroupId || 'none'} onValueChange={v => setNewGroupId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddUserOpen(false)}>Annuler</Button>
            <Button onClick={handleAddUser} disabled={addingUser}>{addingUser ? 'Création...' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member to group dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre au groupe</DialogTitle>
            <DialogDescription>{groups.find(g => g.id === addMemberGroupId)?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Utilisateur</Label>
              <Select value={addMemberUserId} onValueChange={setAddMemberUserId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {users.filter(u => !groups.find(g => g.id === addMemberGroupId)?.members.some(m => m.userId === u.id)).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rôle dans le groupe</Label>
              <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Membre</SelectItem>
                  <SelectItem value="REFERENT">Référent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={addMemberIsStudent} onCheckedChange={setAddMemberIsStudent} />
              <Label>Participe comme élève</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddMemberOpen(false)}>Annuler</Button>
            <Button onClick={handleAddMember}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add progress dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une progression</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Utilisateur</Label>
              <Select value={formUser} onValueChange={setFormUser}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Programme</Label>
              <Select value={formProgram} onValueChange={setFormProgram}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{p.nameFr}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
            <div>
              <Label>Sourate</Label>
              <Select value={formSurah} onValueChange={v => { setFormSurah(v); setFormVerseStart('1'); const s = surahs.find(s => s.number === parseInt(v)); setFormVerseEnd(s ? s.totalVerses.toString() : '') }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>{surahs.map(s => <SelectItem key={s.number} value={s.number.toString()}>{s.number}. {s.nameAr} {s.nameFr}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Verset début</Label><Input type="number" value={formVerseStart} onChange={e => setFormVerseStart(e.target.value)} /></div>
              <div><Label>Verset fin</Label><Input type="number" value={formVerseEnd} onChange={e => setFormVerseEnd(e.target.value)} /></div>
            </div>
            <div><Label>Commentaire</Label><Input value={formComment} onChange={e => setFormComment(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAddProgress}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite by email dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Inviter par email</DialogTitle>
            <DialogDescription>Un email sera envoyé avec un lien pour créer son mot de passe</DialogDescription>
          </DialogHeader>
          {inviteResult ? (
            <div className="space-y-4 py-4">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${inviteResult.emailSent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {inviteResult.emailSent ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <span className="text-sm font-medium">
                  {inviteResult.emailSent ? 'Invitation envoyée par email' : 'Email non envoyé — partagez le lien manuellement'}
                </span>
              </div>
              <div>
                <Label>Lien d'invitation</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={inviteResult.inviteUrl} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(inviteResult.inviteUrl) }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setInviteOpen(false)}>Fermer</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div><Label>Nom</Label><Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Prénom Nom" /></div>
                <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
                <div>
                  <Label>Rôle</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">Utilisateur</SelectItem>
                      <SelectItem value="REFERENT">Référent</SelectItem>
                      <SelectItem value="ADMIN">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Groupe (optionnel)</Label>
                  <Select value={inviteGroupId || 'none'} onValueChange={v => setInviteGroupId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>Annuler</Button>
                <Button onClick={handleInvite} disabled={inviting}>
                  {inviting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Envoi...</> : <><Mail className="h-4 w-4 mr-1" />Envoyer l'invitation</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
