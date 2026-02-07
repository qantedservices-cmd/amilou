import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Check all tables for any Montmagny-related data
  console.log('=== Recherche exhaustive ===\n')

  // Progress par utilisateur
  const progressByUser = await prisma.progress.groupBy({
    by: ['userId'],
    _count: true
  })
  console.log('Progress par userId:')
  for (const p of progressByUser) {
    const user = await prisma.user.findUnique({ where: { id: p.userId } })
    console.log(`  ${user?.name}: ${p._count}`)
  }

  // DailyProgramCompletion par utilisateur
  const completionsByUser = await prisma.dailyProgramCompletion.groupBy({
    by: ['userId'],
    _count: true
  })
  console.log('\nDailyProgramCompletion par userId:')
  for (const c of completionsByUser) {
    const user = await prisma.user.findUnique({ where: { id: c.userId } })
    console.log(`  ${user?.name}: ${c._count}`)
  }

  // Check createdBy field - maybe imports used a different field
  console.log('\n=== createdBy dans Progress ===')
  const createdByProgress = await prisma.progress.groupBy({
    by: ['createdBy'],
    _count: true
  })
  for (const c of createdByProgress) {
    console.log(`  ${c.createdBy}: ${c._count}`)
  }

  // Check if there are any orphaned records
  console.log('\n=== Emails des membres Montmagny ===')
  const montmagny = await prisma.group.findFirst({
    where: { name: { contains: 'Montmagny' } },
    include: { members: { include: { user: true } } }
  })
  for (const m of montmagny?.members || []) {
    console.log(`  ${m.user.email}`)
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())
