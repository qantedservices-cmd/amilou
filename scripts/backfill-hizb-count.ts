import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillHizbCount() {
  console.log('Starting hizbCount backfill...')

  // Get the MEMORIZATION program
  const memorizationProgram = await prisma.program.findFirst({
    where: { code: 'MEMORIZATION' }
  })

  if (!memorizationProgram) {
    console.error('MEMORIZATION program not found')
    return
  }

  console.log('Found MEMORIZATION program:', memorizationProgram.id)

  // Get all revision cycles without hizbCount
  const revisionCycles = await prisma.completionCycle.findMany({
    where: {
      type: 'REVISION',
      hizbCount: null
    },
    orderBy: { completedAt: 'asc' }
  })

  console.log(`Found ${revisionCycles.length} revision cycles without hizbCount`)

  let updated = 0
  let skipped = 0

  for (const cycle of revisionCycles) {
    // Find the last memorization entry before or on the cycle completion date
    const lastMemorization = await prisma.progress.findFirst({
      where: {
        userId: cycle.userId,
        programId: memorizationProgram.id,
        date: { lte: cycle.completedAt }
      },
      orderBy: [
        { date: 'desc' },
        { surahNumber: 'desc' },
        { verseEnd: 'desc' }
      ]
    })

    if (!lastMemorization) {
      console.log(`  Cycle ${cycle.id} (${cycle.completedAt.toISOString().split('T')[0]}): No memorization data found - skipped`)
      skipped++
      continue
    }

    // Get the hizb for the last memorized verse
    const verse = await prisma.verse.findUnique({
      where: {
        surahNumber_verseNumber: {
          surahNumber: lastMemorization.surahNumber,
          verseNumber: lastMemorization.verseEnd
        }
      }
    })

    if (!verse?.hizb) {
      console.log(`  Cycle ${cycle.id}: Verse ${lastMemorization.surahNumber}:${lastMemorization.verseEnd} has no hizb data - skipped`)
      skipped++
      continue
    }

    // Round up to include the full hizb
    const hizbCount = Math.ceil(verse.hizb)

    // Update the cycle
    await prisma.completionCycle.update({
      where: { id: cycle.id },
      data: { hizbCount }
    })

    console.log(`  Cycle ${cycle.id} (${cycle.completedAt.toISOString().split('T')[0]}): Set hizbCount to ${hizbCount} (from surah ${lastMemorization.surahNumber}, verse ${lastMemorization.verseEnd})`)
    updated++
  }

  console.log('\n--- Summary ---')
  console.log(`Total cycles processed: ${revisionCycles.length}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
}

backfillHizbCount()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
