import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  // Get a user
  const user = await prisma.user.findFirst()
  console.log('User:', user?.name)

  // Period: year 2026
  const periodStart = new Date('2026-01-01')
  const periodEnd = new Date('2026-12-31')
  const now = new Date()
  const actualEnd = now < periodEnd ? now : periodEnd

  const totalDays = Math.ceil((actualEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000))
  console.log('Période: 2026-01-01 à', actualEnd.toISOString().split('T')[0])
  console.log('Nombre total de jours:', totalDays)

  // Get completions
  const completions = await prisma.dailyProgramCompletion.findMany({
    where: {
      userId: user!.id,
      date: { gte: periodStart, lt: actualEnd },
      completed: true
    },
    include: { program: true }
  })

  console.log('Nombre de completions:', completions.length)

  // Group by program
  const byProgram: Record<string, Set<string>> = {}
  for (const c of completions) {
    const code = c.program.code
    if (!byProgram[code]) byProgram[code] = new Set()
    byProgram[code].add(c.date.toISOString().split('T')[0])
  }

  console.log('\nPar programme:')
  for (const [code, dates] of Object.entries(byProgram)) {
    const count = dates.size
    const rate = Math.round((count / totalDays) * 100)
    console.log(`  ${code}: ${count} jours sur ${totalDays} = ${rate}%`)
  }

  // Average
  const programs = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING', 'TAFSIR']
  let totalRate = 0
  for (const code of programs) {
    const count = byProgram[code]?.size || 0
    totalRate += Math.round((count / totalDays) * 100)
  }
  console.log(`\nMoyenne: ${Math.round(totalRate / programs.length)}%`)
}

check().catch(console.error).finally(() => prisma.$disconnect())
