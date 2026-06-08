import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function debug() {
  // Find Famille group
  const groups = await prisma.group.findMany()
  console.log('All groups:')
  groups.forEach(g => console.log('  -', g.id, g.name))

  const familleGroup = await prisma.group.findFirst({
    where: { name: { contains: 'Famille' } }
  })
  console.log('\nFamille group:', familleGroup)

  if (familleGroup) {
    // Get members
    const members = await prisma.groupMember.findMany({
      where: { groupId: familleGroup.id },
      include: { user: { select: { id: true, name: true, role: true } } }
    })
    console.log('\nMembers:')
    members.forEach(m => console.log('  -', m.user.name, '- GroupMember role:', m.role, '- User role:', m.user.role))

    // Check sessions
    const sessions = await prisma.groupSession.findMany({
      where: { groupId: familleGroup.id }
    })
    console.log('\nSessions:', sessions.length)
  }
}

debug().catch(console.error).finally(() => prisma.$disconnect())
