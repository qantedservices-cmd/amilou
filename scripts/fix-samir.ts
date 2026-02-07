import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function fix() {
  const samir = await prisma.user.findFirst({ where: { name: 'Samir' } })
  if (!samir) {
    console.log('Samir non trouvé')
    return
  }
  console.log('Samir ID:', samir.id)

  const members = await prisma.groupMember.findMany({
    where: { userId: samir.id },
    include: { group: true }
  })
  console.log('\nGroupes de Samir:')
  members.forEach(m => console.log('  ' + m.group.name + ': ' + m.role))

  // Check source of Progress entries
  const progress = await prisma.progress.findMany({
    where: { userId: samir.id },
    take: 10,
    orderBy: { date: 'desc' }
  })
  console.log('\nDerniers Progress de Samir:')
  progress.forEach(p => {
    console.log('  ' + p.date.toISOString().split('T')[0] + ' | ' + (p.comment || 'saisie manuelle'))
  })

  // Count by comment type
  const imported = await prisma.progress.count({
    where: { userId: samir.id, comment: { startsWith: 'Import' } }
  })
  const manual = await prisma.progress.count({
    where: { userId: samir.id, OR: [{ comment: null }, { comment: { not: { startsWith: 'Import' } } }] }
  })
  console.log('\nRépartition:')
  console.log('  Importés:', imported)
  console.log('  Manuels:', manual)
}

fix().catch(console.error).finally(() => prisma.$disconnect())
