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

    const group = await prisma.group.findFirst({ where: { inviteCode: code } })
    if (!group) return NextResponse.json({ error: 'Code invalide' }, { status: 404 })

    const existing = await prisma.groupMember.findFirst({
      where: { userId: session.user.id, groupId: group.id },
    })
    if (existing) return NextResponse.json({ success: true, alreadyMember: true, groupId: group.id })

    await prisma.groupMember.create({
      data: { userId: session.user.id, groupId: group.id, role: 'MEMBER', isStudent: true },
    })
    return NextResponse.json({ success: true, groupId: group.id })
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
