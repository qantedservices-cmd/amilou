import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Get Mohamed Koucha
  const user = await prisma.user.findFirst({ where: { name: { contains: 'Koucha' } } })
  console.log('User:', user?.name, user?.id)

  // Period: year 2026
  const periodStart = new Date('2026-01-01')
  const now = new Date()

  const totalDays = Math.ceil((now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000))
  console.log('Période: 2026-01-01 à', now.toISOString().split('T')[0])
  console.log('Nombre total de jours:', totalDays)

  // Get completions for 2026
  const completions = await prisma.dailyProgramCompletion.findMany({
    where: {
      userId: user!.id,
      date: { gte: periodStart },
      completed: true
    },
    include: { program: true }
  })

  console.log('Nombre de completions 2026:', completions.length)

  // Group by program
  const byProgram: Record<string, Set<string>> = {}
  for (const c of completions) {
    const code = c.program.code
    if (!byProgram[code]) byProgram[code] = new Set()
    byProgram[code].add(c.date.toISOString().split('T')[0])
  }

  console.log('\nPar programme:')
  const programs = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING', 'TAFSIR']
  let totalRate = 0
  for (const code of programs) {
    const count = byProgram[code]?.size || 0
    const rate = Math.round((count / totalDays) * 100)
    totalRate += rate
    console.log(`  ${code}: ${count} jours sur ${totalDays} = ${rate}%`)
  }
  console.log(`\nMoyenne: ${Math.round(totalRate / programs.length)}%`)

  // Show the dates
  console.log('\nDates par programme:')
  for (const [code, dates] of Object.entries(byProgram)) {
    console.log(`  ${code}:`, Array.from(dates).sort().join(', '))
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())
