const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const amilou = await prisma.group.findFirst({ where: { name: { contains: 'Amilou' } } })
  if (!amilou) { console.log('Groupe Amilou non trouvé'); return }

  // Get sessions from 2026 (likely auto-created)
  const sessions = await prisma.groupSession.findMany({
    where: {
      groupId: amilou.id,
      date: { gte: new Date('2026-01-01') }
    },
    include: {
      attendance: {
        include: { user: { select: { name: true } } }
      },
      recitations: true,
    },
    orderBy: { date: 'asc' }
  })

  console.log(`${sessions.length} séances Amilou depuis 2026:\n`)
  for (const s of sessions) {
    const presents = s.attendance.filter(a => a.present).map(a => a.user.name)
    console.log(`  ${s.date.toISOString().split('T')[0]} | sem ${s.weekNumber} | createdBy: ${s.createdBy}`)
    console.log(`    Présents: ${presents.length > 0 ? presents.join(', ') : 'aucun'}`)
    console.log(`    Récitations: ${s.recitations.length} | Notes: ${s.notes || 'aucune'}`)
    console.log(`    ID: ${s.id}`)
    console.log()
  }

  // Also check: who is the createdBy user?
  const creatorIds = [...new Set(sessions.map(s => s.createdBy))]
  const creators = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, name: true }
  })
  console.log('Créateurs:', creators.map(c => `${c.name} (${c.id})`).join(', '))
}

main().catch(console.error).finally(() => prisma.$disconnect())
