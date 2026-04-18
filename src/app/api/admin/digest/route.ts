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

    const [totalUsers, newUsers, logins, pendingInvites, allUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { name: true, email: true, createdAt: true } }),
      prisma.loginLog.findMany({ where: { success: true, createdAt: { gte: since } }, select: { userId: true, email: true } }),
      prisma.invitationLog.count({ where: { status: 'PENDING', expiresAt: { gt: new Date() } } }),
      prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    ])

    const activeUserIds = new Set(logins.map(l => l.userId).filter(Boolean))
    const activeEmails = new Set(logins.map(l => l.email))
    const inactiveUsers = allUsers.filter(u => !activeUserIds.has(u.id))

    const periodLabel = frequency === 'daily' ? 'du jour' : frequency === 'weekly' ? 'de la semaine' : 'du mois'
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px">
        <h2>Synthèse Aamilou ${periodLabel}</h2>
        <h3>Connexions</h3>
        <p><strong>${logins.length}</strong> connexions — <strong>${activeEmails.size}</strong> utilisateurs actifs sur <strong>${totalUsers}</strong></p>
        ${newUsers.length > 0 ? `<h3>Nouveaux inscrits (${newUsers.length})</h3><ul>${newUsers.map(u => `<li>${u.name || 'Sans nom'} — ${u.email}</li>`).join('')}</ul>` : '<p>Aucun nouvel inscrit.</p>'}
        <h3>Utilisateurs inactifs (${inactiveUsers.length})</h3>
        <p style="color:#666;font-size:13px">${inactiveUsers.map(u => u.name || u.email).join(', ') || 'Tous actifs'}</p>
        ${pendingInvites > 0 ? `<p><strong>${pendingInvites}</strong> invitation(s) en attente.</p>` : ''}
        <hr/><p style="color:#999;font-size:11px">Aamilou — Email automatique</p>
      </div>`

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } })
    if (admins.length > 0 && process.env.RESEND_API_KEY) {
      await getResend().emails.send({
        from: 'Aamilou <onboarding@resend.dev>',
        to: admins.map(a => a.email),
        subject: `Synthèse Aamilou ${periodLabel}`,
        html,
      })
    }

    return NextResponse.json({ success: true, sent: admins.length })
  } catch (error) {
    console.error('Error generating digest:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
