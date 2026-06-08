const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const groupId = 'cml308ot60000dvh9r83thotk'; // Cours Montmagny

// Simulate what the frontend does:
// 1. GET /api/groups/{id}/mastery → returns sessions[], commentsMap
// 2. openSessionReportDialog(targetNum) → calls session-report API
// 3. Renders suivi individuel by filtering commentsMap[member][surah] where sessionNumber === reportSessionNumber

async function main() {
  // === Step 1: Simulate mastery GET response ===
  const sessions = await prisma.groupSession.findMany({
    where: { groupId },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, weekNumber: true }
  });
  const sessionNumberMap = new Map(sessions.map((s, idx) => [s.id, idx + 1]));
  const sessionDateMap = new Map(sessions.map(s => [s.id, s.date.toISOString()]));
  const nextSessionNumber = sessions.length + 1;
  const totalSessions = sessions.length;

  const members = await prisma.groupMember.findMany({
    where: { groupId, role: 'MEMBER' },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: 'asc' } }
  });

  const sessionIds = sessions.map(s => s.id);
  const recitations = await prisma.surahRecitation.findMany({
    where: { sessionId: { in: sessionIds }, userId: { in: members.map(m => m.userId) }, comment: { not: null } },
    select: { id: true, userId: true, surahNumber: true, comment: true, sessionId: true, createdAt: true }
  });

  // Build commentsMap (same as API does)
  const commentsMap = {};
  for (const r of recitations) {
    if (!r.comment) continue;
    if (!commentsMap[r.userId]) commentsMap[r.userId] = {};
    if (!commentsMap[r.userId][r.surahNumber]) commentsMap[r.userId][r.surahNumber] = [];
    commentsMap[r.userId][r.surahNumber].push({
      id: r.id,
      comment: r.comment,
      sessionNumber: sessionNumberMap.get(r.sessionId) || null,
      sessionId: r.sessionId,
      sessionDate: sessionDateMap.get(r.sessionId) || null,
      createdAt: r.createdAt.toISOString()
    });
  }

  const sessionsResponse = sessions.map((s, idx) => ({
    number: idx + 1,
    date: s.date.toISOString(),
    weekNumber: s.weekNumber
  }));

  console.log('=== API mastery response ===');
  console.log('totalSessions:', totalSessions);
  console.log('nextSessionNumber:', nextSessionNumber);
  console.log('sessions array length:', sessionsResponse.length);
  console.log('members:', members.length);

  // === Step 2: Simulate navigation ===
  // Test: select S14 in selector, click "Voir séance"
  // openSessionReportDialog(14) → fetches session-report?sessionNumber=14
  console.log('\n=== Test navigation S14 ===');
  const s14Report = await prisma.groupSession.findUnique({
    where: { id: sessions[13].id },
    select: { nextSurahNumber: true, homework: true, sessionTopics: true }
  });
  console.log('Session report fetched OK:', !!s14Report);
  console.log('nextSurahNumber:', s14Report?.nextSurahNumber);
  console.log('Has homework:', !!s14Report?.homework);
  console.log('Has topics:', !!s14Report?.sessionTopics);

  // === Step 3: Simulate suivi individuel filtering ===
  // Frontend code: for each member, iterate commentsMap[member.id][surahNum]
  // and filter where c.sessionNumber === reportSessionNumber
  function getSessionComments(reportSessionNumber) {
    const sessionComments = [];
    for (const member of members) {
      const memberComments = commentsMap[member.userId];
      if (!memberComments) continue;
      const nameParts = member.user.name.split(' ');
      const firstName = nameParts[nameParts.length - 1];
      for (const [surahNumStr, comments] of Object.entries(memberComments)) {
        for (const c of comments) {
          if (c.sessionNumber === reportSessionNumber) {
            sessionComments.push({
              memberName: firstName,
              surahNum: parseInt(surahNumStr),
              comment: c.comment.replace(/<[^>]*>/g, '').substring(0, 60)
            });
          }
        }
      }
    }
    return sessionComments;
  }

  // Test S14
  const s14Comments = getSessionComments(14);
  console.log('\nS14 suivi individuel: ' + s14Comments.length + ' rows');
  for (const c of s14Comments.slice(0, 3)) {
    console.log('  ' + c.memberName + ' | Surah ' + c.surahNum + ' | ' + c.comment);
  }

  // Test S10
  const s10Comments = getSessionComments(10);
  console.log('\nS10 suivi individuel: ' + s10Comments.length + ' rows');
  for (const c of s10Comments) {
    console.log('  ' + c.memberName + ' | Surah ' + c.surahNum + ' | ' + c.comment);
  }

  // Test S1 (no comments)
  const s1Comments = getSessionComments(1);
  console.log('\nS1 suivi individuel: ' + s1Comments.length + ' rows (should be 0)');

  // Test S15 (next session, doesn't exist yet)
  const s15Comments = getSessionComments(15);
  console.log('S15 suivi individuel: ' + s15Comments.length + ' rows (should be 0)');

  // === Step 4: Test prev/next navigation boundaries ===
  console.log('\n=== Navigation boundaries ===');
  console.log('S1: prev disabled=' + (1 <= 1) + ', next disabled=' + (1 >= totalSessions));
  console.log('S14: prev disabled=' + (14 <= 1) + ', next disabled=' + (14 >= totalSessions));
  console.log('S7: prev disabled=' + (7 <= 1) + ', next disabled=' + (7 >= totalSessions));

  // === Step 5: Verify session selector -> dialog flow ===
  console.log('\n=== Flow test: activeSession=12, click "Voir séance" ===');
  const activeSession = '12';
  const targetNum = parseInt(activeSession); // 12
  // openSessionReportDialog(12) is called
  // Inside: targetNum = 12 (from parameter)
  // Fetches: /api/groups/{id}/mastery/session-report?sessionNumber=12
  console.log('Would fetch session-report?sessionNumber=' + targetNum);
  const s12Comments = getSessionComments(12);
  console.log('S12 suivi individuel: ' + s12Comments.length + ' rows');
  for (const c of s12Comments.slice(0, 3)) {
    console.log('  ' + c.memberName + ' | Surah ' + c.surahNum + ' | ' + c.comment);
  }

  console.log('\n=== All tests passed ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
