'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ArrowLeft, BookOpen, Check, ChevronDown, List, FolderTree } from 'lucide-react'
import { SegmentedProgressBar, SegmentData } from '@/components/segmented-progress-bar'

interface BookItem {
  id: string
  itemNumber: number
  title?: string
  textAr?: string
  textFr?: string
  textEn?: string
  reference?: string
  userProgress: {
    completed: boolean
    completedAt?: string
    notes?: string
    rating?: number
  } | null
}

interface Chapter {
  id: string
  title: string
  titleAr?: string
  chapterNumber: number
  depth: number
  totalItems: number
  _count: { items: number }
  children?: Chapter[]
}

interface BookDetail {
  id: string
  title: string
  titleAr?: string
  titleEn?: string
  author?: string
  authorAr?: string
  type: string
  discipline: string
  collectionLevel?: number
  totalItems: number
  chapters: Chapter[]
  userProgress: {
    completed: number
    total: number
    percentage: number
  }
}

const DISCIPLINE_COLORS: Record<string, string> = {
  AQEEDAH: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  HADITH: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FIQH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TAJWEED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  GRAMMAR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  USUL_FIQH: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
}

export default function BookDetailPage() {
  const t = useTranslations('books')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string

  const [book, setBook] = useState<BookDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [chapterItems, setChapterItems] = useState<Record<string, BookItem[]>>({})
  const [loadingChapters, setLoadingChapters] = useState<Set<string>>(new Set())
  const [chapterProgress, setChapterProgress] = useState<Record<string, number>>({})
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [openChapters, setOpenChapters] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'accordion' | 'list'>('accordion')

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}`)
      if (res.ok) {
        const data = await res.json()
        setBook(data)
      }
    } catch (e) {
      console.error('Error fetching book:', e)
    } finally {
      setLoading(false)
    }
  }, [bookId])

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/progress`)
      if (res.ok) {
        const data = await res.json()
        setChapterProgress(data.chapterProgress || {})
      }
    } catch (e) {
      console.error('Error fetching progress:', e)
    }
  }, [bookId])

  useEffect(() => {
    fetchBook()
    fetchProgress()
  }, [fetchBook, fetchProgress])

  async function loadChapterItems(chapterId: string) {
    if (chapterItems[chapterId]) return
    setLoadingChapters((prev) => new Set(prev).add(chapterId))
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/items`)
      if (res.ok) {
        const items = await res.json()
        setChapterItems((prev) => ({ ...prev, [chapterId]: items }))
      }
    } catch (e) {
      console.error('Error fetching items:', e)
    } finally {
      setLoadingChapters((prev) => {
        const next = new Set(prev)
        next.delete(chapterId)
        return next
      })
    }
  }

  // Load all chapters for list view
  async function loadAllChapterItems() {
    if (!book) return
    const allChapters = getAllChapters(book.chapters)
    const toLoad = allChapters.filter(ch => !chapterItems[ch.id])
    if (toLoad.length === 0) return
    for (const ch of toLoad) {
      setLoadingChapters((prev) => new Set(prev).add(ch.id))
    }
    try {
      await Promise.all(toLoad.map(async (ch) => {
        const res = await fetch(`/api/books/${bookId}/chapters/${ch.id}/items`)
        if (res.ok) {
          const items = await res.json()
          setChapterItems((prev) => ({ ...prev, [ch.id]: items }))
        }
      }))
    } catch (e) {
      console.error('Error loading all items:', e)
    } finally {
      setLoadingChapters(new Set())
    }
  }

  async function toggleItem(itemId: string, completed: boolean) {
    setToggling((prev) => new Set(prev).add(itemId))
    try {
      await fetch(`/api/books/${bookId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: [itemId], completed }),
      })
      // Update local item state
      setChapterItems((prev) => {
        const updated = { ...prev }
        for (const [chapId, items] of Object.entries(updated)) {
          updated[chapId] = items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  userProgress: {
                    completed,
                    completedAt: completed ? new Date().toISOString() : undefined,
                    notes: item.userProgress?.notes,
                    rating: item.userProgress?.rating,
                  },
                }
              : item
          )
        }
        return updated
      })
      // Update book progress locally (avoid full re-fetch which causes accordion to close)
      setBook(prev => {
        if (!prev) return prev
        const newCompleted = completed
          ? prev.userProgress.completed + 1
          : prev.userProgress.completed - 1
        return {
          ...prev,
          userProgress: {
            ...prev.userProgress,
            completed: newCompleted,
            percentage: prev.userProgress.total > 0
              ? Math.round((newCompleted / prev.userProgress.total) * 100)
              : 0
          }
        }
      })
      await fetchProgress()
    } catch (e) {
      console.error('Error toggling item:', e)
    } finally {
      setToggling((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  async function toggleChapter(chapterId: string, completed: boolean) {
    const items = chapterItems[chapterId]
    if (!items) return
    const itemIds = items.map((item) => item.id)
    const changedCount = items.filter(item => (item.userProgress?.completed || false) !== completed).length
    try {
      await fetch(`/api/books/${bookId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, completed }),
      })
      // Update local state
      setChapterItems((prev) => ({
        ...prev,
        [chapterId]: prev[chapterId].map((item) => ({
          ...item,
          userProgress: {
            completed,
            completedAt: completed ? new Date().toISOString() : undefined,
            notes: item.userProgress?.notes,
            rating: item.userProgress?.rating,
          },
        })),
      }))
      // Update book progress locally
      setBook(prev => {
        if (!prev) return prev
        const newCompleted = completed
          ? prev.userProgress.completed + changedCount
          : prev.userProgress.completed - changedCount
        return {
          ...prev,
          userProgress: {
            ...prev.userProgress,
            completed: Math.max(0, newCompleted),
            percentage: prev.userProgress.total > 0
              ? Math.round((Math.max(0, newCompleted) / prev.userProgress.total) * 100)
              : 0
          }
        }
      })
      await fetchProgress()
    } catch (e) {
      console.error('Error toggling chapter:', e)
    }
  }

  // Helper: flatten all chapters (including children) for counting
  function getAllChapters(chapters: Chapter[]): Chapter[] {
    const result: Chapter[] = []
    for (const ch of chapters) {
      result.push(ch)
      if (ch.children) {
        result.push(...getAllChapters(ch.children))
      }
    }
    return result
  }

  // Compute counts
  const counts = useMemo(() => {
    if (!book) return { kitab: 0, bab: 0, hadiths: 0, read: 0 }
    const topLevel = book.chapters.length
    let subChapters = 0
    for (const ch of book.chapters) {
      subChapters += ch.children?.length || 0
    }
    return {
      kitab: topLevel,
      bab: subChapters,
      hadiths: book.userProgress.total,
      read: book.userProgress.completed
    }
  }, [book])

  // Transform chapters into SegmentData[] for the progress bar
  const bookSegments: SegmentData[] = useMemo(() => {
    if (!book?.chapters) return []
    return book.chapters.map(ch => {
      const completed = chapterProgress[ch.id] || 0
      const total = ch.totalItems || ch._count?.items || 0
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
      return {
        id: ch.id,
        label: `${ch.chapterNumber}. ${ch.title}`,
        labelAr: ch.titleAr,
        status: percentage >= 100
          ? 'completed' as const
          : percentage > 0
            ? 'in_progress' as const
            : 'not_started' as const,
        percentage,
        totalItems: total,
        completedItems: completed,
      }
    })
  }, [book?.chapters, chapterProgress])

  const fetchChapterHistory = useCallback(async (segmentId: string) => {
    const res = await fetch(`/api/books/${bookId}/chapters/${segmentId}/history`)
    if (!res.ok) return []
    const data = await res.json()
    return data.entries
  }, [bookId])

  // Collect all items across loaded chapters for list view
  const allItemsList = useMemo(() => {
    if (!book) return []
    const result: Array<{ chapterTitle: string; chapterTitleAr?: string; item: BookItem }> = []
    function collectItems(chapters: Chapter[]) {
      for (const ch of chapters) {
        const items = chapterItems[ch.id]
        if (items) {
          for (const item of items) {
            result.push({
              chapterTitle: ch.title,
              chapterTitleAr: ch.titleAr,
              item,
            })
          }
        }
        if (ch.children) {
          collectItems(ch.children)
        }
      }
    }
    collectItems(book.chapters)
    return result
  }, [book, chapterItems])

  if (loading || !book) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const pct = book.userProgress.percentage

  function renderChapterSection(chapter: Chapter, depth: number = 0) {
    const items = chapterItems[chapter.id]
    const completedInChapter = chapterProgress[chapter.id] || 0
    const totalInChapter = chapter.totalItems || chapter._count?.items || 0
    const chapterPct = totalInChapter > 0 ? Math.round((completedInChapter / totalInChapter) * 100) : 0
    const isComplete = totalInChapter > 0 && completedInChapter >= totalInChapter

    return (
      <AccordionItem key={chapter.id} value={chapter.id} className={depth > 0 ? 'border-l-2 border-muted ml-4' : ''}>
        <AccordionTrigger
          className="text-sm hover:no-underline"
          onClick={() => loadChapterItems(chapter.id)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isComplete && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
            <span className="truncate text-left">
              {chapter.chapterNumber}. {chapter.title}
            </span>
            {chapter.titleAr && (
              <span className="text-xs text-muted-foreground truncate" dir="rtl">
                {chapter.titleAr}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {totalInChapter > 0 && (
              <Badge variant={isComplete ? 'default' : 'secondary'} className="text-[10px]">
                {completedInChapter}/{totalInChapter}
              </Badge>
            )}
            {chapterPct > 0 && chapterPct < 100 && (
              <span className="text-[10px] text-muted-foreground">{chapterPct}%</span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {loadingChapters.has(chapter.id) && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          )}

          {items && items.length > 0 && (
            <div className="space-y-1">
              {/* Batch actions */}
              <div className="flex gap-2 mb-2 px-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => toggleChapter(chapter.id, true)}
                >
                  {t('markAll')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => toggleChapter(chapter.id, false)}
                >
                  {t('unmarkAll')}
                </Button>
              </div>

              {items.map((item) => renderItemRow(item))}
            </div>
          )}

          {items && items.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-2">
              Aucun élément dans ce chapitre
            </p>
          )}

          {/* Nested chapters */}
          {chapter.children && chapter.children.length > 0 && (
            <Accordion type="multiple" value={openChapters} onValueChange={setOpenChapters}>
              {chapter.children.map((child) => renderChapterSection(child, depth + 1))}
            </Accordion>
          )}
        </AccordionContent>
      </AccordionItem>
    )
  }

  function renderItemRow(item: BookItem) {
    const isCompleted = item.userProgress?.completed || false
    const hasText = item.textAr || item.textFr

    return (
      <div key={item.id}>
        {hasText ? (
          <Collapsible>
            <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
              <Checkbox
                checked={isCompleted}
                disabled={toggling.has(item.id)}
                onCheckedChange={(checked) =>
                  toggleItem(item.id, checked as boolean)
                }
                className="mt-0.5"
              />
              <CollapsibleTrigger className="flex-1 text-left">
                <div className="flex items-center gap-1">
                  <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                    {item.itemNumber}. {item.title || `#${item.itemNumber}`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="ml-8 px-2 pb-2">
              {item.textAr && (
                <p className="text-sm leading-relaxed text-right mb-2" dir="rtl">
                  {item.textAr}
                </p>
              )}
              {item.textFr && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.textFr}
                </p>
              )}
              {item.textEn && !item.textFr && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.textEn}
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
            <Checkbox
              checked={isCompleted}
              disabled={toggling.has(item.id)}
              onCheckedChange={(checked) =>
                toggleItem(item.id, checked as boolean)
              }
              className="mt-0.5"
            />
            <span className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
              {item.itemNumber}. {item.title || `#${item.itemNumber}`}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/books`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{book.title}</h1>
          {book.titleAr && (
            <p className="text-sm text-muted-foreground" dir="rtl">{book.titleAr}</p>
          )}
          {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge className={DISCIPLINE_COLORS[book.discipline] || ''}>
          {t(`disciplines.${book.discipline}`)}
        </Badge>
        <Badge variant="outline">
          {t(`types.${book.type}`)}
        </Badge>
        {book.collectionLevel != null && (
          <Badge variant="secondary">
            {t('level')} {book.collectionLevel}
          </Badge>
        )}
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-muted"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${pct}, 100`}
                  className="text-emerald-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold">{pct}%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                <span className="text-emerald-600 font-bold">{counts.read}</span>
                <span className="text-muted-foreground">/{counts.hadiths} {book.type === 'HADITH_COLLECTION' ? 'hadiths' : 'items'} lus</span>
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {counts.kitab > 0 && (
                  <span>{counts.kitab} kitab</span>
                )}
                {counts.bab > 0 && (
                  <span>{counts.bab} bab</span>
                )}
              </div>
            </div>
          </div>
          {bookSegments.length > 0 && (
            <div className="mt-3">
              <SegmentedProgressBar
                segments={bookSegments}
                mode="full"
                colorScheme="book"
                fetchHistory={fetchChapterHistory}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={viewMode === 'accordion' ? 'default' : 'outline'}
          className="text-xs h-8"
          onClick={() => setViewMode('accordion')}
        >
          <FolderTree className="h-3.5 w-3.5 mr-1" />
          Chapitres
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'list' ? 'default' : 'outline'}
          className="text-xs h-8"
          onClick={() => {
            setViewMode('list')
            loadAllChapterItems()
          }}
        >
          <List className="h-3.5 w-3.5 mr-1" />
          Liste
        </Button>
      </div>

      {/* Accordion view */}
      {viewMode === 'accordion' && (
        <Accordion type="multiple" value={openChapters} onValueChange={setOpenChapters}>
          {book.chapters.map((chapter) => renderChapterSection(chapter))}
        </Accordion>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-4">
            {loadingChapters.size > 0 && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full mr-2" />
                <span className="text-sm text-muted-foreground">Chargement...</span>
              </div>
            )}
            {allItemsList.length > 0 && (
              <div className="space-y-0.5">
                {(() => {
                  let currentChapter = ''
                  return allItemsList.map(({ chapterTitle, chapterTitleAr, item }) => {
                    const showHeader = chapterTitle !== currentChapter
                    currentChapter = chapterTitle
                    return (
                      <div key={item.id}>
                        {showHeader && (
                          <div className="flex items-center gap-2 pt-3 pb-1 first:pt-0 border-b border-muted mb-1">
                            <span className="text-xs font-semibold text-muted-foreground">{chapterTitle}</span>
                            {chapterTitleAr && (
                              <span className="text-xs text-muted-foreground" dir="rtl">{chapterTitleAr}</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-start gap-2 px-2 py-1 rounded hover:bg-muted/50">
                          <Checkbox
                            checked={item.userProgress?.completed || false}
                            disabled={toggling.has(item.id)}
                            onCheckedChange={(checked) =>
                              toggleItem(item.id, checked as boolean)
                            }
                            className="mt-0.5"
                          />
                          <span className={`text-sm ${item.userProgress?.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.itemNumber}. {item.title || `#${item.itemNumber}`}
                          </span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
            {allItemsList.length === 0 && loadingChapters.size === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun élément chargé
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
