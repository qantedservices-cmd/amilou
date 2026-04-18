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

    // Build hizb→surah lookup in ONE query (load all 60 hizb boundaries)
    const hizbVerses = await prisma.verse.findMany({
      where: { hizb: { not: null } },
      select: {
        hizb: true,
        surahNumber: true,
        verseNumber: true,
        juz: true,
        surah: { select: { nameAr: true, nameFr: true } },
      },
      orderBy: [{ hizb: 'asc' }, { surahNumber: 'asc' }, { verseNumber: 'asc' }],
    })

    // Build a map: integer hizb → first verse info
    const hizbMap = new Map<number, { surahNumber: number; surahNameAr: string; surahNameFr: string; verseNumber: number; juz: number | null }>()
    for (const v of hizbVerses) {
      if (v.hizb == null) continue
      const key = Math.round(v.hizb)
      if (!hizbMap.has(key)) {
        hizbMap.set(key, {
          surahNumber: v.surahNumber,
          surahNameAr: v.surah.nameAr,
          surahNameFr: v.surah.nameFr,
          verseNumber: v.verseNumber,
          juz: v.juz,
        })
      }
    }

    function resolveHizb(hizb: number) {
      if (hizb <= 0) {
        // Hizb 0 = Al-Fatiha v.1
        const h1 = hizbMap.get(1)
        return h1 ? { ...h1, hizb: 0 } : null
      }
      const rounded = Math.round(hizb)
      return hizbMap.get(rounded) || hizbMap.get(rounded - 1) || hizbMap.get(rounded + 1) || null
    }

    // Hizb → page approximation
    const hizbToPage = (hizb: number) => Math.round(hizb * 604 / 60)

    // Fetch all completions + cycles + adjustments in parallel
    const [completions, cycles, adjustments] = await Promise.all([
      prisma.dailyProgramCompletion.findMany({
        where: { userId: targetUserId, date: { gte: since } },
        include: { program: { select: { code: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.completionCycle.findMany({
        where: { userId: targetUserId, completedAt: { gte: since } },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.positionAdjustment.findMany({
        where: { userId: targetUserId, date: { gte: since } },
        orderBy: { date: 'desc' },
      }),
    ])

    // Group by date
    const grouped = new Map<string, Record<string, unknown>>()

    for (const c of completions) {
      const dateStr = c.date.toISOString().split('T')[0]
      if (!grouped.has(dateStr)) grouped.set(dateStr, {})
      const entry = grouped.get(dateStr)!
      const code = c.program.code

      if ((code === 'REVISION' || code === 'READING') && (c.readingHizb != null || c.revisionHizb != null)) {
        const hizb = code === 'READING' ? c.readingHizb : c.revisionHizb
        const info = hizb != null ? resolveHizb(hizb) : null
        entry[code] = {
          completed: c.completed,
          hizb: hizb != null ? Math.round(hizb * 10) / 10 : null,
          surah: info?.surahNumber || c.surahNumber || null,
          surahNameAr: info?.surahNameAr || null,
          verse: info?.verseNumber || c.verseNumber || null,
          juz: info?.juz || null,
          page: hizb != null ? hizbToPage(hizb) : null,
        }
      } else {
        entry[code] = c.completed
      }
    }

    // Add cycles
    for (const cycle of cycles) {
      const dateStr = cycle.completedAt.toISOString().split('T')[0]
      if (!grouped.has(dateStr)) grouped.set(dateStr, {})
      const entry = grouped.get(dateStr)!
      if (!entry._cycles) entry._cycles = []
      ;(entry._cycles as Array<{ type: string; notes: string | null; hizbCount: number | null }>).push({
        type: cycle.type,
        notes: cycle.notes,
        hizbCount: cycle.hizbCount,
      })
    }

    // Add adjustments with resolved surah names
    for (const adj of adjustments) {
      const dateStr = adj.date.toISOString().split('T')[0]
      if (!grouped.has(dateStr)) grouped.set(dateStr, {})
      const entry = grouped.get(dateStr)!

      const readInfo = adj.readingHizb != null ? resolveHizb(adj.readingHizb) : null
      const revInfo = adj.revisionHizb != null ? resolveHizb(adj.revisionHizb) : null

      entry._adjustment = {
        readingHizb: adj.readingHizb,
        revisionHizb: adj.revisionHizb,
        surah: adj.surahNumber,
        verse: adj.verseNumber,
        page: adj.page,
        readingSurahNameAr: readInfo?.surahNameAr || null,
        readingVerse: readInfo?.verseNumber || null,
        revisionSurahNameAr: revInfo?.surahNameAr || null,
        revisionVerse: revInfo?.verseNumber || null,
      }
    }

    // Convert to sorted array
    const log = Array.from(grouped.entries())
      .map(([date, programs]) => ({ date, programs }))
      .sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({ log })
  } catch (error) {
    console.error('Error fetching completion log:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération du journal' }, { status: 500 })
  }
}
