'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}

export function JoinOrCreateGroupDialog({ open, onOpenChange, onDone }: Props) {
  // --- Rejoindre ---
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [foundGroup, setFoundGroup] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)

  async function verifyCode() {
    const c = code.trim().toUpperCase()
    if (!c) return
    setChecking(true)
    setJoinError('')
    setFoundGroup(null)
    try {
      const res = await fetch(`/api/join?code=${encodeURIComponent(c)}`)
      const data = await res.json()
      if (res.ok) setFoundGroup(data)
      else setJoinError(data.error || 'Code invalide')
    } catch {
      setJoinError('Erreur réseau')
    } finally {
      setChecking(false)
    }
  }

  async function joinGroup() {
    const c = code.trim().toUpperCase()
    setJoining(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Vous avez rejoint le groupe')
        onOpenChange(false)
        onDone()
      } else {
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setJoining(false)
    }
  }

  // --- Créer ---
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState<'student' | 'supervisor'>('student')
  const [creating, setCreating] = useState(false)

  async function createGroup() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isStudent: role === 'student',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Groupe créé')
        onOpenChange(false)
        onDone()
      } else {
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rejoindre ou créer un groupe</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="join" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="join">Rejoindre</TabsTrigger>
            <TabsTrigger value="create">Créer</TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="join-code">Code d&apos;invitation</Label>
              <div className="flex gap-2">
                <Input
                  id="join-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setFoundGroup(null); setJoinError('') }}
                  placeholder="A3F9C1"
                  maxLength={6}
                  className="uppercase tracking-widest"
                />
                <Button variant="outline" onClick={verifyCode} disabled={checking || !code.trim()}>
                  {checking ? '...' : 'Vérifier'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Demandez le code à 6 caractères à votre référent.</p>
            </div>
            {joinError && <p className="text-sm text-red-600">{joinError}</p>}
            {foundGroup && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="font-medium">{foundGroup.name}</p>
                {foundGroup.description && <p className="text-sm text-muted-foreground">{foundGroup.description}</p>}
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={joinGroup} disabled={joining}>
                  {joining ? 'Inscription...' : 'Rejoindre ce groupe'}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nom du groupe</Label>
              <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon groupe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-desc">Description (optionnel)</Label>
              <Input id="create-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Votre rôle dans ce groupe</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="role" checked={role === 'student'} onChange={() => setRole('student')} />
                Je participe aussi comme élève
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="role" checked={role === 'supervisor'} onChange={() => setRole('supervisor')} />
                Je supervise seulement
              </label>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={createGroup} disabled={creating || !name.trim()}>
              {creating ? 'Création...' : 'Créer le groupe'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
