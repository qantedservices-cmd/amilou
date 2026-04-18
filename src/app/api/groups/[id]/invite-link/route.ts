import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import crypto from 'crypto'

async function checkReferentOrAdmin(userId: string, groupId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') return true
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId, role: 'REFERENT' } })
  return !!membership
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { id: groupId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, groupId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase()
    await prisma.group.update({ where: { id: groupId }, data: { inviteCode } })
    const baseUrl = process.env.NEXTAUTH_URL || 'https://aamilou.com'
    return NextResponse.json({ inviteCode, inviteUrl: `${baseUrl}/fr/join?code=${inviteCode}` })
  } catch (error) {
    console.error('Error generating invite link:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { id: groupId } = await params
    const canEdit = await checkReferentOrAdmin(session.user.id, groupId)
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    await prisma.group.update({ where: { id: groupId }, data: { inviteCode: null } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing invite link:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
