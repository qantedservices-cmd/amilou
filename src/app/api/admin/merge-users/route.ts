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

    // Evaluations have two FK
    const evalGiven = await prisma.evaluation.updateMany({ where: { evaluatorId: sourceUserId }, data: { evaluatorId: targetUserId } })
    if (evalGiven.count > 0) summary['evaluation_given'] = evalGiven.count
    const evalReceived = await prisma.evaluation.updateMany({ where: { evaluatedId: sourceUserId }, data: { evaluatedId: targetUserId } })
    if (evalReceived.count > 0) summary['evaluation_received'] = evalReceived.count

    // Group memberships — transfer or delete if target already member
    const sourceMembers = await prisma.groupMember.findMany({ where: { userId: sourceUserId } })
    for (const membership of sourceMembers) {
      const existing = await prisma.groupMember.findFirst({ where: { userId: targetUserId, groupId: membership.groupId } })
      if (!existing) {
        await prisma.groupMember.update({ where: { id: membership.id }, data: { userId: targetUserId } })
        summary['groupMember'] = (summary['groupMember'] || 0) + 1
      } else {
        await prisma.groupMember.delete({ where: { id: membership.id } })
      }
    }

    if (replaceEmail) {
      await prisma.user.update({ where: { id: targetUserId }, data: { email: replaceEmail.trim().toLowerCase() } })
      summary['emailUpdated'] = 1
    }

    await prisma.user.delete({ where: { id: sourceUserId } })
    summary['sourceDeleted'] = 1

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Error merging users:', error)
    return NextResponse.json({ error: 'Erreur lors de la fusion' }, { status: 500 })
  }
}
