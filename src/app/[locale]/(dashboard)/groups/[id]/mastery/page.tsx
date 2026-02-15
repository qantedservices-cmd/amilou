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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ArrowLeft, ArrowUpDown, BookOpen, ChevronDown, ChevronRight, ChevronUp, Download, FileText, MessageSquare, Pencil, Plus, Printer, Search, Trash2, Users, Check, X } from 'lucide-react'
import { RichTextEditor, stripHtmlTags } from '@/components/ui/rich-text-editor'
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
  sessionNumber: number | null
  sessionId: string | null
  sessionDate: string | null
  createdAt: string
}

interface SurahInfo {
  nameAr: string
  nameFr: string
  totalVerses: number
}

interface TopicItem {
  label: string
  checked: boolean
  children?: TopicItem[]
}

interface SurahOption {
  number: number
  nameAr: string
  nameFr: string
  totalVerses: number
}

interface ResearchTopic {
  id: string
  sessionNumber: number | null
  assignedTo: string
  question: string
  answer: string | null
  isValidated: boolean
  createdAt: string
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
  nextSessionNumber: number
  totalSessions: number
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
  const [sessionNumber, setSessionNumber] = useState('')
  const [verseStart, setVerseStart] = useState(1)
  const [verseEnd, setVerseEnd] = useState(1)
  const [showAllComments, setShowAllComments] = useState(false)
  const [addingComment, setAddingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [commentSortAsc, setCommentSortAsc] = useState(false)
  const [commentFilter, setCommentFilter] = useState('')

  // Inline editing state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [editingCommentSession, setEditingCommentSession] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  // Export state
  const exportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  // Session report dialog state
  const [sessionReportOpen, setSessionReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportSessionNumber, setReportSessionNumber] = useState(0)
  const [reportTopics, setReportTopics] = useState<TopicItem[]>([])
  const [reportNextSurah, setReportNextSurah] = useState<string>('')
  const [reportHomework, setReportHomework] = useState('')
  const [reportSurahs, setReportSurahs] = useState<SurahOption[]>([])
  const [newTopicLabel, setNewTopicLabel] = useState('')
  const [reportTafsirEntries, setReportTafsirEntries] = useState<Array<{ type: string; surahNumber: number; verseStart: number; verseEnd: number }>>([])
  const [pdfViewerData, setPdfViewerData] = useState<{ blobUrl: string, fileName: string, pdfId: string } | null>(null)
  const [pdfSectionOrder, setPdfSectionOrder] = useState([
    { key: 'pointsAbordes', label: 'Points abordés', enabled: true },
    { key: 'prochaineSourate', label: 'Sourate pour la prochaine séance', enabled: true },
    { key: 'devoirs', label: 'Devoirs Quotidiens', enabled: true },
    { key: 'sensDesVersets', label: 'Lecture sens des versets', enabled: true },
    { key: 'tafsir', label: 'Tafsir', enabled: true },
    { key: 'classement', label: 'Classement élèves', enabled: true },
    { key: 'suiviIndividuel', label: 'Suivi individuel', enabled: true },
    { key: 'grille', label: 'Grille de suivi', enabled: true },
    { key: 'annexeCommentaires', label: 'Annexe 1 - Commentaires sur récitations', enabled: true },
    { key: 'annexeRecherche', label: 'Annexe 2 - Sujets de recherche suite échanges', enabled: true },
    { key: 'annexeArcEnCiel', label: 'Annexe 3 - Lecture Livre Arc en Ciel', enabled: true },
  ])
  const pdfSections = Object.fromEntries(pdfSectionOrder.map(s => [s.key, s.enabled])) as Record<string, boolean>

  // Session range filters for annexes
  const [annexeRechercheFrom, setAnnexeRechercheFrom] = useState(1)
  const [annexeRechercheTo, setAnnexeRechercheTo] = useState(0) // 0 = will be set to reportSessionNumber
  const [annexeArcEnCielFrom, setAnnexeArcEnCielFrom] = useState(1)
  const [annexeArcEnCielTo, setAnnexeArcEnCielTo] = useState(0) // 0 = will be set to reportSessionNumber

  // Research topics state
  const [researchTopicsOpen, setResearchTopicsOpen] = useState(false)
  const [researchTopics, setResearchTopics] = useState<ResearchTopic[]>([])
  const [researchLoading, setResearchLoading] = useState(false)
  const [newResearchSession, setNewResearchSession] = useState('')
  const [newResearchAssignedTo, setNewResearchAssignedTo] = useState('')
  const [newResearchQuestion, setNewResearchQuestion] = useState('')
  const [newResearchAnswer, setNewResearchAnswer] = useState('')
  const [newResearchValidated, setNewResearchValidated] = useState(false)
  const [addingResearch, setAddingResearch] = useState(false)
  const [editingResearchId, setEditingResearchId] = useState<string | null>(null)
  const [editResearchSession, setEditResearchSession] = useState('')
  const [editResearchAssignedTo, setEditResearchAssignedTo] = useState('')
  const [editResearchQuestion, setEditResearchQuestion] = useState('')
  const [editResearchAnswer, setEditResearchAnswer] = useState('')
  const [editResearchValidated, setEditResearchValidated] = useState(false)
  const [savingResearch, setSavingResearch] = useState(false)
  const [deletingResearchId, setDeletingResearchId] = useState<string | null>(null)

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
    setSessionNumber(data.nextSessionNumber.toString())
    const surahInfo = data.allSurahsMap[surahNumber]
    setVerseStart(1)
    setVerseEnd(surahInfo?.totalVerses || 1)
    setShowAllComments(false)
    setEditingCommentId(null)
    setCommentSortAsc(false)
    setCommentFilter('')
    setEditDialogOpen(true)
  }

  function getComments(): Comment[] {
    if (!editingCell || !data?.commentsMap) return []
    let comments = data.commentsMap[editingCell.userId]?.[editingCell.surahNumber] || []

    // Filter by search text
    if (commentFilter.trim()) {
      const search = commentFilter.trim().toLowerCase()
      comments = comments.filter(c =>
        c.comment.toLowerCase().includes(search) ||
        (c.sessionNumber && `s${c.sessionNumber}`.includes(search))
      )
    }

    // Sort: newest first by default, toggle with commentSortAsc
    comments = [...comments].sort((a, b) => {
      const dateA = a.sessionDate || a.createdAt
      const dateB = b.sessionDate || b.createdAt
      return commentSortAsc
        ? new Date(dateA).getTime() - new Date(dateB).getTime()
        : new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    return comments
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
          sessionNumber: sessionNumber ? parseInt(sessionNumber) : null,
          verseStart,
          verseEnd
        })
      })
      if (res.ok) {
        await fetchMastery()
        setNewComment('')
      } else {
        const errorData = await res.json()
        alert('Erreur: ' + (errorData.error || 'Impossible d\'ajouter le commentaire'))
      }
    } catch (err) {
      console.error('Error adding comment:', err)
      alert('Erreur de connexion')
    } finally {
      setAddingComment(false)
    }
  }

  async function handleEditComment() {
    if (!editingCommentId) return
    setSavingComment(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/mastery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: editingCommentId,
          comment: editingCommentText.trim() || undefined,
          sessionNumber: editingCommentSession ? parseInt(editingCommentSession) : undefined
        })
      })
      if (res.ok) {
        await fetchMastery()
        setEditingCommentId(null)
        setEditingCommentText('')
        setEditingCommentSession('')
      } else {
        const errorData = await res.json()
        alert('Erreur: ' + (errorData.error || 'Impossible de modifier le commentaire'))
      }
    } catch (err) {
      console.error('Error editing comment:', err)
      alert('Erreur de connexion')
    } finally {
      setSavingComment(false)
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

  async function fetchResearchTopics() {
    setResearchLoading(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/research-topics`)
      if (res.ok) {
        const json = await res.json()
        setResearchTopics(json.topics || [])
        // Pre-fill session number with latest
        if (json.totalSessions > 0) {
          setNewResearchSession(json.totalSessions.toString())
        }
      }
    } catch (err) {
      console.error('Error fetching research topics:', err)
    } finally {
      setResearchLoading(false)
    }
  }

  function openResearchTopics() {
    setResearchTopicsOpen(true)
    fetchResearchTopics()
  }

  async function handleAddResearchTopic() {
    if (!newResearchAssignedTo.trim() || !newResearchQuestion.trim()) return
    setAddingResearch(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/research-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionNumber: newResearchSession ? parseInt(newResearchSession) : null,
          assignedTo: newResearchAssignedTo.trim(),
          question: newResearchQuestion.trim(),
          answer: newResearchAnswer.trim() || null,
          isValidated: newResearchValidated
        })
      })
      if (res.ok) {
        await fetchResearchTopics()
        setNewResearchAssignedTo('')
        setNewResearchQuestion('')
        setNewResearchAnswer('')
        setNewResearchValidated(false)
      } else {
        const errorData = await res.json()
        alert('Erreur: ' + (errorData.error || 'Impossible d\'ajouter'))
      }
    } catch (err) {
      console.error('Error adding research topic:', err)
      alert('Erreur de connexion')
    } finally {
      setAddingResearch(false)
    }
  }

  function startEditResearch(topic: ResearchTopic) {
    setEditingResearchId(topic.id)
    setEditResearchSession(topic.sessionNumber?.toString() || '')
    setEditResearchAssignedTo(topic.assignedTo)
    setEditResearchQuestion(topic.question)
    setEditResearchAnswer(topic.answer || '')
    setEditResearchValidated(topic.isValidated)
  }

  async function handleSaveResearch() {
    if (!editingResearchId) return
    setSavingResearch(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/research-topics`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingResearchId,
          sessionNumber: editResearchSession ? parseInt(editResearchSession) : null,
          assignedTo: editResearchAssignedTo.trim(),
          question: editResearchQuestion.trim(),
          answer: editResearchAnswer.trim() || null,
          isValidated: editResearchValidated
        })
      })
      if (res.ok) {
        await fetchResearchTopics()
        setEditingResearchId(null)
      } else {
        const errorData = await res.json()
        alert('Erreur: ' + (errorData.error || 'Impossible de modifier'))
      }
    } catch (err) {
      console.error('Error updating research topic:', err)
      alert('Erreur de connexion')
    } finally {
      setSavingResearch(false)
    }
  }

  async function handleDeleteResearch(id: string) {
    setDeletingResearchId(id)
    try {
      const res = await fetch(`/api/groups/${groupId}/research-topics?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await fetchResearchTopics()
      }
    } catch (err) {
      console.error('Error deleting research topic:', err)
    } finally {
      setDeletingResearchId(null)
    }
  }

  async function openSessionReportDialog() {
    if (!data) return
    setSessionReportOpen(true)
    setReportLoading(true)
    try {
      const targetNum = data.nextSessionNumber - 1
      const reportRes = await fetch(`/api/groups/${groupId}/mastery/session-report${targetNum > 0 ? `?sessionNumber=${targetNum}` : ''}`)
      if (reportRes.ok) {
        const json = await reportRes.json()
        const sessionNum = json.sessionNumber || data.nextSessionNumber
        setReportSessionNumber(sessionNum)
        setAnnexeRechercheTo(sessionNum)
        setAnnexeArcEnCielTo(sessionNum)

        // Default topics structure (source of truth for labels and children)
        const defaultTopics: TopicItem[] = [
          { label: 'Suivi individuel de la mémorisation', checked: true },
          { label: 'Préparation de la prochaine sourate en groupe', checked: true, children: [
            { label: 'Récitation', checked: false },
            { label: 'Lecture sens des versets', checked: false },
            { label: 'Tafsir', checked: false },
          ]},
          { label: 'Étude leçon du livre Arc en Ciel', checked: false },
          { label: 'Sujets de recherches', checked: false },
          { label: 'Échanges ouverts', checked: false },
        ]

        // Merge saved topics with defaults: preserve checked state, add missing children
        const savedTopics: TopicItem[] = json.sessionTopics || []
        let mergedTopics: TopicItem[]
        if (savedTopics.length > 0) {
          // Start with defaults, overlay saved checked state
          mergedTopics = defaultTopics.map(dt => {
            // Find matching saved topic by label similarity
            const saved = savedTopics.find(st =>
              st.label === dt.label ||
              dt.label.toLowerCase().includes(st.label.toLowerCase().slice(0, 15)) ||
              st.label.toLowerCase().includes(dt.label.toLowerCase().slice(0, 15))
            )
            const topic: TopicItem = {
              label: dt.label,
              checked: saved ? saved.checked : dt.checked,
            }
            if (dt.children) {
              topic.children = dt.children.map(dc => {
                const savedChild = saved?.children?.find(sc => sc.label === dc.label)
                return { label: dc.label, checked: savedChild ? savedChild.checked : dc.checked }
              })
            }
            return topic
          })
          // Add any custom topics (not in defaults)
          const defaultLabels = defaultTopics.map(d => d.label.toLowerCase())
          const customTopics = savedTopics.filter(st =>
            !defaultLabels.some(dl => dl.includes(st.label.toLowerCase().slice(0, 15)) || st.label.toLowerCase().includes(dl.slice(0, 15)))
          )
          mergedTopics = [...mergedTopics, ...customTopics]
        } else {
          mergedTopics = defaultTopics
        }
        setReportTopics(mergedTopics)
        setReportNextSurah(json.nextSurahNumber?.toString() || '')
        setReportHomework(json.homework || '')
        setReportSurahs(json.surahs || [])
        setReportTafsirEntries(json.tafsirEntries || [])

      }
    } catch (err) {
      console.error('Error loading session report:', err)
    } finally {
      setReportLoading(false)
    }
  }

  function toggleTopic(index: number, childIndex?: number) {
    setReportTopics(prev => prev.map((t, i) => {
      if (i !== index) return t
      if (childIndex !== undefined && t.children) {
        const newChildren = t.children.map((c, ci) => ci === childIndex ? { ...c, checked: !c.checked } : c)
        return { ...t, children: newChildren }
      }
      return { ...t, checked: !t.checked }
    }))
  }

  function addCustomTopic() {
    if (!newTopicLabel.trim()) return
    setReportTopics(prev => [...prev, { label: newTopicLabel.trim(), checked: true }])
    setNewTopicLabel('')
  }

  function removeCustomTopic(index: number) {
    setReportTopics(prev => prev.filter((_, i) => i !== index))
  }

  // Load Amiri font for jsPDF (supports Arabic + accented Latin)
  async function loadPdfArabicSupport(doc: any): Promise<{ hasFont: boolean; reshape: (text: string) => string }> {
    let hasFont = false

    try {
      const fontRes = await fetch('/fonts/Amiri-Regular.ttf')
      const fontData = await fontRes.arrayBuffer()
      const bytes = new Uint8Array(fontData)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      doc.addFileToVFS('Amiri-Regular.ttf', base64)
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
      // Register same font for bold style (no bold TTF available, but prevents fallback to helvetica)
      doc.addFileToVFS('Amiri-Bold.ttf', base64)
      doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold')
      hasFont = true
    } catch (err) {
      console.error('Error loading Arabic font:', err)
    }

    // No reshaping needed: Amiri font + PDF viewer handle Arabic shaping/bidi natively
    const reshape = (text: string): string => {
      if (!text || !hasFont) return ''
      return text
    }

    return { hasFont, reshape }
  }

  // Format surah label for PDF: "الكوثر 108. L'Abondance 3v."
  // Arabic name first as requested
  function surahLabel(num: number, info: SurahInfo | undefined, reshape: (s: string) => string): string {
    const fr = info?.nameFr || ''
    const ar = reshape(info?.nameAr || '')
    const v = info?.totalVerses || '?'
    if (ar) return `${ar}  ${num}. ${fr} ${v}v.`
    return `${num}. ${fr} ${v}v.`
  }

  async function handleGenerateSessionPDF() {
    if (!data) return
    setExporting(true)

    // Save report data to DB first
    try {
      await fetch(`/api/groups/${groupId}/mastery/session-report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionNumber: reportSessionNumber,
          nextSurahNumber: reportNextSurah && reportNextSurah !== 'none' ? parseInt(reportNextSurah) : null,
          homework: reportHomework,
          sessionTopics: reportTopics,
          saveAsDefault: true
        })
      })
    } catch (err) {
      console.error('Error saving session report:', err)
    }

    try {
      const { jsPDF } = await import('jspdf')
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default

      const targetSessionNumber = reportSessionNumber

      // Find session date and weekNumber from comments
      let sessionDate = ''
      let sessionWeekNumber: number | null = null
      for (const memberComments of Object.values(data.commentsMap)) {
        for (const surahComments of Object.values(memberComments)) {
          for (const c of surahComments) {
            if (c.sessionNumber === targetSessionNumber) {
              if (c.sessionDate) {
                sessionDate = new Date(c.sessionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
              }
              if (c.weekNumber) sessionWeekNumber = c.weekNumber
              break
            }
          }
          if (sessionDate) break
        }
        if (sessionDate) break
      }
      if (!sessionDate) {
        sessionDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      }

      // Create PDF
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const { hasFont: hasArabicFont, reshape: reshapeAr } = await loadPdfArabicSupport(doc)
      const pdfFont = hasArabicFont ? 'Amiri' : 'helvetica'

      // Helper: draw section header bar
      const drawSectionHeader = (title: string) => {
        doc.setFillColor(45, 55, 72)
        doc.rect(0, 0, 297, 20, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(16)
        doc.setFont(pdfFont, 'bold')
        doc.text(title, 14, 13)
        doc.setTextColor(0, 0, 0)
      }

      // Helper: status color
      const getStatusColor = (text: string): [number, number, number] | null => {
        if (text.startsWith('V')) return [34, 197, 94]
        if (text === 'C') return [59, 130, 246]
        if (text === '90%') return [134, 239, 172]
        if (text.includes('50') || text.includes('51')) return [250, 204, 21]
        if (text === 'AM') return [251, 146, 60]
        if (text.startsWith('S')) return [167, 139, 250]
        return null
      }

      // Helper: draw legend (3x2 grid centered)
      const drawLegend = (startLegendY: number): number => {
        let lY = startLegendY
        doc.setFontSize(12)
        doc.setFont(pdfFont, 'bold')
        doc.text('Légende :', 14, lY)
        lY += 6
        doc.setFont(pdfFont, 'normal')
        doc.setFontSize(10)
        const items = [
          { code: 'V', color: [34, 197, 94], label: 'Validé', textWhite: true },
          { code: 'C', color: [59, 130, 246], label: 'Supposé connu', textWhite: true },
          { code: '90%', color: [134, 239, 172], label: 'Presque maîtrisé', textWhite: false },
          { code: '51%', color: [250, 204, 21], label: 'Moitié acquise', textWhite: false },
          { code: 'AM', color: [251, 146, 60], label: 'À mémoriser', textWhite: false },
          { code: 'S', color: [167, 139, 250], label: 'Récité à un élève', textWhite: true },
        ]
        const cw = 90
        const sx = (297 - cw * 3) / 2
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const col = i % 3
          const lx = sx + col * cw
          doc.setFillColor(item.color[0], item.color[1], item.color[2])
          doc.rect(lx, lY - 3, 10, 4, 'F')
          doc.setTextColor(item.textWhite ? 255 : 0, item.textWhite ? 255 : 0, item.textWhite ? 255 : 0)
          doc.text(item.code, lx + 5, lY, { align: 'center' })
          doc.setTextColor(0, 0, 0)
          doc.text(item.label, lx + 12, lY)
          if (col === 2) lY += 6
        }
        if (items.length % 3 !== 0) lY += 6
        return lY
      }

      // Pre-compute data for all sections
      // Ranking data
      const rankingData = data.members.map(m => {
        const memberMastery = data.masteryMap[m.id] || {}
        let validatedCount = 0
        for (const entry of Object.values(memberMastery)) {
          if (entry.status === 'V') validatedCount++
        }
        const nameParts = m.name.split(' ')
        const firstName = nameParts[nameParts.length - 1]
        const lastName = nameParts.slice(0, -1).join(' ')
        return { name: `${lastName} ${firstName}`, validated: validatedCount }
      }).sort((a, b) => b.validated - a.validated)

      // Session rows
      const sessionRows: string[][] = []
      for (const member of data.members) {
        const memberComments = data.commentsMap[member.id]
        if (!memberComments) continue
        const nameParts = member.name.split(' ')
        const firstName = nameParts[nameParts.length - 1]
        for (const [surahNum, comments] of Object.entries(memberComments)) {
          for (const c of comments) {
            if (c.sessionNumber === targetSessionNumber) {
              const surahInfo = data.allSurahsMap[parseInt(surahNum)]
              sessionRows.push([
                firstName,
                surahLabel(parseInt(surahNum), surahInfo, reshapeAr),
                `1-${surahInfo?.totalVerses || '?'}`,
                getCellDisplay(member.id, parseInt(surahNum)),
                stripHtmlTags(c.comment)
              ])
            }
          }
        }
      }

      // Past comments
      const pastCommentsByMember: Record<string, { memberName: string; comments: { sessionNum: number; session: string; surah: string; comment: string }[] }> = {}
      for (const member of data.members) {
        const memberComments = data.commentsMap[member.id]
        if (!memberComments) continue
        const nameParts = member.name.split(' ')
        const firstName = nameParts[nameParts.length - 1]
        const lastName = nameParts.slice(0, -1).join(' ')
        const fullName = `${lastName} ${firstName}`
        for (const [surahNum, comments] of Object.entries(memberComments)) {
          const surahInfo = data.allSurahsMap[parseInt(surahNum)]
          for (const c of comments) {
            if (c.sessionNumber && c.sessionNumber < targetSessionNumber) {
              if (!pastCommentsByMember[member.id]) {
                pastCommentsByMember[member.id] = { memberName: fullName, comments: [] }
              }
              const dateStr = c.sessionDate ? new Date(c.sessionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''
              pastCommentsByMember[member.id].comments.push({
                sessionNum: c.sessionNumber,
                session: `S${c.sessionNumber}${dateStr ? ` (${dateStr})` : ''}`,
                surah: surahLabel(parseInt(surahNum), surahInfo, reshapeAr),
                comment: stripHtmlTags(c.comment)
              })
            }
          }
        }
      }
      for (const entry of Object.values(pastCommentsByMember)) {
        entry.comments.sort((a, b) => b.sessionNum - a.sessionNum)
      }
      const membersWithComments = Object.values(pastCommentsByMember).filter(e => e.comments.length > 0)

      // Fetch ALL research topics for Annexe 2
      let allResearchTopics: ResearchTopic[] = []
      try {
        const researchRes = await fetch(`/api/groups/${groupId}/research-topics`)
        if (researchRes.ok) {
          const json = await researchRes.json()
          allResearchTopics = json.topics || []
        }
      } catch (err) {
        console.error('Error fetching research topics for PDF:', err)
      }

      // Map section keys to TOC labels and availability conditions
      // Tafsir entries for PDF
      const pdfSensEntries = reportTafsirEntries.filter(e => e.type === 'SENS')
      const pdfTafsirEntries = reportTafsirEntries.filter(e => e.type === 'TAFSIR')

      const sectionTocLabel: Record<string, string> = {
        pointsAbordes: 'Points abordés de la séance',
        prochaineSourate: 'Sourate pour la prochaine séance',
        devoirs: 'Devoirs Quotidiens',
        sensDesVersets: 'Lecture sens des versets',
        tafsir: 'Tafsir',
        classement: 'Classement des élèves',
        suiviIndividuel: 'Suivi individuel de mémorisation',
        grille: 'Grille de suivi',
        annexeCommentaires: 'Annexe 1 - Commentaires sur récitations',
        annexeRecherche: 'Annexe 2 - Sujets de recherche suite échanges',
        annexeArcEnCiel: 'Annexe 3 - Lecture Livre Arc en Ciel',
      }
      const sectionHasContent: Record<string, boolean> = {
        pointsAbordes: true,
        prochaineSourate: !!(reportNextSurah && reportNextSurah !== 'none'),
        devoirs: !!reportHomework.trim(),
        sensDesVersets: pdfSensEntries.length > 0,
        tafsir: pdfTafsirEntries.length > 0,
        classement: true,
        suiviIndividuel: sessionRows.length > 0,
        grille: true,
        annexeCommentaires: membersWithComments.length > 0,
        annexeRecherche: allResearchTopics.length > 0,
        annexeArcEnCiel: true,
      }

      // Build ordered TOC entries following user-defined order
      const tocEntries: string[] = []
      for (const sec of pdfSectionOrder) {
        if (sec.enabled && sectionHasContent[sec.key] && sectionTocLabel[sec.key]) {
          tocEntries.push(sectionTocLabel[sec.key])
        }
      }

      // Track section page numbers for clickable TOC
      const sectionPages: Record<string, number> = {}

      // ===== PAGE 1: Cover + Table of contents =====
      doc.setFillColor(45, 55, 72)
      doc.rect(0, 0, 297, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.setFont(pdfFont, 'bold')
      doc.text(`Séance N°${targetSessionNumber}${sessionWeekNumber ? ` - Semaine ${sessionWeekNumber}` : ''}`, 14, 14)
      doc.setFontSize(14)
      doc.setFont(pdfFont, 'normal')
      doc.text(`${data.group.name} - ${sessionDate}`, 14, 24)

      doc.setTextColor(0, 0, 0)
      let yPos = 42

      // Table of contents (placeholder - links added at the end)
      doc.setFontSize(14)
      doc.setFont(pdfFont, 'bold')
      doc.text('Table des matières', 14, yPos)
      yPos += 8
      doc.setFont(pdfFont, 'normal')
      doc.setFontSize(13)
      const tocStartY = yPos
      for (let i = 0; i < tocEntries.length; i++) {
        doc.text(`${i + 1}.  ${tocEntries[i]}`, 20, yPos)
        yPos += 7
      }

      // Track whether devoirs was already rendered (when it follows suiviIndividuel on same page)
      let devoirsRendered = false

      // Generate sections in user-defined order
      for (const sec of pdfSectionOrder) {
        if (!sec.enabled || !sectionHasContent[sec.key]) continue

        if (sec.key === 'pointsAbordes') {
          // Points abordés (+ prochaine sourate if it immediately follows or is enabled)
          doc.addPage()
          sectionPages['Points abordés de la séance'] = doc.getNumberOfPages()
          drawSectionHeader('Points abordés de la séance')
          yPos = 28

          if (reportTopics.length > 0) {
            doc.setFontSize(13)
            doc.setFont(pdfFont, 'normal')
            for (const topic of reportTopics) {
              if (topic.checked) {
                doc.setFillColor(34, 197, 94)
              } else {
                doc.setFillColor(200, 200, 200)
              }
              doc.rect(14, yPos - 3, 3, 3, 'F')
              doc.text(`  ${topic.label}`, 18, yPos)
              yPos += 6
              if (topic.children && topic.children.length > 0) {
                doc.setFontSize(11)
                for (const child of topic.children) {
                  if (child.checked) {
                    doc.setFillColor(34, 197, 94)
                  } else {
                    doc.setFillColor(200, 200, 200)
                  }
                  doc.rect(22, yPos - 3, 2.5, 2.5, 'F')
                  doc.text(`  ${child.label}`, 26, yPos)
                  yPos += 5
                }
                doc.setFontSize(13)
              }
            }
            yPos += 4
          }

          // Render prochaineSourate on same page if enabled
          if (pdfSections.prochaineSourate && reportNextSurah && reportNextSurah !== 'none') {
            sectionPages['Sourate pour la prochaine séance'] = doc.getNumberOfPages()
            const surahInfo = reportSurahs.find(s => s.number === parseInt(reportNextSurah))
            if (surahInfo) {
              doc.setFontSize(13)
              doc.setFont(pdfFont, 'bold')
              doc.setTextColor(220, 38, 38) // Red
              const nextSurahLbl = surahLabel(surahInfo.number, { nameAr: surahInfo.nameAr, nameFr: surahInfo.nameFr, totalVerses: surahInfo.totalVerses }, reshapeAr)
              doc.text(`Sourate pour la prochaine séance : ${nextSurahLbl}`, 14, yPos)
              doc.setTextColor(0, 0, 0) // Reset to black
              yPos += 8
            }
          }
        } else if (sec.key === 'prochaineSourate') {
          // If pointsAbordes was before this in the order, it was already rendered on that page
          // If pointsAbordes is disabled or comes after, render prochaineSourate standalone
          const pointsAbIdx = pdfSectionOrder.findIndex(s => s.key === 'pointsAbordes')
          const prochaineIdx = pdfSectionOrder.findIndex(s => s.key === 'prochaineSourate')
          const pointsAbEnabled = pdfSections.pointsAbordes
          if (!pointsAbEnabled || pointsAbIdx > prochaineIdx) {
            // Render standalone
            doc.addPage()
            sectionPages['Sourate pour la prochaine séance'] = doc.getNumberOfPages()
            drawSectionHeader('Sourate pour la prochaine séance')
            yPos = 28
            const surahInfo = reportSurahs.find(s => s.number === parseInt(reportNextSurah))
            if (surahInfo) {
              doc.setFontSize(13)
              doc.setFont(pdfFont, 'bold')
              doc.setTextColor(220, 38, 38) // Red
              const nextSurahLbl = surahLabel(surahInfo.number, { nameAr: surahInfo.nameAr, nameFr: surahInfo.nameFr, totalVerses: surahInfo.totalVerses }, reshapeAr)
              doc.text(`Sourate pour la prochaine séance : ${nextSurahLbl}`, 14, yPos)
              doc.setTextColor(0, 0, 0) // Reset to black
            }
          }
          // else: already rendered with pointsAbordes
        } else if (sec.key === 'sensDesVersets') {
          // Render on the current page if there's room, or on a new page
          doc.addPage()
          sectionPages['Lecture sens des versets'] = doc.getNumberOfPages()
          drawSectionHeader('Lecture sens des versets')
          yPos = 28
          doc.setFontSize(13)
          doc.setFont(pdfFont, 'normal')
          for (const entry of pdfSensEntries) {
            const surahInfo = reportSurahs.find(s => s.number === entry.surahNumber)
            const surahName = surahInfo ? `${surahInfo.nameFr}` : `Sourate ${entry.surahNumber}`
            doc.text(`- Sourate ${entry.surahNumber} (${surahName}), versets ${entry.verseStart}-${entry.verseEnd}`, 14, yPos)
            yPos += 6
          }
        } else if (sec.key === 'tafsir') {
          doc.addPage()
          sectionPages['Tafsir'] = doc.getNumberOfPages()
          drawSectionHeader('Tafsir')
          yPos = 28
          doc.setFontSize(13)
          doc.setFont(pdfFont, 'normal')
          for (const entry of pdfTafsirEntries) {
            const surahInfo = reportSurahs.find(s => s.number === entry.surahNumber)
            const surahName = surahInfo ? `${surahInfo.nameFr}` : `Sourate ${entry.surahNumber}`
            doc.text(`- Sourate ${entry.surahNumber} (${surahName}), versets ${entry.verseStart}-${entry.verseEnd}`, 14, yPos)
            yPos += 6
          }
        } else if (sec.key === 'classement') {
          doc.addPage()
          sectionPages['Classement des élèves'] = doc.getNumberOfPages()
          drawSectionHeader('Classement des élèves')

          autoTable(doc, {
            head: [['#', 'Élève', 'Sourates validées']],
            body: rankingData.map((r, i) => [(i + 1).toString(), r.name, r.validated.toString()]),
            startY: 25,
            styles: {
              font: pdfFont,
              fontSize: 12,
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
              0: { cellWidth: 15, halign: 'center' },
              1: { cellWidth: 80 },
              2: { cellWidth: 40, halign: 'center' }
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            didParseCell: (hookData: any) => {
              if (hookData.section === 'body' && hookData.column.index === 0) {
                const rank = parseInt(hookData.cell.text[0])
                if (rank === 1) { hookData.cell.styles.fillColor = [255, 215, 0]; hookData.cell.styles.fontStyle = 'bold' }
                else if (rank === 2) { hookData.cell.styles.fillColor = [192, 192, 192]; hookData.cell.styles.fontStyle = 'bold' }
                else if (rank === 3) { hookData.cell.styles.fillColor = [205, 127, 50]; hookData.cell.styles.textColor = [255, 255, 255]; hookData.cell.styles.fontStyle = 'bold' }
              }
            },
            margin: { left: 60, right: 60 }
          })
        } else if (sec.key === 'suiviIndividuel') {
          doc.addPage()
          sectionPages['Suivi individuel de mémorisation'] = doc.getNumberOfPages()
          drawSectionHeader('Suivi individuel de mémorisation')

          autoTable(doc, {
            head: [['Élève', 'Sourate', 'Versets', 'Statut', 'Commentaire']],
            body: sessionRows,
            startY: 25,
            styles: {
              font: pdfFont,
              fontSize: 12,
              cellPadding: 3,
              lineColor: [200, 200, 200],
              lineWidth: 0.1
            },
            headStyles: {
              fillColor: [71, 85, 105],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 12
            },
            columnStyles: {
              0: { cellWidth: 28 },
              1: { cellWidth: 60 },
              2: { cellWidth: 18, halign: 'center' },
              3: { cellWidth: 18, halign: 'center' },
              4: { cellWidth: 'auto' }
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            margin: { left: 10, right: 10 }
          })
          yPos = (doc as any).lastAutoTable.finalY + 8

          // If devoirs is the next enabled section, render it on same page if it fits
          const suiviIdx = pdfSectionOrder.findIndex(s => s.key === 'suiviIndividuel')
          const nextEnabled = pdfSectionOrder.slice(suiviIdx + 1).find(s => s.enabled && sectionHasContent[s.key])
          if (nextEnabled?.key === 'devoirs' && reportHomework.trim()) {
            if (yPos > 170) {
              doc.addPage()
              yPos = 15
            }
            sectionPages['Devoirs Quotidiens'] = doc.getNumberOfPages()
            doc.setFontSize(13)
            doc.setFont(pdfFont, 'bold')
            doc.text('Devoirs Quotidiens :', 14, yPos)
            yPos += 6
            doc.setFont(pdfFont, 'normal')
            doc.setFontSize(12)
            const homeworkLines = reportHomework.split('\n')
            for (const line of homeworkLines) {
              if (yPos > 195) {
                doc.addPage()
                yPos = 15
              }
              doc.text(line, 14, yPos)
              yPos += 5
            }
            devoirsRendered = true
          }
        } else if (sec.key === 'devoirs') {
          if (devoirsRendered) continue
          doc.addPage()
          sectionPages['Devoirs Quotidiens'] = doc.getNumberOfPages()
          drawSectionHeader('Devoirs Quotidiens')
          yPos = 28
          doc.setFont(pdfFont, 'normal')
          doc.setFontSize(12)
          const homeworkLines = reportHomework.split('\n')
          for (const line of homeworkLines) {
            if (yPos > 195) {
              doc.addPage()
              yPos = 15
            }
            doc.text(line, 14, yPos)
            yPos += 5
          }
        } else if (sec.key === 'grille') {
          doc.addPage()
          sectionPages['Grille de suivi'] = doc.getNumberOfPages()
          drawSectionHeader('Grille de suivi')

          const gridHeaders = ['Sourate']
          for (const m of data.members) {
            const parts = m.name.split(' ')
            const lastName = parts.slice(0, -1).join(' ')
            const firstName = parts[parts.length - 1]
            gridHeaders.push(`${lastName}\n${firstName}`)
          }

          const gridRows: string[][] = []
          for (const group of data.surahGroups) {
            if (group.type === 'surah' && group.number) {
              const surahInfo = data.allSurahsMap[group.number]
              const row = [surahLabel(group.number!, surahInfo, reshapeAr)]
              for (const member of data.members) {
                row.push(getCellDisplay(member.id, group.number!))
              }
              gridRows.push(row)
            }
          }

          autoTable(doc, {
            head: [gridHeaders],
            body: gridRows,
            startY: 25,
            styles: {
              font: pdfFont,
              fontSize: 11,
              cellPadding: 2,
              halign: 'center',
              valign: 'middle',
              lineColor: [200, 200, 200],
              lineWidth: 0.1
            },
            headStyles: {
              fillColor: [71, 85, 105],
              textColor: [255, 255, 255],
              fontSize: 11,
              fontStyle: 'bold',
              halign: 'center'
            },
            columnStyles: {
              0: { cellWidth: 60, halign: 'left', fontStyle: 'bold' }
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

          let legendY = (doc as any).lastAutoTable?.finalY + 8 || 180
          if (legendY > 180) {
            doc.addPage()
            legendY = 15
          }
          drawLegend(legendY)
        } else if (sec.key === 'annexeCommentaires') {
          doc.addPage()
          sectionPages['Annexe 1 - Commentaires sur récitations'] = doc.getNumberOfPages()
          drawSectionHeader('Annexe 1 - Commentaires sur récitations')

          let annexeY = 25

          for (const entry of membersWithComments) {
            if (annexeY > 180) {
              doc.addPage()
              annexeY = 15
            }

            doc.setFontSize(12)
            doc.setFont(pdfFont, 'bold')
            doc.setFillColor(226, 232, 240)
            doc.rect(10, annexeY - 4, 277, 6, 'F')
            doc.text(entry.memberName, 14, annexeY)
            annexeY += 4

            autoTable(doc, {
              head: [['Séance', 'Sourate', 'Commentaire']],
              body: entry.comments.map(c => [c.session, c.surah, c.comment]),
              startY: annexeY,
              styles: {
                font: pdfFont,
                fontSize: 11,
                cellPadding: 2,
                lineColor: [200, 200, 200],
                lineWidth: 0.1
              },
              headStyles: {
                fillColor: [71, 85, 105],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 11
              },
              columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 60 },
                2: { cellWidth: 'auto' }
              },
              alternateRowStyles: {
                fillColor: [248, 250, 252]
              },
              margin: { left: 10, right: 10 }
            })
            annexeY = (doc as any).lastAutoTable.finalY + 6
          }
        } else if (sec.key === 'annexeRecherche') {
          doc.addPage()
          sectionPages['Annexe 2 - Sujets de recherche suite échanges'] = doc.getNumberOfPages()
          drawSectionHeader('Annexe 2 - Sujets de recherche suite échanges')

          const sortedTopics = [...allResearchTopics]
            .filter(t => {
              if (t.sessionNumber === null) return true
              return t.sessionNumber >= annexeRechercheFrom && t.sessionNumber <= annexeRechercheTo
            })
            .sort((a, b) => {
              if (a.sessionNumber === null) return 1
              if (b.sessionNumber === null) return -1
              return b.sessionNumber - a.sessionNumber
            })

          const researchRows = sortedTopics.map(t => [
            t.sessionNumber ? `S${t.sessionNumber}` : '-',
            t.assignedTo,
            t.question,
            t.answer || '',
            t.isValidated ? 'Oui' : ''
          ])

          autoTable(doc, {
            head: [['Séance', 'Élève', 'Question', 'Réponse', 'Validé']],
            body: researchRows,
            startY: 25,
            styles: {
              font: pdfFont,
              fontSize: 11,
              cellPadding: 2,
              lineColor: [200, 200, 200],
              lineWidth: 0.1
            },
            headStyles: {
              fillColor: [71, 85, 105],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 11
            },
            columnStyles: {
              0: { cellWidth: 18, halign: 'center' },
              1: { cellWidth: 28 },
              2: { cellWidth: 72 },
              3: { cellWidth: 144 },
              4: { cellWidth: 15, halign: 'center' }
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            didParseCell: (hookData: any) => {
              if (hookData.section === 'body' && hookData.column.index === 4) {
                if (hookData.cell.text.join('') === 'Oui') {
                  hookData.cell.styles.fillColor = [34, 197, 94]
                  hookData.cell.styles.textColor = [255, 255, 255]
                  hookData.cell.styles.fontStyle = 'bold'
                }
              }
            },
            margin: { left: 10, right: 10 }
          })
        } else if (sec.key === 'annexeArcEnCiel') {
          doc.addPage()
          sectionPages['Annexe 3 - Lecture Livre Arc en Ciel'] = doc.getNumberOfPages()
          drawSectionHeader('Annexe 3 - Lecture Livre Arc en Ciel')

          const arcEnCielDataAll = [
            ['1', 'La croyance musulmane', '1', 'Noms et Attributs d\'Allah', 'S2', 'S2'],
            ['1', 'La croyance musulmane', '2', 'Les Anges', 'S4', 'S4'],
            ['1', 'La croyance musulmane', '3', 'Les Djinns', 'S6', 'S6'],
            ['1', 'La croyance musulmane', '4', 'La naissance de Isa (Jésus) Qu\'Allah Le Très le Salue', 'S8', 'S8'],
            ['1', 'La croyance musulmane', '5', 'Les Prophètes et Messagers', 'S10', 'S10'],
          ]

          const arcEnCielData = arcEnCielDataAll.filter(row => {
            const sMatch = row[4].match(/^S(\d+)$/)
            if (!sMatch) return true
            const sNum = parseInt(sMatch[1])
            return sNum >= annexeArcEnCielFrom && sNum <= annexeArcEnCielTo
          })

          // Highlight rows where session number matches current session
          const currentSessionLabel = `S${reportSessionNumber}`

          autoTable(doc, {
            head: [['Ch.', 'Titre Chapitre', 'N°', 'Titre Cours', 'Lecture', 'Q/R']],
            body: arcEnCielData,
            startY: 25,
            styles: {
              font: pdfFont,
              fontSize: 11,
              cellPadding: 2,
              lineColor: [200, 200, 200],
              lineWidth: 0.1
            },
            headStyles: {
              fillColor: [71, 85, 105],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 11
            },
            columnStyles: {
              0: { cellWidth: 14, halign: 'center' },
              1: { cellWidth: 55 },
              2: { cellWidth: 14, halign: 'center' },
              3: { cellWidth: 120 },
              4: { cellWidth: 30, halign: 'center' },
              5: { cellWidth: 30, halign: 'center' }
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            didParseCell: (hookData: any) => {
              if (hookData.section === 'body') {
                const cellText = hookData.cell.text.join('')
                // Highlight cells matching current session
                if (cellText === currentSessionLabel && (hookData.column.index === 4 || hookData.column.index === 5)) {
                  hookData.cell.styles.fillColor = [34, 197, 94]
                  hookData.cell.styles.textColor = [255, 255, 255]
                  hookData.cell.styles.fontStyle = 'bold'
                }
              }
            },
            margin: { left: 10, right: 10 }
          })
        }
      }

      // Add clickable TOC links on page 1
      doc.setPage(1)
      doc.setTextColor(30, 64, 175) // Blue for links
      doc.setFontSize(13)
      doc.setFont(pdfFont, 'normal')
      for (let i = 0; i < tocEntries.length; i++) {
        const entry = tocEntries[i]
        const entryY = tocStartY + i * 7
        const targetPage = sectionPages[entry]
        if (targetPage) {
          // Add internal link (x, y, w, h, {pageNumber})
          doc.link(18, entryY - 5, 200, 7, { pageNumber: targetPage })
        }
      }
      // Re-render TOC text in blue with page numbers
      for (let i = 0; i < tocEntries.length; i++) {
        const entry = tocEntries[i]
        const entryY = tocStartY + i * 7
        const targetPage = sectionPages[entry]
        // White rect to clear previous text
        doc.setFillColor(255, 255, 255)
        doc.rect(18, entryY - 5, 260, 7, 'F')
        // Re-draw in blue
        doc.setTextColor(30, 64, 175)
        const pageStr = targetPage ? `  (p.${targetPage})` : ''
        doc.text(`${i + 1}.  ${entry}${pageStr}`, 20, entryY)
      }
      doc.setTextColor(0, 0, 0)

      // Footer on all pages
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${i}/${pageCount}`, 280, 205)
      }

      const fileName = `seance-${targetSessionNumber}-${data.group.name.replace(/\s+/g, '-').toLowerCase()}.pdf`
      const blob = doc.output('blob')
      const blobUrl = URL.createObjectURL(blob)

      // Upload to server for reliable HTTP download
      let pdfId = ''
      try {
        const pdfBase64 = doc.output('datauristring').split(',')[1]
        const uploadRes = await fetch('/api/pdf-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: pdfBase64, fileName }),
        })
        if (uploadRes.ok) {
          const json = await uploadRes.json()
          pdfId = json.id
        }
      } catch { /* fallback: download won't work but viewer still will */ }

      // Show PDF in a dialog on the same page
      setPdfViewerData({ blobUrl, fileName, pdfId })

      setSessionReportOpen(false)
    } catch (err) {
      console.error('Error exporting session PDF:', err)
      alert('Erreur PDF: ' + (err instanceof Error ? err.message : 'Erreur'))
    } finally {
      setExporting(false)
    }
  }

  async function handleSave() {
    if (!editingCell) return
    setSaving(true)
    try {
      // Save pending comment if there is one
      if (newComment.trim()) {
        const commentRes = await fetch(`/api/groups/${groupId}/mastery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editingCell.userId,
            surahNumber: editingCell.surahNumber,
            comment: newComment.trim(),
            sessionNumber: sessionNumber ? parseInt(sessionNumber) : null,
            verseStart,
            verseEnd
          })
        })
        if (!commentRes.ok) {
          const errorData = await commentRes.json()
          alert('Erreur: ' + (errorData.error || 'Impossible d\'ajouter le commentaire'))
          setSaving(false)
          return
        }
        setNewComment('')
      }

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
            onClick={openSessionReportDialog}
            disabled={exporting}
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF Séance
          </Button>
          {data.isReferent && (
            <Button
              variant="outline"
              size="sm"
              onClick={openResearchTopics}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Recherches
            </Button>
          )}
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
                  <th className="sticky left-0 z-30 bg-background border-b border-r p-2 text-left w-[140px] md:w-[220px]">
                    <span className="text-xs md:text-sm font-medium">Sourate</span>
                  </th>
                  {data.members.map(member => {
                    const nameParts = member.name.split(' ')
                    // Last name = all words except the last, First name = last word
                    const lastName = nameParts.slice(0, -1).join(' ')
                    const firstName = nameParts[nameParts.length - 1]
                    return (
                      <th
                        key={member.id}
                        className="border-b p-1 text-center w-[60px] md:w-[70px] text-xs"
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
                          <td className="sticky left-0 z-10 bg-background border-r p-2 w-[140px] md:w-[220px]">
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
                              <div className="text-xs md:text-sm leading-snug">
                                <div className="flex items-center gap-1 md:gap-2">
                                  <span className="font-bold w-6 md:w-7 text-right">{surahNum}</span>
                                  <span className="font-semibold">{surahInfo?.nameAr}</span>
                                </div>
                                <div className="pl-7 md:pl-9 text-[10px] md:text-xs text-gray-500">
                                  {surahInfo?.nameFr} <span className="text-gray-400">({surahInfo?.totalVerses} v.)</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          {data.members.map(member => (
                            <td
                              key={member.id}
                              className={`p-1 text-center border-l ${data.isReferent ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                              onClick={() => {
                                const si = data.allSurahsMap[surahNum]
                                openEditDialog(member.id, member.name, surahNum, `${surahNum}. ${si?.nameFr || ''} (${si?.nameAr || ''}) - ${si?.totalVerses || '?'} v.`)
                              }}
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
                        <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 border-r p-2" colSpan={1}>
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
                      <td className="sticky left-0 z-10 bg-background border-r p-2 w-[140px] md:w-[220px]">
                        <div className="text-xs md:text-sm leading-snug">
                          <div className="flex items-center gap-1 md:gap-2">
                            <span className="font-bold w-6 md:w-7 text-right">{group.number}</span>
                            <span className="font-semibold">{group.nameAr}</span>
                          </div>
                          <div className="pl-7 md:pl-9 text-[10px] md:text-xs text-gray-500">
                            {group.nameFr} <span className="text-gray-400">({group.totalVerses} v.)</span>
                          </div>
                        </div>
                      </td>
                      {data.members.map(member => (
                        <td
                          key={member.id}
                          className={`p-1 text-center border-l ${data.isReferent ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                          onClick={() => openEditDialog(member.id, member.name, group.number!, `${group.number}. ${group.nameFr || ''} (${group.nameAr || ''}) - ${group.totalVerses || '?'} v.`)}
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

              {/* Filter and sort controls */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Filtrer..."
                    value={commentFilter}
                    onChange={(e) => setCommentFilter(e.target.value)}
                    className="h-7 text-xs pl-7"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => setCommentSortAsc(!commentSortAsc)}
                  title={commentSortAsc ? 'Plus ancien → récent' : 'Plus récent → ancien'}
                >
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  {commentSortAsc ? 'Ancien' : 'Récent'}
                </Button>
              </div>

              {/* Existing comments */}
              {(() => {
                const comments = getComments()
                const visibleComments = showAllComments ? comments : comments.slice(0, 3)
                const hasMore = comments.length > 3

                const formatSessionDate = (dateStr: string | null) => {
                  if (!dateStr) return ''
                  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                }

                return (
                  <>
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucun commentaire</p>
                    ) : (
                      <div className="space-y-2">
                        {visibleComments.map((c) => (
                          <div key={c.id} className="bg-muted/50 rounded p-2 text-sm">
                            {editingCommentId === c.id ? (
                              // Inline editing mode
                              <div className="space-y-2">
                                <div className="flex gap-2 items-center">
                                  <Label className="text-xs shrink-0">Séance</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={editingCommentSession}
                                    onChange={(e) => setEditingCommentSession(e.target.value)}
                                    className="w-20 h-7 text-xs"
                                  />
                                </div>
                                <RichTextEditor
                                  value={editingCommentText}
                                  onChange={setEditingCommentText}
                                  placeholder="Commentaire..."
                                  className="min-h-[60px]"
                                />
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setEditingCommentId(null)
                                      setEditingCommentText('')
                                      setEditingCommentSession('')
                                    }}
                                    disabled={savingComment}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Annuler
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={handleEditComment}
                                    disabled={savingComment}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    {savingComment ? 'Sauvegarde...' : 'Sauvegarder'}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // Display mode
                              <div className="flex items-start gap-2">
                                <div className="flex-1">
                                  <span className="font-medium text-primary">
                                    S{c.sessionNumber || '?'}
                                    {c.sessionDate && (
                                      <span className="text-muted-foreground font-normal text-xs ml-1">
                                        ({formatSessionDate(c.sessionDate)})
                                      </span>
                                    )}
                                    {': '}
                                  </span>
                                  <span dangerouslySetInnerHTML={{ __html: c.comment }} />
                                </div>
                                <div className="flex shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                    onClick={() => {
                                      setEditingCommentId(c.id)
                                      setEditingCommentText(c.comment)
                                      setEditingCommentSession(c.sessionNumber?.toString() || '')
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteComment(c.id)}
                                    disabled={deletingCommentId === c.id}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
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
                <div className="flex gap-2 items-center">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Séance</Label>
                    <Input
                      type="number"
                      min="1"
                      value={sessionNumber}
                      onChange={(e) => setSessionNumber(e.target.value)}
                      className="w-20 h-8 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Versets</Label>
                    <div className="flex gap-1 items-center">
                      <Input
                        type="number"
                        min="1"
                        value={verseStart}
                        onChange={(e) => setVerseStart(parseInt(e.target.value) || 1)}
                        className="w-14 h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">-</span>
                      <Input
                        type="number"
                        min="1"
                        value={verseEnd}
                        onChange={(e) => setVerseEnd(parseInt(e.target.value) || 1)}
                        className="w-14 h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <RichTextEditor
                  value={newComment}
                  onChange={setNewComment}
                  placeholder="Ex: Hésitation v.8"
                />
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

      {/* Research Topics Sheet */}
      <Sheet open={researchTopicsOpen} onOpenChange={setResearchTopicsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sujets de recherche</SheetTitle>
            <SheetDescription>{data.group.name}</SheetDescription>
          </SheetHeader>

          {researchLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement...</div>
          ) : (
            <div className="space-y-4 mt-4">
              {/* Add new topic form */}
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <Label className="text-sm font-medium">Nouveau sujet</Label>
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Séance</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newResearchSession}
                      onChange={(e) => setNewResearchSession(e.target.value)}
                      className="w-20 h-8 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <Label className="text-xs">Élève(s)</Label>
                    <Input
                      value={newResearchAssignedTo}
                      onChange={(e) => setNewResearchAssignedTo(e.target.value)}
                      placeholder="Nom ou 'Tous'"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Question</Label>
                  <Textarea
                    value={newResearchQuestion}
                    onChange={(e) => setNewResearchQuestion(e.target.value)}
                    placeholder="Question de recherche..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Réponse (optionnel)</Label>
                  <Textarea
                    value={newResearchAnswer}
                    onChange={(e) => setNewResearchAnswer(e.target.value)}
                    placeholder="Éléments de réponse..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="new-research-validated"
                      checked={newResearchValidated}
                      onCheckedChange={(checked) => setNewResearchValidated(checked === true)}
                    />
                    <Label htmlFor="new-research-validated" className="text-xs">Validé</Label>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddResearchTopic}
                    disabled={addingResearch || !newResearchAssignedTo.trim() || !newResearchQuestion.trim()}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {addingResearch ? 'Ajout...' : 'Ajouter'}
                  </Button>
                </div>
              </div>

              {/* List of existing topics grouped by session */}
              {(() => {
                // Group by session number (descending)
                const grouped = new Map<number | null, ResearchTopic[]>()
                for (const t of researchTopics) {
                  const key = t.sessionNumber
                  if (!grouped.has(key)) grouped.set(key, [])
                  grouped.get(key)!.push(t)
                }
                // Sort groups: descending session number, null at end
                const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
                  if (a === null) return 1
                  if (b === null) return -1
                  return b - a
                })

                return sortedKeys.map(sessionNum => (
                  <div key={sessionNum ?? 'none'} className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-1">
                      {sessionNum ? `Séance ${sessionNum}` : 'Sans séance'}
                    </h3>
                    {grouped.get(sessionNum)!.map(topic => (
                      <div key={topic.id} className="border rounded p-2 text-sm space-y-1">
                        {editingResearchId === topic.id ? (
                          // Edit mode
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <div className="flex flex-col gap-1">
                                <Label className="text-xs">Séance</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={editResearchSession}
                                  onChange={(e) => setEditResearchSession(e.target.value)}
                                  className="w-20 h-7 text-xs"
                                />
                              </div>
                              <div className="flex flex-col gap-1 flex-1">
                                <Label className="text-xs">Élève(s)</Label>
                                <Input
                                  value={editResearchAssignedTo}
                                  onChange={(e) => setEditResearchAssignedTo(e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </div>
                            </div>
                            <Textarea
                              value={editResearchQuestion}
                              onChange={(e) => setEditResearchQuestion(e.target.value)}
                              rows={2}
                              className="text-xs"
                              placeholder="Question"
                            />
                            <Textarea
                              value={editResearchAnswer}
                              onChange={(e) => setEditResearchAnswer(e.target.value)}
                              rows={2}
                              className="text-xs"
                              placeholder="Réponse"
                            />
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`edit-validated-${topic.id}`}
                                checked={editResearchValidated}
                                onCheckedChange={(checked) => setEditResearchValidated(checked === true)}
                              />
                              <Label htmlFor={`edit-validated-${topic.id}`} className="text-xs">Validé</Label>
                            </div>
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setEditingResearchId(null)}
                                disabled={savingResearch}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Annuler
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleSaveResearch}
                                disabled={savingResearch}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                {savingResearch ? 'Sauvegarde...' : 'Sauvegarder'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">{topic.assignedTo}</Badge>
                                {topic.isValidated && (
                                  <Badge className="bg-green-500 text-white text-xs">Validé</Badge>
                                )}
                              </div>
                              <p className="font-medium">{topic.question}</p>
                              {topic.answer && (
                                <p className="text-muted-foreground text-xs">{topic.answer.length > 120 ? topic.answer.slice(0, 120) + '...' : topic.answer}</p>
                              )}
                            </div>
                            <div className="flex shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() => startEditResearch(topic)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteResearch(topic.id)}
                                disabled={deletingResearchId === topic.id}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              })()}

              {researchTopics.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">Aucun sujet de recherche</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Session Report Dialog */}
      <Dialog open={sessionReportOpen} onOpenChange={setSessionReportOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rapport de séance</DialogTitle>
            <DialogDescription>
              {data.group.name} — Séance N°{reportSessionNumber}
            </DialogDescription>
          </DialogHeader>

          {reportLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement...</div>
          ) : (
            <div className="grid gap-4 py-4">
              {/* Checklist */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Points abordés</Label>
                <div className="space-y-1">
                  {reportTopics.map((topic, idx) => (
                    <div key={idx}>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={topic.checked}
                          onChange={() => toggleTopic(idx)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm flex-1">{topic.label}</span>
                        {/* Allow removing non-default items (index >= 5) */}
                        {idx >= 5 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => removeCustomTopic(idx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {/* Sub-items */}
                      {topic.children && topic.children.length > 0 && (
                        <div className="ml-6 mt-1 space-y-1">
                          {topic.children.map((child, cidx) => (
                            <div key={cidx} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={child.checked}
                                onChange={() => toggleTopic(idx, cidx)}
                                className="h-3.5 w-3.5 rounded border-gray-300"
                              />
                              <span className="text-xs text-muted-foreground">{child.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Add custom topic */}
                <div className="flex gap-2 pt-1">
                  <Input
                    value={newTopicLabel}
                    onChange={(e) => setNewTopicLabel(e.target.value)}
                    placeholder="Autre point..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addCustomTopic}
                    disabled={!newTopicLabel.trim()}
                    className="h-8 shrink-0"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </div>

              {/* Next surah */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-medium">Sourate pour la prochaine séance</Label>
                <Select value={reportNextSurah} onValueChange={setReportNextSurah}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une sourate" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">— Aucune —</SelectItem>
                    {reportSurahs.map(s => (
                      <SelectItem key={s.number} value={s.number.toString()}>
                        {s.number}. {s.nameFr} ({s.nameAr}) - {s.totalVerses} v.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Homework */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-medium">Devoirs Quotidiens</Label>
                <textarea
                  value={reportHomework}
                  onChange={(e) => setReportHomework(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Devoirs quotidiens pour les élèves..."
                />
              </div>

            </div>
          )}

          {/* PDF sections selector with reorder */}
          {!reportLoading && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-medium">Sections à inclure dans le PDF</Label>
              <div className="space-y-0.5">
                {pdfSectionOrder.map((section, idx) => (
                  <div key={section.key}>
                    <div className="flex items-center gap-1.5 py-0.5">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={() => setPdfSectionOrder(prev =>
                          prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s)
                        )}
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                      <span className="text-xs flex-1">{section.label}</span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => setPdfSectionOrder(prev => {
                          const arr = [...prev]
                          ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
                          return arr
                        })}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === pdfSectionOrder.length - 1}
                        onClick={() => setPdfSectionOrder(prev => {
                          const arr = [...prev]
                          ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
                          return arr
                        })}
                        className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {section.key === 'annexeRecherche' && section.enabled && (
                      <div className="flex items-center gap-2 pl-6 py-0.5">
                        <span className="text-xs text-muted-foreground">Séances :</span>
                        <Input type="number" min={1} max={annexeRechercheTo} value={annexeRechercheFrom}
                          onChange={e => setAnnexeRechercheFrom(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 h-7 text-xs" />
                        <span className="text-xs">à</span>
                        <Input type="number" min={annexeRechercheFrom} value={annexeRechercheTo}
                          onChange={e => setAnnexeRechercheTo(parseInt(e.target.value) || reportSessionNumber)}
                          className="w-16 h-7 text-xs" />
                      </div>
                    )}
                    {section.key === 'annexeArcEnCiel' && section.enabled && (
                      <div className="flex items-center gap-2 pl-6 py-0.5">
                        <span className="text-xs text-muted-foreground">Séances :</span>
                        <Input type="number" min={1} max={annexeArcEnCielTo} value={annexeArcEnCielFrom}
                          onChange={e => setAnnexeArcEnCielFrom(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 h-7 text-xs" />
                        <span className="text-xs">à</span>
                        <Input type="number" min={annexeArcEnCielFrom} value={annexeArcEnCielTo}
                          onChange={e => setAnnexeArcEnCielTo(parseInt(e.target.value) || reportSessionNumber)}
                          className="w-16 h-7 text-xs" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionReportOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleGenerateSessionPDF} disabled={exporting || reportLoading}>
              <FileText className="h-4 w-4 mr-2" />
              {exporting ? 'Génération...' : 'Générer PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* PDF Viewer - Fullscreen overlay */}
      {pdfViewerData && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
          {/* Print landscape hint */}
          <style>{`@media print { @page { size: landscape; } }`}</style>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 flex-shrink-0">
            {pdfViewerData.pdfId ? (
              <a
                href={`/api/pdf-download/${pdfViewerData.pdfId}`}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </a>
            ) : (
              <a
                href={pdfViewerData.blobUrl}
                download={pdfViewerData.fileName}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </a>
            )}
            <button
              onClick={() => {
                const printFrame = document.getElementById('pdf-print-frame') as HTMLIFrameElement
                if (printFrame?.contentWindow) {
                  printFrame.contentWindow.focus()
                  printFrame.contentWindow.print()
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
            <span className="text-slate-300 text-sm font-medium ml-auto">{pdfViewerData.fileName}</span>
            <button
              onClick={() => {
                URL.revokeObjectURL(pdfViewerData.blobUrl)
                setPdfViewerData(null)
              }}
              className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* PDF iframe - fills all remaining space */}
          <iframe
            id="pdf-print-frame"
            src={pdfViewerData.blobUrl}
            className="flex-1 w-full border-0"
            title={pdfViewerData.fileName}
          />
        </div>
      )}
    </div>
  )
}
