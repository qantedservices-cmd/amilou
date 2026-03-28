import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'
import { getMemorizedZone } from '@/lib/quran-utils'

// GET — Get all verses of a surah with user's positions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ surahNumber: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    const targetUserId = userId || session.user.id
    const { surahNumber: surahParam } = await params
    const surahNumber = parseInt(surahParam)

    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return NextResponse.json({ error: 'Numéro de sourate invalide' }, { status: 400 })
    }

    const [surah, verses, user, zone, mastery] = await Promise.all([
      prisma.surah.findUnique({ where: { number: surahNumber } }),
      prisma.verse.findMany({
        where: { surahNumber, textAr: { not: null } },
        orderBy: { verseNumber: 'asc' },
        select: { verseNumber: true, textAr: true, page: true, juz: true, hizb: true }
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          readingCurrentHizb: true,
          revisionCurrentHizb: true,
          memorizationStartSurah: true,
          memorizationStartVerse: true,
          memorizationDirection: true,
        }
      }),
      getMemorizedZone(targetUserId),
      prisma.surahMastery.findUnique({
        where: { userId_surahNumber: { userId: targetUserId, surahNumber } }
      })
    ])

    if (!surah) {
      return NextResponse.json({ error: 'Sourate non trouvée' }, { status: 404 })
    }

    // Find which verses are in the memorized zone
    const memorizedVerses = new Set<number>()
    if (zone) {
      for (const v of verses) {
        if (v.hizb != null && v.hizb >= zone.startHizb && v.hizb <= zone.endHizb) {
          memorizedVerses.add(v.verseNumber)
        }
      }
    }

    // Find reading and revision positions in this surah
    let readingVerse: number | null = null
    let revisionVerse: number | null = null

    if (user) {
      const readingHizb = user.readingCurrentHizb ?? 0
      const revisionHizb = user.revisionCurrentHizb ?? 0

      if (readingHizb > 0) {
        const readingAbsoluteHizb = readingHizb + 1 // next position
        for (const v of verses) {
          if (v.hizb != null && Math.abs(v.hizb - readingAbsoluteHizb) < 0.5) {
            readingVerse = v.verseNumber
            break
          }
        }
      }

      if (revisionHizb > 0 && zone) {
        const revisionAbsoluteHizb = zone.startHizb + revisionHizb
        for (const v of verses) {
          if (v.hizb != null && Math.abs(v.hizb - revisionAbsoluteHizb) < 0.5) {
            revisionVerse = v.verseNumber
            break
          }
        }
      }
    }

    return NextResponse.json({
      surah: {
        number: surah.number,
        nameAr: surah.nameAr,
        nameFr: surah.nameFr,
        nameEn: surah.nameEn,
        totalVerses: surah.totalVerses,
        revelationType: surah.revelationType,
        mastery: mastery?.status || null,
      },
      verses: verses.map(v => ({
        number: v.verseNumber,
        textAr: v.textAr,
        page: v.page,
        juz: v.juz,
        hizb: v.hizb,
        isMemorized: memorizedVerses.has(v.verseNumber),
      })),
      positions: {
        readingVerse,
        revisionVerse,
      },
      memorizedZone: zone,
    })
  } catch (error) {
    console.error('Error fetching surah:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la sourate' },
      { status: 500 }
    )
  }
}
