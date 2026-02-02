'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  User,
  BookOpen,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Award,
  Clock,
} from 'lucide-react'

interface ProfileData {
  user: {
    id: string
    name: string | null
    email: string
    role: string
    createdAt: string
    groups: { id: string; name: string; role: string }[]
  }
  memorization: {
    surahsValidated: number
    surahsInProgress: number
    totalVerses: number
    totalPages: number
    progressPercent: number
  }
  attendance: {
    totalSessions: number
    presentSessions: number
    globalRate: number
    thisYear: { sessions: number; present: number; rate: number }
    thisMonth: { sessions: number; present: number; rate: number }
    currentStreak: number
  }
  dailyPrograms: {
    currentWeek: { name: string; daysCompleted: number }[]
    weekNumber: number
  }
  weeklyObjectives: {
    id: string
    name: string
    isCustom: boolean
    completed: boolean
  }[]
  recentRecitations: {
    id: string
    date: string
    weekNumber: number | null
    groupName: string
    surahNumber: number
    surahName: string
    surahNameAr: string
    type: string
    verseStart: number
    verseEnd: number
    status: string
    comment: string | null
  }[]
  surahMasteries: {
    surahNumber: number
    surahName: string
    surahNameAr: string
    totalVerses: number
    status: string
    validatedWeek: number | null
    validatedAt: string | null
  }[]
  recentValidations: {
    surahNumber: number
    surahName: string
    validatedAt: string | null
    validatedWeek: number | null
  }[]
}

const roleLabels: Record<string, string> = {
  USER: 'Utilisateur',
  REFERENT: 'Référent',
  MANAGER: 'Gestionnaire',
  ADMIN: 'Administrateur',
}

const statusColors: Record<string, string> = {
  X: 'bg-gray-100 text-gray-800',
  AM: 'bg-blue-100 text-blue-800',
  '50%': 'bg-yellow-100 text-yellow-800',
  '51%': 'bg-yellow-100 text-yellow-800',
  '90%': 'bg-orange-100 text-orange-800',
  V: 'bg-green-100 text-green-800',
  S: 'bg-emerald-100 text-emerald-800',
}

function getStatusColor(status: string): string {
  for (const [key, value] of Object.entries(statusColors)) {
    if (status.startsWith(key)) return value
  }
  return 'bg-gray-100 text-gray-800'
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const userId = params.id as string

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOwnProfile = session?.user?.id === userId

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch(`/api/users/${userId}/profile`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erreur lors du chargement')
        }
        const data = await response.json()
        setProfile(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchProfile()
    }
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">
          {isOwnProfile ? 'Mon Profil' : `Profil de ${profile.user.name || 'Utilisateur'}`}
        </h1>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <User className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{profile.user.name || 'Sans nom'}</CardTitle>
              <CardDescription>{profile.user.email}</CardDescription>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{roleLabels[profile.user.role] || profile.user.role}</Badge>
                {profile.user.groups.map((g) => (
                  <Badge key={g.id} variant="outline">
                    {g.name}
                    {g.role !== 'MEMBER' && ` (${g.role})`}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Inscrit le</p>
              <p className="font-medium">{new Date(profile.user.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sourates validées</p>
                <p className="text-2xl font-bold">{profile.memorization.surahsValidated}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold">{profile.memorization.surahsInProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Présence globale</p>
                <p className="text-2xl font-bold">{profile.attendance.globalRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Award className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Série en cours</p>
                <p className="text-2xl font-bold">{profile.attendance.currentStreak}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Memorization Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Progression Mémorisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Progression globale</span>
                <span className="text-sm font-medium">{profile.memorization.progressPercent}%</span>
              </div>
              <Progress value={profile.memorization.progressPercent} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{profile.memorization.totalVerses}</p>
                <p className="text-sm text-muted-foreground">Versets mémorisés</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{profile.memorization.totalPages}</p>
                <p className="text-sm text-muted-foreground">Pages (~)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{profile.memorization.surahsValidated}</p>
                <p className="text-sm text-muted-foreground">Sourates validées</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{profile.memorization.surahsInProgress}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed info */}
      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">Assiduité</TabsTrigger>
          <TabsTrigger value="recitations">Récitations</TabsTrigger>
          <TabsTrigger value="masteries">Sourates</TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cette année</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{profile.attendance.thisYear.rate}%</p>
                <p className="text-sm text-muted-foreground">
                  {profile.attendance.thisYear.present}/{profile.attendance.thisYear.sessions} séances
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ce mois</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{profile.attendance.thisMonth.rate}%</p>
                <p className="text-sm text-muted-foreground">
                  {profile.attendance.thisMonth.present}/{profile.attendance.thisMonth.sessions} séances
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{profile.attendance.globalRate}%</p>
                <p className="text-sm text-muted-foreground">
                  {profile.attendance.presentSessions}/{profile.attendance.totalSessions} séances
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Programs this week */}
          {profile.dailyPrograms.currentWeek.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Programmes cette semaine (S{profile.dailyPrograms.weekNumber})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.dailyPrograms.currentWeek.map((prog, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span>{prog.name}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={(prog.daysCompleted / 7) * 100} className="w-24" />
                        <span className="text-sm text-muted-foreground w-12">
                          {prog.daysCompleted}/7
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly Objectives */}
          {profile.weeklyObjectives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Objectifs hebdomadaires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.weeklyObjectives.map((obj) => (
                    <Badge
                      key={obj.id}
                      variant={obj.completed ? 'default' : 'outline'}
                      className={obj.completed ? 'bg-emerald-500' : ''}
                    >
                      {obj.completed && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {obj.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recitations Tab */}
        <TabsContent value="recitations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Récitations récentes</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.recentRecitations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune récitation enregistrée
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Sourate</TableHead>
                      <TableHead>Versets</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Groupe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.recentRecitations.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="whitespace-nowrap">
                          <div>{rec.date}</div>
                          {rec.weekNumber && (
                            <div className="text-xs text-muted-foreground">S{rec.weekNumber}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{rec.surahName}</div>
                          <div className="text-xs text-muted-foreground font-arabic">
                            {rec.surahNameAr}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rec.verseStart}-{rec.verseEnd}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {rec.type === 'MEMORIZATION' ? 'Mémo' : 'Révision'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(rec.status)}>{rec.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rec.groupName}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Masteries Tab */}
        <TabsContent value="masteries">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">État des sourates</CardTitle>
              <CardDescription>
                {profile.surahMasteries.length} sourates enregistrées
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profile.surahMasteries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune sourate enregistrée
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Sourate</TableHead>
                      <TableHead>Versets</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Validation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.surahMasteries.map((m) => (
                      <TableRow key={m.surahNumber}>
                        <TableCell className="font-medium">{m.surahNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{m.surahName}</div>
                          <div className="text-xs text-muted-foreground font-arabic">
                            {m.surahNameAr}
                          </div>
                        </TableCell>
                        <TableCell>{m.totalVerses}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(m.status)}>{m.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {m.validatedWeek ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="w-3 h-3" />
                              S{m.validatedWeek}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Validations */}
      {profile.recentValidations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Validations récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.recentValidations.map((v, idx) => (
                <Badge key={idx} variant="secondary" className="py-1">
                  {v.surahName}
                  {v.validatedWeek && (
                    <span className="ml-1 text-xs opacity-70">(S{v.validatedWeek})</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
