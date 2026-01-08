import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Calendar, Users, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const t = useTranslations()

  const stats = [
    {
      title: t('dashboard.stats.totalVerses'),
      value: '0',
      description: 'versets mémorisés',
      icon: BookOpen,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900',
    },
    {
      title: t('dashboard.stats.totalPages'),
      value: '0',
      description: 'pages complétées',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      title: t('dashboard.stats.attendanceRate'),
      value: '0%',
      description: 'ce mois',
      icon: Calendar,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900',
    },
    {
      title: t('nav.groups'),
      value: '0',
      description: 'groupes actifs',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.overview')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
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
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.myProgress')}</CardTitle>
            <CardDescription>Votre progression cette semaine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Graphique de progression à venir
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('attendance.title')}</CardTitle>
            <CardDescription>Votre assiduité ce mois</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Calendrier d'assiduité à venir
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('progress.title')}</CardTitle>
          <CardDescription>Vos dernières entrées</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[100px] items-center justify-center text-muted-foreground">
            {t('progress.noEntries')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
