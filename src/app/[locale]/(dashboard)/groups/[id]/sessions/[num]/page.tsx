'use client'

import { useState, useEffect, use } from 'react'
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
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Grid3X3,
  Pencil,
  Plus,
  Save,
  Trophy,
  Users,
  X,
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
  number: number
  date: string
  weekNumber: number
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

      if (reportRes.ok) {
        const reportData = await reportRes.json()
        setSessionDate(reportData.sessionDate || '')
        setSessionWeekNumber(reportData.weekNumber)
        setReportNextSurah(reportData.nextSurahNumber?.toString() || '')
        setReportHomework(reportData.homework || '')
        setReportSurahs(reportData.surahs || [])

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
    const result: { memberId: string; memberName: string; firstName: string; surahNum: number; surahInfo: SurahInfo | undefined; status: string; comment: string }[] = []
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
              memberId: member.id,
              memberName: member.name,
              firstName,
              surahNum,
              surahInfo: allSurahsMap[surahNum],
              status: getCellDisplay(member.id, surahNum),
              comment: stripHtmlTags(c.comment)
            })
          }
        }
      }
    }
    return result
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
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Points abordés + Devoirs */}
        <div className="space-y-6">
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

        {/* Right column: Suivi individuel + Classement */}
        <div className="lg:col-span-2 space-y-6">
          {/* Suivi individuel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                Suivi individuel
                <Badge variant="secondary" className="ml-auto">{sessionComments.length} récitations</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sessionComments.length === 0 ? (
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
                      </tr>
                    </thead>
                    <tbody>
                      {sessionComments.map((sc, i) => (
                        <tr key={i} className={`border-b last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
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
                          <td className="px-4 py-2.5 text-sm">{sc.comment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
    </div>
  )
}
