'use client'

import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Menu,
  LayoutDashboard,
  TrendingUp,
  CalendarCheck,
  Users,
  ClipboardCheck,
  Calendar,
  Settings,
  Shield,
  BookOpen,
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
  { href: '/presentation', icon: BookOpen, labelKey: 'nav.presentation' },
  { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { href: '/admin', icon: Shield, labelKey: 'nav.admin', adminOnly: true },
]

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useTranslations()
  const { effectiveRole } = useImpersonation()

  const isActive = (href: string) => {
    const pathWithoutLocale = pathname.replace(/^\/(fr|ar|en)/, '')
    return pathWithoutLocale === href || pathWithoutLocale.startsWith(href + '/')
  }

  // Close sheet when navigating
  const handleLinkClick = () => {
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <span className="text-lg">📖</span>
            </div>
            <span className="text-lg font-semibold">{t('common.appName')}</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
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
            .filter((item) => !item.adminOnly || effectiveRole === 'ADMIN')
            .map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
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
      </SheetContent>
    </Sheet>
  )
}
