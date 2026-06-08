const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const amilou = await prisma.group.findFirst({ where: { name: { contains: 'Amilou' } } })

  const sessions = await prisma.groupSession.findMany({
    where: { groupId: amilou.id },
    include: {
      attendance: {
        include: { user: { select: { id: true, name: true } } }
      },
      recitations: { select: { id: true } },
    },
    orderBy: { date: 'asc' }
  })

  console.log(`${sessions.length} séances Amilou restantes:\n`)

  // Check for suspicious patterns: only 1 present, no recitations, no notes
  const suspicious = []
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    const presents = s.attendance.filter(a => a.present)
    const presentNames = presents.map(a => a.user.name).join(', ')
    const isSuspicious = presents.length <= 1 && s.recitations.length === 0 && !s.notes

    if (isSuspicious) {
      suspicious.push(s)
      console.log(`  *** #${i+1} | ${s.date.toISOString().split('T')[0]} | sem ${s.weekNumber} | ${presents.length}/${s.attendance.length} présents (${presentNames || 'aucun'}) | 0 récit. | SUSPECT`)
    } else {
      console.log(`      #${i+1} | ${s.date.toISOString().split('T')[0]} | sem ${s.weekNumber} | ${presents.length}/${s.attendance.length} présents | ${s.recitations.length} récit. | ${s.notes ? 'notes' : ''}`)
    }
  }

  console.log(`\n${suspicious.length} séances suspectes (≤1 présent, 0 récitations, pas de notes)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
