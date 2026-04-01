import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET — Verify invite token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { inviteToken: token },
      select: { id: true, name: true, email: true, inviteExpires: true, password: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Lien d\'invitation invalide' }, { status: 404 })
    }

    if (user.password) {
      return NextResponse.json({ error: 'Ce compte a déjà été activé' }, { status: 400 })
    }

    if (user.inviteExpires && new Date() > user.inviteExpires) {
      return NextResponse.json({ error: 'Ce lien d\'invitation a expiré' }, { status: 400 })
    }

    return NextResponse.json({ name: user.name, email: user.email })
  } catch (error) {
    console.error('Error verifying invite:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

// POST — Accept invite and set password
export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token et mot de passe requis' }, { status: 400 })
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 4 caractères' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { inviteToken: token },
      select: { id: true, password: true, inviteExpires: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Lien d\'invitation invalide' }, { status: 404 })
    }

    if (user.password) {
      return NextResponse.json({ error: 'Ce compte a déjà été activé' }, { status: 400 })
    }

    if (user.inviteExpires && new Date() > user.inviteExpires) {
      return NextResponse.json({ error: 'Ce lien d\'invitation a expiré' }, { status: 400 })
    }

    // Hash password and activate account
    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        inviteToken: null,
        inviteExpires: null,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error accepting invite:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
