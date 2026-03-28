import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const targetUserId = effectiveUserId || session.user.id

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '90', 10)

    const since = new Date()
    since.setUTCDate(since.getUTCDate() - days)
    since.setUTCHours(0, 0, 0, 0)

    // Fetch all completions with program info
    const completions = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: targetUserId,
        date: { gte: since },
      },
      include: { program: { select: { code: true } } },
      orderBy: { date: 'desc' },
    })

    // Hizb → page approximation (604 pages / 60 hizbs ≈ 10.07 pages per hizb)
    const hizbToPage = (hizb: number) => Math.round(hizb * 604 / 60)

    // Group by date
    const grouped = new Map<string, Record<string, unknown>>()

    for (const c of completions) {
      const dateStr = c.date.toISOString().split('T')[0]
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, {})
      }
      const entry = grouped.get(dateStr)!
      const code = c.program.code

      if ((code === 'REVISION' || code === 'READING') && (c.readingHizb != null || c.revisionHizb != null)) {
        const hizb = code === 'READING' ? c.readingHizb : c.revisionHizb
        entry[code] = {
          completed: c.completed,
          hizb: hizb != null ? Math.round(hizb * 10) / 10 : null,
          surah: c.surahNumber,
          verse: c.verseNumber,
          page: hizb != null ? hizbToPage(hizb) : null,
        }
      } else {
        entry[code] = c.completed
      }
    }

    // Fetch completion cycles
    const cycles = await prisma.completionCycle.findMany({
      where: {
        userId: targetUserId,
        completedAt: { gte: since },
      },
      orderBy: { completedAt: 'desc' },
    })

    // Add cycles to grouped data
    for (const cycle of cycles) {
      const dateStr = cycle.completedAt.toISOString().split('T')[0]
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, {})
      }
      const entry = grouped.get(dateStr)!
      if (!entry._cycles) entry._cycles = []
      ;(entry._cycles as Array<{ type: string; notes: string | null; hizbCount: number | null }>).push({
        type: cycle.type,
        notes: cycle.notes,
        hizbCount: cycle.hizbCount,
      })
    }

    // Fetch manual position adjustments
    const adjustments = await prisma.positionAdjustment.findMany({
      where: {
        userId: targetUserId,
        date: { gte: since },
      },
      orderBy: { date: 'desc' },
    })

    // Add adjustments to grouped data
    for (const adj of adjustments) {
      const dateStr = adj.date.toISOString().split('T')[0]
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, {})
      }
      const entry = grouped.get(dateStr)!
      entry._adjustment = {
        readingHizb: adj.readingHizb,
        revisionHizb: adj.revisionHizb,
        surah: adj.surahNumber,
        verse: adj.verseNumber,
        page: adj.page,
      }
    }

    // Convert to array sorted by date desc
    const log = Array.from(grouped.entries()).map(([date, programs]) => ({
      date,
      programs,
    }))

    return NextResponse.json({ log })
  } catch (error) {
    console.error('Error fetching completion log:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du journal' },
      { status: 500 }
    )
  }
}
