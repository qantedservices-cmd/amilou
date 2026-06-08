const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  // Fix Montmagny sessions with wrong week numbers
  // Feb 8, 2026 (Sunday) = week 6 (ISO: Feb 2 - Feb 8)
  const feb8 = await prisma.groupSession.findMany({
    where: { date: { gte: new Date("2026-02-08"), lt: new Date("2026-02-09") } },
    select: { id: true, date: true, weekNumber: true }
  });
  for (const s of feb8) {
    console.log("Session Feb 8:", s.id, "week", s.weekNumber);
    await prisma.groupSession.update({ where: { id: s.id }, data: { weekNumber: 6 } });
    console.log("  -> updated to week 6");
  }

  // Feb 7, 2026 (Saturday) = still week 5 (Feb 1-7)
  const feb7 = await prisma.groupSession.findMany({
    where: { date: { gte: new Date("2026-02-07"), lt: new Date("2026-02-08") } },
    select: { id: true, date: true, weekNumber: true }
  });
  for (const s of feb7) {
    console.log("Session Feb 7:", s.id, "week", s.weekNumber);
    await prisma.groupSession.update({ where: { id: s.id }, data: { weekNumber: 5 } });
    console.log("  -> updated to week 5");
  }

  await prisma.$disconnect();
  console.log("Done.");
})();
