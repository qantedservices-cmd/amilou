import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Get all completions
  const completions = await prisma.dailyProgramCompletion.findMany({
    include: { program: true, user: true }
  })
  console.log('Total completions en base:', completions.length)

  if (completions.length > 0) {
    console.log('Exemples:', completions.slice(0, 5).map(c => ({
      user: c.user.name,
      program: c.program.code,
      date: c.date,
      completed: c.completed
    })))
  }

  // Check all users
  const users = await prisma.user.findMany({ select: { id: true, name: true } })
  console.log('\nUtilisateurs:', users.map(u => u.name))

  // Check DailyAttendance (old system?)
  const attendance = await prisma.dailyAttendance.findMany({ take: 5 })
  console.log('\nDailyAttendance count:', await prisma.dailyAttendance.count())
}

check().catch(console.error).finally(() => prisma.$disconnect())
