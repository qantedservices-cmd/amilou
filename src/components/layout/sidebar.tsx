'use client'

import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useImpersonation } from '@/contexts/ImpersonationContext'
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
  BookOpen,
  Library,
  Grid3X3,
  FileText,
  ChevronDown,
  BookMarked,
} from 'lucide-react'

interface NavItem {
  href: string
  icon: typeof LayoutDashboard
  labelKey: string
  adminOnly?: boolean
  children?: { href: string; icon: typeof LayoutDashboard; labelKey: string }[]
}

const navItems: NavItem[] = [
  { href: '/quran', icon: BookOpen, labelKey: 'nav.quran' },
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  {
    href: '/progress',
    icon: TrendingUp,
    labelKey: 'nav.progress',
    children: [
      { href: '/tafsir', icon: BookMarked, labelKey: 'nav.tafsir' },
    ],
  },
  { href: '/attendance', icon: CalendarCheck, labelKey: 'nav.attendance' },
  { href: '/groups', icon: Users, labelKey: 'nav.groups' },
  { href: '/evaluations', icon: ClipboardCheck, labelKey: 'nav.evaluations' },
  { href: '/sessions', icon: Calendar, labelKey: 'nav.sessions' },
  { href: '/mastery', icon: Grid3X3, labelKey: 'nav.mastery' },
  { href: '/books', icon: Library, labelKey: 'nav.books' },
]

const bottomItems: NavItem[] = [
  { href: '/presentation', icon: FileText, labelKey: 'nav.presentation' },
  { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { href: '/admin', icon: Shield, labelKey: 'nav.admin', adminOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const t = useTranslations()
  const { effectiveRole } = useImpersonation()

  const pathWithoutLocale = pathname.replace(/^\/(fr|ar|en)/, '')

  const isActive = (href: string) => {
    return pathWithoutLocale === href || pathWithoutLocale.startsWith(href + '/')
  }

  // Auto-expand parent if a child is active
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const item of navItems) {
      if (item.children?.some(child => isActive(child.href))) {
        initial.add(item.href)
      }
    }
    return initial
  })

  function toggleExpand(href: string) {
    setExpandedMenus(prev => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  function renderNavItem(item: NavItem) {
    const Icon = item.icon
    const active = isActive(item.href)
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedMenus.has(item.href)
    const childActive = item.children?.some(child => isActive(child.href))

    return (
      <div key={item.href}>
        <div className="flex items-center">
          <Link
            href={item.href}
            className={cn(
              'flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active && !childActive
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50'
                : childActive
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {t(item.labelKey)}
          </Link>
          {hasChildren && (
            <button
              onClick={() => toggleExpand(item.href)}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
            {item.children!.map(child => {
              const ChildIcon = child.icon
              const childIsActive = isActive(child.href)
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    childIsActive
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50 font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <ChildIcon className="h-4 w-4" />
                  {t(child.labelKey)}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
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
        {navItems.map(renderNavItem)}
      </nav>

      <div className="border-t p-4 space-y-1">
        {bottomItems
          .filter((item) => !item.adminOnly || effectiveRole === 'ADMIN')
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
