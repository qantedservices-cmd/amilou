import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  // All users with data
  const users = await prisma.user.findMany()
  console.log('=== Utilisateurs avec données ===')

  for (const u of users) {
    const att = await prisma.dailyAttendance.count({ where: { userId: u.id } })
    const prog = await prisma.progress.count({ where: { userId: u.id } })
    if (att > 0 || prog > 0) {
      console.log(`${u.name}: Attendance=${att}, Progress=${prog}`)
    }
  }

  // Check GroupMember for Montmagny
  const montmagny = await prisma.group.findFirst({ where: { name: { contains: 'Montmagny' } } })
  console.log('\n=== Groupe Montmagny ===')
  console.log('ID:', montmagny?.id)

  const members = await prisma.groupMember.findMany({
    where: { groupId: montmagny?.id },
    include: { user: true }
  })
  console.log('\nMembres:')
  for (const m of members) {
    console.log(`  ${m.user.id.substring(0,8)}... | ${m.user.name} | ${m.user.email}`)
  }

  // Check if imported data exists with different user IDs
  console.log('\n=== Tous les userId dans DailyAttendance ===')
  const attUsers = await prisma.dailyAttendance.groupBy({
    by: ['userId'],
    _count: true
  })
  for (const a of attUsers) {
    const user = await prisma.user.findUnique({ where: { id: a.userId } })
    console.log(`${user?.name || 'INCONNU'}: ${a._count} entrées`)
  }
}

check().catch(console.error).finally(() => prisma.$disconnect())
