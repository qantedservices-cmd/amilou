import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getRequestMeta } from '@/lib/log-utils'

export async function POST(request: Request) {
  try {
    const { email, success } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const { ipAddress, userAgent } = await getRequestMeta()

    if (success) {
      // Update the most recent successful login (created by NextAuth callback) with IP/UA
      const recentLog = await prisma.loginLog.findFirst({
        where: { email: email.toLowerCase().trim(), success: true, ipAddress: null },
        orderBy: { createdAt: 'desc' },
      })
      if (recentLog) {
        await prisma.loginLog.update({
          where: { id: recentLog.id },
          data: { ipAddress, userAgent },
        })
      }
    } else {
      // Create a failed login entry
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
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error logging login:', error)
    return NextResponse.json({ ok: true })
  }
}
