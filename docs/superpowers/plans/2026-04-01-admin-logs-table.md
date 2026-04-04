# Admin Logs & Users Table Refonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login/invitation event tracking and refactor the admin users tab into a filterable, sortable, groupable table with activity indicators + a new History tab.

**Architecture:** Two new Prisma models (LoginLog, InvitationLog) with event capture in auth callbacks and API routes. The admin page gets a refactored Users tab with indicator cards and rich table, plus a new History tab showing merged chronological events with filters and pagination.

**Tech Stack:** Prisma, Next.js API Routes, NextAuth callbacks, React (client components), shadcn/ui Table/Badge/Select/Tabs

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add LoginLog, InvitationLog models + relations |
| `src/lib/auth.ts` | Modify | Add signIn callback to log successful logins |
| `src/lib/log-utils.ts` | Create | Helper to extract IP/UA from request headers |
| `src/app/api/auth/login-log/route.ts` | Create | API for logging failed login attempts |
| `src/app/api/admin/invite/route.ts` | Modify | Create InvitationLog on invite send |
| `src/app/api/invite/route.ts` | Modify | Update InvitationLog on invite acceptance |
| `src/app/api/admin/stats/route.ts` | Modify | Add loginStats, lastLogins, loginCounts, inviteStatuses |
| `src/app/api/admin/logs/route.ts` | Create | GET merged logs with filters + pagination |
| `src/app/[locale]/login/page.tsx` | Modify | Call login-log API on failed attempt |
| `src/app/[locale]/(dashboard)/admin/page.tsx` | Modify | Refactored Users tab + new History tab |

---

### Task 1: Prisma Schema — Add LoginLog and InvitationLog

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add LoginLog model**

Add after the `Session` model block (~line 103):

```prisma
model LoginLog {
  id        String   @id @default(cuid())
  userId    String?
  email     String
  success   Boolean
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([email])
  @@index([createdAt])
}
```

- [ ] **Step 2: Add InvitationLog model**

Add after LoginLog:

```prisma
model InvitationLog {
  id         String    @id @default(cuid())
  email      String
  name       String?
  role       String    @default("USER")
  groupId    String?
  invitedBy  String
  status     String    @default("PENDING")
  token      String
  sentAt     DateTime  @default(now())
  acceptedAt DateTime?
  expiresAt  DateTime

  inviter User   @relation(fields: [invitedBy], references: [id])
  group   Group? @relation(fields: [groupId], references: [id])

  @@index([email])
  @@index([status])
  @@index([invitedBy])
  @@index([sentAt])
}
```

- [ ] **Step 3: Add relations on User and Group**

In the `User` model, add after `userItemProgress`:
```prisma
  loginLogs           LoginLog[]
  invitationsSent     InvitationLog[]
```

In the `Group` model, add after `groupBooks`:
```prisma
  invitationLogs  InvitationLog[]
```

- [ ] **Step 4: Push schema to Supabase**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add LoginLog and InvitationLog models"
```

---

### Task 2: Request Header Helper

**Files:**
- Create: `src/lib/log-utils.ts`

- [ ] **Step 1: Create log-utils.ts**

```typescript
import { headers } from 'next/headers'

export async function getRequestMeta() {
  const h = await headers()
  const ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    || h.get('x-real-ip')
    || null
  const userAgent = h.get('user-agent') || null
  return { ipAddress, userAgent }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/log-utils.ts
git commit -m "feat: add request header helper for IP/UA extraction"
```

---

### Task 3: Log Successful Logins in Auth

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add signIn callback**

In `src/lib/auth.ts`, add a `signIn` callback inside the existing `callbacks` object (before the `jwt` callback). Import prisma at top if not already imported (it is via `./db`):

```typescript
callbacks: {
    async signIn({ user }) {
      if (user?.id && user?.email) {
        try {
          await prisma.loginLog.create({
            data: {
              userId: user.id,
              email: user.email,
              success: true,
            }
          })
        } catch (e) {
          console.error('Failed to log login:', e)
        }
      }
      return true
    },
    async jwt({ token, user }) {
      // ... existing code
    },
    // ... rest
}
```

Note: IP/UA are not available in the signIn callback. We'll capture them for failed logins only (via the client-side API). For successful logins, the log exists without IP/UA — this is acceptable.

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: log successful logins in NextAuth signIn callback"
```

---

### Task 4: Failed Login Log API

**Files:**
- Create: `src/app/api/auth/login-log/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getRequestMeta } from '@/lib/log-utils'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const { ipAddress, userAgent } = await getRequestMeta()

    // Look up user by email (may not exist)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true }
    })

    await prisma.loginLog.create({
      data: {
        userId: user?.id || null,
        email: email.toLowerCase().trim(),
        success: false,
        ipAddress,
        userAgent,
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error logging failed login:', error)
    return NextResponse.json({ ok: true }) // Don't leak errors
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/login-log/route.ts
git commit -m "feat: add API for logging failed login attempts"
```

---

### Task 5: Log Failed Logins from Login Page

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`

- [ ] **Step 1: Add login-log call on failure**

In `handleSubmit`, after `if (result?.error)` block at line 33, add the fetch call:

Replace:
```typescript
    if (result?.error) {
      setError(t('auth.invalidCredentials'))
      setLoading(false)
    } else {
```

With:
```typescript
    if (result?.error) {
      setError(t('auth.invalidCredentials'))
      setLoading(false)
      // Log failed attempt
      fetch('/api/auth/login-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {})
    } else {
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/[locale]/login/page.tsx"
git commit -m "feat: log failed login attempts from login page"
```

---

### Task 6: Log Invitations on Send

**Files:**
- Modify: `src/app/api/admin/invite/route.ts`

- [ ] **Step 1: Add InvitationLog creation after email send**

In the POST function, after the successful user creation and email send attempt (after line 91, before the `if (emailError)` check), add the InvitationLog creation. Replace the section from `if (emailError)` to the final `return`:

Replace (lines 93-104):
```typescript
    if (emailError) {
      console.error('Resend error:', emailError)
      // User created but email failed — return the invite URL for manual sharing
      return NextResponse.json({
        user,
        emailSent: false,
        inviteUrl,
        error: 'Email non envoyé, partagez le lien manuellement'
      })
    }

    return NextResponse.json({ user, emailSent: true, inviteUrl })
```

With:
```typescript
    // Log the invitation
    await prisma.invitationLog.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role: role || 'USER',
        groupId: groupId || null,
        invitedBy: adminId,
        status: 'PENDING',
        token: inviteToken,
        expiresAt: inviteExpires,
      }
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json({
        user,
        emailSent: false,
        inviteUrl,
        error: 'Email non envoyé, partagez le lien manuellement'
      })
    }

    return NextResponse.json({ user, emailSent: true, inviteUrl })
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/invite/route.ts
git commit -m "feat: log invitations in InvitationLog on send"
```

---

### Task 7: Update InvitationLog on Invite Acceptance

**Files:**
- Modify: `src/app/api/invite/route.ts`

- [ ] **Step 1: Update InvitationLog status to ACCEPTED**

In the POST function, after the `prisma.user.update` call (line 72-79), before the `return NextResponse.json({ success: true })`, add:

```typescript
    // Update invitation log
    await prisma.invitationLog.updateMany({
      where: { token },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      }
    })
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/invite/route.ts
git commit -m "feat: mark InvitationLog as ACCEPTED on account activation"
```

---

### Task 8: Update Admin Stats API

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`

- [ ] **Step 1: Add login and invitation stats to the response**

After the existing `const groups = await prisma.group.findMany(...)` block (~line 172) and before the `return NextResponse.json(...)`, add the following queries:

```typescript
    // Login stats
    const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const now30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const lastLoginsByUser = await prisma.loginLog.groupBy({
      by: ['userId'],
      where: { success: true, userId: { not: null } },
      _max: { createdAt: true },
      _count: true,
    })

    const lastLogins: Record<string, string> = {}
    const loginCounts: Record<string, number> = {}
    let activeCount = 0
    let mediumCount = 0
    let inactiveCount = 0

    for (const entry of lastLoginsByUser) {
      if (!entry.userId) continue
      const lastDate = entry._max.createdAt!
      lastLogins[entry.userId] = lastDate.toISOString()
      loginCounts[entry.userId] = entry._count
      if (lastDate > now7d) activeCount++
      else if (lastDate > now30d) mediumCount++
      else inactiveCount++
    }

    const usersWithLogins = new Set(lastLoginsByUser.map(e => e.userId).filter(Boolean))
    const allUserIds = validStats.map(u => u?.id).filter(Boolean)
    const neverConnected = allUserIds.filter(id => !usersWithLogins.has(id!)).length

    // Invitation stats
    const pendingInvites = await prisma.invitationLog.count({
      where: {
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      }
    })

    const inviteLogs = await prisma.invitationLog.findMany({
      where: {
        email: { in: allUserIds.length > 0 ? undefined : undefined }
      },
      select: { email: true, status: true, expiresAt: true },
      orderBy: { sentAt: 'desc' },
    })

    // Deduplicate: keep most recent per email
    const inviteStatuses: Record<string, string> = {}
    for (const inv of inviteLogs) {
      if (!inviteStatuses[inv.email]) {
        inviteStatuses[inv.email] = inv.status === 'PENDING' && inv.expiresAt < new Date()
          ? 'EXPIRED'
          : inv.status
      }
    }
```

Then update the return statement to include the new data:

```typescript
    return NextResponse.json({
      users: validStats,
      globalAttendanceRate,
      inactiveUsersCount,
      totalUsers: validStats.length,
      groups,
      loginStats: {
        activeCount,
        mediumCount,
        inactiveCount,
        neverConnected,
        pendingInvites,
      },
      lastLogins,
      loginCounts,
      inviteStatuses,
    })
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/stats/route.ts
git commit -m "feat: add login and invitation stats to admin stats API"
```

---

### Task 9: Admin Logs API

**Files:**
- Create: `src/app/api/admin/logs/route.ts`

- [ ] **Step 1: Create the logs API**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type') || 'all'
    const period = searchParams.get('period') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Period filter
    let dateFilter: Date | undefined
    if (period === 'today') {
      dateFilter = new Date()
      dateFilter.setHours(0, 0, 0, 0)
    } else if (period === '7d') {
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === '30d') {
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }

    // Fetch login logs
    const includeLogins = type === 'all' || type === 'login' || type === 'login-fail'
    const includeInvitations = type === 'all' || type === 'invitation'

    type LogEntry = {
      id: string
      type: 'login' | 'login-fail' | 'invitation-sent' | 'invitation-accepted'
      date: Date
      userId: string | null
      userName: string | null
      userEmail: string
      details: Record<string, unknown>
    }

    const entries: LogEntry[] = []

    if (includeLogins) {
      const loginWhere: any = {}
      if (userId) loginWhere.userId = userId
      if (type === 'login') loginWhere.success = true
      if (type === 'login-fail') loginWhere.success = false
      if (dateFilter) loginWhere.createdAt = { gte: dateFilter }

      const loginLogs = await prisma.loginLog.findMany({
        where: loginWhere,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      })

      for (const log of loginLogs) {
        entries.push({
          id: log.id,
          type: log.success ? 'login' : 'login-fail',
          date: log.createdAt,
          userId: log.userId,
          userName: log.user?.name || null,
          userEmail: log.email,
          details: {
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
          },
        })
      }
    }

    if (includeInvitations) {
      const inviteWhere: any = {}
      if (userId) inviteWhere.invitedBy = userId
      if (dateFilter) inviteWhere.sentAt = { gte: dateFilter }

      const inviteLogs = await prisma.invitationLog.findMany({
        where: inviteWhere,
        include: {
          inviter: { select: { id: true, name: true, email: true } },
          group: { select: { name: true } },
        },
        orderBy: { sentAt: 'desc' },
      })

      for (const inv of inviteLogs) {
        // Add "sent" entry
        entries.push({
          id: inv.id + '-sent',
          type: 'invitation-sent',
          date: inv.sentAt,
          userId: inv.invitedBy,
          userName: inv.inviter?.name || null,
          userEmail: inv.email,
          details: {
            inviteName: inv.name,
            role: inv.role,
            groupName: inv.group?.name || null,
            status: inv.status === 'PENDING' && inv.expiresAt < new Date() ? 'EXPIRED' : inv.status,
          },
        })

        // Add "accepted" entry if applicable
        if (inv.status === 'ACCEPTED' && inv.acceptedAt) {
          entries.push({
            id: inv.id + '-accepted',
            type: 'invitation-accepted',
            date: inv.acceptedAt,
            userId: null,
            userName: inv.name,
            userEmail: inv.email,
            details: {
              role: inv.role,
              groupName: inv.group?.name || null,
            },
          })
        }
      }
    }

    // Sort by date descending
    entries.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Paginate
    const total = entries.length
    const totalPages = Math.ceil(total / limit)
    const paged = entries.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      logs: paged,
      total,
      page,
      totalPages,
    })
  } catch (error) {
    console.error('Error fetching admin logs:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/logs/route.ts
git commit -m "feat: add admin logs API with filters and pagination"
```

---

### Task 10: Refactor Admin Page — Users Tab + History Tab

**Files:**
- Modify: `src/app/[locale]/(dashboard)/admin/page.tsx`

This is the largest task. The admin page is ~892 lines. We modify the Users tab content and add a History tab. The other tabs (Groups, Ranking, Progress) and all dialogs remain unchanged.

- [ ] **Step 1: Add new interfaces and state**

After the existing interfaces (~line 126), add:

```typescript
interface LoginStats {
  activeCount: number
  mediumCount: number
  inactiveCount: number
  neverConnected: number
  pendingInvites: number
}

interface LogEntry {
  id: string
  type: 'login' | 'login-fail' | 'invitation-sent' | 'invitation-accepted'
  date: string
  userId: string | null
  userName: string | null
  userEmail: string
  details: Record<string, any>
}
```

Update the `AdminStats` interface to include new fields:

```typescript
interface AdminStats {
  users: UserRanking[]
  globalAttendanceRate: number
  inactiveUsersCount: number
  totalUsers: number
  groups: { id: string; name: string }[]
  loginStats?: LoginStats
  lastLogins?: Record<string, string>
  loginCounts?: Record<string, number>
  inviteStatuses?: Record<string, string>
}
```

Add new state variables after the existing state declarations (~line 173):

```typescript
  // History tab
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotalPages, setLogsTotalPages] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logFilterUser, setLogFilterUser] = useState('all')
  const [logFilterType, setLogFilterType] = useState('all')
  const [logFilterPeriod, setLogFilterPeriod] = useState('30d')

  // Users tab filters
  const [filterRole, setFilterRole] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterActivity, setFilterActivity] = useState('all')
  const [filterInvite, setFilterInvite] = useState('all')
  const [groupBy, setGroupBy] = useState('none')
  const [sortColumn, setSortColumn] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState('users')
```

- [ ] **Step 2: Add fetchLogs function**

After the existing `fetchGroups` function (~line 249), add:

```typescript
  async function fetchLogs() {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams({ page: logsPage.toString(), limit: '50', period: logFilterPeriod })
      if (logFilterUser !== 'all') params.set('userId', logFilterUser)
      if (logFilterType !== 'all') params.set('type', logFilterType)
      const res = await fetch(`/api/admin/logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setLogsTotalPages(data.totalPages)
        setLogsTotal(data.total)
      }
    } catch (e) { console.error(e) }
    setLogsLoading(false)
  }
```

Add a useEffect for logs:

```typescript
  useEffect(() => {
    if (isAdmin && activeTab === 'history') fetchLogs()
  }, [isAdmin, activeTab, logsPage, logFilterUser, logFilterType, logFilterPeriod])
```

- [ ] **Step 3: Add filtered/sorted users logic**

Replace the existing `filteredUsers` useMemo (~line 398-404) with:

```typescript
  const enrichedUsers = useMemo(() => {
    return users.map(u => ({
      ...u,
      groups: groups.filter(g => g.members.some(m => m.userId === u.id)).map(g => g.name),
      lastLogin: adminStats?.lastLogins?.[u.id] || null,
      loginCount: adminStats?.loginCounts?.[u.id] || 0,
      inviteStatus: adminStats?.inviteStatuses?.[u.email] || null,
      activityStatus: (() => {
        const last = adminStats?.lastLogins?.[u.id]
        if (!last) return 'never'
        const d = Date.now() - new Date(last).getTime()
        if (d < 7 * 86400000) return 'active'
        if (d < 30 * 86400000) return 'medium'
        return 'inactive'
      })(),
    }))
  }, [users, groups, adminStats])

  const filteredUsers = useMemo(() => {
    let result = enrichedUsers

    // Text search
    if (userSearch) {
      const s = userSearch.toLowerCase()
      result = result.filter(u => (u.name || '').toLowerCase().includes(s) || u.email.toLowerCase().includes(s))
    }

    // Filters
    if (filterRole !== 'all') result = result.filter(u => u.role === filterRole)
    if (filterGroup !== 'all') result = result.filter(u => u.groups.some(g => groups.find(gr => gr.id === filterGroup)?.name === g))
    if (filterActivity !== 'all') result = result.filter(u => u.activityStatus === filterActivity)
    if (filterInvite !== 'all') {
      if (filterInvite === 'none') result = result.filter(u => !u.inviteStatus)
      else result = result.filter(u => u.inviteStatus === filterInvite)
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortColumn === 'name') cmp = (a.name || '').localeCompare(b.name || '')
      else if (sortColumn === 'email') cmp = a.email.localeCompare(b.email)
      else if (sortColumn === 'role') cmp = a.role.localeCompare(b.role)
      else if (sortColumn === 'lastLogin') {
        const da = a.lastLogin ? new Date(a.lastLogin).getTime() : 0
        const db = b.lastLogin ? new Date(b.lastLogin).getTime() : 0
        cmp = da - db
      }
      else if (sortColumn === 'loginCount') cmp = a.loginCount - b.loginCount
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [enrichedUsers, userSearch, filterRole, filterGroup, filterActivity, filterInvite, sortColumn, sortDir])

  // Grouped users
  const groupedUsers = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, typeof filteredUsers>()
    for (const u of filteredUsers) {
      if (groupBy === 'role') {
        const key = u.role
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(u)
      } else if (groupBy === 'group') {
        if (u.groups.length === 0) {
          const key = 'Sans groupe'
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(u)
        } else {
          for (const g of u.groups) {
            if (!map.has(g)) map.set(g, [])
            map.get(g)!.push(u)
          }
        }
      }
    }
    return map
  }, [filteredUsers, groupBy])
```

- [ ] **Step 4: Add helper functions**

After `getProgramColor` (~line 396), add:

```typescript
  function getActivityBadge(status: string) {
    if (status === 'active') return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Actif (< 7j)" />
    if (status === 'medium') return <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400" title="Moyen (7-30j)" />
    if (status === 'inactive') return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title="Inactif (> 30j)" />
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" title="Jamais connecté" />
  }

  function getInviteBadge(status: string | null) {
    if (!status) return null
    if (status === 'ACCEPTED') return <Badge className="bg-emerald-100 text-emerald-700 text-xs">Acceptée</Badge>
    if (status === 'PENDING') return <Badge className="bg-blue-100 text-blue-700 text-xs">En attente</Badge>
    if (status === 'EXPIRED') return <Badge className="bg-gray-100 text-gray-500 text-xs">Expirée</Badge>
    return null
  }

  function formatRelativeDate(dateStr: string | null) {
    if (!dateStr) return 'Jamais'
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return "Aujourd'hui"
    if (days === 1) return 'Hier'
    if (days < 7) return `Il y a ${days}j`
    if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`
    return `Il y a ${Math.floor(days / 30)} mois`
  }

  function toggleSort(col: string) {
    if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDir('asc') }
  }

  function getSortIcon(col: string) {
    if (sortColumn !== col) return null
    return sortDir === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-1" /> : <ArrowDown className="inline h-3 w-3 ml-1" />
  }

  function viewUserLogs(userId: string) {
    setLogFilterUser(userId)
    setLogFilterType('all')
    setLogFilterPeriod('all')
    setLogsPage(1)
    setActiveTab('history')
  }

  function getLogTypeBadge(type: string) {
    if (type === 'login') return <Badge className="bg-emerald-100 text-emerald-700 text-xs">Connexion</Badge>
    if (type === 'login-fail') return <Badge className="bg-red-100 text-red-700 text-xs">Échec</Badge>
    if (type === 'invitation-sent') return <Badge className="bg-blue-100 text-blue-700 text-xs">Invitation</Badge>
    if (type === 'invitation-accepted') return <Badge className="bg-emerald-100 text-emerald-700 text-xs">Activation</Badge>
    return <Badge variant="outline">{type}</Badge>
  }

  function shortenUA(ua: string | null) {
    if (!ua) return ''
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari')) return 'Safari'
    if (ua.includes('Edge')) return 'Edge'
    return ua.substring(0, 30)
  }
```

- [ ] **Step 5: Replace stats cards**

Replace the stats cards section (~lines 423-429):

```html
      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{adminStats?.totalUsers || users.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Assiduité globale</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{adminStats?.globalAttendanceRate || 0}%</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Inactifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{adminStats?.inactiveUsersCount || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Groupes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{groups.length}</div></CardContent></Card>
      </div>
```

With:

```html
      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Utilisateurs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{adminStats?.totalUsers || users.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Actifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{adminStats?.loginStats?.activeCount || 0}</div><p className="text-xs text-muted-foreground">connexion &lt; 7j</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Inactifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{adminStats?.loginStats?.inactiveCount || 0}</div><p className="text-xs text-muted-foreground">connexion &gt; 30j</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" />Jamais connectés</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-gray-500">{adminStats?.loginStats?.neverConnected || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Invitations en attente</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{adminStats?.loginStats?.pendingInvites || 0}</div></CardContent></Card>
      </div>
```

- [ ] **Step 6: Update Tabs to include History + make controlled**

Replace the Tabs opening (~line 432-438):

```html
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-1"><Users className="h-4 w-4" />Utilisateurs</TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-1"><FolderOpen className="h-4 w-4" />Groupes</TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-1"><Trophy className="h-4 w-4" />Classement</TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Progressions</TabsTrigger>
        </TabsList>
```

With:

```html
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users" className="flex items-center gap-1"><Users className="h-4 w-4" />Utilisateurs</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1"><Activity className="h-4 w-4" />Historique</TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-1"><FolderOpen className="h-4 w-4" />Groupes</TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-1"><Trophy className="h-4 w-4" />Classement</TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Progressions</TabsTrigger>
        </TabsList>
```

- [ ] **Step 7: Replace Users tab content**

Replace the entire `<TabsContent value="users">` block (~lines 441-496) with the new content that includes filters, grouped/ungrouped table with new columns:

```tsx
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher par nom ou email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setAddUserOpen(true)}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
                  <Button variant="outline" onClick={() => { setInviteOpen(true); setInviteResult(null); setInviteName(''); setInviteEmail(''); setInviteRole('USER'); setInviteGroupId('') }}><Mail className="h-4 w-4 mr-1" />Inviter</Button>
                </div>
              </div>
              {/* Filters row */}
              <div className="flex gap-2 flex-wrap mt-3">
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Rôle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les rôles</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="REFERENT">Référent</SelectItem>
                    <SelectItem value="USER">Utilisateur</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Groupe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les groupes</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterActivity} onValueChange={setFilterActivity}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Activité" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute activité</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                    <SelectItem value="never">Jamais connecté</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterInvite} onValueChange={setFilterInvite}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Invitation" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="ACCEPTED">Acceptée</SelectItem>
                    <SelectItem value="PENDING">En attente</SelectItem>
                    <SelectItem value="EXPIRED">Expirée</SelectItem>
                    <SelectItem value="none">Aucune</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Grouper par" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pas de groupement</SelectItem>
                    <SelectItem value="role">Par rôle</SelectItem>
                    <SelectItem value="group">Par groupe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''} trouvé{filteredUsers.length > 1 ? 's' : ''}</p>
            </CardHeader>
            <CardContent>
              {groupedUsers ? (
                // Grouped view
                <div className="space-y-6">
                  {Array.from(groupedUsers.entries()).map(([groupName, groupUsers]) => (
                    <div key={groupName}>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-2">{groupName} ({groupUsers.length})</h3>
                      {renderUsersTable(groupUsers)}
                    </div>
                  ))}
                </div>
              ) : (
                renderUsersTable(filteredUsers)
              )}
            </CardContent>
          </Card>
        </TabsContent>
```

- [ ] **Step 8: Add renderUsersTable helper function**

Add this function before the return statement (before `if (loading)`):

```tsx
  function renderUsersTable(userList: typeof filteredUsers) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Nom{getSortIcon('name')}</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>Email{getSortIcon('email')}</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('role')}>Rôle{getSortIcon('role')}</TableHead>
            <TableHead>Groupes</TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('lastLogin')}>Dernière cnx{getSortIcon('lastLogin')}</TableHead>
            <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort('loginCount')}>Cnx{getSortIcon('loginCount')}</TableHead>
            <TableHead className="text-center">Activité</TableHead>
            <TableHead>Invitation</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userList.map(user => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name || '-'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
              <TableCell><Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge></TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.groups.map(g => <Badge key={g} variant="outline" className="text-xs">{g}</Badge>)}
                  {user.groups.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </TableCell>
              <TableCell className="text-sm cursor-pointer hover:underline" onClick={() => viewUserLogs(user.id)} title="Voir l'historique">
                {formatRelativeDate(user.lastLogin)}
              </TableCell>
              <TableCell className="text-center text-sm cursor-pointer hover:underline" onClick={() => viewUserLogs(user.id)} title="Voir l'historique">
                {user.loginCount}
              </TableCell>
              <TableCell className="text-center">{getActivityBadge(user.activityStatus)}</TableCell>
              <TableCell>{getInviteBadge(user.inviteStatus)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} title="Modifier"><Pencil className="h-3.5 w-3.5" /></Button>
                  {user.id !== session?.user?.id && (
                    <Button variant="ghost" size="sm" onClick={() => startImpersonation(user.id)} className="text-amber-600" title="Voir en tant que"><Eye className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
```

- [ ] **Step 9: Add History tab content**

After the Users `TabsContent` closing tag and before the Groups `TabsContent`, add:

```tsx
        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Historique des événements</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Select value={logFilterUser} onValueChange={v => { setLogFilterUser(v); setLogsPage(1) }}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Utilisateur" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les utilisateurs</SelectItem>
                      {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={logFilterType} onValueChange={v => { setLogFilterType(v); setLogsPage(1) }}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="login">Connexions</SelectItem>
                      <SelectItem value="login-fail">Échecs</SelectItem>
                      <SelectItem value="invitation">Invitations</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={logFilterPeriod} onValueChange={v => { setLogFilterPeriod(v); setLogsPage(1) }}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Période" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Aujourd'hui</SelectItem>
                      <SelectItem value="7d">7 derniers jours</SelectItem>
                      <SelectItem value="30d">30 derniers jours</SelectItem>
                      <SelectItem value="all">Tout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{logsTotal} événement{logsTotal > 1 ? 's' : ''}</p>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : logs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucun événement</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Heure</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Détails</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap">{new Date(log.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>{getLogTypeBadge(log.type)}</TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium text-sm">{log.userName || log.userEmail.split('@')[0]}</span>
                              <span className="text-xs text-muted-foreground ml-2">{log.userEmail}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(log.type === 'login' || log.type === 'login-fail') && (
                              <span>{log.details.ipAddress || ''}{log.details.ipAddress && log.details.userAgent ? ' — ' : ''}{shortenUA(log.details.userAgent as string)}</span>
                            )}
                            {log.type === 'invitation-sent' && (
                              <span>→ {log.details.inviteName} ({log.details.role}){log.details.groupName ? ` — ${log.details.groupName}` : ''} — <Badge variant="outline" className="text-xs">{log.details.status as string}</Badge></span>
                            )}
                            {log.type === 'invitation-accepted' && (
                              <span>Compte activé{log.details.groupName ? ` — ${log.details.groupName}` : ''}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {/* Pagination */}
                  {logsTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <Button variant="outline" size="sm" disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)}>Précédent</Button>
                      <span className="text-sm text-muted-foreground">Page {logsPage} sur {logsTotalPages}</span>
                      <Button variant="outline" size="sm" disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage(p => p + 1)}>Suivant</Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
```

- [ ] **Step 10: Remove old getUserGroups function**

Delete the `getUserGroups` function (~line 407-409) — it's replaced by `enrichedUsers`.

- [ ] **Step 11: Add Clock import**

Add `Clock` to the lucide-react imports if not already present. Actually, we don't use `Clock` — we use `Activity` which is already imported. No change needed.

- [ ] **Step 12: Commit**

```bash
git add "src/app/[locale]/(dashboard)/admin/page.tsx"
git commit -m "feat: refonte onglet Utilisateurs avec indicateurs + nouvel onglet Historique"
```

---

### Task 11: Push Schema & Deploy

- [ ] **Step 1: Push schema to Supabase**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 2: Push to git**

Run: `git push origin master`

- [ ] **Step 3: Deploy to VPS**

Run: `ssh root@72.61.105.112 "cd /opt/amilou && git pull && docker-compose up -d --build"`
Expected: Build succeeds, containers start.

- [ ] **Step 4: Verify**

Open the admin page on VPS and check:
- Users tab shows new columns and filters
- History tab loads (empty is expected — no logs yet)
- Login/logout creates log entries
