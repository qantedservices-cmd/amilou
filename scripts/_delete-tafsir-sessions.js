const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const SESSION_IDS = [
  'cml619l2x00fsup4auv99dk8z',  // 2026-01-17
  'cml619leh00g1up4ac4ose6en',  // 2026-01-24
  'cml619lrw00gaup4aicxqvgw3',  // 2026-01-25
  'cml63qm7j0001l2ibuhuzo6ls',  // 2026-02-01
]

async function main() {
  for (const id of SESSION_IDS) {
    // Delete attendance records first (foreign key)
    const deletedAttendance = await prisma.sessionAttendance.deleteMany({
      where: { sessionId: id }
    })
    console.log(`Session ${id}: ${deletedAttendance.count} présences supprimées`)

    // Delete recitations (should be 0 but just in case)
    const deletedRecitations = await prisma.surahRecitation.deleteMany({
      where: { sessionId: id }
    })
    if (deletedRecitations.count > 0) {
      console.log(`  ${deletedRecitations.count} récitations supprimées`)
    }

    // Delete the session
    await prisma.groupSession.delete({ where: { id } })
    console.log(`  Session supprimée`)
  }

  console.log(`\nTerminé: ${SESSION_IDS.length} séances supprimées`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
