const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sunday
  d.setDate(d.getDate() - day);
  return d;
}

(async () => {
  const groups = await prisma.group.findMany({ select: { id: true, name: true } });

  for (const group of groups) {
    console.log(`\n=== ${group.name} ===`);

    const sessions = await prisma.groupSession.findMany({
      where: { groupId: group.id },
      orderBy: { date: "asc" },
      include: {
        _count: { select: { recitations: true, attendance: true } }
      }
    });

    // Group sessions by week (Sunday start)
    const byWeek = {};
    for (const s of sessions) {
      const weekKey = getWeekStart(s.date).toISOString().slice(0, 10);
      if (!byWeek[weekKey]) byWeek[weekKey] = [];
      byWeek[weekKey].push(s);
    }

    for (const [weekKey, weekSessions] of Object.entries(byWeek)) {
      if (weekSessions.length <= 1) continue;

      console.log(`\n  Week ${weekKey}: ${weekSessions.length} sessions (DUPLICATES)`);
      for (const s of weekSessions) {
        console.log(`    - ${s.id} | ${s.date.toISOString().slice(0, 10)} | week ${s.weekNumber} | ${s._count.recitations} recitations | ${s._count.attendance} attendance`);
      }

      // Keep the session with the most recitations (and attendance as tiebreaker)
      weekSessions.sort((a, b) => {
        const diff = b._count.recitations - a._count.recitations;
        if (diff !== 0) return diff;
        return b._count.attendance - a._count.attendance;
      });

      const keeper = weekSessions[0];
      const toDelete = weekSessions.slice(1);

      console.log(`    KEEP: ${keeper.id} (${keeper._count.recitations} recitations)`);

      for (const dup of toDelete) {
        // Move recitations from dup to keeper
        if (dup._count.recitations > 0) {
          const moved = await prisma.surahRecitation.updateMany({
            where: { sessionId: dup.id },
            data: { sessionId: keeper.id }
          });
          console.log(`    MOVED ${moved.count} recitations from ${dup.id} to ${keeper.id}`);
        }

        // Move attendance from dup to keeper (skip if conflict)
        if (dup._count.attendance > 0) {
          const attendances = await prisma.sessionAttendance.findMany({
            where: { sessionId: dup.id }
          });
          for (const att of attendances) {
            const existing = await prisma.sessionAttendance.findFirst({
              where: { sessionId: keeper.id, userId: att.userId }
            });
            if (!existing) {
              await prisma.sessionAttendance.update({
                where: { id: att.id },
                data: { sessionId: keeper.id }
              });
            } else {
              await prisma.sessionAttendance.delete({ where: { id: att.id } });
            }
          }
          console.log(`    MOVED/MERGED attendance from ${dup.id}`);
        }

        // Copy session-report fields if keeper doesn't have them
        const updates = {};
        if (!keeper.nextSurahNumber && dup.nextSurahNumber) updates.nextSurahNumber = dup.nextSurahNumber;
        if (!keeper.homework && dup.homework) updates.homework = dup.homework;
        if (!keeper.sessionTopics && dup.sessionTopics) updates.sessionTopics = dup.sessionTopics;
        if (Object.keys(updates).length > 0) {
          await prisma.groupSession.update({ where: { id: keeper.id }, data: updates });
          console.log(`    COPIED report fields to keeper`);
        }

        // Delete the duplicate
        await prisma.groupSession.delete({ where: { id: dup.id } });
        console.log(`    DELETED duplicate ${dup.id}`);
      }
    }

    // Print final state
    const finalSessions = await prisma.groupSession.findMany({
      where: { groupId: group.id },
      orderBy: { date: "asc" },
      include: { _count: { select: { recitations: true } } }
    });
    console.log(`\n  Final sessions for ${group.name}:`);
    finalSessions.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.date.toISOString().slice(0, 10)} | week ${s.weekNumber} | ${s._count.recitations} recitations`);
    });
  }

  await prisma.$disconnect();
  console.log("\nDone.");
})();
