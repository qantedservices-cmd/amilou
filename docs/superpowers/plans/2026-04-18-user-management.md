# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account merging, admin alerts (email on signup + periodic digest), first-login onboarding flow, and group invite links.

**Architecture:** Four independent features sharing only the Prisma schema changes. Merge API transfers all relational data then deletes source. Alert emails use existing Resend integration. Onboarding uses a User flag + redirect logic in the dashboard layout. Invite links use a code on the Group model + a public join page.

**Tech Stack:** Prisma, Next.js API Routes, Resend (email), React client components, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `hasSeenOnboarding` on User, `inviteCode` on Group |
| `src/app/api/admin/merge-users/route.ts` | Create | Merge two user accounts |
| `src/app/api/auth/register/route.ts` | Modify | Send email to admin on new registration |
| `src/app/api/admin/digest/route.ts` | Create | Periodic summary email |
| `src/app/api/groups/[id]/invite-link/route.ts` | Create | Generate/delete group invite code |
| `src/app/api/join/route.ts` | Create | Join group via invite code |
| `src/app/[locale]/join/page.tsx` | Create | Public page to join a group |
| `src/app/[locale]/(dashboard)/admin/page.tsx` | Modify | Merge dialog + Nouveau/En ligne badges |
| `src/app/[locale]/(dashboard)/groups/page.tsx` | Modify | Invite link button for referents |
| `src/app/[locale]/(dashboard)/layout.tsx` | Modify | Onboarding redirect logic |
| `src/app/[locale]/(dashboard)/presentation/page.tsx` | Modify | Onboarding banner |
| `src/app/[locale]/(dashboard)/settings/page.tsx` | Modify | Onboarding guide banner |

---

### Task 1: Prisma Schema — hasSeenOnboarding + inviteCode

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields**

In the `User` model, add after `dashboardLayout`:
```prisma
  hasSeenOnboarding   Boolean @default(false)
```

In the `Group` model, add after `defaultHomework`:
```prisma
  inviteCode       String?   @unique
```

- [ ] **Step 2: Push schema**

Run: `npx prisma db push`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add hasSeenOnboarding on User, inviteCode on Group"
```

---

### Task 2: Merge Users API

**Files:**
- Create: `src/app/api/admin/merge-users/route.ts`

- [ ] **Step 1: Create the API**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { sourceUserId, targetUserId, replaceEmail } = await request.json()

    if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) {
      return NextResponse.json({ error: 'Source et cible requis et différents' }, { status: 400 })
    }

    const [source, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: sourceUserId } }),
      prisma.user.findUnique({ where: { id: targetUserId } }),
    ])

    if (!source || !target) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    const summary: Record<string, number> = {}

    // Transfer all relational data
    const transfers = [
      { model: 'progress', field: 'userId' },
      { model: 'dailyAttendance', field: 'userId' },
      { model: 'dailyProgramCompletion', field: 'userId' },
      { model: 'dailyLog', field: 'userId' },
      { model: 'surahMastery', field: 'userId' },
      { model: 'surahRecitation', field: 'userId' },
      { model: 'sessionAttendance', field: 'userId' },
      { model: 'completionCycle', field: 'userId' },
      { model: 'positionAdjustment', field: 'userId' },
      { model: 'userProgramSettings', field: 'userId' },
      { model: 'userObjective', field: 'userId' },
      { model: 'weeklyObjective', field: 'userId' },
      { model: 'userBook', field: 'userId' },
      { model: 'userItemProgress', field: 'userId' },
      { model: 'loginLog', field: 'userId' },
    ]

    for (const { model, field } of transfers) {
      const result = await (prisma as any)[model].updateMany({
        where: { [field]: sourceUserId },
        data: { [field]: targetUserId },
      })
      if (result.count > 0) summary[model] = result.count
    }

    // Handle evaluations (two foreign keys)
    const evalGiven = await prisma.evaluation.updateMany({
      where: { evaluatorId: sourceUserId },
      data: { evaluatorId: targetUserId },
    })
    if (evalGiven.count > 0) summary['evaluation_given'] = evalGiven.count

    const evalReceived = await prisma.evaluation.updateMany({
      where: { evaluatedId: sourceUserId },
      data: { evaluatedId: targetUserId },
    })
    if (evalReceived.count > 0) summary['evaluation_received'] = evalReceived.count

    // Transfer group memberships (skip if target already member of same group)
    const sourceMembers = await prisma.groupMember.findMany({
      where: { userId: sourceUserId },
    })
    for (const membership of sourceMembers) {
      const existing = await prisma.groupMember.findFirst({
        where: { userId: targetUserId, groupId: membership.groupId },
      })
      if (!existing) {
        await prisma.groupMember.update({
          where: { id: membership.id },
          data: { userId: targetUserId },
        })
        summary['groupMember'] = (summary['groupMember'] || 0) + 1
      } else {
        await prisma.groupMember.delete({ where: { id: membership.id } })
      }
    }

    // Update email if requested
    if (replaceEmail) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { email: replaceEmail.trim().toLowerCase() },
      })
      summary['emailUpdated'] = 1
    }

    // Delete source user
    await prisma.user.delete({ where: { id: sourceUserId } })
    summary['sourceDeleted'] = 1

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Error merging users:', error)
    return NextResponse.json({ error: 'Erreur lors de la fusion' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/merge-users/route.ts
git commit -m "feat: API fusion de comptes utilisateur"
```

---

### Task 3: Merge UI in Admin Page

**Files:**
- Modify: `src/app/[locale]/(dashboard)/admin/page.tsx`

- [ ] **Step 1: Add merge state and dialog**

Add state variables after existing state:
```typescript
  // Merge dialog
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState('')
  const [mergeTarget, setMergeTarget] = useState('')
  const [mergeEmail, setMergeEmail] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<Record<string, number> | null>(null)
```

Add handler:
```typescript
  async function handleMerge() {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return
    if (!confirm('Cette action est irréversible. Le compte source sera supprimé et toutes ses données transférées. Continuer ?')) return
    setMerging(true)
    try {
      const res = await fetch('/api/admin/merge-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUserId: mergeSource, targetUserId: mergeTarget, replaceEmail: mergeEmail || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setMergeResult(data.summary)
        await checkAdminAndFetch()
      } else { alert(data.error || 'Erreur') }
    } catch { alert('Erreur réseau') }
    setMerging(false)
  }
```

- [ ] **Step 2: Add merge button in the Users tab header**

Find the buttons area (Ajouter + Inviter) and add:
```tsx
<Button variant="outline" onClick={() => { setMergeOpen(true); setMergeResult(null); setMergeSource(''); setMergeTarget(''); setMergeEmail('') }}>
  Fusionner
</Button>
```

- [ ] **Step 3: Add merge dialog**

Add the dialog before the closing `</div>` of the page:
```tsx
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fusionner deux comptes</DialogTitle>
            <DialogDescription>Transférer toutes les données du compte source vers le cible, puis supprimer le source.</DialogDescription>
          </DialogHeader>
          {mergeResult ? (
            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Fusion réussie</span>
              </div>
              <div className="text-sm space-y-1">
                {Object.entries(mergeResult).map(([key, count]) => (
                  <div key={key} className="flex justify-between"><span className="text-muted-foreground">{key}</span><span className="font-medium">{count}</span></div>
                ))}
              </div>
              <DialogFooter><Button onClick={() => setMergeOpen(false)}>Fermer</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <Label>Compte source (sera supprimé)</Label>
                <Select value={mergeSource} onValueChange={setMergeSource}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.id !== mergeTarget).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.email} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Compte cible (qui reste)</Label>
                <Select value={mergeTarget} onValueChange={setMergeTarget}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.id !== mergeSource).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.email} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nouvel email pour le compte cible (optionnel)</Label>
                <Input value={mergeEmail} onChange={e => setMergeEmail(e.target.value)} placeholder="Laisser vide pour garder l'email actuel" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setMergeOpen(false)}>Annuler</Button>
                <Button onClick={handleMerge} disabled={merging || !mergeSource || !mergeTarget || mergeSource === mergeTarget} className="bg-red-600 hover:bg-red-700">
                  {merging ? 'Fusion...' : 'Fusionner'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
```

- [ ] **Step 4: Add Nouveau/En ligne badges in the users table**

In the `renderUsersTable` function, find the Name cell. Add badges based on `createdAt` and `lastLogin`:

After the user name display, add:
```tsx
{/* Check if user created < 7 days ago */}
{(() => {
  // We need createdAt - check if available from adminStats or add to user fetch
  // For now use a simple approach: check enrichedUsers for recent activity
  return null
})()}
```

Actually, the user list doesn't include `createdAt`. We need to add it to the `/api/users` response. In the Users API, add `createdAt` to the select. Then in the table, add:

```tsx
{user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 7 * 86400000 && (
  <Badge className="bg-blue-100 text-blue-700 text-[10px] ml-1">Nouveau</Badge>
)}
```

For "En ligne" badge, use `lastLogin`:
```tsx
{user.lastLogin && Date.now() - new Date(user.lastLogin).getTime() < 5 * 60000 && (
  <span className="inline-block w-2 h-2 rounded-full bg-green-500 ml-1" title="En ligne" />
)}
```

Note: `createdAt` needs to be added to the User interface and fetched from the API. Modify the `/api/users` route to include `createdAt` in the response.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(dashboard)/admin/page.tsx"
git commit -m "feat: dialog fusion de comptes + badges Nouveau/En ligne"
```

---

### Task 4: Email Admin on Registration

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Add Resend email after registration**

Add import at top:
```typescript
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
```

After the user creation (after line 35 `}`), add:
```typescript
    // Send notification email to admin
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true },
      })
      if (admins.length > 0 && process.env.RESEND_API_KEY) {
        await getResend().emails.send({
          from: 'Aamilou <onboarding@resend.dev>',
          to: admins.map(a => a.email),
          subject: `Nouvelle inscription — ${name || email}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Nouvelle inscription sur Aamilou</h2>
              <p><strong>Nom :</strong> ${name || '(non renseigné)'}</p>
              <p><strong>Email :</strong> ${email}</p>
              <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
              <hr />
              <p style="color: #666; font-size: 12px;">Connectez-vous à l'administration pour gérer cet utilisateur.</p>
            </div>
          `,
        })
      }
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError)
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat: email admin à chaque nouvelle inscription"
```

---

### Task 5: Periodic Digest Email API

**Files:**
- Create: `src/app/api/admin/digest/route.ts`

- [ ] **Step 1: Create the digest API**

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (!secret || secret !== process.env.DIGEST_SECRET) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const frequency = process.env.DIGEST_FREQUENCY || 'weekly'
    const daysMap: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 }
    const days = daysMap[frequency] || 7
    const since = new Date(Date.now() - days * 86400000)

    // Gather stats
    const [totalUsers, newUsers, logins, pendingInvites] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { name: true, email: true, createdAt: true },
      }),
      prisma.loginLog.findMany({
        where: { success: true, createdAt: { gte: since } },
        select: { userId: true, email: true, createdAt: true },
      }),
      prisma.invitationLog.count({
        where: { status: 'PENDING', expiresAt: { gt: new Date() } },
      }),
    ])

    // Active users (unique logins)
    const activeUserIds = new Set(logins.map(l => l.userId).filter(Boolean))
    const activeEmails = new Set(logins.map(l => l.email))

    // All users for inactive list
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
    })
    const inactiveUsers = allUsers.filter(u => !activeUserIds.has(u.id))

    // Build email HTML
    const periodLabel = frequency === 'daily' ? 'du jour' : frequency === 'weekly' ? 'de la semaine' : 'du mois'
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2>Synthèse Aamilou ${periodLabel}</h2>

        <h3>Connexions</h3>
        <p><strong>${logins.length}</strong> connexions — <strong>${activeEmails.size}</strong> utilisateurs actifs sur <strong>${totalUsers}</strong></p>

        ${newUsers.length > 0 ? `
          <h3>Nouveaux inscrits (${newUsers.length})</h3>
          <ul>${newUsers.map(u => `<li>${u.name || 'Sans nom'} — ${u.email} (${new Date(u.createdAt).toLocaleDateString('fr-FR')})</li>`).join('')}</ul>
        ` : '<p>Aucun nouvel inscrit.</p>'}

        <h3>Utilisateurs inactifs (${inactiveUsers.length})</h3>
        <p style="color: #666; font-size: 13px;">${inactiveUsers.map(u => u.name || u.email).join(', ') || 'Tous actifs'}</p>

        ${pendingInvites > 0 ? `<p><strong>${pendingInvites}</strong> invitation(s) en attente.</p>` : ''}

        <hr />
        <p style="color: #999; font-size: 11px;">Aamilou — Email automatique</p>
      </div>
    `

    // Send to all admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    })

    if (admins.length > 0 && process.env.RESEND_API_KEY) {
      await getResend().emails.send({
        from: 'Aamilou <onboarding@resend.dev>',
        to: admins.map(a => a.email),
        subject: `Synthèse Aamilou ${periodLabel}`,
        html,
      })
    }

    return NextResponse.json({ success: true, sent: admins.length, stats: { totalUsers, newUsers: newUsers.length, logins: logins.length, activeUsers: activeEmails.size, inactiveUsers: inactiveUsers.length, pendingInvites } })
  } catch (error) {
    console.error('Error generating digest:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Add env variables on VPS**

Add to `/opt/amilou/.env`:
```
DIGEST_SECRET=a-random-secret-string-here
DIGEST_FREQUENCY=weekly
```

- [ ] **Step 3: Add crontab on VPS**

```bash
ssh root@72.61.105.112 "crontab -l 2>/dev/null; echo '0 8 * * 1 curl -s http://localhost:3000/api/admin/digest?secret=a-random-secret-string-here > /dev/null'" | ssh root@72.61.105.112 "crontab -"
```

This runs every Monday at 8:00 AM.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/digest/route.ts
git commit -m "feat: API synthèse périodique par email pour admin"
```

---

### Task 6: Onboarding Redirect

**Files:**
- Modify: `src/app/[locale]/(dashboard)/layout.tsx`
- Modify: `src/app/[locale]/(dashboard)/presentation/page.tsx`
- Modify: `src/app/[locale]/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Add redirect logic in dashboard layout**

Read `src/app/[locale]/(dashboard)/layout.tsx` first. Add a check: if user is authenticated and `hasSeenOnboarding === false`, redirect to `/presentation`.

This needs to be done client-side (the layout is likely a server component wrapping client pages). The simplest approach: add a client component `OnboardingGuard` that checks `/api/me` and redirects.

Create or modify to add:
```tsx
// In the dashboard layout, after auth check
// Fetch user profile and check hasSeenOnboarding
```

Actually, the simplest approach is to do the check in the dashboard page itself (since that's where users land after login). Find where the dashboard redirects and add the onboarding check there.

Better approach: add the check in `src/app/[locale]/(dashboard)/dashboard/page.tsx` since that's where users land after login:

In the dashboard page's data loading (where `/api/stats` is fetched), check if the user has `hasSeenOnboarding`. Add this to the `/api/me` or `/api/stats` response.

Add `hasSeenOnboarding` to the `/api/me` response. Then in the dashboard page, after loading:
```typescript
useEffect(() => {
  fetch('/api/me').then(r => r.json()).then(d => {
    if (d.hasSeenOnboarding === false) {
      window.location.href = `/${locale}/presentation`
    }
  }).catch(() => {})
}, [])
```

- [ ] **Step 2: Add onboarding banner on presentation page**

In `src/app/[locale]/(dashboard)/presentation/page.tsx`, add at the bottom (before "Retour en haut"):

```tsx
{/* Onboarding CTA */}
<Card className="border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
  <CardContent className="pt-6">
    <div className="text-center space-y-3">
      <h3 className="font-semibold text-lg">Prêt à commencer ?</h3>
      <p className="text-sm text-muted-foreground">Configurez vos objectifs et votre zone de mémorisation pour activer le suivi.</p>
      <Button
        className="bg-emerald-600 hover:bg-emerald-700"
        onClick={() => window.location.href = `/${locale}/settings`}
      >
        <Settings className="h-4 w-4 mr-2" />
        Configurer mon compte
      </Button>
    </div>
  </CardContent>
</Card>
```

Note: needs to check if `hasSeenOnboarding === false` to show this. Fetch from `/api/me`.

- [ ] **Step 3: Add onboarding guide in settings page**

In `src/app/[locale]/(dashboard)/settings/page.tsx`, add a banner at the top when `hasSeenOnboarding === false`:

```tsx
{!hasSeenOnboarding && (
  <Card className="border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-emerald-600 shrink-0" />
        <div>
          <h3 className="font-semibold">Bienvenue !</h3>
          <p className="text-sm text-muted-foreground">Configurez vos objectifs par programme et votre zone de mémorisation pour commencer le suivi.</p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

Add logic to set `hasSeenOnboarding = true` when the user saves program settings or memorization zone for the first time:

```typescript
// After saving settings successfully:
if (!hasSeenOnboarding) {
  await fetch('/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hasSeenOnboarding: true }),
  })
}
```

- [ ] **Step 4: Add hasSeenOnboarding to /api/me response**

Modify `/api/me/route.ts` to include `hasSeenOnboarding` in the response.

- [ ] **Step 5: Accept hasSeenOnboarding in /api/user/profile PUT**

Modify `/api/user/profile/route.ts` to accept and update `hasSeenOnboarding`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/(dashboard)/dashboard/page.tsx" "src/app/[locale]/(dashboard)/presentation/page.tsx" "src/app/[locale]/(dashboard)/settings/page.tsx" src/app/api/me/route.ts src/app/api/user/profile/route.ts
git commit -m "feat: onboarding première connexion — redirection + guide"
```

---

### Task 7: Group Invite Link API

**Files:**
- Create: `src/app/api/groups/[id]/invite-link/route.ts`
- Create: `src/app/api/join/route.ts`

- [ ] **Step 1: Create invite-link API**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import crypto from 'crypto'

async function checkReferentOrAdmin(userId: string, groupId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') return true
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId, role: 'REFERENT' },
  })
  return !!membership
}

// POST — Generate invite code
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: groupId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, groupId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase() // 6 chars

    await prisma.group.update({
      where: { id: groupId },
      data: { inviteCode },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://aamilou.com'
    const inviteUrl = `${baseUrl}/fr/join?code=${inviteCode}`

    return NextResponse.json({ inviteCode, inviteUrl })
  } catch (error) {
    console.error('Error generating invite link:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

// DELETE — Remove invite code
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: groupId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, groupId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    await prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing invite link:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create join API**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) return NextResponse.json({ error: 'Code requis' }, { status: 400 })

    const group = await prisma.group.findFirst({
      where: { inviteCode: code },
      select: { id: true, name: true, description: true },
    })

    if (!group) return NextResponse.json({ error: 'Code invalide' }, { status: 404 })

    return NextResponse.json(group)
  } catch (error) {
    console.error('Error verifying join code:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { code } = await request.json()
    if (!code) return NextResponse.json({ error: 'Code requis' }, { status: 400 })

    const group = await prisma.group.findFirst({
      where: { inviteCode: code },
    })

    if (!group) return NextResponse.json({ error: 'Code invalide' }, { status: 404 })

    // Check if already a member
    const existing = await prisma.groupMember.findFirst({
      where: { userId: session.user.id, groupId: group.id },
    })

    if (existing) return NextResponse.json({ success: true, alreadyMember: true, groupId: group.id })

    // Add to group
    await prisma.groupMember.create({
      data: {
        userId: session.user.id,
        groupId: group.id,
        role: 'MEMBER',
        isStudent: true,
      },
    })

    return NextResponse.json({ success: true, groupId: group.id })
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/groups/[id]/invite-link/route.ts src/app/api/join/route.ts
git commit -m "feat: APIs invitation groupe par lien + rejoindre un groupe"
```

---

### Task 8: Join Page + Group Invite UI

**Files:**
- Create: `src/app/[locale]/join/page.tsx`
- Modify: `src/app/[locale]/(dashboard)/groups/page.tsx`

- [ ] **Step 1: Create join page**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const code = searchParams.get('code')

  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [group, setGroup] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!code) { setError('Code manquant'); setLoading(false); return }
    fetch(`/api/join?code=${code}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error) }))
      .then(data => setGroup(data))
      .catch(e => setError(e.message || 'Code invalide'))
      .finally(() => setLoading(false))
  }, [code])

  async function handleJoin() {
    if (!code) return
    setJoining(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push(`/${locale}/groups`), 2000)
      } else if (res.status === 401) {
        window.location.href = `/${locale}/login`
      } else {
        setError(data.error || 'Erreur')
      }
    } catch { setError('Erreur réseau') }
    setJoining(false)
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950 dark:to-black">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
            <Users className="h-6 w-6 text-emerald-600" />
          </div>
          <CardTitle>
            {success ? 'Bienvenue !' : error ? 'Erreur' : `Rejoindre ${group?.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {success ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-12 w-12 text-emerald-600" />
              <p className="text-muted-foreground">Vous avez rejoint le groupe. Redirection...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={() => router.push(`/${locale}/login`)}>Se connecter</Button>
            </div>
          ) : group ? (
            <>
              {group.description && <p className="text-muted-foreground text-sm">{group.description}</p>}
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleJoin} disabled={joining}>
                {joining ? 'Inscription...' : 'Rejoindre le groupe'}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Add invite link button in groups page**

In `src/app/[locale]/(dashboard)/groups/page.tsx`, find where each group card is rendered. For groups where the user is REFERENT, add an invite link section.

Add state:
```typescript
const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({})
const [generatingLink, setGeneratingLink] = useState('')
```

Add handler:
```typescript
async function generateInviteLink(groupId: string) {
  setGeneratingLink(groupId)
  try {
    const res = await fetch(`/api/groups/${groupId}/invite-link`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setInviteLinks(prev => ({ ...prev, [groupId]: data.inviteUrl }))
    }
  } catch (e) { console.error(e) }
  setGeneratingLink('')
}
```

In the group card, after the member list or in the card header, add for referents:
```tsx
{group.myRole === 'REFERENT' && (
  <div className="mt-3 pt-3 border-t">
    {inviteLinks[group.id] ? (
      <div className="flex gap-2">
        <Input value={inviteLinks[group.id]} readOnly className="text-xs" />
        <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(inviteLinks[group.id])}>
          Copier
        </Button>
      </div>
    ) : (
      <Button variant="outline" size="sm" onClick={() => generateInviteLink(group.id)} disabled={generatingLink === group.id}>
        {generatingLink === group.id ? 'Génération...' : 'Lien d\'invitation'}
      </Button>
    )}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/join/page.tsx" "src/app/[locale]/(dashboard)/groups/page.tsx"
git commit -m "feat: page rejoindre groupe + bouton lien invitation pour référent"
```

---

### Task 9: Deploy + Docs

- [ ] **Step 1: Push schema**

Run: `npx prisma db push`

- [ ] **Step 2: Push and deploy**

```bash
git push origin master
ssh root@72.61.105.112 "cd /opt/amilou && git pull && docker-compose up -d --build"
```

- [ ] **Step 3: Add env variables on VPS**

```bash
ssh root@72.61.105.112 "echo 'DIGEST_SECRET=amilou-digest-2026' >> /opt/amilou/.env && echo 'DIGEST_FREQUENCY=weekly' >> /opt/amilou/.env"
```

- [ ] **Step 4: Add crontab**

```bash
ssh root@72.61.105.112 "(crontab -l 2>/dev/null; echo '0 8 * * 1 curl -s http://localhost:3000/api/admin/digest?secret=amilou-digest-2026 > /dev/null') | crontab -"
```

- [ ] **Step 5: Update CLAUDE.md**

Add sections for merge, alerts, onboarding, invite links.
