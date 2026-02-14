'use client'

import { LanguageSelector } from './language-selector'
import { UserMenu } from './user-menu'
import { MobileSidebar } from './mobile-sidebar'
import { SearchCommand } from '@/components/search-command'

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-6">
      <MobileSidebar />

      <div className="flex-1 flex justify-center">
        <SearchCommand />
      </div>

      <div className="flex items-center gap-4">
        <LanguageSelector />
        <UserMenu />
      </div>
    </header>
  )
}
