const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find all sessions that have recitations but where the reciting users are not marked present
  const sessions = await prisma.groupSession.findMany({
    include: {
      recitations: { select: { userId: true } },
      attendance: { select: { id: true, userId: true, present: true } }
    }
  })

  let fixedCount = 0

  for (const s of sessions) {
    // Get unique users who have recitations
    const recitingUserIds = [...new Set(s.recitations.map(r => r.userId))]

    for (const userId of recitingUserIds) {
      const att = s.attendance.find(a => a.userId === userId)

      if (att && !att.present) {
        // Mark as present
        await prisma.sessionAttendance.update({
          where: { id: att.id },
          data: { present: true }
        })
        fixedCount++
        console.log(`  Fixed: session ${s.date.toISOString().split('T')[0]} - user ${userId} marked present`)
      } else if (!att) {
        // Create attendance record
        await prisma.sessionAttendance.create({
          data: {
            sessionId: s.id,
            userId,
            present: true,
            excused: false
          }
        })
        fixedCount++
        console.log(`  Created: session ${s.date.toISOString().split('T')[0]} - attendance for user ${userId}`)
      }
    }
  }

  console.log(`\nTerminé: ${fixedCount} enregistrements de présence corrigés`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
