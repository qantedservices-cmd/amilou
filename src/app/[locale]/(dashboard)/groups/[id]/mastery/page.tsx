'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ChevronDown, ChevronRight, Users } from 'lucide-react'
import Link from 'next/link'

interface Member {
  id: string
  name: string
}

interface SurahGroup {
  type: 'surah' | 'collapsed'
  number?: number
  nameAr?: string
  nameFr?: string
  start?: number
  end?: number
}

interface MasteryEntry {
  status: string
  validatedWeek: number | null
}

interface MasteryData {
  group: { id: string; name: string }
  members: Member[]
  surahGroups: SurahGroup[]
  masteryMap: Record<string, Record<number, MasteryEntry>>
  isReferent: boolean
  referent: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  'V': 'bg-green-500 text-white',
  'X': 'bg-blue-500 text-white',
  '90%': 'bg-green-300 text-green-900',
  '51%': 'bg-yellow-400 text-yellow-900',
  '50%': 'bg-yellow-300 text-yellow-900',
  'AM': 'bg-orange-400 text-orange-900',
  'S': 'bg-purple-400 text-purple-900',
}

const STATUS_OPTIONS = [
  { value: 'NONE', label: '- Aucun' },
  { value: 'V', label: 'V - Validé' },
  { value: 'X', label: 'X - Connu' },
  { value: '90%', label: '90%' },
  { value: '51%', label: '51%' },
  { value: '50%', label: '50%' },
  { value: 'AM', label: 'AM - À mémoriser' },
  { value: 'S', label: 'S - Récité à un élève' },
]

export default function MasteryPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id: groupId, locale } = use(params)
  const router = useRouter()
  const [data, setData] = useState<MasteryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRanges, setExpandedRanges] = useState<Set<string>>(new Set())

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingCell, setEditingCell] = useState<{ userId: string; userName: string; surahNumber: number; surahName: string } | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editWeek, setEditWeek] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMastery()
  }, [groupId])

  async function fetchMastery() {
    try {
      const res = await fetch(`/api/groups/${groupId}/mastery`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        const json = await res.json()
        setError(json.error || 'Erreur')
      }
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  function toggleExpanded(key: string) {
    const newSet = new Set(expandedRanges)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedRanges(newSet)
  }

  function getCellDisplay(userId: string, surahNumber: number): string {
    const entry = data?.masteryMap[userId]?.[surahNumber]
    if (!entry) return '-'
    if (entry.status === 'V' && entry.validatedWeek) {
      return `V${entry.validatedWeek}`
    }
    if (entry.status === 'S' && entry.validatedWeek) {
      return `S${entry.validatedWeek}`
    }
    return entry.status
  }

  function getCellColor(userId: string, surahNumber: number): string {
    const entry = data?.masteryMap[userId]?.[surahNumber]
    if (!entry) return 'bg-gray-100 dark:bg-gray-800 text-gray-400'
    const baseStatus = entry.status.replace(/\d+$/, '') // Remove trailing numbers
    return STATUS_COLORS[entry.status] || STATUS_COLORS[baseStatus] || 'bg-gray-200 text-gray-700'
  }

  function openEditDialog(userId: string, userName: string, surahNumber: number, surahName: string) {
    if (!data?.isReferent) return
    const entry = data?.masteryMap[userId]?.[surahNumber]
    setEditingCell({ userId, userName, surahNumber, surahName })
    setEditStatus(entry?.status || 'NONE')
    setEditWeek(entry?.validatedWeek?.toString() || '')
    setEditDialogOpen(true)
  }

  async function handleSave() {
    if (!editingCell) return
    setSaving(true)
    try {
      const statusToSend = editStatus === 'NONE' ? '' : editStatus
      const res = await fetch(`/api/groups/${groupId}/mastery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingCell.userId,
          surahNumber: editingCell.surahNumber,
          status: statusToSend,
          validatedWeek: editWeek ? parseInt(editWeek) : null
        })
      })
      if (res.ok) {
        await fetchMastery()
        setEditDialogOpen(false)
      }
    } catch (err) {
      console.error('Error saving:', err)
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

  if (error) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    )
  }

  if (!data) return null

  // Get all surahs for expanded ranges
  const allSurahs = Array.from({ length: 114 }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/groups`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{data.group.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Suivi des sourates - {data.members.length} élèves
            </p>
          </div>
        </div>
        {data.referent && (
          <Badge variant="outline">Référent: {data.referent.name}</Badge>
        )}
      </div>

      {/* Legend */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Légende</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.filter(s => s.value !== 'NONE').map(s => (
              <div key={s.value} className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.value] || 'bg-gray-200'}`}>
                  {s.value}
                </span>
                <span className="text-xs text-muted-foreground">{s.label.split(' - ')[1] || ''}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Matrix */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-background">
                <tr>
                  <th className="sticky left-0 z-30 bg-background border-b border-r p-2 text-left min-w-[200px]">
                    Sourate
                  </th>
                  {data.members.map(member => (
                    <th
                      key={member.id}
                      className="border-b p-2 text-center min-w-[70px] text-xs font-medium"
                    >
                      <div className="truncate max-w-[70px]" title={member.name}>
                        {member.name.split(' ')[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.surahGroups.map((group, idx) => {
                  if (group.type === 'collapsed') {
                    const key = `${group.start}-${group.end}`
                    const isExpanded = expandedRanges.has(key)
                    const count = (group.end || 0) - (group.start || 0) + 1

                    if (isExpanded) {
                      // Render all surahs in this range
                      const surahsInRange = allSurahs.filter(
                        n => n >= (group.start || 0) && n <= (group.end || 0)
                      )
                      return surahsInRange.map((surahNum, subIdx) => (
                        <tr
                          key={`expanded-${surahNum}`}
                          className="hover:bg-muted/50"
                        >
                          <td className="sticky left-0 bg-background border-r p-2">
                            <div className="flex items-center gap-2">
                              {subIdx === 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleExpanded(key)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              )}
                              {subIdx !== 0 && <div className="w-6" />}
                              <span className="text-sm">{surahNum}</span>
                            </div>
                          </td>
                          {data.members.map(member => (
                            <td
                              key={member.id}
                              className={`p-1 text-center border-l ${data.isReferent ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                              onClick={() => openEditDialog(member.id, member.name, surahNum, `Sourate ${surahNum}`)}
                            >
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getCellColor(member.id, surahNum)}`}>
                                {getCellDisplay(member.id, surahNum)}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))
                    }

                    return (
                      <tr
                        key={key}
                        className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleExpanded(key)}
                      >
                        <td className="sticky left-0 bg-muted/30 border-r p-2" colSpan={1}>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <ChevronRight className="h-4 w-4" />
                            <span className="text-sm">
                              Sourates {group.start} - {group.end} ({count} sourates, aucune donnée)
                            </span>
                          </div>
                        </td>
                        {data.members.map(member => (
                          <td key={member.id} className="p-1 text-center border-l text-muted-foreground">
                            -
                          </td>
                        ))}
                      </tr>
                    )
                  }

                  // Regular surah row
                  return (
                    <tr key={group.number} className="hover:bg-muted/50">
                      <td className="sticky left-0 bg-background border-r p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-8">{group.number}</span>
                          <span className="text-sm text-muted-foreground">{group.nameAr}</span>
                        </div>
                      </td>
                      {data.members.map(member => (
                        <td
                          key={member.id}
                          className={`p-1 text-center border-l ${data.isReferent ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                          onClick={() => openEditDialog(member.id, member.name, group.number!, `${group.number} - ${group.nameAr}`)}
                        >
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getCellColor(member.id, group.number!)}`}>
                            {getCellDisplay(member.id, group.number!)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le statut</DialogTitle>
            <DialogDescription>
              {editingCell?.userName} - {editingCell?.surahName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un statut" />
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
            {(editStatus === 'V' || editStatus === 'S') && (
              <div className="space-y-2">
                <Label>Semaine de validation</Label>
                <Input
                  type="number"
                  min="1"
                  max="53"
                  value={editWeek}
                  onChange={(e) => setEditWeek(e.target.value)}
                  placeholder="Ex: 7"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
