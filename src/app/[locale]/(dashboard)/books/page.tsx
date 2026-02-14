'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Library, Search, Plus, BookOpen, Check, List, X } from 'lucide-react'

interface Book {
  id: string
  title: string
  titleAr?: string
  titleEn?: string
  author?: string
  authorAr?: string
  type: string
  discipline: string
  collectionId?: string
  collectionLevel?: number
  totalItems: number
  isSystem: boolean
  sortOrder: number
  _count: { chapters: number }
  // User-specific
  completedItems?: number
  percentage?: number
}

const DISCIPLINES = [
  'AQEEDAH', 'HADITH', 'FIQH', 'TAJWEED', 'GRAMMAR', 'USUL_FIQH', 'POETRY', 'GENERAL', 'ADAB',
]

const DISCIPLINE_COLORS: Record<string, string> = {
  AQEEDAH: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  HADITH: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FIQH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TAJWEED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  GRAMMAR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  USUL_FIQH: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  POETRY: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  GENERAL: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  ADAB: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
}

export default function BooksPage() {
  const t = useTranslations('books')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()

  const [books, setBooks] = useState<Book[]>([])
  const [myBooks, setMyBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [view, setView] = useState<'collection' | 'flat' | 'list'>('list')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addingBookId, setAddingBookId] = useState<string | null>(null)

  useEffect(() => {
    fetchBooks()
    fetchMyBooks()
  }, [])

  async function fetchBooks() {
    try {
      const res = await fetch('/api/books')
      if (res.ok) setBooks(await res.json())
    } catch (e) {
      console.error('Error fetching books:', e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMyBooks() {
    try {
      const res = await fetch('/api/user/books')
      if (res.ok) setMyBooks(await res.json())
    } catch (e) {
      console.error('Error fetching my books:', e)
    }
  }

  async function removeFromMyList(bookId: string) {
    try {
      const res = await fetch(`/api/user/books/${bookId}`, { method: 'DELETE' })
      if (res.ok) {
        setMyBooks(prev => prev.filter(b => b.id !== bookId))
      }
    } catch (e) {
      console.error('Error removing book:', e)
    }
  }

  async function addToMyList(bookId: string) {
    setAddingBookId(bookId)
    try {
      const res = await fetch('/api/user/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      })
      if (res.ok) {
        await fetchMyBooks()
      }
    } catch (e) {
      console.error('Error adding book:', e)
    } finally {
      setAddingBookId(null)
    }
  }

  const filteredBooks = books.filter((book) => {
    if (category !== 'all') {
      // category can be a type (MATN, HADITH_COLLECTION) or a discipline
      if (category === 'MATN' || category === 'HADITH_COLLECTION') {
        if (book.type !== category) return false
      } else {
        if (book.discipline !== category) return false
      }
    }
    if (search) {
      const q = search.toLowerCase()
      if (
        !book.title.toLowerCase().includes(q) &&
        !(book.titleAr && book.titleAr.includes(q)) &&
        !(book.author && book.author.toLowerCase().includes(q))
      ) {
        return false
      }
    }
    return true
  })

  // Group by collection level + discipline for books without level
  const byLevel: Record<number, Book[]> = {}
  const byDiscipline: Record<string, Book[]> = {}
  for (const book of filteredBooks) {
    if (book.collectionLevel != null) {
      if (!byLevel[book.collectionLevel]) byLevel[book.collectionLevel] = []
      byLevel[book.collectionLevel].push(book)
    } else {
      const disc = book.discipline || 'GENERAL'
      if (!byDiscipline[disc]) byDiscipline[disc] = []
      byDiscipline[disc].push(book)
    }
  }

  const DISCIPLINE_LABELS: Record<string, string> = {
    HADITH: 'Hadiths',
    AQEEDAH: 'Croyance (Aqeedah)',
    FIQH: 'Jurisprudence (Fiqh)',
    TAJWEED: 'Tajweed',
    GRAMMAR: 'Grammaire',
    USUL_FIQH: 'Fondements du Fiqh',
    POETRY: 'Poésie',
    ADAB: 'Adab',
    GENERAL: 'Autres',
  }

  const myBookIds = new Set(myBooks.map((b) => b.id))

  function BookCard({ book }: { book: Book }) {
    const myBook = myBooks.find((b) => b.id === book.id)
    const pct = myBook?.percentage || 0
    const isInMyList = myBookIds.has(book.id)

    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => router.push(`/${locale}/books/${book.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{book.title}</h3>
              {book.titleAr && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="rtl">
                  {book.titleAr}
                </p>
              )}
              {book.author && (
                <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
              )}
            </div>
            {!isInMyList && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  addToMyList(book.id)
                }}
                disabled={addingBookId === book.id}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {isInMyList && (
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            )}
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            <Badge variant="outline" className={`text-[10px] ${DISCIPLINE_COLORS[book.discipline] || ''}`}>
              {t(`disciplines.${book.discipline}`)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {book.totalItems} {t('items')}
            </Badge>
            {book.collectionLevel != null && (
              <Badge variant="secondary" className="text-[10px]">
                {t('level')} {book.collectionLevel}
              </Badge>
            )}
          </div>

          {pct > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>{t('progress')}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-emerald-600" />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('addToMyList')}
        </Button>
      </div>

      {/* My Books Section */}
      {myBooks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('myBooks')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myBooks.map((book) => {
              const pct = book.percentage || 0
              return (
                <Card
                  key={`my-${book.id}`}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/${locale}/books/${book.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{book.title}</h3>
                        {book.titleAr && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="rtl">
                            {book.titleAr}
                          </p>
                        )}
                        {book.author && (
                          <p className="text-xs text-muted-foreground mt-1">{book.author}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromMyList(book.id)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className={`text-[10px] ${DISCIPLINE_COLORS[book.discipline] || ''}`}>
                        {t(`disciplines.${book.discipline}`)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {book.totalItems} {t('items')}
                      </Badge>
                    </div>

                    {pct > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{t('progress')}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Catalog */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t('catalog')}</h2>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Toutes catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              <SelectItem value="MATN">Mutun (collection)</SelectItem>
              <SelectItem value="HADITH_COLLECTION">Collections de hadiths</SelectItem>
              <SelectItem value="AQEEDAH">Croyance (Aqeedah)</SelectItem>
              <SelectItem value="HADITH">Hadiths</SelectItem>
              <SelectItem value="FIQH">Jurisprudence (Fiqh)</SelectItem>
              <SelectItem value="TAJWEED">Tajweed</SelectItem>
              <SelectItem value="GRAMMAR">Grammaire</SelectItem>
              <SelectItem value="USUL_FIQH">Fondements du Fiqh</SelectItem>
              <SelectItem value="ADAB">Adab</SelectItem>
              <SelectItem value="POETRY">Poésie</SelectItem>
              <SelectItem value="GENERAL">Autres</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button
              variant={view === 'collection' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('collection')}
            >
              {t('collection')}
            </Button>
            <Button
              variant={view === 'flat' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('flat')}
            >
              {t('catalog')}
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4 mr-1" />
              Liste
            </Button>
          </div>
        </div>

        {/* Collection View */}
        {view === 'collection' && Object.keys(byLevel).length > 0 && (
          <Accordion type="multiple" defaultValue={Object.keys(byLevel).map(String)}>
            {Object.entries(byLevel)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level, levelBooks]) => (
                <AccordionItem key={level} value={level}>
                  <AccordionTrigger className="text-sm font-semibold">
                    {t('level')} {level}
                    <Badge variant="secondary" className="ml-2">
                      {levelBooks.length}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                      {levelBooks.map((book) => (
                        <BookCard key={book.id} book={book} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            {Object.entries(byDiscipline)
              .sort(([a], [b]) => (DISCIPLINE_LABELS[a] || a).localeCompare(DISCIPLINE_LABELS[b] || b))
              .map(([disc, discBooks]) => (
                <AccordionItem key={disc} value={`disc-${disc}`}>
                  <AccordionTrigger className="text-sm font-semibold">
                    {DISCIPLINE_LABELS[disc] || disc}
                    <Badge variant="secondary" className="ml-2">
                      {discBooks.length}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                      {discBooks.map((book) => (
                        <BookCard key={book.id} book={book} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        )}

        {/* Flat View */}
        {view === 'flat' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="border rounded-lg divide-y">
            {filteredBooks.map((book) => {
              const myBook = myBooks.find((b) => b.id === book.id)
              const pct = myBook?.percentage || 0
              const isInMyList = myBookIds.has(book.id)

              return (
                <div
                  key={book.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/${locale}/books/${book.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{book.title}</span>
                      {book.titleAr && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline" dir="rtl">
                          {book.titleAr}
                        </span>
                      )}
                    </div>
                    {book.author && (
                      <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                    )}
                  </div>

                  <Badge variant="outline" className={`text-[10px] shrink-0 ${DISCIPLINE_COLORS[book.discipline] || ''}`}>
                    {t(`disciplines.${book.discipline}`)}
                  </Badge>

                  <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                    {book.totalItems} {t('items')}
                  </span>

                  {pct > 0 && (
                    <div className="shrink-0 w-16 flex items-center gap-1">
                      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{pct}%</span>
                    </div>
                  )}

                  {isInMyList ? (
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        addToMyList(book.id)
                      }}
                      disabled={addingBookId === book.id}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {filteredBooks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('noBooks')}</p>
          </div>
        )}
      </div>

      {/* Add Book Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('addToMyList')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {books
              .filter((b) => !myBookIds.has(b.id))
              .map((book) => (
                <div
                  key={book.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    addToMyList(book.id)
                    setShowAddDialog(false)
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">{book.title}</p>
                    {book.titleAr && (
                      <p className="text-xs text-muted-foreground" dir="rtl">
                        {book.titleAr}
                      </p>
                    )}
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${DISCIPLINE_COLORS[book.discipline] || ''}`}>
                        {t(`disciplines.${book.discipline}`)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {book.totalItems} {t('items')}
                      </Badge>
                    </div>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            {books.filter((b) => !myBookIds.has(b.id)).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('noBooks')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
