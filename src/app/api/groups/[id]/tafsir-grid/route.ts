import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id: groupId } = await params

    // Get all sessions for this group
    const sessions = await prisma.groupSession.findMany({
      where: { groupId },
      orderBy: { date: 'asc' },
      select: { id: true, weekNumber: true, tafsirEntries: true },
    })

    // Get all 114 surahs
    const surahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' },
      select: { number: true, nameAr: true, nameFr: true, totalVerses: true },
    })

    // Build coverage per surah
    const coverage: Record<number, {
      tafsir: { verseStart: number; verseEnd: number; sessionNumber: number }[]
      sens: { verseStart: number; verseEnd: number; sessionNumber: number }[]
    }> = {}

    for (const surah of surahs) {
      coverage[surah.number] = { tafsir: [], sens: [] }
    }

    for (const sess of sessions) {
      const entries = (sess.tafsirEntries as any[]) || []
      for (const entry of entries) {
        if (!entry.surahNumber || !coverage[entry.surahNumber]) continue
        const target = entry.type === 'TAFSIR' ? coverage[entry.surahNumber].tafsir : coverage[entry.surahNumber].sens
        target.push({
          verseStart: entry.verseStart,
          verseEnd: entry.verseEnd,
          sessionNumber: sess.weekNumber || 0,
        })
      }
    }

    // Calculate unique verses covered per surah per type
    const grid = surahs.map(surah => {
      const cov = coverage[surah.number]

      const tafsirVerses = new Set<number>()
      for (const entry of cov.tafsir) {
        for (let v = entry.verseStart; v <= entry.verseEnd; v++) tafsirVerses.add(v)
      }

      const sensVerses = new Set<number>()
      for (const entry of cov.sens) {
        for (let v = entry.verseStart; v <= entry.verseEnd; v++) sensVerses.add(v)
      }

      return {
        surahNumber: surah.number,
        nameAr: surah.nameAr,
        nameFr: surah.nameFr,
        totalVerses: surah.totalVerses,
        tafsirCovered: tafsirVerses.size,
        tafsirComplete: tafsirVerses.size >= surah.totalVerses,
        tafsirRange: cov.tafsir.length > 0 ? `v.${Math.min(...cov.tafsir.map(e => e.verseStart))}-${Math.max(...cov.tafsir.map(e => e.verseEnd))}` : null,
        sensCovered: sensVerses.size,
        sensComplete: sensVerses.size >= surah.totalVerses,
        sensRange: cov.sens.length > 0 ? `v.${Math.min(...cov.sens.map(e => e.verseStart))}-${Math.max(...cov.sens.map(e => e.verseEnd))}` : null,
      }
    })

    return NextResponse.json({ grid })
  } catch (error) {
    console.error('Error fetching tafsir grid:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
