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
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default

      // Create PDF in landscape
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Header with gradient effect
      doc.setFillColor(45, 55, 72)
      doc.rect(0, 0, 297, 25, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text(`Grille de suivi`, 14, 12)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(data.group.name, 14, 19)
      doc.setFontSize(10)
      doc.text(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 250, 15)

      // Reset text color
      doc.setTextColor(0, 0, 0)

      // Prepare table headers - member names on 2 lines
      const headers = ['Sourate']
      for (const m of data.members) {
        const parts = m.name.split(' ')
        const lastName = parts.slice(0, -1).join(' ')
        const firstName = parts[parts.length - 1]
        headers.push(`${lastName}\n${firstName}`)
      }

      // Prepare table rows
      const rows: string[][] = []
      for (const group of data.surahGroups) {
        if (group.type === 'surah' && group.number) {
          const surahInfo = data.allSurahsMap[group.number]
          const row = [`${group.number}. ${surahInfo?.nameFr || ''}`]
          for (const member of data.members) {
            row.push(getCellDisplay(member.id, group.number!))
          }
          rows.push(row)
        }
      }

      // Status colors mapping
      const getStatusColor = (text: string): [number, number, number] | null => {
        if (text.startsWith('V')) return [34, 197, 94] // green
        if (text === 'C') return [59, 130, 246] // blue
        if (text === '90%') return [134, 239, 172] // light green
        if (text.includes('50') || text.includes('51')) return [250, 204, 21] // yellow
        if (text === 'AM') return [251, 146, 60] // orange
        if (text.startsWith('S')) return [167, 139, 250] // purple
        return null
      }

      // Add styled table
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 30,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          halign: 'center',
          valign: 'middle',
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [71, 85, 105],
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 35, halign: 'left', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: (hookData: any) => {
          if (hookData.section === 'body' && hookData.column.index > 0) {
            const text = hookData.cell.text.join('')
            const color = getStatusColor(text)
            if (color) {
              hookData.cell.styles.fillColor = color
              hookData.cell.styles.textColor = text === '90%' || text.includes('50') ? [0, 0, 0] : [255, 255, 255]
              hookData.cell.styles.fontStyle = 'bold'
            }
          }
        },
        margin: { left: 10, right: 10 }
      })

      // Collect comments
      const allComments: { member: string; surah: string; week: string; comment: string }[] = []
      for (const member of data.members) {
        const memberComments = data.commentsMap[member.id]
        if (!memberComments) continue
        const parts = member.name.split(' ')
        const firstName = parts[parts.length - 1]

        for (const [surahNum, comments] of Object.entries(memberComments)) {
          const surahInfo = data.allSurahsMap[parseInt(surahNum)]
          for (const c of comments) {
            allComments.push({
              member: firstName,
              surah: `${surahNum}. ${surahInfo?.nameFr || ''}`,
              week: c.weekNumber ? `S${c.weekNumber}` : '-',
              comment: c.comment
            })
          }
        }
      }

      // Comments page if any
      if (allComments.length > 0) {
        doc.addPage()

        // Header
        doc.setFillColor(45, 55, 72)
        doc.rect(0, 0, 297, 20, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Commentaires', 14, 13)
        doc.setTextColor(0, 0, 0)

        // Comments table
        autoTable(doc, {
          head: [['Élève', 'Sourate', 'Sem.', 'Commentaire']],
          body: allComments.map(c => [c.member, c.surah, c.week, c.comment]),
          startY: 25,
          styles: {
            fontSize: 9,
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: 0.1
          },
          headStyles: {
            fillColor: [71, 85, 105],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 40 },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 'auto' }
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 10, right: 10 }
        })
      }

      // Footer on all pages
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${i}/${pageCount}`, 280, 205)
      }

      // Download
      const pdfOutput = doc.output('blob')
      const blobUrl = window.URL.createObjectURL(pdfOutput)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = blobUrl
      a.download = `grille-${data.group.name.replace(/\s+/g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)
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
