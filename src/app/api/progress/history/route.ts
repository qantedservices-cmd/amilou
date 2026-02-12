import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const userId = effectiveUserId!

    const { searchParams } = new URL(request.url)
    const surahNumber = parseInt(searchParams.get('surahNumber') || '0')
    const programCode = searchParams.get('program') || 'MEMORIZATION'

    if (!surahNumber) {
      return NextResponse.json({ error: 'surahNumber requis' }, { status: 400 })
    }

    const program = await prisma.program.findFirst({
      where: { code: programCode },
    })

    if (!program) {
      return NextResponse.json({ entries: [] })
    }

    const entries = await prisma.progress.findMany({
      where: {
        userId,
        surahNumber,
        programId: program.id,
      },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        verseStart: true,
        verseEnd: true,
      },
    })

    const surah = await prisma.surah.findUnique({
      where: { number: surahNumber },
    })

    return NextResponse.json({
      entries: entries.map((e) => ({
        date: e.date.toISOString(),
        description: `Versets ${e.verseStart}–${e.verseEnd} (${surah?.nameFr || `Sourate ${surahNumber}`})`,
        verseStart: e.verseStart,
        verseEnd: e.verseEnd,
      })),
    })
  } catch (error) {
    console.error('Error fetching progress history:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    )
  }
}
