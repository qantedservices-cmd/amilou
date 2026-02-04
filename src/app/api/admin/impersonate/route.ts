import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { cookies } from 'next/headers'

const IMPERSONATE_COOKIE = 'amilou_impersonate'

// POST - Start impersonation
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Only ADMIN can impersonate
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 })
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Set impersonation cookie
    const cookieStore = await cookies()
    cookieStore.set(IMPERSONATE_COOKIE, JSON.stringify({
      odminId: session.user.id,
      odminName: session.user.name,
      targetId: targetUser.id,
      targetName: targetUser.name,
      targetEmail: targetUser.email,
      targetRole: targetUser.role
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/'
    })

    return NextResponse.json({
      success: true,
      impersonating: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      }
    })
  } catch (error) {
    console.error('Impersonate error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Stop impersonation
export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.delete(IMPERSONATE_COOKIE)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Stop impersonation error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET - Check impersonation status
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get(IMPERSONATE_COOKIE)

    if (!impersonateCookie?.value) {
      return NextResponse.json({ impersonating: null })
    }

    try {
      const data = JSON.parse(impersonateCookie.value)
      return NextResponse.json({
        impersonating: {
          adminId: data.adminId,
          adminName: data.adminName,
          targetId: data.targetId,
          targetName: data.targetName,
          targetEmail: data.targetEmail,
          targetRole: data.targetRole
        }
      })
    } catch {
      return NextResponse.json({ impersonating: null })
    }
  } catch (error) {
    console.error('Get impersonation error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
