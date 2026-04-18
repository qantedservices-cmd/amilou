import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    })

    // Notify admins
    try {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } })
      if (admins.length > 0 && process.env.RESEND_API_KEY) {
        await getResend().emails.send({
          from: 'Aamilou <onboarding@resend.dev>',
          to: admins.map(a => a.email),
          subject: `Nouvelle inscription — ${name || email}`,
          html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2>Nouvelle inscription sur Aamilou</h2><p><strong>Nom:</strong> ${name || '(non renseigné)'}</p><p><strong>Email:</strong> ${email}</p><p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p><hr/><p style="color:#666;font-size:12px">Connectez-vous à l'administration pour gérer cet utilisateur.</p></div>`,
        })
      }
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError)
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'inscription' },
      { status: 500 }
    )
  }
}
