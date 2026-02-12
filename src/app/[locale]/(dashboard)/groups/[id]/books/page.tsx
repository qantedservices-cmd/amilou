'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Library, Plus, BookOpen, Users, Trash2 } from 'lucide-react'

interface GroupBook {
  id: string
  bookId: string
  isRequired: boolean
  book: {
    id: string
    title: string
    titleAr?: string
    author?: string
    type: string
    discipline: string
    totalItems: number
    _count: { chapters: number }
  }
}

interface MemberProgress {
  user: { id: string; name: string; email: string }
  role: string
  totalCompleted: number
  chapterProgress: Record<string, number>
}

interface BookProgressData {
  chapters: Array<{
    id: string
    title: string
    titleAr?: string
    totalItems: number
    depth: number
    parentId?: string
  }>
  members: MemberProgress[]
}

interface CatalogBook {
  id: string
  title: string
  titleAr?: string
  author?: string
  discipline: string
  totalItems: number
}

const DISCIPLINE_COLORS: Record<string, string> = {
  AQEEDAH: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  HADITH: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FIQH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TAJWEED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  GRAMMAR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  USUL_FIQH: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
}

export default function GroupBooksPage() {
  const t = useTranslations('books')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string

  const [groupBooks, setGroupBooks] = useState<GroupBook[]>([])
  const [groupInfo, setGroupInfo] = useState<{ name: string; myRole: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [catalogBooks, setCatalogBooks] = useState<CatalogBook[]>([])
  const [selectedBookForProgress, setSelectedBookForProgress] = useState<string | null>(null)
  const [bookProgress, setBookProgress] = useState<BookProgressData | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)

  useEffect(() => {
    fetchGroupBooks()
    fetchGroupInfo()
  }, [groupId])

  async function fetchGroupInfo() {
    try {
      const res = await fetch(`/api/groups/${groupId}`)
      if (res.ok) {
        const data = await res.json()
        setGroupInfo({ name: data.name, myRole: data.myRole })
      }
    } catch (e) {
      console.error('Error fetching group info:', e)
    }
  }

  async function fetchGroupBooks() {
    try {
      const res = await fetch(`/api/groups/${groupId}/books`)
      if (res.ok) setGroupBooks(await res.json())
    } catch (e) {
      console.error('Error fetching group books:', e)
    } finally {
      setLoading(false)
    }
  }

  async function openAssignDialog() {
    setShowAssignDialog(true)
    try {
      const res = await fetch('/api/books')
      if (res.ok) setCatalogBooks(await res.json())
    } catch (e) {
      console.error('Error fetching catalog:', e)
    }
  }

  async function assignBook(bookId: string) {
    try {
      const res = await fetch(`/api/groups/${groupId}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      })
      if (res.ok) {
        await fetchGroupBooks()
        setShowAssignDialog(false)
      }
    } catch (e) {
      console.error('Error assigning book:', e)
    }
  }

  async function removeBook(bookId: string) {
    if (!confirm(t('confirmRemove'))) return
    try {
      const res = await fetch(`/api/groups/${groupId}/books/${bookId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchGroupBooks()
        if (selectedBookForProgress === bookId) {
          setSelectedBookForProgress(null)
          setBookProgress(null)
        }
      }
    } catch (e) {
      console.error('Error removing book:', e)
    }
  }

  async function viewBookProgress(bookId: string) {
    setSelectedBookForProgress(bookId)
    setLoadingProgress(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/books/${bookId}`)
      if (res.ok) setBookProgress(await res.json())
    } catch (e) {
      console.error('Error fetching book progress:', e)
    } finally {
      setLoadingProgress(false)
    }
  }

  const isReferentOrAdmin = groupInfo?.myRole === 'REFERENT' || groupInfo?.myRole === 'ADMIN'
  const assignedBookIds = new Set(groupBooks.map((gb) => gb.bookId))

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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/groups/${groupId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {t('groupBooks')} - {groupInfo?.name || '...'}
          </h1>
        </div>
        {isReferentOrAdmin && (
          <Button onClick={openAssignDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('assignBook')}
          </Button>
        )}
      </div>

      {/* Group Books */}
      {groupBooks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t('noBooks')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groupBooks.map((gb) => (
            <Card
              key={gb.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                selectedBookForProgress === gb.bookId ? 'ring-2 ring-emerald-500' : ''
              }`}
              onClick={() => viewBookProgress(gb.bookId)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{gb.book.title}</h3>
                    {gb.book.titleAr && (
                      <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                        {gb.book.titleAr}
                      </p>
                    )}
                    {gb.book.author && (
                      <p className="text-xs text-muted-foreground mt-1">{gb.book.author}</p>
                    )}
                  </div>
                  {isReferentOrAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeBook(gb.bookId)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className={`text-[10px] ${DISCIPLINE_COLORS[gb.book.discipline] || ''}`}>
                    {t(`disciplines.${gb.book.discipline}`)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {gb.book.totalItems} {t('items')}
                  </Badge>
                  {gb.isRequired && (
                    <Badge variant="destructive" className="text-[10px]">
                      Obligatoire
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Member Progress Matrix */}
      {selectedBookForProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('memberProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProgress ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
              </div>
            ) : bookProgress ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Membre</th>
                      <th className="text-center p-2 font-medium">Total</th>
                      {bookProgress.chapters
                        .filter((c) => !c.parentId)
                        .map((ch) => (
                          <th key={ch.id} className="text-center p-2 font-medium text-xs max-w-[80px] truncate">
                            {ch.title.length > 15 ? ch.title.slice(0, 15) + '...' : ch.title}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookProgress.members.map((member) => {
                      const selectedBook = groupBooks.find((gb) => gb.bookId === selectedBookForProgress)
                      const totalItems = selectedBook?.book.totalItems || 0
                      const memberPct = totalItems > 0 ? Math.round((member.totalCompleted / totalItems) * 100) : 0

                      return (
                        <tr key={member.user.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div className="font-medium text-xs">{member.user.name || member.user.email}</div>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant={memberPct >= 100 ? 'default' : 'secondary'} className="text-[10px]">
                              {memberPct}%
                            </Badge>
                          </td>
                          {bookProgress.chapters
                            .filter((c) => !c.parentId)
                            .map((ch) => {
                              const completed = member.chapterProgress[ch.id] || 0
                              const total = ch.totalItems
                              const chapPct = total > 0 ? Math.round((completed / total) * 100) : 0
                              return (
                                <td key={ch.id} className="p-2 text-center">
                                  {total > 0 ? (
                                    <span className={`text-xs ${chapPct >= 100 ? 'text-emerald-600 font-medium' : ''}`}>
                                      {completed}/{total}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </td>
                              )
                            })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Assign Book Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('assignBook')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {catalogBooks
              .filter((b) => !assignedBookIds.has(b.id))
              .map((book) => (
                <div
                  key={book.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => assignBook(book.id)}
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
            {catalogBooks.filter((b) => !assignedBookIds.has(b.id)).length === 0 && (
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
