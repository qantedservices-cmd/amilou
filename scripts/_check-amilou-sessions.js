const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find Amilou group
  const groups = await prisma.group.findMany({ select: { id: true, name: true } })
  console.log('Groupes:', groups.map(g => `${g.name} (${g.id})`).join(', '))

  const amilou = groups.find(g => g.name.toLowerCase().includes('amilou'))
  if (!amilou) { console.log('Groupe Amilou non trouvé'); return }

  // Get all sessions for Amilou
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: amilou.id },
    include: {
      attendance: { select: { id: true, present: true } },
      recitations: { select: { id: true, comment: true, surahNumber: true } },
    },
    orderBy: { date: 'asc' }
  })

  console.log(`\n${sessions.length} séances Amilou:\n`)
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    const presentCount = s.attendance.filter(a => a.present).length
    console.log(`  #${i+1} | ${s.date.toISOString().split('T')[0]} | sem ${s.weekNumber} | ${presentCount}/${s.attendance.length} présents | ${s.recitations.length} récitations | notes: ${s.notes ? 'oui' : 'non'} | id: ${s.id}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
