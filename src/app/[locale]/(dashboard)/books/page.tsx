'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Library, Search, Plus, BookOpen, Check, List, X, BookPlus } from 'lucide-react'

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

interface ChapterForm {
  title: string
  titleAr: string
  pageStart: string
  pageEnd: string
}

const EMPTY_CHAPTER: ChapterForm = { title: '', titleAr: '', pageStart: '', pageEnd: '' }

export default function BooksPage() {
  const t = useTranslations('books')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const { data: sessionData } = useSession()

  const [books, setBooks] = useState<Book[]>([])
  const [myBooks, setMyBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [view, setView] = useState<'collection' | 'flat' | 'list'>('list')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addingBookId, setAddingBookId] = useState<string | null>(null)

  // Create book dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    titleAr: '',
    author: '',
    authorAr: '',
    discipline: 'GENERAL',
    type: 'MATN',
    totalPages: '',
  })
  const [createChapters, setCreateChapters] = useState<ChapterForm[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createGroupId, setCreateGroupId] = useState('')
  const [userGroups, setUserGroups] = useState<Array<{id: string, name: string}>>([])

  const isAdmin = (sessionData?.user as any)?.role === 'ADMIN'
  const userRole = (sessionData?.user as any)?.role

  useEffect(() => {
    fetchBooks()
    fetchMyBooks()
    fetchUserGroups()
  }, [])

  async function fetchUserGroups() {
    try {
      const groupsRes = await fetch('/api/groups')
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        setUserGroups(Array.isArray(groupsData) ? groupsData.map((g: any) => ({ id: g.id, name: g.name })) : [])
      }
    } catch (e) {
      console.error('Error fetching groups:', e)
    }
  }

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

  async function createBook() {
    setCreateError(null)
    if (!createForm.title.trim()) {
      setCreateError('Le titre est requis.')
      return
    }
    const totalPages = parseInt(createForm.totalPages)
    if (!totalPages || totalPages < 1) {
      setCreateError('Le nombre de pages doit être un entier positif.')
      return
    }
    setCreating(true)
    try {
      const chapters = createChapters
        .filter((ch) => ch.title.trim())
        .map((ch) => ({
          title: ch.title.trim(),
          titleAr: ch.titleAr.trim() || undefined,
          pageStart: ch.pageStart ? parseInt(ch.pageStart) : undefined,
          pageEnd: ch.pageEnd ? parseInt(ch.pageEnd) : undefined,
        }))

      const res = await fetch('/api/admin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, totalPages, chapters: chapters.length > 0 ? chapters : undefined, groupId: createGroupId || undefined }),
      })

      if (!res.ok) {
        const err = await res.json()
        setCreateError(err.error || 'Erreur lors de la création.')
        return
      }

      // Reset and refresh
      setShowCreateDialog(false)
      setCreateForm({ title: '', titleAr: '', author: '', authorAr: '', discipline: 'GENERAL', type: 'MATN', totalPages: '' })
      setCreateChapters([])
      setCreateGroupId('')
      await fetchBooks()
    } catch {
      setCreateError('Erreur réseau.')
    } finally {
      setCreating(false)
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

  // Count books per category (based on all books, not filtered)
  const categoryCounts: Record<string, number> = {}
  for (const book of books) {
    // Count by type
    categoryCounts[book.type] = (categoryCounts[book.type] || 0) + 1
    // Count by discipline
    categoryCounts[book.discipline] = (categoryCounts[book.discipline] || 0) + 1
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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setCreateError(null)
              setCreateGroupId('')
              setShowCreateDialog(true)
            }}
            size="sm"
            variant="outline"
          >
            <BookPlus className="h-4 w-4 mr-1" />
            Ajouter un livre
          </Button>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('addToMyList')}
          </Button>
        </div>
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
              <SelectItem value="all">Toutes catégories ({books.length})</SelectItem>
              <SelectItem value="MATN">Mutun ({categoryCounts['MATN'] || 0})</SelectItem>
              <SelectItem value="HADITH_COLLECTION">Collections de hadiths ({categoryCounts['HADITH_COLLECTION'] || 0})</SelectItem>
              <SelectItem value="AQEEDAH">Croyance ({categoryCounts['AQEEDAH'] || 0})</SelectItem>
              <SelectItem value="HADITH">Hadiths ({categoryCounts['HADITH'] || 0})</SelectItem>
              <SelectItem value="FIQH">Fiqh ({categoryCounts['FIQH'] || 0})</SelectItem>
              <SelectItem value="TAJWEED">Tajweed ({categoryCounts['TAJWEED'] || 0})</SelectItem>
              <SelectItem value="GRAMMAR">Grammaire ({categoryCounts['GRAMMAR'] || 0})</SelectItem>
              <SelectItem value="USUL_FIQH">Usul al-Fiqh ({categoryCounts['USUL_FIQH'] || 0})</SelectItem>
              <SelectItem value="ADAB">Adab ({categoryCounts['ADAB'] || 0})</SelectItem>
              <SelectItem value="POETRY">Poésie ({categoryCounts['POETRY'] || 0})</SelectItem>
              <SelectItem value="GENERAL">Autres ({categoryCounts['GENERAL'] || 0})</SelectItem>
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

      {/* Create Book Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) { setCreateGroupId('') } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookPlus className="h-5 w-5" />
              Ajouter un livre
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-title">Titre (français) <span className="text-destructive">*</span></Label>
                <Input
                  id="create-title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Titre du livre"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-titleAr">Titre (arabe)</Label>
                <Input
                  id="create-titleAr"
                  dir="rtl"
                  value={createForm.titleAr}
                  onChange={(e) => setCreateForm((f) => ({ ...f, titleAr: e.target.value }))}
                  placeholder="العنوان بالعربية"
                />
              </div>
            </div>

            {/* Author row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-author">Auteur</Label>
                <Input
                  id="create-author"
                  value={createForm.author}
                  onChange={(e) => setCreateForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder="Nom de l'auteur"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-authorAr">Auteur (arabe)</Label>
                <Input
                  id="create-authorAr"
                  dir="rtl"
                  value={createForm.authorAr}
                  onChange={(e) => setCreateForm((f) => ({ ...f, authorAr: e.target.value }))}
                  placeholder="اسم المؤلف"
                />
              </div>
            </div>

            {/* Discipline + Type + Pages */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Discipline</Label>
                <Select
                  value={createForm.discipline}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, discipline: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AQEEDAH">Croyance (Aqeedah)</SelectItem>
                    <SelectItem value="HADITH">Hadiths</SelectItem>
                    <SelectItem value="FIQH">Fiqh</SelectItem>
                    <SelectItem value="TAJWEED">Tajweed</SelectItem>
                    <SelectItem value="GRAMMAR">Grammaire</SelectItem>
                    <SelectItem value="USUL_FIQH">Usul al-Fiqh</SelectItem>
                    <SelectItem value="POETRY">Poésie</SelectItem>
                    <SelectItem value="ADAB">Adab</SelectItem>
                    <SelectItem value="GENERAL">Général</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATN">Matn</SelectItem>
                    <SelectItem value="HADITH_COLLECTION">Collection de hadiths</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-pages">Nombre de pages <span className="text-destructive">*</span></Label>
                <Input
                  id="create-pages"
                  type="number"
                  min="1"
                  value={createForm.totalPages}
                  onChange={(e) => setCreateForm((f) => ({ ...f, totalPages: e.target.value }))}
                  placeholder="ex: 120"
                />
              </div>
            </div>

            {/* Chapters section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Chapitres</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateChapters((cs) => [...cs, { ...EMPTY_CHAPTER }])}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter un chapitre
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sans chapitres, un seul chapitre par défaut sera créé avec toutes les pages.
              </p>

              {createChapters.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3">
                  {createChapters.map((ch, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_80px_80px_32px] gap-2 items-start">
                      <div>
                        {idx === 0 && <Label className="text-xs mb-1 block">Titre</Label>}
                        <Input
                          value={ch.title}
                          onChange={(e) =>
                            setCreateChapters((cs) =>
                              cs.map((c, i) => (i === idx ? { ...c, title: e.target.value } : c))
                            )
                          }
                          placeholder={`Chapitre ${idx + 1}`}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs mb-1 block">Titre arabe</Label>}
                        <Input
                          dir="rtl"
                          value={ch.titleAr}
                          onChange={(e) =>
                            setCreateChapters((cs) =>
                              cs.map((c, i) => (i === idx ? { ...c, titleAr: e.target.value } : c))
                            )
                          }
                          placeholder="عنوان الفصل"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs mb-1 block">Page début</Label>}
                        <Input
                          type="number"
                          min="1"
                          value={ch.pageStart}
                          onChange={(e) =>
                            setCreateChapters((cs) =>
                              cs.map((c, i) => (i === idx ? { ...c, pageStart: e.target.value } : c))
                            )
                          }
                          placeholder="1"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs mb-1 block">Page fin</Label>}
                        <Input
                          type="number"
                          min="1"
                          value={ch.pageEnd}
                          onChange={(e) =>
                            setCreateChapters((cs) =>
                              cs.map((c, i) => (i === idx ? { ...c, pageEnd: e.target.value } : c))
                            )
                          }
                          placeholder="50"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className={idx === 0 ? 'mt-5' : ''}>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setCreateChapters((cs) => cs.filter((_, i) => i !== idx))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Group assignment (for ADMIN and REFERENT) */}
            {(userRole === 'ADMIN' || userRole === 'REFERENT') && userGroups.length > 0 && (
              <div className="space-y-2">
                <Label>Assigner au groupe (optionnel)</Label>
                <Select value={createGroupId || 'none'} onValueChange={v => setCreateGroupId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Personnel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Personnel</SelectItem>
                    {userGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button onClick={createBook} disabled={creating}>
              {creating ? 'Création...' : 'Créer le livre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
