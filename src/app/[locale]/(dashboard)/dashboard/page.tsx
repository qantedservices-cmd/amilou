'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BookOpen, Calendar, TrendingUp, Target, CheckCircle, Circle, AlertCircle, Award, FileText } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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

interface ObjectiveVsRealized {
  programId: string
  programCode: string
  programName: string
  objective: {
    quantity: number
    unit: string
    period: string
  } | null
  realized: {
    quantity: number
    unit: string
  } | null
}

interface GlobalProgress {
  memorizedVerses: number
  memorizedPages: number
  memorizedSurahs: number
  percentage: number
  totalVerses: number
  totalPages: number
  totalSurahs: number
}

interface WeeklyAttendanceEntry {
  id: string
  date: string
  weekNumber: number
  year: number
  sunday: number
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  comment: string | null
  daysActive: number
  totalScore: number
  score: number
}

interface EvolutionData {
  week: string
  weekStart: string
  MEMORIZATION: number
  CONSOLIDATION: number
  REVISION: number
  READING: number
  TAFSIR: number
  total: number
}

interface Stats {
  period: string
  selectedYear: number
  selectedMonth: number
  availableYears: number[]
  globalProgress: GlobalProgress
  totalVerses: number
  totalPages: number
  uniqueSurahs: number
  groupsCount: number
  attendanceRate: number
  activeWeeksCount: number
  totalWeeksInPeriod: number
  recentProgress: ProgressEntry[]
  objectives: Objective[]
  progressByProgram: Record<string, number>
  objectivesVsRealized: ObjectiveVsRealized[]
  evolutionData: EvolutionData[]
  weeklyAttendance: WeeklyAttendanceEntry[]
}

type PeriodType = 'year' | 'month' | 'global'

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

export default function DashboardPage() {
  const t = useTranslations()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodType>('year')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)

  async function fetchStats() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      params.set('year', selectedYear.toString())
      if (period === 'month') {
        params.set('month', selectedMonth.toString())
      }
      const res = await fetch(`/api/stats?${params.toString()}`)
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

  useEffect(() => {
    fetchStats()
  }, [period, selectedYear, selectedMonth])

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

  const UNITS: Record<string, string> = {
    PAGE: 'Page(s)',
    QUART: 'Quart(s)',
    DEMI_HIZB: 'Demi-hizb',
    HIZB: 'Hizb',
    JUZ: 'Juz',
  }

  const PERIODS: Record<string, string> = {
    DAY: '/jour',
    WEEK: '/semaine',
    MONTH: '/mois',
    YEAR: '/an',
  }

  function formatQuantityUnit(quantity: number, unit: string) {
    return `${quantity} ${UNITS[unit] || unit}`
  }

  function formatObjective(obj: ObjectiveVsRealized['objective']) {
    if (!obj) return 'Non défini'
    return `${obj.quantity} ${UNITS[obj.unit] || obj.unit}${PERIODS[obj.period] || ''}`
  }

  function getCompletionStatus(item: ObjectiveVsRealized) {
    if (!item.objective) return 'none'
    if (!item.realized) return 'pending'
    if (item.realized.quantity >= item.objective.quantity && item.realized.unit === item.objective.unit) {
      return 'complete'
    }
    return 'partial'
  }

  function getPeriodLabel() {
    if (period === 'global') return 'Global (tout)'
    if (period === 'month') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`
    return `Année ${selectedYear}`
  }

  const PROGRAM_ORDER = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING', 'TAFSIR']

  const PROGRAM_TEXT_COLORS: Record<string, string> = {
    MEMORIZATION: 'text-emerald-600 dark:text-emerald-400',
    CONSOLIDATION: 'text-blue-600 dark:text-blue-400',
    REVISION: 'text-amber-600 dark:text-amber-400',
    READING: 'text-purple-600 dark:text-purple-400',
    TAFSIR: 'text-rose-600 dark:text-rose-400',
  }

  const CHART_COLORS = {
    MEMORIZATION: '#10b981',
    CONSOLIDATION: '#3b82f6',
    REVISION: '#f59e0b',
    READING: '#8b5cf6',
    TAFSIR: '#f43f5e',
  }

  const statCards = [
    {
      title: t('dashboard.stats.totalVerses'),
      value: stats?.globalProgress?.memorizedVerses || 0,
      description: `sur ${stats?.globalProgress?.totalVerses || 6236} versets`,
      icon: BookOpen,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900',
    },
    {
      title: t('dashboard.stats.totalPages'),
      value: stats?.globalProgress?.memorizedPages || 0,
      description: `sur ${stats?.globalProgress?.totalPages || 604} pages`,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      title: 'Sourates',
      value: stats?.globalProgress?.memorizedSurahs || 0,
      description: `sur ${stats?.globalProgress?.totalSurahs || 114} sourates`,
      icon: Award,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900',
    },
    {
      title: 'Assiduité',
      value: `${stats?.activeWeeksCount || 0}/${stats?.totalWeeksInPeriod || 0}`,
      description: `semaines actives (${stats?.attendanceRate || 0}%)`,
      icon: Calendar,
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.overview')}</p>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Type */}
          <div className="flex rounded-md border">
            {(['year', 'month', 'global'] as PeriodType[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'ghost'}
                size="sm"
                className={`h-8 px-3 rounded-none first:rounded-l-md last:rounded-r-md ${
                  period === p ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                }`}
                onClick={() => setPeriod(p)}
              >
                {p === 'year' ? 'Année' : p === 'month' ? 'Mois' : 'Global'}
              </Button>
            ))}
          </div>

          {/* Year Selector */}
          {period !== 'global' && (
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(stats?.availableYears || [new Date().getFullYear()]).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Month Selector */}
          {period === 'month' && (
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, idx) => (
                  <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Global Progress Bar */}
      <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 border-emerald-200 dark:border-emerald-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-emerald-600" />
            Mon Avancement Global - Mémorisation
          </CardTitle>
          <CardDescription>
            Progression dans la mémorisation du Coran
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-bold text-emerald-600 text-lg">
                {stats?.globalProgress?.percentage || 0}%
              </span>
            </div>
            <Progress
              value={stats?.globalProgress?.percentage || 0}
              className="h-4 bg-emerald-100 dark:bg-emerald-900"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats?.globalProgress?.memorizedPages || 0} pages</span>
              <span>{stats?.globalProgress?.memorizedSurahs || 0} sourates</span>
              <span>{stats?.globalProgress?.memorizedVerses || 0} versets</span>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Évolution sur 12 semaines
          </CardTitle>
          <CardDescription>
            Pages travaillées par programme (toutes activités confondues)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.evolutionData && stats.evolutionData.some(d => d.total > 0) ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-2">{label}</p>
                            {payload.map((entry, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span>{entry.name}: {Number(entry.value).toFixed(1)} pages</span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="MEMORIZATION" name="Mémorisation" stackId="1" stroke={CHART_COLORS.MEMORIZATION} fill={CHART_COLORS.MEMORIZATION} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="CONSOLIDATION" name="Consolidation" stackId="1" stroke={CHART_COLORS.CONSOLIDATION} fill={CHART_COLORS.CONSOLIDATION} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="REVISION" name="Révision" stackId="1" stroke={CHART_COLORS.REVISION} fill={CHART_COLORS.REVISION} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="READING" name="Lecture" stackId="1" stroke={CHART_COLORS.READING} fill={CHART_COLORS.READING} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="TAFSIR" name="Tafsir" stackId="1" stroke={CHART_COLORS.TAFSIR} fill={CHART_COLORS.TAFSIR} fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Pas encore de données d'activité
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bilan Assiduité par Programme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Bilan Assiduité - {getPeriodLabel()}
          </CardTitle>
          <CardDescription>
            Taux de réalisation par programme journalier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Programmes Journaliers</h4>
              {[
                { code: 'MEMORIZATION', name: 'Mémorisation', color: 'bg-emerald-500' },
                { code: 'CONSOLIDATION', name: 'Consolidation', color: 'bg-blue-500' },
                { code: 'REVISION', name: 'Révision', color: 'bg-amber-500' },
                { code: 'READING', name: 'Lecture', color: 'bg-purple-500' },
              ].map((program) => {
                const days = stats?.progressByProgram?.[program.code] || 0
                const totalDays = period === 'month' ? 30 : period === 'year' ? 365 : (stats?.totalWeeksInPeriod || 1) * 7
                const percentage = Math.min(Math.round((days / Math.max(totalDays / 7, 1)) * 100), 100)
                return (
                  <div key={program.code} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{program.name}</span>
                      <span className="font-medium">{stats?.progressByProgram?.[program.code] || 0} versets</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${program.color} transition-all duration-300`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Historique Assiduité - {getPeriodLabel()}
          </CardTitle>
          <CardDescription>
            Score journalier (ancien système 0-5)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.weeklyAttendance && stats.weeklyAttendance.length > 0 ? (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 sm:px-2 font-medium text-muted-foreground text-xs sm:text-sm">Sem.</th>
                    <th className="text-center py-2 px-0.5 sm:px-1 font-medium text-muted-foreground text-xs sm:text-sm">D</th>
                    <th className="text-center py-2 px-0.5 sm:px-1 font-medium text-muted-foreground text-xs sm:text-sm">L</th>
                    <th className="text-center py-2 px-0.5 sm:px-1 font-medium text-muted-foreground text-xs sm:text-sm">M</th>
                    <th className="text-center py-2 px-0.5 sm:px-1 font-medium text-muted-foreground text-xs sm:text-sm">Me</th>
                    <th className="text-center py-2 px-0.5 sm:px-1 font-medium text-muted-foreground text-xs sm:text-sm">J</th>
                    <th className="text-center py-2 px-0.5 sm:px-1 font-medium text-muted-foreground text-xs sm:text-sm">V</th>
                    <th className="text-center py-2 px-0.5 sm:px-1 font-medium text-muted-foreground text-xs sm:text-sm">S</th>
                    <th className="text-center py-2 px-1 sm:px-2 font-medium text-muted-foreground text-xs sm:text-sm">%</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.weeklyAttendance.map((week) => (
                    <tr key={week.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 px-1 sm:px-2 font-medium whitespace-nowrap text-xs sm:text-sm">
                        S{week.weekNumber}
                        <span className="text-xs text-muted-foreground ml-0.5">
                          {week.year !== new Date().getFullYear() ? `'${String(week.year).slice(2)}` : ''}
                        </span>
                      </td>
                      {(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const).map((day) => (
                        <td key={day} className="text-center py-2 px-0.5 sm:px-1">
                          <ScoreCell score={week[day]} />
                        </td>
                      ))}
                      <td className="text-center py-2 px-1 sm:px-2">
                        <Badge variant={week.score >= 80 ? 'default' : week.score >= 50 ? 'secondary' : 'outline'}
                          className={week.score >= 80 ? 'bg-emerald-600' : week.score >= 50 ? 'bg-amber-500' : ''}>
                          {week.score}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="mt-3 pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Programmes accomplis dans l'ordre : Mémo - Conso - Révision - Lecture - Tafsir</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500"></span> 5 (tous)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-emerald-300"></span> 4
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-amber-400"></span> 3
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-orange-400"></span> 2
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-300"></span> 1
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700"></span> 0
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              Aucune donnée d'assiduité pour cette période
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objectifs vs Réalisé - Today */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-600" />
            Objectifs vs Réalisé - Aujourd'hui
          </CardTitle>
          <CardDescription>
            Votre progression quotidienne par programme
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.objectivesVsRealized && stats.objectivesVsRealized.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {stats.objectivesVsRealized.map((item) => {
                const status = getCompletionStatus(item)
                return (
                  <div
                    key={item.programId}
                    className={`rounded-lg border p-3 ${
                      status === 'complete'
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                        : status === 'partial'
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getProgramColor(item.programCode)}>
                        {item.programName}
                      </Badge>
                      {status === 'complete' && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                      {status === 'partial' && <AlertCircle className="h-4 w-4 text-amber-600" />}
                      {status === 'pending' && <Circle className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Objectif:</span>
                        <span className="font-medium">{formatObjective(item.objective)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Réalisé:</span>
                        <span className={`font-medium ${item.realized ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {item.realized ? formatQuantityUnit(item.realized.quantity, item.realized.unit) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              Configurez vos objectifs dans les paramètres
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Progression par programme - {getPeriodLabel()}
          </CardTitle>
          <CardDescription>Versets travaillés</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.progressByProgram && Object.keys(stats.progressByProgram).length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PROGRAM_ORDER
                .filter(code => stats.progressByProgram[code] !== undefined)
                .map(code => (
                  <div key={code} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <Badge className={getProgramColor(code)}>
                      {code === 'MEMORIZATION' && 'Mémorisation'}
                      {code === 'CONSOLIDATION' && 'Consolidation'}
                      {code === 'REVISION' && 'Révision'}
                      {code === 'READING' && 'Lecture'}
                      {code === 'TAFSIR' && 'Tafsir'}
                    </Badge>
                    <span className={`font-bold text-lg ${PROGRAM_TEXT_COLORS[code] || 'text-emerald-600'}`}>
                      {stats.progressByProgram[code]}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              Aucune activité - {getPeriodLabel()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Progress */}
      <Card>
        <CardHeader>
          <CardTitle>{t('progress.title')}</CardTitle>
          <CardDescription>Vos dernières entrées - {getPeriodLabel()}</CardDescription>
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

function ScoreCell({ score }: { score: number }) {
  if (score === 0) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded text-xs font-medium bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600">
        -
      </span>
    )
  }

  const colors: Record<number, string> = {
    5: 'bg-emerald-500 text-white',
    4: 'bg-emerald-300 text-emerald-900 dark:bg-emerald-700 dark:text-emerald-100',
    3: 'bg-amber-400 text-amber-900 dark:bg-amber-600 dark:text-amber-100',
    2: 'bg-orange-400 text-orange-900 dark:bg-orange-600 dark:text-orange-100',
    1: 'bg-red-300 text-red-900 dark:bg-red-700 dark:text-red-100',
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded text-xs font-bold ${colors[score] || colors[1]}`}
      title={`${score}/5 programmes`}
    >
      {score}
    </span>
  )
}
