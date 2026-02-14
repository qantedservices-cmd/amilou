'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Search, FileText, BookOpen, Users, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SearchResult {
  pages: Array<{ name: string; path: string }>
  surahs: Array<{ number: number; nameFr: string; nameAr: string; totalVerses: number }>
  books: Array<{ id: string; title: string; titleAr?: string; author?: string; discipline: string }>
  students: Array<{ id: string; name: string | null; email: string }>
}

export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const locale = useLocale()

  // Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 1) {
      setResults(null)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          setResults(await res.json())
        }
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const navigate = useCallback((path: string) => {
    setOpen(false)
    setQuery('')
    setResults(null)
    router.push(`/${locale}${path}`)
  }, [locale, router])

  const hasResults = results && (
    results.pages.length > 0 ||
    results.surahs.length > 0 ||
    results.books.length > 0 ||
    results.students.length > 0
  )

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 md:h-9 md:w-60 md:justify-start md:px-3 md:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline-flex text-sm text-muted-foreground">Rechercher...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher une page, sourate, livre, élève..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Recherche en cours...
            </div>
          )}

          {!loading && query && !hasResults && (
            <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          )}

          {results?.pages && results.pages.length > 0 && (
            <CommandGroup heading="Pages">
              {results.pages.map((page) => (
                <CommandItem
                  key={page.path}
                  value={page.name}
                  onSelect={() => navigate(page.path)}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>{page.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results?.surahs && results.surahs.length > 0 && (
            <CommandGroup heading="Sourates">
              {results.surahs.map((surah) => (
                <CommandItem
                  key={surah.number}
                  value={`${surah.number} ${surah.nameFr} ${surah.nameAr}`}
                  onSelect={() => navigate(`/progress?surah=${surah.number}`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="flex-1">
                    {surah.number}. {surah.nameFr}
                  </span>
                  <span className="text-xs text-muted-foreground mr-2" dir="rtl">
                    {surah.nameAr}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {surah.totalVerses} v.
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results?.books && results.books.length > 0 && (
            <CommandGroup heading="Livres">
              {results.books.map((book) => (
                <CommandItem
                  key={book.id}
                  value={`${book.title} ${book.titleAr || ''} ${book.author || ''}`}
                  onSelect={() => navigate(`/books/${book.id}`)}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span className="flex-1">{book.title}</span>
                  {book.author && (
                    <span className="text-xs text-muted-foreground">{book.author}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results?.students && results.students.length > 0 && (
            <CommandGroup heading="Élèves">
              {results.students.map((student) => (
                <CommandItem
                  key={student.id}
                  value={`${student.name || ''} ${student.email}`}
                  onSelect={() => navigate(`/dashboard?userId=${student.id}`)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>{student.name || student.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
