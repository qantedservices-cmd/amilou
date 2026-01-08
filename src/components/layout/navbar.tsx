'use client'

import { useTranslations } from 'next-intl'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageSelector } from './language-selector'
import { UserMenu } from './user-menu'

interface NavbarProps {
  onMenuClick?: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const t = useTranslations()

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Menu</span>
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <LanguageSelector />
        <UserMenu />
      </div>
    </header>
  )
}
