'use client'

import { useState, useEffect, use, useRef } from 'react'
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
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Download, FileText, MessageSquare, Plus, Trash2, Users } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
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
  totalVerses?: number
  start?: number
  end?: number
}

interface MasteryEntry {
  status: string
  validatedWeek: number | null
}

interface Comment {
  id: string
  comment: string
  weekNumber: number | null
  createdAt: string
}

interface SurahInfo {
  nameAr: string
  nameFr: string
  totalVerses: number
}

interface MasteryData {
  group: { id: string; name: string }
  members: Member[]
  surahGroups: SurahGroup[]
  allSurahsMap: Record<number, SurahInfo>
  masteryMap: Record<string, Record<number, MasteryEntry>>
  commentsMap: Record<string, Record<number, Comment[]>>
  isReferent: boolean
  referent: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  'V': 'bg-green-500 text-white',
  'X': 'bg-blue-500 text-white',
  'C': 'bg-blue-500 text-white',
  '90%': 'bg-green-300 text-green-900',
  '51%': 'bg-yellow-400 text-yellow-900',
  '50%': 'bg-yellow-300 text-yellow-900',
  'AM': 'bg-orange-400 text-orange-900',
  'S': 'bg-purple-400 text-purple-900',
}

// Display mapping (X stored in DB displays as C)
const STATUS_DISPLAY: Record<string, string> = {
  'X': 'C',
}

const STATUS_OPTIONS = [
  { value: 'NONE', label: '- Aucun' },
  { value: 'V', label: 'V - Validé' },
  { value: 'X', label: 'C - Supposé connu, à valider' },
  { value: '90%', label: '90% - Presque maîtrisé' },
  { value: '51%', label: '51% - Moitié acquise' },
  { value: '50%', label: '50% - Moitié acquise' },
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

  // Comments state
  const [newComment, setNewComment] = useState('')
  const [commentWeek, setCommentWeek] = useState('')
  const [showAllComments, setShowAllComments] = useState(false)
  const [addingComment, setAddingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  // Export state
  const exportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

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
    // Display X as C
    return STATUS_DISPLAY[entry.status] || entry.status
  }

  function getCellColor(userId: string, surahNumber: number): string {
    const entry = data?.masteryMap[userId]?.[surahNumber]
    if (!entry) return 'bg-gray-100 dark:bg-gray-800 text-gray-400'
    const baseStatus = entry.status.replace(/\d+$/, '') // Remove trailing numbers
    return STATUS_COLORS[entry.status] || STATUS_COLORS[baseStatus] || 'bg-gray-200 text-gray-700'
  }

  function hasComments(userId: string, surahNumber: number): boolean {
    const comments = data?.commentsMap?.[userId]?.[surahNumber]
    return !!(comments && comments.length > 0)
  }

  function openEditDialog(userId: string, userName: string, surahNumber: number, surahName: string) {
    if (!data?.isReferent) return
    const entry = data?.masteryMap[userId]?.[surahNumber]
    setEditingCell({ userId, userName, surahNumber, surahName })
    setEditStatus(entry?.status || 'NONE')
    setEditWeek(entry?.validatedWeek?.toString() || '')
    setNewComment('')
    setCommentWeek('')
    setShowAllComments(false)
    setEditDialogOpen(true)
  }

  function getComments(): Comment[] {
    if (!editingCell || !data?.commentsMap) return []
    return data.commentsMap[editingCell.userId]?.[editingCell.surahNumber] || []
  }

  async function handleAddComment() {
    if (!editingCell || !newComment.trim()) return
    setAddingComment(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/mastery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingCell.userId,
          surahNumber: editingCell.surahNumber,
          comment: newComment.trim(),
          weekNumber: commentWeek ? parseInt(commentWeek) : null
        })
      })
      if (res.ok) {
        await fetchMastery()
        setNewComment('')
        setCommentWeek('')
      }
    } catch (err) {
      console.error('Error adding comment:', err)
    } finally {
      setAddingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    setDeletingCommentId(commentId)
    try {
      const res = await fetch(`/api/groups/${groupId}/mastery?commentId=${commentId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await fetchMastery()
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function handleExportPNG() {
    if (!exportRef.current || !data) return
    setExporting(true)
    try {
      const { toPng } = await import('html-to-image')

      // Get the element to capture
      const element = exportRef.current

      // Temporarily remove overflow constraints for full capture
      const scrollContainer = element.querySelector('[class*="overflow-auto"]') as HTMLElement
      const originalMaxHeight = scrollContainer?.style.maxHeight
      const originalOverflow = scrollContainer?.style.overflow
      if (scrollContainer) {
        scrollContainer.style.maxHeight = 'none'
        scrollContainer.style.overflow = 'visible'
      }

      // Remove sticky positioning temporarily
      const stickyElements = element.querySelectorAll('[class*="sticky"]')
      const originalPositions: string[] = []
      stickyElements.forEach((el, i) => {
        const htmlEl = el as HTMLElement
        originalPositions[i] = htmlEl.style.position
        htmlEl.style.position = 'relative'
      })

      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 4,
        style: {
          transform: 'none'
        }
      })

      // Restore original styles
      if (scrollContainer) {
        scrollContainer.style.maxHeight = originalMaxHeight || ''
        scrollContainer.style.overflow = originalOverflow || ''
      }
      stickyElements.forEach((el, i) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.position = originalPositions[i] || ''
      })

      // Download
      const link = document.createElement('a')
      link.download = `grille-suivi-${data.group.name.replace(/\s+/g, '-')}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error exporting:', err)
      alert('Erreur lors de l\'export: ' + (err instanceof Error ? err.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPDF() {
    if (!data) return
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')

      // Create PDF in landscape
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Title
      doc.setFontSize(16)
      doc.text(`Grille de suivi - ${data.group.name}`, 14, 15)
      doc.setFontSize(10)
      doc.text(new Date().toLocaleDateString('fr-FR'), 14, 22)

      // Simple text-based grid
      let y = 35
      const colWidth = 12
      const firstColWidth = 50

      // Header row - member names
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text('Sourate', 14, y)
      data.members.forEach((m, i) => {
        const parts = m.name.split(' ')
        const firstName = parts[parts.length - 1]
        doc.text(firstName.substring(0, 8), 14 + firstColWidth + (i * colWidth), y)
      })
      y += 6

      // Data rows
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      for (const group of data.surahGroups) {
        if (group.type === 'surah' && group.number) {
          if (y > 195) {
            doc.addPage()
            y = 15
          }
          const surahInfo = data.allSurahsMap[group.number]
          doc.text(`${group.number}. ${(surahInfo?.nameFr || '').substring(0, 20)}`, 14, y)

          data.members.forEach((member, i) => {
            const status = getCellDisplay(member.id, group.number)
            doc.text(status, 14 + firstColWidth + (i * colWidth), y)
          })
          y += 4
        }
      }

      // Comments section
      const allComments: string[] = []
      for (const member of data.members) {
        const memberComments = data.commentsMap[member.id]
        if (!memberComments) continue
        const parts = member.name.split(' ')
        const firstName = parts[parts.length - 1]

        for (const [surahNum, comments] of Object.entries(memberComments)) {
          const surahInfo = data.allSurahsMap[parseInt(surahNum)]
          for (const c of comments) {
            const weekLabel = c.weekNumber ? `S${c.weekNumber}` : ''
            allComments.push(`${firstName} - ${surahNum}. ${surahInfo?.nameFr || ''} ${weekLabel}: ${c.comment}`)
          }
        }
      }

      if (allComments.length > 0) {
        doc.addPage()
        doc.setFontSize(14)
        doc.text('Commentaires', 14, 15)
        doc.setFontSize(9)
        let cy = 25
        for (const c of allComments) {
          if (cy > 195) {
            doc.addPage()
            cy = 15
          }
          doc.text(c.substring(0, 100), 14, cy)
          cy += 6
        }
      }

      // Save directly
      doc.save(`grille-${data.group.name.replace(/\s+/g, '-')}.pdf`)
    } catch (err) {
      console.error('Error exporting PDF:', err)
      alert('Erreur PDF: ' + (err instanceof Error ? err.message : 'Erreur'))
    } finally {
      setExporting(false)
    }
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
            <h1 className="text-2xl font-bold">Grille de suivi</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {data.group.name} - {data.members.length} élèves
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPNG}
            disabled={exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          {data.referent && (
            <Badge variant="outline">Référent: {data.referent.name}</Badge>
          )}
        </div>
      </div>

      {/* Exportable area */}
      <div ref={exportRef} className="space-y-4 bg-background p-2">
        {/* Legend */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Légende - {data.group.name}</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex flex-wrap gap-4">
              {STATUS_OPTIONS.filter(s => s.value !== 'NONE').map(s => (
                <div key={s.value} className="flex items-center gap-2">
                  <span className={`w-12 h-6 flex items-center justify-center rounded text-xs font-medium ${STATUS_COLORS[s.value] || 'bg-gray-200'}`}>
                    {STATUS_DISPLAY[s.value] || s.value}
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
                  <th className="sticky left-0 z-30 bg-background border-b border-r p-2 text-left w-[220px]">
                    <span className="text-sm font-medium">Sourate</span>
                  </th>
                  {data.members.map(member => {
                    const nameParts = member.name.split(' ')
                    // Last name = all words except the last, First name = last word
                    const lastName = nameParts.slice(0, -1).join(' ')
                    const firstName = nameParts[nameParts.length - 1]
                    return (
                      <th
                        key={member.id}
                        className="border-b p-1 text-center w-[70px] text-xs"
                      >
                        <div className="flex flex-col items-center" title={member.name}>
                          <span className="font-semibold truncate w-full text-[10px]">{lastName}</span>
                          <span className="text-[10px] text-muted-foreground truncate w-full">{firstName}</span>
                        </div>
                      </th>
                    )
                  })}
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
                      return surahsInRange.map((surahNum, subIdx) => {
                        const surahInfo = data.allSurahsMap[surahNum]
                        return (
                        <tr
                          key={`expanded-${surahNum}`}
                          className="hover:bg-muted/50"
                        >
                          <td className="sticky left-0 bg-background border-r p-2 w-[220px]">
                            <div className="flex items-center gap-1">
                              {subIdx === 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => toggleExpanded(key)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              )}
                              {subIdx !== 0 && <div className="w-6 shrink-0" />}
                              <div className="text-sm leading-snug">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold w-7 text-right">{surahNum}</span>
                                  <span className="font-semibold">{surahInfo?.nameAr}</span>
                                </div>
                                <div className="pl-9 text-xs text-gray-500">
                                  {surahInfo?.nameFr} <span className="text-gray-400">({surahInfo?.totalVerses} v.)</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          {data.members.map(member => (
                            <td
                              key={member.id}
                              className={`p-1 text-center border-l ${data.isReferent ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                              onClick={() => openEditDialog(member.id, member.name, surahNum, `Sourate ${surahNum}`)}
                            >
                              <div className="relative inline-block">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getCellColor(member.id, surahNum)}`}>
                                  {getCellDisplay(member.id, surahNum)}
                                </span>
                                {hasComments(member.id, surahNum) && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" title="Commentaires" />
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      )})
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
                      <td className="sticky left-0 bg-background border-r p-2 w-[220px]">
                        <div className="text-sm leading-snug">
                          <div className="flex items-center gap-2">
                            <span className="font-bold w-7 text-right">{group.number}</span>
                            <span className="font-semibold">{group.nameAr}</span>
                          </div>
                          <div className="pl-9 text-xs text-gray-500">
                            {group.nameFr} <span className="text-gray-400">({group.totalVerses} v.)</span>
                          </div>
                        </div>
                      </td>
                      {data.members.map(member => (
                        <td
                          key={member.id}
                          className={`p-1 text-center border-l ${data.isReferent ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                          onClick={() => openEditDialog(member.id, member.name, group.number!, `${group.number} - ${group.nameAr}`)}
                        >
                          <div className="relative inline-block">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getCellColor(member.id, group.number!)}`}>
                              {getCellDisplay(member.id, group.number!)}
                            </span>
                            {hasComments(member.id, group.number!) && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" title="Commentaires" />
                            )}
                          </div>
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
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le statut</DialogTitle>
            <DialogDescription>
              {editingCell?.userName} - {editingCell?.surahName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Status section */}
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

            {/* Comments section */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <Label className="text-sm font-medium">Commentaires</Label>
              </div>

              {/* Existing comments */}
              {(() => {
                const comments = getComments()
                const visibleComments = showAllComments ? comments : comments.slice(0, 3)
                const hasMore = comments.length > 3

                return (
                  <>
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucun commentaire</p>
                    ) : (
                      <div className="space-y-2">
                        {visibleComments.map((c) => (
                          <div key={c.id} className="flex items-start gap-2 bg-muted/50 rounded p-2 text-sm">
                            <div className="flex-1">
                              {c.weekNumber && (
                                <span className="font-medium text-primary">S{c.weekNumber}: </span>
                              )}
                              <span>{c.comment}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteComment(c.id)}
                              disabled={deletingCommentId === c.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => setShowAllComments(!showAllComments)}
                          >
                            {showAllComments ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Voir moins
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Voir {comments.length - 3} de plus
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Add new comment */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Ajouter un commentaire</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="53"
                    value={commentWeek}
                    onChange={(e) => setCommentWeek(e.target.value)}
                    placeholder="S?"
                    className="w-16"
                  />
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Ex: Hésitation v.8"
                    className="flex-1 min-h-[60px]"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddComment}
                  disabled={addingComment || !newComment.trim()}
                  className="w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {addingComment ? 'Ajout...' : 'Ajouter'}
                </Button>
              </div>
            </div>
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
