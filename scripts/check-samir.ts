import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Get Samir
  const user = await prisma.user.findFirst({ where: { name: { contains: 'Samir' } } })
  console.log('User:', user?.name, user?.id)

  // Check DailyAttendance (imported from Forms)
  const attendance = await prisma.dailyAttendance.findMany({
    where: { userId: user!.id },
    orderBy: { date: 'asc' }
  })

  console.log('\n=== DailyAttendance (import Forms) ===')
  console.log('Nombre d\'entrées:', attendance.length)
  if (attendance.length > 0) {
    console.log('Première date:', attendance[0].date.toISOString().split('T')[0])
    console.log('Dernière date:', attendance[attendance.length - 1].date.toISOString().split('T')[0])
  }

  // Check DailyProgramCompletion
  const completions = await prisma.dailyProgramCompletion.findMany({
    where: { userId: user!.id, completed: true },
    orderBy: { date: 'asc' }
  })

  console.log('\n=== DailyProgramCompletion ===')
  console.log('Nombre d\'entrées:', completions.length)
  if (completions.length > 0) {
    console.log('Première date:', completions[0].date.toISOString().split('T')[0])
    console.log('Dernière date:', completions[completions.length - 1].date.toISOString().split('T')[0])
  }

  // Find adoption date (earliest of both)
  let adoptionDate: Date | null = null
  if (attendance.length > 0) {
    adoptionDate = attendance[0].date
  }
  if (completions.length > 0) {
    if (!adoptionDate || completions[0].date < adoptionDate) {
      adoptionDate = completions[0].date
    }
  }

  console.log('\n=== Date d\'adoption ===')
  console.log('Date:', adoptionDate?.toISOString().split('T')[0] || 'Aucune donnée')

  // Calculate what the rate should be
  if (adoptionDate) {
    const now = new Date()
    const daysSinceAdoption = Math.ceil((now.getTime() - adoptionDate.getTime()) / (24 * 60 * 60 * 1000))
    console.log('Jours depuis adoption:', daysSinceAdoption)

    // Count unique days with completions
    const uniqueDays = new Set<string>()
    for (const c of completions) {
      uniqueDays.add(c.date.toISOString().split('T')[0])
    }
    console.log('Jours avec completions:', uniqueDays.size)
    console.log('Taux corrigé:', Math.round((uniqueDays.size / daysSinceAdoption) * 100) + '%')
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())
