import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

// GET — List all 114 surahs with user's mastery status
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    const targetUserId = userId || session.user.id

    const [surahs, masteries] = await Promise.all([
      prisma.surah.findMany({ orderBy: { number: 'asc' } }),
      prisma.surahMastery.findMany({
        where: { userId: targetUserId },
        select: { surahNumber: true, status: true }
      })
    ])

    const masteryMap = new Map(masteries.map(m => [m.surahNumber, m.status]))

    const result = surahs.map(s => ({
      number: s.number,
      nameAr: s.nameAr,
      nameFr: s.nameFr,
      nameEn: s.nameEn,
      totalVerses: s.totalVerses,
      revelationType: s.revelationType,
      mastery: masteryMap.get(s.number) || null
    }))

    return NextResponse.json({ surahs: result })
  } catch (error) {
    console.error('Error fetching surahs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sourates' },
      { status: 500 }
    )
  }
}
