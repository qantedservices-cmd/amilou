import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Get Mohamed Koucha
  const user = await prisma.user.findFirst({ where: { name: { contains: 'Koucha' } } })
  console.log('User:', user?.name)

  // All completions (global period)
  const completions = await prisma.dailyProgramCompletion.findMany({
    where: {
      userId: user!.id,
      completed: true
    },
    include: { program: true },
    orderBy: { date: 'asc' }
  })

  console.log('Total completions:', completions.length)

  if (completions.length > 0) {
    const firstDate = completions[0].date
    const lastDate = completions[completions.length - 1].date
    console.log('Première date:', firstDate.toISOString().split('T')[0])
    console.log('Dernière date:', lastDate.toISOString().split('T')[0])

    // Calculate total days from first to now
    const now = new Date()
    const totalDays = Math.ceil((now.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000))
    console.log('Jours depuis le début:', totalDays)

    // Group by program
    const byProgram: Record<string, Set<string>> = {}
    for (const c of completions) {
      const code = c.program.code
      if (!byProgram[code]) byProgram[code] = new Set()
      byProgram[code].add(c.date.toISOString().split('T')[0])
    }

    console.log('\nPar programme (global):')
    const programs = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING', 'TAFSIR']
    let totalRate = 0
    for (const code of programs) {
      const count = byProgram[code]?.size || 0
      const rate = Math.round((count / totalDays) * 100)
      totalRate += rate
      console.log(`  ${code}: ${count} jours sur ${totalDays} = ${rate}%`)
    }
    console.log(`\nMoyenne: ${Math.round(totalRate / programs.length)}%`)
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())
