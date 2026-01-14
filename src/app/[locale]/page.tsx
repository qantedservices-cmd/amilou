import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

export default function HomePage() {
  const t = useTranslations()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950 dark:to-black">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
            <span className="text-4xl">📖</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-emerald-900 dark:text-emerald-50">
            {t('common.appName')}
          </h1>
          <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            {t('dashboard.title')} - {t('progress.title')}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-full bg-emerald-600 px-8 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            {t('auth.login')}
          </Link>
          <Link
            href="/register"
            className="flex h-12 items-center justify-center rounded-full border border-emerald-600 px-8 font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-950"
          >
            {t('auth.register')}
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <FeatureCard icon="📊" label={t('nav.dashboard')} />
          <FeatureCard icon="📈" label={t('nav.progress')} />
          <FeatureCard icon="✅" label={t('nav.attendance')} />
          <FeatureCard icon="👥" label={t('nav.groups')} />
        </div>
      </main>
    </div>
  )
}

function FeatureCard({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
    </div>
  )
}
