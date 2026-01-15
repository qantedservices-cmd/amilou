'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Plus, Settings, UserPlus, LogOut, Trash2, Crown } from 'lucide-react'

interface GroupMember {
  id: string
  role: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

interface Group {
  id: string
  name: string
  description: string | null
  sessionFrequency: string
  myRole: string
  memberCount: number
  members: GroupMember[]
}

export default function GroupsPage() {
  const t = useTranslations()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

  // Create form
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newFrequency, setNewFrequency] = useState('WEEKLY')
  const [creating, setCreating] = useState(false)

  // Add member form
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('MEMBER')
  const [addingMember, setAddingMember] = useState(false)
  const [memberError, setMemberError] = useState('')

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    try {
      const res = await fetch('/api/groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateGroup() {
    if (!newName.trim()) return
    setCreating(true)

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          sessionFrequency: newFrequency,
        }),
      })

      if (res.ok) {
        await fetchGroups()
        setCreateDialogOpen(false)
        setNewName('')
        setNewDescription('')
        setNewFrequency('WEEKLY')
      }
    } catch (error) {
      console.error('Error creating group:', error)
    } finally {
      setCreating(false)
    }
  }

  async function handleAddMember() {
    if (!memberEmail.trim() || !selectedGroup) return
    setAddingMember(true)
    setMemberError('')

    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberEmail,
          role: memberRole,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        await fetchGroups()
        // Refresh selected group
        const updated = groups.find(g => g.id === selectedGroup.id)
        if (updated) setSelectedGroup(updated)
        setAddMemberDialogOpen(false)
        setMemberEmail('')
        setMemberRole('MEMBER')
      } else {
        setMemberError(data.error || 'Erreur')
      }
    } catch (error) {
      setMemberError('Erreur lors de l\'ajout')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedGroup) return
    if (!confirm('Retirer ce membre du groupe ?')) return

    try {
      const res = await fetch(
        `/api/groups/${selectedGroup.id}/members?memberId=${memberId}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        await fetchGroups()
        setDetailDialogOpen(false)
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('Supprimer ce groupe ? Cette action est irréversible.')) return

    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchGroups()
        setDetailDialogOpen(false)
      }
    } catch (error) {
      console.error('Error deleting group:', error)
    }
  }

  function openGroupDetails(group: Group) {
    setSelectedGroup(group)
    setDetailDialogOpen(true)
  }

  function getFrequencyLabel(freq: string) {
    const labels: Record<string, string> = {
      DAILY: 'Quotidien',
      WEEKLY: 'Hebdomadaire',
      BIWEEKLY: 'Bi-mensuel',
      MONTHLY: 'Mensuel',
    }
    return labels[freq] || freq
  }

  function getRoleBadge(role: string) {
    const config: Record<string, { label: string; className: string }> = {
      ADMIN: { label: 'Admin', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
      REFERENT: { label: 'Référent', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
      MEMBER: { label: 'Membre', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' },
    }
    const c = config[role] || config.MEMBER
    return <Badge className={c.className}>{c.label}</Badge>
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.groups')}</h1>
          <p className="text-muted-foreground">Gérez vos groupes d'étude</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              Créer un groupe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un groupe</DialogTitle>
              <DialogDescription>
                Créez un nouveau groupe d'étude coranique
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du groupe</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Groupe Al-Fatiha"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optionnel)</Label>
                <Input
                  id="description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description du groupe"
                />
              </div>
              <div className="space-y-2">
                <Label>Fréquence des séances</Label>
                <Select value={newFrequency} onValueChange={setNewFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Quotidien</SelectItem>
                    <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                    <SelectItem value="BIWEEKLY">Bi-mensuel</SelectItem>
                    <SelectItem value="MONTHLY">Mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={creating || !newName.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {creating ? t('common.loading') : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Vous n'êtes membre d'aucun groupe.<br />
              Créez votre premier groupe pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openGroupDetails(group)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                      <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      {group.description && (
                        <CardDescription className="line-clamp-1">
                          {group.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {group.myRole === 'ADMIN' && (
                    <Crown className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{group.memberCount} membres</span>
                  </div>
                  <Badge variant="outline">{getFrequencyLabel(group.sessionFrequency)}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Group Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedGroup.name}
                  {selectedGroup.myRole === 'ADMIN' && (
                    <Crown className="h-4 w-4 text-amber-500" />
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedGroup.description || 'Aucune description'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fréquence</span>
                  <Badge variant="outline">
                    {getFrequencyLabel(selectedGroup.sessionFrequency)}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Membres ({selectedGroup.members.length})</span>
                    {selectedGroup.myRole === 'ADMIN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddMemberDialogOpen(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-auto">
                    {selectedGroup.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.user.name || member.user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{member.user.name || 'Sans nom'}</p>
                            <p className="text-xs text-muted-foreground">{member.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(member.role)}
                          {selectedGroup.myRole === 'ADMIN' && member.role !== 'ADMIN' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveMember(member.user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex justify-between sm:justify-between">
                {selectedGroup.myRole === 'ADMIN' ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteGroup(selectedGroup.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveMember(selectedGroup.members.find(m => m.role === selectedGroup.myRole)?.user.id || '')}
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Quitter
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
            <DialogDescription>
              Ajoutez un utilisateur par son adresse email
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {memberError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {memberError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Membre</SelectItem>
                  <SelectItem value="REFERENT">Référent</SelectItem>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addingMember || !memberEmail.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {addingMember ? t('common.loading') : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
