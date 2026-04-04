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
