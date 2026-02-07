import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function check() {
  const m = await prisma.group.findFirst({ where: { name: { contains: "Montmagny" } } })
  const sessions = await prisma.groupSession.count({ where: { groupId: m?.id } })
  const recitations = await prisma.surahRecitation.count({ where: { session: { groupId: m?.id } } })
  const attendances = await prisma.sessionAttendance.count({ where: { session: { groupId: m?.id } } })
  console.log("Sessions:", sessions, "| Recitations:", recitations, "| Attendances:", attendances)
}
check().finally(() => prisma.$disconnect())
