import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // Find all groups
  const groups = await prisma.group.findMany({
    include: {
      members: {
        include: { user: true }
      }
    }
  })

  console.log('=== Tous les groupes ===')
  for (const g of groups) {
    console.log(`\n${g.name} (${g.id}):`)
    console.log(`  Membres: ${g.members.length}`)
    for (const m of g.members) {
      console.log(`    - ${m.user.name} (${m.role})`)
    }
  }

  // Check Montmagny specifically
  const montmagny = groups.find(g => g.name.toLowerCase().includes('montmagny'))
  if (montmagny) {
    console.log('\n=== Analyse Montmagny ===')
    for (const m of montmagny.members) {
      const userId = m.userId
      
      // Check progress
      const progress = await prisma.progress.count({ where: { userId } })
      
      // Check daily completions
      const completions = await prisma.dailyProgramCompletion.count({ where: { userId } })
      
      // Check attendance
      const attendance = await prisma.dailyAttendance.count({ where: { userId } })
      
      console.log(`${m.user.name}:`)
      console.log(`  Progress: ${progress}, Completions: ${completions}, Attendance: ${attendance}`)
    }
  } else {
    console.log('\nGroupe Montmagny non trouvé')
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())
