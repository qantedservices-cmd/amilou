const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const sessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date("2026-02-08"), lt: new Date("2026-02-09") } },
    select: { id: true, date: true, weekNumber: true, groupId: true }
  });
  for (const s of sessions) {
    console.log("id:", s.id, "date:", s.date.toISOString().slice(0,10), "weekNumber:", s.weekNumber);
  }
  await prisma.$disconnect();
})();
