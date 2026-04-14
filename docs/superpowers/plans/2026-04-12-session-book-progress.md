# Session Book Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Annexe 3 with dynamic book progress tracking per session — referents can record which chapters/pages were covered, and the PDF generates automatically.

**Architecture:** New `SessionBookProgress` Prisma model links sessions to books. New CRUD API at `/api/sessions/[id]/book-progress`. Session page gets a "Avancement Livres" section. PDF Annexe 3 queries `SessionBookProgress` instead of hardcoded data. Chapter post-creation via existing `/api/books/[id]/chapters` enhanced with page-item auto-creation.

**Tech Stack:** Prisma, Next.js API Routes, React (client components), shadcn/ui, jsPDF + jspdf-autotable

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add SessionBookProgress model + relations |
| `src/app/api/sessions/[id]/book-progress/route.ts` | Create | CRUD for session book progress entries |
| `src/app/api/books/[id]/chapters/route.ts` | Modify | Enhance POST to auto-create page items |
| `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx` | Modify | Add "Avancement Livres" section |
| `src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx` | Modify | Replace hardcoded Annexe 3 with dynamic data |
| `src/app/[locale]/(dashboard)/books/[id]/page.tsx` | Modify | Add "Ajouter un chapitre" button for referent/admin |

---

### Task 1: Prisma Schema — Add SessionBookProgress

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add SessionBookProgress model**

Add after the `ResearchTopic` model block:

```prisma
model SessionBookProgress {
  id         String       @id @default(cuid())
  sessionId  String
  bookId     String
  chapterId  String?
  pageStart  Int?
  pageEnd    Int?
  isRead     Boolean      @default(false)
  isQaDone   Boolean      @default(false)
  comment    String?
  createdBy  String
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  session GroupSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  book    Book           @relation(fields: [bookId], references: [id])
  chapter BookChapter?   @relation(fields: [chapterId], references: [id])

  @@index([sessionId])
  @@index([bookId])
}
```

- [ ] **Step 2: Add relations on GroupSession, Book, BookChapter**

In `GroupSession` model, add after `researchTopics`:
```prisma
  bookProgress   SessionBookProgress[]
```

In `Book` model, add after `userBooks`:
```prisma
  sessionProgress SessionBookProgress[]
```

In `BookChapter` model, add after `items`:
```prisma
  sessionProgress SessionBookProgress[]
```

- [ ] **Step 3: Push schema**

Run: `npx prisma db push`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add SessionBookProgress model for tracking books in sessions"
```

---

### Task 2: Session Book Progress API

**Files:**
- Create: `src/app/api/sessions/[id]/book-progress/route.ts`

- [ ] **Step 1: Create the CRUD API**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

async function checkReferentOrAdmin(userId: string, sessionId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') return true

  const session = await prisma.groupSession.findUnique({
    where: { id: sessionId },
    select: { groupId: true }
  })
  if (!session) return false

  const membership = await prisma.groupMember.findFirst({
    where: { groupId: session.groupId, userId, role: 'REFERENT' }
  })
  return !!membership
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params

    const entries = await prisma.sessionBookProgress.findMany({
      where: { sessionId },
      include: {
        book: { select: { id: true, title: true, titleAr: true } },
        chapter: {
          select: {
            id: true, title: true, titleAr: true, chapterNumber: true, depth: true,
            parent: { select: { id: true, title: true, titleAr: true, chapterNumber: true } }
          }
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, sessionId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { bookId, chapterId, pageStart, pageEnd, isRead, isQaDone, comment } = await request.json()

    if (!bookId) return NextResponse.json({ error: 'Livre requis' }, { status: 400 })

    const entry = await prisma.sessionBookProgress.create({
      data: {
        sessionId,
        bookId,
        chapterId: chapterId || null,
        pageStart: pageStart || null,
        pageEnd: pageEnd || null,
        isRead: isRead || false,
        isQaDone: isQaDone || false,
        comment: comment || null,
        createdBy: session.user.id,
      },
      include: {
        book: { select: { id: true, title: true, titleAr: true } },
        chapter: {
          select: {
            id: true, title: true, titleAr: true, chapterNumber: true, depth: true,
            parent: { select: { id: true, title: true, titleAr: true, chapterNumber: true } }
          }
        },
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Error creating book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, sessionId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { entryId, chapterId, pageStart, pageEnd, isRead, isQaDone, comment } = await request.json()

    if (!entryId) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

    const entry = await prisma.sessionBookProgress.update({
      where: { id: entryId },
      data: {
        chapterId: chapterId !== undefined ? (chapterId || null) : undefined,
        pageStart: pageStart !== undefined ? pageStart : undefined,
        pageEnd: pageEnd !== undefined ? pageEnd : undefined,
        isRead: isRead !== undefined ? isRead : undefined,
        isQaDone: isQaDone !== undefined ? isQaDone : undefined,
        comment: comment !== undefined ? (comment || null) : undefined,
      },
      include: {
        book: { select: { id: true, title: true, titleAr: true } },
        chapter: {
          select: {
            id: true, title: true, titleAr: true, chapterNumber: true, depth: true,
            parent: { select: { id: true, title: true, titleAr: true, chapterNumber: true } }
          }
        },
      },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error updating book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: sessionId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, sessionId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('entryId')
    if (!entryId) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

    await prisma.sessionBookProgress.delete({ where: { id: entryId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting book progress:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/sessions/[id]/book-progress/route.ts
git commit -m "feat: CRUD API for session book progress"
```

---

### Task 3: Enhance Chapter Creation with Auto-Create Page Items

**Files:**
- Modify: `src/app/api/books/[id]/chapters/route.ts`

- [ ] **Step 1: Add page-item auto-creation to POST**

Replace the existing POST function body (lines 41-76) with an enhanced version that accepts `pageStart`/`pageEnd` and auto-creates BookItem entries:

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const pageStart = body.pageStart ? parseInt(body.pageStart) : null
    const pageEnd = body.pageEnd ? parseInt(body.pageEnd) : null
    const pageCount = (pageStart && pageEnd && pageEnd >= pageStart) ? (pageEnd - pageStart + 1) : 0

    const chapter = await prisma.bookChapter.create({
      data: {
        bookId: id,
        parentId: body.parentId || null,
        title: body.title,
        titleAr: body.titleAr || null,
        titleEn: body.titleEn || null,
        chapterNumber: body.chapterNumber || 0,
        depth: body.depth || (body.parentId ? 1 : 0),
        totalItems: pageCount,
        sortOrder: body.sortOrder || 0,
      },
    })

    // Auto-create page items if page range specified
    if (pageStart && pageEnd && pageEnd >= pageStart) {
      const items = []
      for (let p = pageStart; p <= pageEnd; p++) {
        items.push({
          chapterId: chapter.id,
          itemNumber: p,
          title: `Page ${p}`,
        })
      }
      await prisma.bookItem.createMany({ data: items })

      // Update book totalItems
      const totalItems = await prisma.bookItem.count({
        where: { chapter: { bookId: id } }
      })
      await prisma.book.update({
        where: { id },
        data: { totalItems }
      })
    }

    return NextResponse.json(chapter, { status: 201 })
  } catch (error) {
    console.error('Error creating chapter:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du chapitre' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/books/[id]/chapters/route.ts
git commit -m "feat: auto-create page items when adding chapter with page range"
```

---

### Task 4: Add Chapter Button on Book Detail Page

**Files:**
- Modify: `src/app/[locale]/(dashboard)/books/[id]/page.tsx`

- [ ] **Step 1: Add state and dialog for adding chapters**

Add new state variables after the existing state declarations (around line 95):

```typescript
  // Add chapter dialog
  const [addChapterOpen, setAddChapterOpen] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [newChapterTitleAr, setNewChapterTitleAr] = useState('')
  const [newChapterParentId, setNewChapterParentId] = useState('')
  const [newChapterPageStart, setNewChapterPageStart] = useState('')
  const [newChapterPageEnd, setNewChapterPageEnd] = useState('')
  const [addingChapter, setAddingChapter] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
```

Fetch user role in the existing useEffect or add a new one:

```typescript
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.role === 'ADMIN' || d.role === 'REFERENT') setIsAdmin(true)
    }).catch(() => {})
  }, [])
```

Add the chapter creation function:

```typescript
  async function handleAddChapter() {
    if (!newChapterTitle) return
    setAddingChapter(true)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newChapterTitle,
          titleAr: newChapterTitleAr || null,
          parentId: newChapterParentId || null,
          pageStart: newChapterPageStart || null,
          pageEnd: newChapterPageEnd || null,
          depth: newChapterParentId ? 1 : 0,
        }),
      })
      if (res.ok) {
        setAddChapterOpen(false)
        setNewChapterTitle('')
        setNewChapterTitleAr('')
        setNewChapterParentId('')
        setNewChapterPageStart('')
        setNewChapterPageEnd('')
        fetchBook()
        fetchProgress()
      }
    } catch (e) { console.error(e) }
    setAddingChapter(false)
  }
```

- [ ] **Step 2: Add button and dialog in the JSX**

Find the header area of the book detail page (where the title and back button are). Add a button next to the view mode toggles:

```tsx
{isAdmin && (
  <Button variant="outline" size="sm" onClick={() => setAddChapterOpen(true)}>
    <Plus className="h-4 w-4 mr-1" />Ajouter chapitre
  </Button>
)}
```

Add the dialog before the closing `</div>` of the page:

```tsx
      <Dialog open={addChapterOpen} onOpenChange={setAddChapterOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ajouter un chapitre</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} placeholder="Titre du chapitre" />
            </div>
            <div className="space-y-2">
              <Label>Titre arabe (optionnel)</Label>
              <Input value={newChapterTitleAr} onChange={e => setNewChapterTitleAr(e.target.value)} placeholder="العنوان" className="font-arabic text-right" />
            </div>
            <div className="space-y-2">
              <Label>Chapitre parent (optionnel)</Label>
              <Select value={newChapterParentId || 'none'} onValueChange={v => setNewChapterParentId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Racine" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Racine (chapitre principal)</SelectItem>
                  {book?.chapters.map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Page debut</Label>
                <Input type="number" min="1" value={newChapterPageStart} onChange={e => setNewChapterPageStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Page fin</Label>
                <Input type="number" min="1" value={newChapterPageEnd} onChange={e => setNewChapterPageEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddChapterOpen(false)}>Annuler</Button>
            <Button onClick={handleAddChapter} disabled={addingChapter || !newChapterTitle}>
              {addingChapter ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

Note: Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Label, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Plus are already imported in this file from earlier changes.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/books/[id]/page.tsx"
git commit -m "feat: bouton ajout chapitre post-création pour référent/admin"
```

---

### Task 5: Session Page — Avancement Livres Section

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx`

This is the largest task. The session page needs a new section "Avancement Livres" where the referent can add/edit/delete book progress entries.

- [ ] **Step 1: Add interfaces and state**

Add new interfaces after the existing ones (~line 58):

```typescript
interface BookProgressEntry {
  id: string
  bookId: string
  chapterId: string | null
  pageStart: number | null
  pageEnd: number | null
  isRead: boolean
  isQaDone: boolean
  comment: string | null
  book: { id: string; title: string; titleAr: string | null }
  chapter: {
    id: string; title: string; titleAr: string | null; chapterNumber: number; depth: number
    parent: { id: string; title: string; titleAr: string | null; chapterNumber: number } | null
  } | null
}

interface GroupBook {
  id: string
  bookId: string
  book: { id: string; title: string; titleAr: string | null; chapters: BookChapterOption[] }
}

interface BookChapterOption {
  id: string
  title: string
  titleAr: string | null
  chapterNumber: number
  depth: number
  children?: BookChapterOption[]
}
```

Add new state after existing state (~line 139):

```typescript
  // Book progress
  const [bookProgressEntries, setBookProgressEntries] = useState<BookProgressEntry[]>([])
  const [groupBooks, setGroupBooks] = useState<GroupBook[]>([])
  const [bpBookId, setBpBookId] = useState('')
  const [bpChapterId, setBpChapterId] = useState('')
  const [bpPageStart, setBpPageStart] = useState('')
  const [bpPageEnd, setBpPageEnd] = useState('')
  const [bpIsRead, setBpIsRead] = useState(false)
  const [bpIsQaDone, setBpIsQaDone] = useState(false)
  const [bpComment, setBpComment] = useState('')
  const [bpSaving, setBpSaving] = useState(false)
  const [bpEditingId, setBpEditingId] = useState<string | null>(null)
```

- [ ] **Step 2: Add fetch functions**

Add after existing fetch functions:

```typescript
  async function fetchBookProgress(sessionId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/book-progress`)
      if (res.ok) setBookProgressEntries(await res.json())
    } catch (e) { console.error(e) }
  }

  async function fetchGroupBooks() {
    try {
      const res = await fetch(`/api/groups/${groupId}/books`)
      if (res.ok) {
        const data = await res.json()
        // For each book, fetch its chapters
        const enriched = await Promise.all(data.map(async (gb: any) => {
          const chapRes = await fetch(`/api/books/${gb.book.id}/chapters`)
          const chapters = chapRes.ok ? await chapRes.json() : []
          return { ...gb, book: { ...gb.book, chapters } }
        }))
        setGroupBooks(enriched)
      }
    } catch (e) { console.error(e) }
  }
```

Call these in the existing data loading useEffect (find where the session data is loaded and add):
```typescript
fetchGroupBooks()
// And when session ID is known:
fetchBookProgress(sessionId)
```

- [ ] **Step 3: Add CRUD handlers**

```typescript
  async function handleAddBookProgress() {
    if (!bpBookId || bpSaving) return
    setBpSaving(true)
    try {
      const sessionData = sessions.find(s => s.number === sessionNum)
      // Find session ID from the loaded data
      const url = bpEditingId
        ? `/api/sessions/${currentSessionId}/book-progress`
        : `/api/sessions/${currentSessionId}/book-progress`
      const method = bpEditingId ? 'PUT' : 'POST'
      const body = bpEditingId
        ? { entryId: bpEditingId, bookId: bpBookId, chapterId: bpChapterId || null, pageStart: bpPageStart ? parseInt(bpPageStart) : null, pageEnd: bpPageEnd ? parseInt(bpPageEnd) : null, isRead: bpIsRead, isQaDone: bpIsQaDone, comment: bpComment || null }
        : { bookId: bpBookId, chapterId: bpChapterId || null, pageStart: bpPageStart ? parseInt(bpPageStart) : null, pageEnd: bpPageEnd ? parseInt(bpPageEnd) : null, isRead: bpIsRead, isQaDone: bpIsQaDone, comment: bpComment || null }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        resetBookProgressForm()
        fetchBookProgress(currentSessionId)
      }
    } catch (e) { console.error(e) }
    setBpSaving(false)
  }

  async function handleDeleteBookProgress(entryId: string) {
    if (!confirm('Supprimer cette entrée ?')) return
    try {
      await fetch(`/api/sessions/${currentSessionId}/book-progress?entryId=${entryId}`, { method: 'DELETE' })
      fetchBookProgress(currentSessionId)
    } catch (e) { console.error(e) }
  }

  function startEditBookProgress(entry: BookProgressEntry) {
    setBpEditingId(entry.id)
    setBpBookId(entry.bookId)
    setBpChapterId(entry.chapterId || '')
    setBpPageStart(entry.pageStart?.toString() || '')
    setBpPageEnd(entry.pageEnd?.toString() || '')
    setBpIsRead(entry.isRead)
    setBpIsQaDone(entry.isQaDone)
    setBpComment(entry.comment || '')
  }

  function resetBookProgressForm() {
    setBpEditingId(null)
    setBpBookId('')
    setBpChapterId('')
    setBpPageStart('')
    setBpPageEnd('')
    setBpIsRead(false)
    setBpIsQaDone(false)
    setBpComment('')
  }
```

Note: `currentSessionId` needs to be derived from the loaded session data. The session page loads sessions by group and session number. Find where the session ID is stored in state and use it. Look for a pattern like `session.id` or fetch it from the sessions list.

- [ ] **Step 4: Add JSX section**

Find the section after "Récitations" in the JSX (search for the research topics or comments section). Add before it:

```tsx
      {/* Avancement Livres */}
      {groupBooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Avancement Livres
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing entries */}
            {bookProgressEntries.map(entry => (
              <div key={entry.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <div className="font-medium text-sm">{entry.book.title}</div>
                  {entry.chapter && (
                    <div className="text-xs text-muted-foreground">
                      {entry.chapter.parent && `Ch.${entry.chapter.parent.chapterNumber} ${entry.chapter.parent.title} — `}
                      {entry.chapter.depth === 0 ? `Ch.${entry.chapter.chapterNumber}` : `Cours ${entry.chapter.chapterNumber}`} {entry.chapter.title}
                    </div>
                  )}
                  {(entry.pageStart || entry.pageEnd) && (
                    <div className="text-xs text-muted-foreground">Pages {entry.pageStart}–{entry.pageEnd}</div>
                  )}
                  <div className="flex gap-2 mt-1">
                    {entry.isRead && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Lu</Badge>}
                    {entry.isQaDone && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Q/R</Badge>}
                  </div>
                  {entry.comment && <p className="text-xs text-muted-foreground mt-1 italic">{entry.comment}</p>}
                </div>
                {isReferent && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEditBookProgress(entry)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteBookProgress(entry.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
            ))}

            {/* Add/Edit form (referent only) */}
            {isReferent && (
              <div className="space-y-3 p-3 rounded-lg border border-dashed">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Livre</Label>
                    <Select value={bpBookId} onValueChange={v => { setBpBookId(v); setBpChapterId('') }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {groupBooks.map(gb => (
                          <SelectItem key={gb.book.id} value={gb.book.id}>{gb.book.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chapitre / Cours</Label>
                    <Select value={bpChapterId || 'none'} onValueChange={v => setBpChapterId(v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {groupBooks.find(gb => gb.book.id === bpBookId)?.book.chapters?.map((ch: BookChapterOption) => (
                          <React.Fragment key={ch.id}>
                            <SelectItem value={ch.id}>Ch.{ch.chapterNumber} {ch.title}</SelectItem>
                            {ch.children?.map((sub: BookChapterOption) => (
                              <SelectItem key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.title}</SelectItem>
                            ))}
                          </React.Fragment>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Page début</Label>
                    <Input type="number" min="1" className="h-8 text-xs" value={bpPageStart} onChange={e => setBpPageStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Page fin</Label>
                    <Input type="number" min="1" className="h-8 text-xs" value={bpPageEnd} onChange={e => setBpPageEnd(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 pt-5 cursor-pointer">
                    <input type="checkbox" checked={bpIsRead} onChange={e => setBpIsRead(e.target.checked)} className="rounded" />
                    <span className="text-xs">Lu</span>
                  </label>
                  <label className="flex items-center gap-2 pt-5 cursor-pointer">
                    <input type="checkbox" checked={bpIsQaDone} onChange={e => setBpIsQaDone(e.target.checked)} className="rounded" />
                    <span className="text-xs">Q/R</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Commentaire</Label>
                  <Input className="h-8 text-xs" value={bpComment} onChange={e => setBpComment(e.target.value)} placeholder="Optionnel" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddBookProgress} disabled={bpSaving || !bpBookId}>
                    {bpSaving ? 'Enregistrement...' : bpEditingId ? 'Modifier' : 'Ajouter'}
                  </Button>
                  {bpEditingId && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetBookProgressForm}>Annuler</Button>
                  )}
                </div>
              </div>
            )}

            {bookProgressEntries.length === 0 && !isReferent && (
              <p className="text-sm text-muted-foreground text-center py-2">Aucun avancement livre pour cette séance</p>
            )}
          </CardContent>
        </Card>
      )}
```

Make sure `React` is imported (for `React.Fragment`). Also ensure `FileText` icon is imported from lucide-react.

- [ ] **Step 5: Wire up session ID and data loading**

Find the main data fetching in the component. The session page loads data via an API. Find where the session object is resolved (it likely comes from a fetch to `/api/sessions` or similar). Once the session ID is available, call `fetchBookProgress(sessionId)` and `fetchGroupBooks()`.

Look for patterns like:
- `const session = ...` or `sessionId` variable
- The main `useEffect` that loads data

Add `fetchGroupBooks()` call in the initial load, and `fetchBookProgress(theSessionId)` once the session ID is known.

Store the session ID in a variable accessible to the handlers:
```typescript
const [currentSessionId, setCurrentSessionId] = useState('')
```
Set it when the session data is loaded.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/(dashboard)/groups/[id]/sessions/[num]/page.tsx"
git commit -m "feat: section Avancement Livres dans la page séance"
```

---

### Task 6: Replace Hardcoded Annexe 3 in PDF

**Files:**
- Modify: `src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx`

- [ ] **Step 1: Add data fetching for SessionBookProgress**

In the PDF generation function, find where data is gathered for the report. Add a fetch for all book progress entries across the session range:

```typescript
// Fetch book progress for annexe 3
const bookProgressRes = await fetch(`/api/admin/logs`) // We need a new endpoint...
```

Actually, we need a dedicated API or use existing group book data. The simplest approach: fetch SessionBookProgress for all sessions in the range directly in the PDF generation code.

Add a new fetch function in the mastery page:

```typescript
async function fetchSessionBookProgress(groupId: string, fromSession: number, toSession: number) {
  // Get all sessions for this group in the range
  const sessionsRes = await fetch(`/api/sessions?groupId=${groupId}`)
  if (!sessionsRes.ok) return []
  const sessions = await sessionsRes.json()

  const filteredSessions = sessions.filter((s: any) =>
    s.weekNumber >= fromSession && s.weekNumber <= toSession
  )

  const allProgress: any[] = []
  for (const sess of filteredSessions) {
    const res = await fetch(`/api/sessions/${sess.id}/book-progress`)
    if (res.ok) {
      const entries = await res.json()
      allProgress.push(...entries.map((e: any) => ({ ...e, sessionNumber: sess.weekNumber })))
    }
  }
  return allProgress
}
```

- [ ] **Step 2: Replace the hardcoded annexe 3 section**

Find the `annexeArcEnCiel` section in the PDF generation (around line 1453-1516). Replace the entire block with dynamic data generation:

```typescript
} else if (sec.key === 'annexeArcEnCiel') {
  // Fetch dynamic book progress
  const bookProgress = await fetchSessionBookProgress(groupId, annexeArcEnCielFrom, annexeArcEnCielTo)

  if (bookProgress.length === 0) continue // Skip if no data

  // Group by book
  const byBook = new Map<string, { title: string; entries: any[] }>()
  for (const entry of bookProgress) {
    if (!byBook.has(entry.bookId)) {
      byBook.set(entry.bookId, { title: entry.book.title, entries: [] })
    }
    byBook.get(entry.bookId)!.entries.push(entry)
  }

  for (const [bookId, bookData] of byBook) {
    doc.addPage()
    const pageTitle = `Annexe 3 - ${bookData.title}`
    sectionPages[pageTitle] = doc.getNumberOfPages()
    drawSectionHeader(pageTitle)

    // Build table rows from entries
    const rows = bookData.entries.map(entry => {
      const chNum = entry.chapter?.parent?.chapterNumber || entry.chapter?.chapterNumber || ''
      const chTitle = entry.chapter?.parent?.title || entry.chapter?.title || ''
      const courseNum = entry.chapter?.parent ? entry.chapter.chapterNumber : ''
      const courseTitle = entry.chapter?.parent ? entry.chapter.title : ''
      const pages = entry.pageStart && entry.pageEnd ? `p.${entry.pageStart}-${entry.pageEnd}` : ''
      const lecture = entry.isRead ? `S${entry.sessionNumber}` : '—'
      const qr = entry.isQaDone ? `S${entry.sessionNumber}` : '—'
      return [chNum.toString(), chTitle, courseNum.toString(), courseTitle, pages, lecture, qr]
    })

    const currentSessionLabel = `S${reportSessionNumber}`

    autoTable(doc, {
      head: [['Ch.', 'Titre Chapitre', 'N°', 'Titre Cours', 'Pages', 'Lecture', 'Q/R']],
      body: rows,
      startY: 25,
      styles: {
        font: pdfFont,
        fontSize: 11,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 11
      },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 45 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 95 },
        4: { cellWidth: 30, halign: 'center' },
        5: { cellWidth: 28, halign: 'center' },
        6: { cellWidth: 28, halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body') {
          const cellText = hookData.cell.text.join('')
          if (cellText === currentSessionLabel && (hookData.column.index === 5 || hookData.column.index === 6)) {
            hookData.cell.styles.fillColor = [34, 197, 94]
            hookData.cell.styles.textColor = [255, 255, 255]
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
      },
      margin: { left: 10, right: 10 }
    })

    // Add comments section if any entries have comments
    const entriesWithComments = bookData.entries.filter((e: any) => e.comment)
    if (entriesWithComments.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 30
      doc.setFontSize(10)
      doc.setFont(pdfFont, 'normal')
      let commentY = finalY + 8
      doc.setFont(pdfFont, 'bold')
      doc.text('Commentaires :', 10, commentY)
      doc.setFont(pdfFont, 'normal')
      commentY += 6
      for (const entry of entriesWithComments) {
        const label = entry.chapter?.title || `p.${entry.pageStart}-${entry.pageEnd}`
        doc.text(`S${entry.sessionNumber} — ${label} : ${entry.comment}`, 12, commentY)
        commentY += 5
        if (commentY > 280) { doc.addPage(); commentY = 20 }
      }
    }
  }
}
```

- [ ] **Step 3: Update sectionHasContent for dynamic check**

Find the `sectionHasContent` object and change:
```typescript
annexeArcEnCiel: true,
```
to:
```typescript
annexeArcEnCiel: true, // Will be checked dynamically, always show in TOC
```

Also update the section label to be more generic:
```typescript
annexeArcEnCiel: 'Annexe 3 - Avancement Livres',
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(dashboard)/groups/[id]/mastery/page.tsx"
git commit -m "feat: annexe 3 PDF dynamique — remplace données hardcodées Arc en Ciel"
```

---

### Task 7: Push Schema & Deploy

- [ ] **Step 1: Push schema to Supabase**

Run: `npx prisma db push`

- [ ] **Step 2: Push to git**

Run: `git push origin master`

- [ ] **Step 3: Deploy to VPS**

Run: `ssh root@72.61.105.112 "cd /opt/amilou && git pull && docker-compose up -d --build"`

- [ ] **Step 4: Update CLAUDE.md and presentation page**

Add documentation for:
- SessionBookProgress model
- Suivi livres en séance
- PDF annexe dynamique
- Ajout chapitres post-création
