'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Calendar, Users, TrendingUp, Target } from 'lucide-react'

interface Program {
  id: string
  code: string
  nameFr: string
}

interface Surah {
  number: number
  nameFr: string
  nameAr: string
}

interface ProgressEntry {
  id: string
  date: string
  verseStart: number
  verseEnd: number
  program: Program
  surah: Surah
}

interface Objective {
  id: string
  dailyTarget: number
  program: Program
}

interface Stats {
  totalVerses: number
  totalPages: number
  uniqueSurahs: number
  groupsCount: number
  attendanceRate: number
  recentProgress: ProgressEntry[]
  objectives: Objective[]
  weeklyByProgram: Record<string, number>
}

export default function DashboardPage() {
  const t = useTranslations()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

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

  const statCards = [
    {
      title: t('dashboard.stats.totalVerses'),
      value: stats?.totalVerses || 0,
      description: 'versets travaillés',
      icon: BookOpen,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900',
    },
    {
      title: t('dashboard.stats.totalPages'),
      value: stats?.totalPages || 0,
      description: 'pages estimées',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      title: t('dashboard.stats.attendanceRate'),
      value: `${stats?.attendanceRate || 0}%`,
      description: 'cette semaine',
      icon: Calendar,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900',
    },
    {
      title: t('nav.groups'),
      value: stats?.groupsCount || 0,
      description: 'groupes actifs',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
    },
  ]

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.overview')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly Progress */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.myProgress')}</CardTitle>
            <CardDescription>Votre progression cette semaine</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.weeklyByProgram && Object.keys(stats.weeklyByProgram).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(stats.weeklyByProgram).map(([code, verses]) => (
                  <div key={code} className="flex items-center justify-between">
                    <Badge className={getProgramColor(code)}>
                      {code === 'MEMORIZATION' && t('programs.memorization')}
                      {code === 'CONSOLIDATION' && t('programs.consolidation')}
                      {code === 'REVISION' && t('programs.revision')}
                      {code === 'READING' && t('programs.reading')}
                      {code === 'TAFSIR' && t('programs.tafsir')}
                    </Badge>
                    <span className="font-semibold text-emerald-600">{verses} versets</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[150px] items-center justify-center text-muted-foreground">
                Aucune activité cette semaine
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Objectives */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t('objectives.title')}
            </CardTitle>
            <CardDescription>Vos objectifs actifs</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.objectives && stats.objectives.length > 0 ? (
              <div className="space-y-3">
                {stats.objectives.map((obj) => (
                  <div key={obj.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <Badge className={getProgramColor(obj.program.code)}>
                      {obj.program.nameFr}
                    </Badge>
                    <span className="text-sm font-medium">
                      {obj.dailyTarget} {t('objectives.versesPerDay')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[150px] items-center justify-center text-muted-foreground">
                Aucun objectif défini
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Progress */}
      <Card>
        <CardHeader>
          <CardTitle>{t('progress.title')}</CardTitle>
          <CardDescription>Vos dernières entrées</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentProgress && stats.recentProgress.length > 0 ? (
            <div className="space-y-3">
              {stats.recentProgress.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge className={getProgramColor(entry.program.code)}>
                      {entry.program.nameFr}
                    </Badge>
                    <div>
                      <span className="font-medium">{entry.surah.nameFr}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        v.{entry.verseStart}-{entry.verseEnd}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              {t('progress.noEntries')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
