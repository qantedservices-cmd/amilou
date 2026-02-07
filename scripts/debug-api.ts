import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function debug() {
  const groupId = 'cml308ot60000dvh9r83thotk' // Montmagny

  // Get members with MEMBER role
  const members = await prisma.groupMember.findMany({
    where: { groupId, role: 'MEMBER' },
    include: { user: { select: { id: true, name: true } } }
  })
  console.log('Members:', members.length)

  // Get member IDs
  const memberIds = members.map(m => m.userId)
  console.log('Member IDs:', memberIds.length)

  // Get mastery data
  const masteryData = await prisma.surahMastery.findMany({
    where: { userId: { in: memberIds } }
  })
  console.log('Mastery entries:', masteryData.length)

  // Get surahs with data
  const surahsWithData = new Set<number>()
  for (const m of masteryData) {
    surahsWithData.add(m.surahNumber)
  }
  console.log('Surahs with data:', surahsWithData.size)
  console.log('Surah numbers:', Array.from(surahsWithData).sort((a,b) => a-b).join(', '))
}

debug().catch(console.error).finally(() => prisma.$disconnect())
