import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Get Mohamed Koucha
  const user = await prisma.user.findFirst({ where: { name: { contains: 'Koucha' } } })
  console.log('User:', user?.name)

  // Check old DailyAttendance system
  const attendance = await prisma.dailyAttendance.findMany({
    where: { userId: user!.id },
    orderBy: { date: 'asc' }
  })

  console.log('\n=== Ancien système DailyAttendance ===')
  console.log('Nombre dentrées:', attendance.length)

  if (attendance.length > 0) {
    for (const a of attendance) {
      const days = [a.sunday, a.monday, a.tuesday, a.wednesday, a.thursday, a.friday, a.saturday]
      const total = days.reduce((s, d) => s + d, 0)
      console.log(`  ${a.date.toISOString().split('T')[0]}: ${days.join(', ')} (total: ${total}/35)`)
    }
  }

  // Check what year the completions belong to
  console.log('\n=== Nouveau système DailyProgramCompletion ===')
  const byYear = await prisma.dailyProgramCompletion.groupBy({
    by: ['date'],
    where: { userId: user!.id, completed: true },
  })

  const years: Record<string, number> = {}
  for (const entry of byYear) {
    const year = entry.date.getFullYear().toString()
    years[year] = (years[year] || 0) + 1
  }
  console.log('Par année:', years)
}

check().catch(console.error).finally(() => prisma.$disconnect())
