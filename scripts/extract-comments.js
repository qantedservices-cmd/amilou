const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const recitations = await prisma.surahRecitation.findMany({
    where: { comment: { not: null } },
    include: {
      session: { include: { group: { select: { name: true } } } },
      user: { select: { name: true } },
      surah: { select: { nameFr: true, nameAr: true, totalVerses: true } }
    },
    orderBy: [{ session: { date: "asc" } }, { userId: "asc" }]
  });
  const bySession = {};
  for (const r of recitations) {
    const key = r.sessionId;
    if (bySession[key] === undefined) {
      bySession[key] = {
        group: r.session.group.name,
        date: r.session.date,
        weekNumber: r.session.weekNumber,
        comments: []
      };
    }
    bySession[key].comments.push({
      user: r.user.name,
      surah: r.surahNumber + ". " + r.surah.nameFr,
      comment: r.comment.replace(/<[^>]*>/g, ""),
      versets: r.verseStart + "-" + r.verseEnd
    });
  }
  const allSessions = await prisma.groupSession.findMany({
    orderBy: { date: "asc" },
    select: { id: true, groupId: true }
  });
  const counters = {};
  const sessionNumMap = {};
  for (const s of allSessions) {
    counters[s.groupId] = (counters[s.groupId] || 0) + 1;
    sessionNumMap[s.id] = counters[s.groupId];
  }
  for (const [sid, data] of Object.entries(bySession)) {
    const num = sessionNumMap[sid] || "?";
    const dateStr = new Date(data.date).toLocaleDateString("fr-FR");
    console.log("=== Seance " + num + " - " + data.group + " (" + dateStr + ") ===");
    for (const c of data.comments) {
      console.log("  " + c.user + " | " + c.surah + " | v." + c.versets + " | " + c.comment);
    }
    console.log("");
  }
  await prisma.$disconnect();
})();
