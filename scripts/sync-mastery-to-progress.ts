/**
 * Sync SurahMastery data to Progress table for dashboard display
 *
 * This script converts validated SurahMastery entries (status V, X, or percentages)
 * into Progress entries so they appear in the dashboard statistics.
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sync-mastery-to-progress.ts
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Sync SurahMastery → Progress\n')

  // 1. Get all SurahMastery entries with validated status
  const masteryEntries = await prisma.surahMastery.findMany({
    where: {
      OR: [
        { status: 'V' },        // Validated
        { status: 'X' },        // Known (supposé connu)
        { status: '50%' },      // Partial knowledge
        { status: '51%' },
        { status: '90%' },
      ]
    },
    include: {
      surah: true,
      user: true
    }
  })

  console.log(`📊 ${masteryEntries.length} entrées SurahMastery à synchroniser\n`)

  // 2. Get MEMORIZATION program
  const memorizationProgram = await prisma.program.findFirst({
    where: { code: 'MEMORIZATION' }
  })

  if (!memorizationProgram) {
    console.error('❌ Programme MEMORIZATION non trouvé')
    return
  }

  // 3. Process each mastery entry
  let created = 0
  let skipped = 0

  for (const mastery of masteryEntries) {
    // Check if Progress already exists for this user/surah
    const existing = await prisma.progress.findFirst({
      where: {
        userId: mastery.userId,
        surahNumber: mastery.surahNumber,
        programId: memorizationProgram.id
      }
    })

    if (existing) {
      skipped++
      continue
    }

    // Determine verse range based on status
    let verseStart = mastery.verseStart || 1
    let verseEnd = mastery.verseEnd || mastery.surah.totalVerses

    // For partial statuses, calculate verse range
    if (mastery.status === '50%' || mastery.status === '51%') {
      verseEnd = Math.ceil(mastery.surah.totalVerses * 0.5)
    } else if (mastery.status === '90%') {
      verseEnd = Math.ceil(mastery.surah.totalVerses * 0.9)
    }

    // Create Progress entry
    const progressDate = mastery.validatedAt || mastery.createdAt

    await prisma.progress.create({
      data: {
        id: randomUUID(),
        userId: mastery.userId,
        surahNumber: mastery.surahNumber,
        programId: memorizationProgram.id,
        verseStart,
        verseEnd,
        date: progressDate,
        comment: `Import depuis SurahMastery (${mastery.status})`,
        createdBy: mastery.userId,
        updatedAt: new Date()
      }
    })

    created++
    console.log(`  ✅ ${mastery.user.name}: Sourate ${mastery.surahNumber} (${mastery.status})`)
  }

  console.log(`\n✨ Synchronisation terminée!`)
  console.log(`📊 Résumé:`)
  console.log(`   - ${created} entrées Progress créées`)
  console.log(`   - ${skipped} entrées déjà existantes (ignorées)`)

  // 4. Show summary by user
  console.log('\n📊 Résumé par utilisateur:')
  const progressByUser = await prisma.progress.groupBy({
    by: ['userId'],
    _count: true
  })

  for (const p of progressByUser) {
    const user = await prisma.user.findUnique({ where: { id: p.userId } })
    if (user) {
      console.log(`   ${user.name}: ${p._count} entrées Progress`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
