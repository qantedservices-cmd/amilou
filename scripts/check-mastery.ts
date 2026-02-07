import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const total = await prisma.surahMastery.count()
  console.log('Total SurahMastery:', total)

  const montmagny = await prisma.group.findFirst({ where: { name: { contains: 'Montmagny' } } })
  const members = await prisma.groupMember.findMany({
    where: { groupId: montmagny?.id, role: 'MEMBER' },
    include: { user: { select: { id: true, name: true } } }
  })

  console.log('\nMembres MEMBER Montmagny:', members.length)

  const memberIds = members.map(m => m.userId)
  const masteryCount = await prisma.surahMastery.count({
    where: { userId: { in: memberIds } }
  })
  console.log('SurahMastery pour ces membres:', masteryCount)

  const examples = await prisma.surahMastery.findMany({
    where: { userId: { in: memberIds } },
    take: 10,
    include: { user: { select: { name: true } } }
  })
  console.log('\nExemples:')
  examples.forEach(e => console.log('  ' + e.user.name + ' - Sourate ' + e.surahNumber + ': ' + e.status))
}

check().catch(console.error).finally(() => prisma.$disconnect())
