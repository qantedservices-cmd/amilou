'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Grid3X3,
  Pencil,
  Plus,
  Save,
  Trash2,
  Trophy,
  Users,
  X,
  Download,
} from 'lucide-react'
import { stripHtmlTags } from '@/components/ui/rich-text-editor'
import Link from 'next/link'

interface Member {
  id: string
  name: string
}

interface SurahInfo {
  nameAr: string
  nameFr: string
  totalVerses: number
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

interface MasteryEntry {
  status: string
  validatedWeek: number | null
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

interface SessionInfo {
  id: string
  number: number
  date: string
  weekNumber: number
}

interface BookProgressEntry {
  id: string
  bookId: string
  chapterId: string | null
  pageStart: number | null
  pageEnd: number | null
  isRead: boolean
  isQaDone: boolean
  comment: string | null
  book: { id: string; title: string; titleAr: string | null }
  chapter: {
    id: string; title: string; titleAr: string | null; chapterNumber: number; depth: number
    parent: { id: string; title: string; titleAr: string | null; chapterNumber: number } | null
  } | null
}

interface GroupBookEntry {
  id: string
  bookId: string
  book: {
    id: string; title: string; titleAr: string | null
    chapters: Array<{
      id: string; title: string; titleAr: string | null; chapterNumber: number; depth: number
      children?: Array<{ id: string; title: string; titleAr: string | null; chapterNumber: number; depth: number }>
    }>
  }
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

const STATUS_DISPLAY: Record<string, string> = {
  'X': 'C',
}

export default function SessionReportPage({ params }: { params: Promise<{ id: string; num: string; locale: string }> }) {
  const { id: groupId, num, locale } = use(params)
  const sessionNum = parseInt(num)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  // Mastery data
  const [members, setMembers] = useState<Member[]>([])
  const [groupName, setGroupName] = useState('')
  const [isReferent, setIsReferent] = useState(false)
  const [commentsMap, setCommentsMap] = useState<Record<string, Record<number, Comment[]>>>({})
  const [masteryMap, setMasteryMap] = useState<Record<string, Record<number, MasteryEntry>>>({})
  const [allSurahsMap, setAllSurahsMap] = useState<Record<number, SurahInfo>>({})
  const [totalSessions, setTotalSessions] = useState(0)
  const [sessions, setSessions] = useState<SessionInfo[]>([])

  // Report data
  const [reportTopics, setReportTopics] = useState<TopicItem[]>([])
  const [reportNextSurah, setReportNextSurah] = useState('')
  const [reportHomework, setReportHomework] = useState('')
  const [reportSurahs, setReportSurahs] = useState<SurahOption[]>([])
  const [sessionDate, setSessionDate] = useState('')
  const [sessionWeekNumber, setSessionWeekNumber] = useState<number | null>(null)
  const [newTopicLabel, setNewTopicLabel] = useState('')

  // Comment editing state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  // Add comment state
  const [addingComment, setAddingComment] = useState(false)
  const [newCommentMember, setNewCommentMember] = useState('')
  const [newCommentSurah, setNewCommentSurah] = useState('')
  const [newCommentText, setNewCommentText] = useState('')

  // Book progress
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [bookProgressEntries, setBookProgressEntries] = useState<BookProgressEntry[]>([])
  const [groupBooks, setGroupBooks] = useState<GroupBookEntry[]>([])
  const [bpBookId, setBpBookId] = useState('')
  const [bpChapterId, setBpChapterId] = useState('')
  const [bpPageStart, setBpPageStart] = useState('')
  const [bpPageEnd, setBpPageEnd] = useState('')
  const [bpIsRead, setBpIsRead] = useState(false)
  const [bpIsQaDone, setBpIsQaDone] = useState(false)
  const [bpComment, setBpComment] = useState('')
  const [bpSaving, setBpSaving] = useState(false)
  const [bpEditingId, setBpEditingId] = useState<string | null>(null)

  // Session notes
  const [sessionNotes, setSessionNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Research topics
  const [researchTopics, setResearchTopics] = useState<Array<{
    id: string; sessionNumber: number | null; assignedTo: string; question: string; answer: string | null; isValidated: boolean
  }>>([])
  const [rtNewAssignedTo, setRtNewAssignedTo] = useState('')
  const [rtSelectedMembers, setRtSelectedMembers] = useState<string[]>([])
  const [rtNewQuestion, setRtNewQuestion] = useState('')
  const [rtEditingId, setRtEditingId] = useState<string | null>(null)
  const [rtEditAnswer, setRtEditAnswer] = useState('')
  const [rtHistoryOpen, setRtHistoryOpen] = useState(false)
  const [rtHistoryFilter, setRtHistoryFilter] = useState<'all' | 'pending' | 'validated'>('all')
  const [rtFilterState, setRtFilterState] = useState('all')
  const [rtFilterSession, setRtFilterSession] = useState('all')
  const [rtGroupBy, setRtGroupBy] = useState('none')

  // Tafsir entries for this session
  const [sessionTafsirEntries, setSessionTafsirEntries] = useState<Array<{
    type: 'SENS' | 'TAFSIR'; surahNumber: number; verseStart: number; verseEnd: number
  }>>([])
  const [tfType, setTfType] = useState<'SENS' | 'TAFSIR'>('TAFSIR')
  const [tfSurah, setTfSurah] = useState('')
  const [tfVerseStart, setTfVerseStart] = useState('')
  const [tfVerseEnd, setTfVerseEnd] = useState('')
  const [savingTafsir, setSavingTafsir] = useState(false)
  const [tfIncludeReferent, setTfIncludeReferent] = useState(true)

  // PDF export options
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false)
  const [pdfSections, setPdfSections] = useState([
    { key: 'pointsAbordes', label: 'Points abordés', enabled: true },
    { key: 'prochaineSourate', label: 'Prochaine sourate', enabled: true },
    { key: 'devoirs', label: 'Devoirs Quotidiens', enabled: true },
    { key: 'notesSeance', label: 'Notes de la séance', enabled: true },
    { key: 'sensDesVersets', label: 'Sens des versets', enabled: true },
    { key: 'tafsir', label: 'Tafsir', enabled: true },
    { key: 'classement', label: 'Classement élèves', enabled: true },
    { key: 'suiviIndividuel', label: 'Suivi individuel', enabled: true },
    { key: 'grille', label: 'Grille de suivi', enabled: true },
    { key: 'annexeCommentaires', label: 'Annexe 1 - Commentaires', enabled: true },
    { key: 'annexeRecherche', label: 'Annexe 2 - Recherches', enabled: true },
    { key: 'annexeArcEnCiel', label: 'Annexe 3 - Livres', enabled: true },
  ])

  useEffect(() => {
    fetchData()
  }, [groupId, sessionNum])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [masteryRes, reportRes] = await Promise.all([
        fetch(`/api/groups/${groupId}/mastery`),
        fetch(`/api/groups/${groupId}/mastery/session-report?sessionNumber=${sessionNum}`)
      ])

      if (!masteryRes.ok) {
        const json = await masteryRes.json()
        setError(json.error || 'Erreur')
        return
      }

      const masteryData = await masteryRes.json()
      setMembers(masteryData.members)
      setGroupName(masteryData.group.name)
      setIsReferent(masteryData.isReferent)
      setCommentsMap(masteryData.commentsMap)
      setMasteryMap(masteryData.masteryMap)
      setAllSurahsMap(masteryData.allSurahsMap)
      setTotalSessions(masteryData.totalSessions)
      setSessions(masteryData.sessions || [])

      // Fetch group books and research topics in parallel
      fetchGroupBooks()
      fetchResearchTopics()

      if (reportRes.ok) {
        const reportData = await reportRes.json()
        setSessionDate(reportData.sessionDate || '')
        setSessionWeekNumber(reportData.weekNumber)

        // Fetch book progress if we have a session ID
        if (reportData.sessionId) {
          setCurrentSessionId(reportData.sessionId)
          fetchBookProgress(reportData.sessionId)
        }
        setReportNextSurah(reportData.nextSurahNumber?.toString() || '')
        setReportHomework(reportData.homework || '')
        setReportSurahs(reportData.surahs || [])
        if (reportData.notes) setSessionNotes(reportData.notes)
        if (reportData.tafsirEntries) setSessionTafsirEntries(reportData.tafsirEntries)

        // Merge topics
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
        const savedTopics: TopicItem[] = reportData.sessionTopics || []
        if (savedTopics.length > 0) {
          const mergedTopics = defaultTopics.map(dt => {
            const saved = savedTopics.find(st =>
              st.label === dt.label ||
              dt.label.toLowerCase().includes(st.label.toLowerCase().slice(0, 15)) ||
              st.label.toLowerCase().includes(dt.label.toLowerCase().slice(0, 15))
            )
            const topic: TopicItem = { label: dt.label, checked: saved ? saved.checked : dt.checked }
            if (dt.children) {
              topic.children = dt.children.map(dc => {
                const savedChild = saved?.children?.find(sc => sc.label === dc.label)
                return { label: dc.label, checked: savedChild ? savedChild.checked : dc.checked }
              })
            }
            return topic
          })
          const defaultLabels = defaultTopics.map(d => d.label.toLowerCase())
          const customTopics = savedTopics.filter(st =>
            !defaultLabels.some(dl => dl.includes(st.label.toLowerCase().slice(0, 15)) || st.label.toLowerCase().includes(dl.slice(0, 15)))
          )
          setReportTopics([...mergedTopics, ...customTopics])
        } else {
          setReportTopics(defaultTopics)
        }
      } else {
        // Fallback: resolve session ID from sessions array
        const sessionsArr: SessionInfo[] = masteryData.sessions || []
        const matchSession = sessionsArr.find(s => s.number === sessionNum)
        if (matchSession?.id) {
          setCurrentSessionId(matchSession.id)
          fetchBookProgress(matchSession.id)
        }
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
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

  async function fetchBookProgress(sessId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessId}/book-progress`)
      if (res.ok) setBookProgressEntries(await res.json())
    } catch (e) { console.error(e) }
  }

  async function fetchGroupBooks() {
    try {
      const res = await fetch(`/api/groups/${groupId}/books`)
      if (!res.ok) return
      const data = await res.json()
      const enriched = await Promise.all(data.map(async (gb: any) => {
        const chapRes = await fetch(`/api/books/${gb.book.id}/chapters`)
        const chapters = chapRes.ok ? await chapRes.json() : []
        return { ...gb, book: { ...gb.book, chapters } }
      }))
      setGroupBooks(enriched)
    } catch (e) { console.error(e) }
  }

  async function fetchResearchTopics() {
    try {
      const res = await fetch(`/api/groups/${groupId}/research-topics`)
      if (res.ok) {
        const data = await res.json()
        setResearchTopics(data.topics || [])
      }
    } catch (e) { console.error(e) }
  }

  async function handleSaveNotes() {
    if (!currentSessionId) return
    setSavingNotes(true)
    try {
      await fetch(`/api/sessions/${currentSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: sessionNotes }),
      })
    } catch (e) { console.error(e) }
    setSavingNotes(false)
  }

  async function handleAddResearchTopic() {
    const assignedTo = rtSelectedMembers.length > 0 ? rtSelectedMembers.join(', ') : rtNewAssignedTo.trim()
    if (!assignedTo || !rtNewQuestion.trim()) return
    try {
      await fetch(`/api/groups/${groupId}/research-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber: sessionNum, assignedTo, question: rtNewQuestion.trim() }),
      })
      setRtNewAssignedTo('')
      setRtSelectedMembers([])
      setRtNewQuestion('')
      fetchResearchTopics()
    } catch (e) { console.error(e) }
  }

  async function handleAnswerResearchTopic(topicId: string, answer: string, validate: boolean) {
    try {
      await fetch(`/api/groups/${groupId}/research-topics`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, answer, isValidated: validate }),
      })
      setRtEditingId(null)
      setRtEditAnswer('')
      fetchResearchTopics()
    } catch (e) { console.error(e) }
  }

  async function handleValidateResearchTopic(topicId: string) {
    try {
      await fetch(`/api/groups/${groupId}/research-topics`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, isValidated: true }),
      })
      fetchResearchTopics()
    } catch (e) { console.error(e) }
  }

  async function handleAddTafsirEntry() {
    if (!tfSurah || !tfVerseStart || !tfVerseEnd || !currentSessionId) return
    setSavingTafsir(true)
    const newEntry = { type: tfType, surahNumber: parseInt(tfSurah), verseStart: parseInt(tfVerseStart), verseEnd: parseInt(tfVerseEnd) }
    const updated = [...sessionTafsirEntries, newEntry]
    try {
      await fetch(`/api/sessions/${currentSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tafsirEntries: updated, includeReferent: tfIncludeReferent }),
      })
      setSessionTafsirEntries(updated)
      setTfSurah('')
      setTfVerseStart('')
      setTfVerseEnd('')
    } catch (e) { console.error(e) }
    setSavingTafsir(false)
  }

  function removeTafsirEntry(index: number) {
    const updated = sessionTafsirEntries.filter((_, i) => i !== index)
    setSessionTafsirEntries(updated)
    if (currentSessionId) {
      fetch(`/api/sessions/${currentSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tafsirEntries: updated }),
      }).catch(console.error)
    }
  }

  async function handleAddBookProgress() {
    if (!bpBookId || !currentSessionId || bpSaving) return
    setBpSaving(true)
    try {
      const method = bpEditingId ? 'PUT' : 'POST'
      const body = bpEditingId
        ? { entryId: bpEditingId, chapterId: bpChapterId || null, pageStart: bpPageStart ? parseInt(bpPageStart) : null, pageEnd: bpPageEnd ? parseInt(bpPageEnd) : null, isRead: bpIsRead, isQaDone: bpIsQaDone, comment: bpComment || null }
        : { bookId: bpBookId, chapterId: bpChapterId || null, pageStart: bpPageStart ? parseInt(bpPageStart) : null, pageEnd: bpPageEnd ? parseInt(bpPageEnd) : null, isRead: bpIsRead, isQaDone: bpIsQaDone, comment: bpComment || null }

      const res = await fetch(`/api/sessions/${currentSessionId}/book-progress`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        resetBpForm()
        fetchBookProgress(currentSessionId)
      }
    } catch (e) { console.error(e) }
    setBpSaving(false)
  }

  async function handleDeleteBookProgress(entryId: string) {
    if (!confirm('Supprimer cette entrée ?')) return
    try {
      await fetch(`/api/sessions/${currentSessionId}/book-progress?entryId=${entryId}`, { method: 'DELETE' })
      fetchBookProgress(currentSessionId)
    } catch (e) { console.error(e) }
  }

  function startEditBp(entry: BookProgressEntry) {
    setBpEditingId(entry.id)
    setBpBookId(entry.bookId)
    setBpChapterId(entry.chapterId || '')
    setBpPageStart(entry.pageStart?.toString() || '')
    setBpPageEnd(entry.pageEnd?.toString() || '')
    setBpIsRead(entry.isRead)
    setBpIsQaDone(entry.isQaDone)
    setBpComment(entry.comment || '')
  }

  function resetBpForm() {
    setBpEditingId(null)
    setBpBookId('')
    setBpChapterId('')
    setBpPageStart('')
    setBpPageEnd('')
    setBpIsRead(false)
    setBpIsQaDone(false)
    setBpComment('')
  }

  function removeCustomTopic(index: number) {
    setReportTopics(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/groups/${groupId}/mastery/session-report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionNumber: sessionNum,
          nextSurahNumber: reportNextSurah && reportNextSurah !== 'none' ? parseInt(reportNextSurah) : null,
          homework: reportHomework,
          sessionTopics: reportTopics,
          saveAsDefault: true
        })
      })
      setEditing(false)
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setSaving(false)
    }
  }

  function getCellDisplay(userId: string, surahNumber: number): string {
    const entry = masteryMap[userId]?.[surahNumber]
    if (!entry) return '-'
    if (entry.status === 'V' && entry.validatedWeek) return `V${entry.validatedWeek}`
    if (entry.status === 'S' && entry.validatedWeek) return `S${entry.validatedWeek}`
    return STATUS_DISPLAY[entry.status] || entry.status
  }

  function getSessionComments() {
    const result: { commentId: string; memberId: string; memberName: string; firstName: string; surahNum: number; surahInfo: SurahInfo | undefined; status: string; comment: string; rawComment: string }[] = []
    for (const member of members) {
      const memberComments = commentsMap[member.id]
      if (!memberComments) continue
      const nameParts = member.name.split(' ')
      const firstName = nameParts[nameParts.length - 1]
      for (const [surahNumStr, comments] of Object.entries(memberComments)) {
        const surahNum = parseInt(surahNumStr)
        for (const c of comments) {
          if (c.sessionNumber === sessionNum) {
            result.push({
              commentId: c.id,
              memberId: member.id,
              memberName: member.name,
              firstName,
              surahNum,
              surahInfo: allSurahsMap[surahNum],
              status: getCellDisplay(member.id, surahNum),
              comment: stripHtmlTags(c.comment),
              rawComment: c.comment
            })
          }
        }
      }
    }
    return result
  }

  async function handleEditComment(commentId: string, newText: string) {
    setSavingComment(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/mastery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, comment: newText })
      })
      if (res.ok) {
        setEditingCommentId(null)
        setEditingText('')
        await fetchData()
      }
    } catch (err) {
      console.error('Error editing comment:', err)
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
        setDeletingCommentId(null)
        await fetchData()
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function handleAddComment() {
    if (!newCommentMember || !newCommentSurah || !newCommentText.trim()) return
    setSavingComment(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/mastery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newCommentMember,
          surahNumber: parseInt(newCommentSurah),
          comment: newCommentText.trim(),
          sessionNumber: sessionNum
        })
      })
      if (res.ok) {
        setAddingComment(false)
        setNewCommentMember('')
        setNewCommentSurah('')
        setNewCommentText('')
        await fetchData()
      }
    } catch (err) {
      console.error('Error adding comment:', err)
    } finally {
      setSavingComment(false)
    }
  }

  function getRanking() {
    return members.map(m => {
      const memberMastery = masteryMap[m.id] || {}
      let validatedCount = 0
      for (const entry of Object.values(memberMastery)) {
        if (entry.status === 'V') validatedCount++
      }
      const nameParts = m.name.split(' ')
      const firstName = nameParts[nameParts.length - 1]
      const lastName = nameParts.slice(0, -1).join(' ')
      return { name: `${firstName} ${lastName}`, validated: validatedCount }
    }).sort((a, b) => b.validated - a.validated)
  }

  // Current session info
  const currentSession = sessions.find(s => s.number === sessionNum)
  const dateStr = sessionDate
    ? new Date(sessionDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : currentSession?.date
      ? new Date(currentSession.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : ''

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

  const sessionComments = getSessionComments()
  const ranking = getRanking()
  const nextSurahInfo = reportSurahs.find(s => s.number === parseInt(reportNextSurah))

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/groups/${groupId}/mastery`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              Séance N°{sessionNum}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              <span>{groupName}</span>
              {dateStr && (
                <>
                  <span>—</span>
                  <Calendar className="h-4 w-4" />
                  <span className="capitalize">{dateStr}</span>
                </>
              )}
              {(sessionWeekNumber || currentSession?.weekNumber) && (
                <Badge variant="outline" className="ml-1">S{sessionWeekNumber || currentSession?.weekNumber}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Session navigation */}
          <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={sessionNum <= 1}
              onClick={() => router.push(`/${locale}/groups/${groupId}/sessions/${sessionNum - 1}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-1 min-w-[60px] text-center">
              {sessionNum} / {totalSessions}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={sessionNum >= totalSessions}
              onClick={() => router.push(`/${locale}/groups/${groupId}/sessions/${sessionNum + 1}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Link href={`/${locale}/groups/${groupId}/mastery`}>
            <Button variant="outline" size="sm">
              <Grid3X3 className="h-4 w-4 mr-1" />
              Grille
            </Button>
          </Link>

          <Link href={`/${locale}/groups/${groupId}/tafsir`}>
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4 mr-1" />
              Tafsir
            </Button>
          </Link>

          <Link href={`/${locale}/groups/${groupId}/mastery?report=${sessionNum}`}>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Rapport PDF
            </Button>
          </Link>

          {isReferent && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Modifier
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); fetchData() }}>
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="space-y-6">
        {/* Points abordés + Devoirs */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Points abordés */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Points abordés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportTopics.map((topic, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-2">
                      {editing ? (
                        <input
                          type="checkbox"
                          checked={topic.checked}
                          onChange={() => toggleTopic(idx)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      ) : (
                        topic.checked
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          : <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                      )}
                      <span className={`text-sm ${topic.checked ? 'font-medium' : 'text-muted-foreground'}`}>
                        {topic.label}
                      </span>
                      {editing && idx >= 5 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeCustomTopic(idx)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {topic.children && (
                      <div className="ml-6 mt-1 space-y-1">
                        {topic.children.map((child, cidx) => (
                          <div key={cidx} className="flex items-center gap-2">
                            {editing ? (
                              <input
                                type="checkbox"
                                checked={child.checked}
                                onChange={() => toggleTopic(idx, cidx)}
                                className="h-3.5 w-3.5 rounded border-gray-300"
                              />
                            ) : (
                              child.checked
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                : <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                            )}
                            <span className={`text-xs ${child.checked ? '' : 'text-muted-foreground'}`}>
                              {child.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {editing && (
                  <div className="flex gap-2 pt-2 border-t mt-3">
                    <Input
                      value={newTopicLabel}
                      onChange={(e) => setNewTopicLabel(e.target.value)}
                      placeholder="Autre point..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
                    />
                    <Button variant="secondary" size="sm" onClick={addCustomTopic} disabled={!newTopicLabel.trim()} className="h-8 shrink-0">
                      <Plus className="h-3 w-3 mr-1" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Prochaine sourate */}
          {(reportNextSurah && reportNextSurah !== 'none' && nextSurahInfo) || editing ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-600" />
                  Prochaine sourate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <Select value={reportNextSurah || 'none'} onValueChange={setReportNextSurah}>
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
                ) : nextSurahInfo ? (
                  <div className="text-lg font-semibold text-red-600">
                    {nextSurahInfo.number}. {nextSurahInfo.nameAr}
                    <span className="text-base font-normal text-muted-foreground ml-2">
                      {nextSurahInfo.nameFr} — {nextSurahInfo.totalVerses} versets
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Devoirs */}
          {(reportHomework.trim() || editing) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-blue-600" />
                  Devoirs Quotidiens
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <textarea
                    value={reportHomework}
                    onChange={(e) => setReportHomework(e.target.value)}
                    rows={6}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Devoirs quotidiens..."
                  />
                ) : (
                  <div className="text-sm whitespace-pre-line">{reportHomework}</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Suivi individuel + Classement */}
        <div className="space-y-6">
          {/* Suivi individuel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                Suivi individuel
                <Badge variant="secondary" className="ml-auto">{sessionComments.length} récitations</Badge>
                {isReferent && !addingComment && (
                  <Button variant="outline" size="sm" className="ml-2 h-7" onClick={() => setAddingComment(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ajouter
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sessionComments.length === 0 && !addingComment ? (
                <div className="px-6 pb-6 text-sm text-muted-foreground italic">
                  Aucun commentaire pour cette séance
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Élève</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sourate</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Commentaire</th>
                        {isReferent && <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sessionComments.map((sc, i) => (
                        <tr key={sc.commentId} className={`border-b last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                          <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">{sc.firstName}</td>
                          <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                            <span className="font-semibold">{sc.surahNum}</span>
                            <span className="ml-1">{sc.surahInfo?.nameAr}</span>
                            <span className="text-muted-foreground ml-1.5 text-xs">{sc.surahInfo?.nameFr}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${STATUS_COLORS[sc.status] || STATUS_COLORS[sc.status.replace(/\d+$/, '')] || 'bg-gray-200 text-gray-700'}`}>
                              {STATUS_DISPLAY[sc.status] || sc.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            {editingCommentId === sc.commentId ? (
                              <div className="flex items-center gap-2">
                                <Textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="min-h-[60px] text-sm"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-emerald-600"
                                    disabled={savingComment || !editingText.trim()}
                                    onClick={() => handleEditComment(sc.commentId, editingText)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => { setEditingCommentId(null); setEditingText('') }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:m-0" dangerouslySetInnerHTML={{ __html: sc.rawComment }} />
                            )}
                          </td>
                          {isReferent && (
                            <td className="px-3 py-2.5 text-center">
                              {editingCommentId !== sc.commentId && !sc.commentId.startsWith('progress-') && (
                                <div className="flex items-center justify-center gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setEditingCommentId(sc.commentId); setEditingText(sc.rawComment) }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    disabled={deletingCommentId === sc.commentId}
                                    onClick={() => {
                                      if (confirm('Supprimer ce commentaire ?')) {
                                        handleDeleteComment(sc.commentId)
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add comment form */}
              {addingComment && (
                <div className="border-t px-4 py-4 space-y-3 bg-muted/10">
                  <div className="text-sm font-medium">Nouveau commentaire</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Élève</Label>
                      <Select value={newCommentMember} onValueChange={setNewCommentMember}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Sélectionner un élève" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map(m => {
                            const nameParts = m.name.split(' ')
                            const firstName = nameParts[nameParts.length - 1]
                            return (
                              <SelectItem key={m.id} value={m.id}>
                                {firstName}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Sourate</Label>
                      <Select value={newCommentSurah} onValueChange={setNewCommentSurah}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Sélectionner une sourate" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {Object.entries(allSurahsMap)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([num, info]) => (
                              <SelectItem key={num} value={num}>
                                {num}. {info.nameAr} ({info.nameFr})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Commentaire</Label>
                    <Textarea
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Évaluation de la récitation..."
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAddingComment(false); setNewCommentMember(''); setNewCommentSurah(''); setNewCommentText('') }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      disabled={savingComment || !newCommentMember || !newCommentSurah || !newCommentText.trim()}
                      onClick={handleAddComment}
                    >
                      {savingComment ? 'Sauvegarde...' : 'Ajouter'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Avancement Livres */}
          {groupBooks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Avancement Livres
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing entries */}
                {bookProgressEntries.map(entry => (
                  <div key={entry.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{entry.book.title}</div>
                      {entry.chapter && (
                        <div className="text-xs text-muted-foreground">
                          {entry.chapter.parent && `Ch.${entry.chapter.parent.chapterNumber} ${entry.chapter.parent.title} — `}
                          {entry.chapter.depth === 0 ? `Ch.${entry.chapter.chapterNumber}` : `Cours ${entry.chapter.chapterNumber}`} {entry.chapter.title}
                        </div>
                      )}
                      {(entry.pageStart || entry.pageEnd) && (
                        <div className="text-xs text-muted-foreground">Pages {entry.pageStart}–{entry.pageEnd}</div>
                      )}
                      <div className="flex gap-2 mt-1">
                        {entry.isRead && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Lu</Badge>}
                        {entry.isQaDone && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Q/R</Badge>}
                      </div>
                      {entry.comment && <p className="text-xs text-muted-foreground mt-1 italic">{entry.comment}</p>}
                    </div>
                    {isReferent && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditBp(entry)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteBookProgress(entry.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add/Edit form (referent only) */}
                {isReferent && (
                  <div className="space-y-3 p-3 rounded-lg border border-dashed">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Livre</Label>
                        <Select value={bpBookId || 'none'} onValueChange={v => { setBpBookId(v === 'none' ? '' : v); setBpChapterId('') }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sélectionner un livre</SelectItem>
                            {groupBooks.map(gb => (
                              <SelectItem key={gb.book.id} value={gb.book.id}>{gb.book.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Chapitre / Cours</Label>
                        <Select value={bpChapterId || 'none'} onValueChange={v => setBpChapterId(v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {groupBooks.find(gb => gb.book.id === bpBookId)?.book.chapters?.map(ch => (
                              <React.Fragment key={ch.id}>
                                <SelectItem value={ch.id}>Ch.{ch.chapterNumber} {ch.title}</SelectItem>
                                {ch.children?.map(sub => (
                                  <SelectItem key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.title}</SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Page début</Label>
                        <Input type="number" min="1" className="h-8 text-xs" value={bpPageStart} onChange={e => setBpPageStart(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Page fin</Label>
                        <Input type="number" min="1" className="h-8 text-xs" value={bpPageEnd} onChange={e => setBpPageEnd(e.target.value)} />
                      </div>
                      <label className="flex items-center gap-2 pt-5 cursor-pointer">
                        <input type="checkbox" checked={bpIsRead} onChange={e => setBpIsRead(e.target.checked)} className="rounded" />
                        <span className="text-xs">Lu</span>
                      </label>
                      <label className="flex items-center gap-2 pt-5 cursor-pointer">
                        <input type="checkbox" checked={bpIsQaDone} onChange={e => setBpIsQaDone(e.target.checked)} className="rounded" />
                        <span className="text-xs">Q/R</span>
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Commentaire</Label>
                      <Input className="h-8 text-xs" value={bpComment} onChange={e => setBpComment(e.target.value)} placeholder="Optionnel" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleAddBookProgress} disabled={bpSaving || !bpBookId}>
                        {bpSaving ? 'Enregistrement...' : bpEditingId ? 'Modifier' : 'Ajouter'}
                      </Button>
                      {bpEditingId && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetBpForm}>Annuler</Button>
                      )}
                    </div>
                  </div>
                )}

                {bookProgressEntries.length === 0 && !isReferent && (
                  <p className="text-sm text-muted-foreground text-center py-2">Aucun avancement livre pour cette séance</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tafsir / Traduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5 text-rose-600" />
                Tafsir & Traduction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Existing entries */}
              {sessionTafsirEntries.map((entry, i) => {
                const surah = reportSurahs.find(s => s.number === entry.surahNumber)
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                    <div className="text-sm">
                      <Badge className={entry.type === 'TAFSIR' ? 'bg-rose-100 text-rose-700 text-[10px] mr-2' : 'bg-purple-100 text-purple-700 text-[10px] mr-2'}>
                        {entry.type === 'TAFSIR' ? 'Tafsir' : 'Traduction'}
                      </Badge>
                      {surah ? `${surah.nameAr} ${surah.nameFr}` : `Sourate ${entry.surahNumber}`} — v.{entry.verseStart}–{entry.verseEnd}
                    </div>
                    {isReferent && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeTafsirEntry(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              })}

              {sessionTafsirEntries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-1">Aucune entrée tafsir/traduction</p>
              )}

              {/* Add form (referent only) */}
              {isReferent && (
                <div className="space-y-2 p-3 rounded-lg border border-dashed">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={tfType} onValueChange={v => setTfType(v as 'SENS' | 'TAFSIR')}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TAFSIR">Tafsir</SelectItem>
                          <SelectItem value="SENS">Traduction / Sens</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sourate</Label>
                      <Select value={tfSurah || 'none'} onValueChange={v => {
                        setTfSurah(v === 'none' ? '' : v)
                        setTfVerseStart('1')
                        const s = reportSurahs.find(s => s.number === parseInt(v))
                        if (s) setTfVerseEnd(s.totalVerses.toString())
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sélectionner</SelectItem>
                          {reportSurahs.map(s => <SelectItem key={s.number} value={s.number.toString()}>{s.number}. {s.nameAr} {s.nameFr}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Verset début</Label>
                      <Input type="number" min="1" className="h-8 text-xs" value={tfVerseStart} onChange={e => setTfVerseStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Verset fin</Label>
                      <Input type="number" min="1" className="h-8 text-xs" value={tfVerseEnd} onChange={e => setTfVerseEnd(e.target.value)} />
                    </div>
                    <div className="pt-5">
                      <Button size="sm" className="h-8 text-xs w-full" onClick={handleAddTafsirEntry} disabled={savingTafsir || !tfSurah || !tfVerseStart || !tfVerseEnd}>
                        Ajouter
                      </Button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input type="checkbox" checked={tfIncludeReferent} onChange={e => setTfIncludeReferent(e.target.checked)} className="rounded" />
                    <span className="text-xs text-muted-foreground">Inclure dans mon profil</span>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Commentaire de séance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-slate-600" />
                Commentaire de la séance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isReferent ? (
                <div className="space-y-2">
                  <Textarea
                    value={sessionNotes}
                    onChange={e => setSessionNotes(e.target.value)}
                    placeholder="Notes et observations de la séance..."
                    rows={3}
                    className="text-sm"
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              ) : sessionNotes ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sessionNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Aucun commentaire</p>
              )}
            </CardContent>
          </Card>

          {/* Sujets de recherche */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-amber-600" />
                Sujets de recherche
                {researchTopics.filter(t => !t.isValidated).length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">{researchTopics.filter(t => !t.isValidated).length} en attente</Badge>
                )}
              </CardTitle>
              {researchTopics.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setRtHistoryOpen(true)}>
                  Tout l&apos;historique ({researchTopics.length})
                </Button>
              )}
            </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Intro + Filters */}
              <div className="flex items-end justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Recherche à faire par</h3>
                  <p className="text-xs text-muted-foreground italic">Questions abordées par les élèves</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={rtFilterState} onValueChange={setRtFilterState}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="validated">Validés</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={rtFilterSession} onValueChange={setRtFilterSession}>
                    <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes S.</SelectItem>
                      {[...new Set(researchTopics.map(t => t.sessionNumber).filter(Boolean))].sort((a, b) => (a || 0) - (b || 0)).map(sn => (
                        <SelectItem key={sn} value={String(sn)}>S{sn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={rtGroupBy} onValueChange={setRtGroupBy}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Pas de groupe</SelectItem>
                      <SelectItem value="session">Par séance</SelectItem>
                      <SelectItem value="assignee">Par assigné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table */}
              {(() => {
                let filtered = researchTopics
                  .filter(t => rtFilterState === 'all' ? true : rtFilterState === 'pending' ? !t.isValidated : t.isValidated)
                  .filter(t => rtFilterSession === 'all' ? true : String(t.sessionNumber) === rtFilterSession)
                  .sort((a, b) => (a.isValidated ? 1 : 0) - (b.isValidated ? 1 : 0) || (b.sessionNumber || 0) - (a.sessionNumber || 0))

                // Group if needed
                const groups: Array<{ label: string; topics: typeof filtered }> = []
                if (rtGroupBy === 'none') {
                  groups.push({ label: '', topics: filtered })
                } else if (rtGroupBy === 'session') {
                  const map = new Map<string, typeof filtered>()
                  for (const t of filtered) {
                    const key = t.sessionNumber ? `S${t.sessionNumber}` : 'Sans séance'
                    if (!map.has(key)) map.set(key, [])
                    map.get(key)!.push(t)
                  }
                  for (const [label, topics] of map) groups.push({ label, topics })
                } else if (rtGroupBy === 'assignee') {
                  const map = new Map<string, typeof filtered>()
                  for (const t of filtered) {
                    if (!map.has(t.assignedTo)) map.set(t.assignedTo, [])
                    map.get(t.assignedTo)!.push(t)
                  }
                  for (const [label, topics] of map) groups.push({ label, topics })
                }

                return filtered.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse table-fixed">
                    <thead>
                      <tr className="border-b-2 border-muted">
                        <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider w-24">Assigné à</th>
                        <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ width: '30%' }}>Questions</th>
                        <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ width: '40%' }}>Réponses</th>
                        <th className="text-center py-2 px-2 font-semibold text-xs uppercase tracking-wider w-16">Statut</th>
                        {isReferent && <th className="w-14"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group, gi) => (
                        <React.Fragment key={gi}>
                          {group.label && (
                            <tr><td colSpan={isReferent ? 5 : 4} className="py-2 px-2 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">{group.label} ({group.topics.length})</td></tr>
                          )}
                          {group.topics
                        .map(topic => (
                        <tr key={topic.id} className={`border-b hover:bg-muted/30 ${!topic.isValidated ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                          <td className="py-2 px-3 text-xs">
                            <div>{topic.assignedTo}</div>
                            {topic.sessionNumber && <span className="text-[10px] text-muted-foreground">S{topic.sessionNumber}</span>}
                          </td>
                          <td className="py-2 px-3 text-sm">{topic.question}</td>
                          <td className="py-2 px-3 text-sm">
                            {rtEditingId === topic.id ? (
                              <div className="flex gap-2">
                                <Input className="h-8 text-xs flex-1" value={rtEditAnswer} onChange={e => setRtEditAnswer(e.target.value)} placeholder="Réponse..." />
                                <Button size="sm" className="h-8 text-xs" onClick={() => handleAnswerResearchTopic(topic.id, rtEditAnswer, false)}>OK</Button>
                                <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAnswerResearchTopic(topic.id, rtEditAnswer, true)}>Valider</Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setRtEditingId(null)}>X</Button>
                              </div>
                            ) : (
                              <span className={topic.answer ? 'italic text-muted-foreground' : 'text-muted-foreground/40'}>
                                {topic.answer || '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {topic.isValidated ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Validé</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 text-[10px]">En attente</Badge>
                            )}
                          </td>
                          {isReferent && (
                            <td className="py-2 px-3">
                              <div className="flex gap-1">
                                {rtEditingId !== topic.id && !topic.isValidated && (
                                  <>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setRtEditingId(topic.id); setRtEditAnswer(topic.answer || '') }}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" onClick={() => handleValidateResearchTopic(topic.id)}>
                                      <Check className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun sujet de recherche</p>
                )
              })()}

              {/* Add new topic (referent only) */}
              {isReferent && (
                <div className="space-y-2 p-3 rounded-lg border border-dashed mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Assigné à</Label>
                      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[32px]">
                        <label className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer text-xs border ${rtSelectedMembers.length === 0 && rtNewAssignedTo === 'Tous' ? 'bg-blue-50 border-blue-300' : 'hover:bg-muted/50'}`}>
                          <input type="checkbox" className="rounded h-3 w-3" checked={rtNewAssignedTo === 'Tous'} onChange={e => { if (e.target.checked) { setRtNewAssignedTo('Tous'); setRtSelectedMembers([]) } else { setRtNewAssignedTo('') } }} />
                          Tous
                        </label>
                        {members.map(m => (
                          <label key={m.id} className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer text-xs border ${rtSelectedMembers.includes(m.name) ? 'bg-blue-50 border-blue-300' : 'hover:bg-muted/50'}`}>
                            <input type="checkbox" className="rounded h-3 w-3" checked={rtSelectedMembers.includes(m.name)} onChange={e => {
                              if (e.target.checked) { setRtSelectedMembers(prev => [...prev, m.name]); setRtNewAssignedTo('') }
                              else { setRtSelectedMembers(prev => prev.filter(n => n !== m.name)) }
                            }} />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Question / Sujet</Label>
                      <Input className="h-8 text-xs" value={rtNewQuestion} onChange={e => setRtNewQuestion(e.target.value)} placeholder="Sujet de recherche..." />
                    </div>
                  </div>
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddResearchTopic} disabled={(!rtNewAssignedTo && rtSelectedMembers.length === 0) || !rtNewQuestion.trim()}>
                    Ajouter le sujet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Classement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Classement des élèves
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-14">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Élève</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sourates validées</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr key={i} className={`border-b last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                        <td className="px-4 py-2 text-center">
                          {i === 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-yellow-900 font-bold text-sm">1</span>
                          ) : i === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-gray-800 font-bold text-sm">2</span>
                          ) : i === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-300 text-orange-900 font-bold text-sm">3</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="font-bold text-emerald-600">{r.validated}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Export PDF */}
      <Card className="mt-6">
        <CardHeader className="cursor-pointer" onClick={() => setPdfOptionsOpen(!pdfOptionsOpen)}>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Export PDF — Seance {sessionNum}
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${pdfOptionsOpen ? 'rotate-180' : ''}`} />
          </CardTitle>
        </CardHeader>
        {pdfOptionsOpen && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Selectionnez les sections a inclure dans le rapport PDF</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pdfSections.map((section, i) => (
                <label key={section.key} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs transition-colors ${section.enabled ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20' : 'hover:bg-muted/50'}`}>
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={e => {
                      setPdfSections(prev => prev.map((s, j) => j === i ? { ...s, enabled: e.target.checked } : s))
                    }}
                    className="rounded"
                  />
                  {section.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  const enabledKeys = pdfSections.filter(s => s.enabled).map(s => s.key).join(',')
                  window.location.href = `/${locale}/groups/${groupId}/mastery?report=${sessionNum}&sections=${enabledKeys}`
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Generer le PDF
              </Button>
              <Button variant="outline" onClick={() => setPdfSections(prev => prev.map(s => ({ ...s, enabled: true })))}>
                Tout selectionner
              </Button>
              <Button variant="outline" onClick={() => setPdfSections(prev => prev.map(s => ({ ...s, enabled: false })))}>
                Tout deselectionner
              </Button>
            </div>

            {/* Preview: summary of what will be in the PDF */}
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Apercu du contenu</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                {reportTopics.length > 0 && pdfSections.find(s => s.key === 'pointsAbordes')?.enabled && (
                  <p>Points abordes : {reportTopics.filter(t => t.checked).length}/{reportTopics.length} coches</p>
                )}
                {reportNextSurah && reportNextSurah !== 'none' && pdfSections.find(s => s.key === 'prochaineSourate')?.enabled && (
                  <p>Prochaine sourate : {reportSurahs.find(s => s.number.toString() === reportNextSurah)?.nameAr || reportNextSurah}</p>
                )}
                {reportHomework && pdfSections.find(s => s.key === 'devoirs')?.enabled && (
                  <p>Devoirs : {reportHomework.substring(0, 50)}{reportHomework.length > 50 ? '...' : ''}</p>
                )}
                {sessionNotes && pdfSections.find(s => s.key === 'notesSeance')?.enabled && (
                  <p>Notes : {sessionNotes.substring(0, 50)}{sessionNotes.length > 50 ? '...' : ''}</p>
                )}
                {sessionTafsirEntries.length > 0 && (pdfSections.find(s => s.key === 'tafsir')?.enabled || pdfSections.find(s => s.key === 'sensDesVersets')?.enabled) && (
                  <p>Tafsir/Traduction : {sessionTafsirEntries.length} entree(s)</p>
                )}
                {bookProgressEntries.length > 0 && pdfSections.find(s => s.key === 'annexeArcEnCiel')?.enabled && (
                  <p>Avancement livres : {bookProgressEntries.length} entree(s)</p>
                )}
                {researchTopics.filter(t => !t.isValidated).length > 0 && pdfSections.find(s => s.key === 'annexeRecherche')?.enabled && (
                  <p>Sujets de recherche : {researchTopics.filter(t => !t.isValidated).length} en attente</p>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Research topics history dialog */}
      <Dialog open={rtHistoryOpen} onOpenChange={setRtHistoryOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Historique des sujets de recherche
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            {(['all', 'pending', 'validated'] as const).map(f => (
              <Button key={f} size="sm" variant={rtHistoryFilter === f ? 'default' : 'outline'} className="text-xs h-7" onClick={() => setRtHistoryFilter(f)}>
                {f === 'all' ? `Tous (${researchTopics.length})` : f === 'pending' ? `En attente (${researchTopics.filter(t => !t.isValidated).length})` : `Validés (${researchTopics.filter(t => t.isValidated).length})`}
              </Button>
            ))}
          </div>
          <div className="space-y-3">
            {researchTopics
              .filter(t => rtHistoryFilter === 'all' ? true : rtHistoryFilter === 'pending' ? !t.isValidated : t.isValidated)
              .sort((a, b) => (b.sessionNumber || 0) - (a.sessionNumber || 0))
              .map(topic => (
                <div key={topic.id} className={`p-3 rounded-lg border ${topic.isValidated ? 'bg-muted/30' : 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        {topic.sessionNumber && <Badge variant="outline" className="text-[10px]">S{topic.sessionNumber}</Badge>}
                        <span>{topic.assignedTo}</span>
                        {topic.isValidated && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Validé</Badge>}
                      </div>
                      <p className="text-sm font-medium">{topic.question}</p>
                      {topic.answer && <p className="text-sm text-muted-foreground mt-1 italic">{topic.answer}</p>}
                      {!topic.answer && !topic.isValidated && (
                        <p className="text-xs text-amber-600 mt-1">En attente de réponse</p>
                      )}
                    </div>
                    {isReferent && !topic.isValidated && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setRtEditingId(topic.id); setRtEditAnswer(topic.answer || ''); setRtHistoryOpen(false) }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" onClick={() => handleValidateResearchTopic(topic.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            {researchTopics.filter(t => rtHistoryFilter === 'all' ? true : rtHistoryFilter === 'pending' ? !t.isValidated : t.isValidated).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun sujet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
