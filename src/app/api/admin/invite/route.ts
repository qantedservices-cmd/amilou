import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { Resend } from 'resend'
import crypto from 'crypto'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

async function checkAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })
  return user?.role === 'ADMIN' ? session.user.id : null
}

// POST — Invite a user by email
export async function POST(request: Request) {
  try {
    const adminId = await checkAdmin()
    if (!adminId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { name, email, role, groupId } = await request.json()

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nom et email requis' }, { status: 400 })
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Un utilisateur avec cet email existe déjà' }, { status: 400 })
    }

    // Generate invite token (48 hours expiry)
    const inviteToken = crypto.randomBytes(32).toString('hex')
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000)

    // Create user without password (will be set on invite acceptance)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role || 'USER',
        inviteToken,
        inviteExpires,
      }
    })

    // Assign to group if specified
    if (groupId) {
      await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId,
          role: 'MEMBER',
          isStudent: true,
        }
      })
    }

    // Build invite URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://aamilou.com'
    const inviteUrl = `${baseUrl}/fr/invite?token=${inviteToken}`

    // Send email via Resend
    const { error: emailError } = await getResend().emails.send({
      from: 'Aamilou <onboarding@resend.dev>',
      to: email,
      subject: 'Invitation à rejoindre Aamilou',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #10b981; text-align: center;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</h1>
          <h2 style="text-align: center;">Bienvenue sur Aamilou</h2>
          <p>Assalamou alaykoum ${name},</p>
          <p>Vous avez été invité(e) à rejoindre <strong>Aamilou</strong>, l'application de suivi d'apprentissage du Coran.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
              Créer mon compte
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Ce lien est valable 48 heures. Si vous n'avez pas demandé cette invitation, ignorez cet email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">Aamilou — Suivi d'apprentissage du Coran</p>
        </div>
      `,
    })

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
  } catch (error) {
    console.error('Error inviting user:', error)
    return NextResponse.json({ error: "Erreur lors de l'invitation" }, { status: 500 })
  }
}
