'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  CalendarCheck,
  Users,
  ClipboardCheck,
  Calendar,
  Settings,
  Shield,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { href: '/progress', icon: TrendingUp, labelKey: 'nav.progress' },
  { href: '/attendance', icon: CalendarCheck, labelKey: 'nav.attendance' },
  { href: '/groups', icon: Users, labelKey: 'nav.groups' },
  { href: '/evaluations', icon: ClipboardCheck, labelKey: 'nav.evaluations' },
  { href: '/sessions', icon: Calendar, labelKey: 'nav.sessions' },
]

const bottomItems = [
  { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { href: '/admin', icon: Shield, labelKey: 'nav.admin', adminOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const t = useTranslations()
  const { data: session } = useSession()
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUserRole() {
      if (session?.user?.id) {
        try {
          const res = await fetch('/api/me')
          if (res.ok) {
            const data = await res.json()
            setUserRole(data.role)
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
        }
      }
    }
    fetchUserRole()
  }, [session?.user?.id])

  const isActive = (href: string) => {
    const pathWithoutLocale = pathname.replace(/^\/(fr|ar|en)/, '')
    return pathWithoutLocale === href || pathWithoutLocale.startsWith(href + '/')
  }

  return (
    <aside className="fixed inset-y-0 start-0 z-50 hidden w-64 flex-col border-e bg-card md:flex">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
          <span className="text-lg">📖</span>
        </div>
        <span className="text-lg font-semibold">{t('common.appName')}</span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {t(item.labelKey)}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-4 space-y-1">
        {bottomItems
          .filter((item) => !item.adminOnly || userRole === 'ADMIN')
          .map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {t(item.labelKey)}
              </Link>
            )
          })}
      </div>
    </aside>
  )
}
