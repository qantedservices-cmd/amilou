const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function main() {
  // 1. Real GroupSessions on Feb 7
  const sessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date('2026-02-07'), lt: new Date('2026-02-08') } },
    include: { group: { select: { name: true } }, attendance: true, recitations: true }
  });
  console.log('=== GroupSessions 7 fev ===');
  for (const s of sessions) {
    console.log(s.group.name, '| sem.' + s.weekNumber, '| id:', s.id, '| att:', s.attendance.length, '| rec:', s.recitations.length);
  }

  // 2. Progress entries on Feb 7 - how many per group
  const groupMembers = await prisma.groupMember.findMany({
    include: { group: { select: { id: true, name: true } } }
  });
  const userGroupMap = {};
  for (const m of groupMembers) {
    if (!userGroupMap[m.userId] || m.role === 'MEMBER') {
      userGroupMap[m.userId] = { groupId: m.group.id, groupName: m.group.name };
    }
  }

  const progress = await prisma.progress.findMany({
    where: { date: { gte: new Date('2026-02-07'), lt: new Date('2026-02-08') } },
    include: { user: { select: { name: true } } }
  });
  const byGroup = {};
  for (const p of progress) {
    const g = userGroupMap[p.userId];
    const name = g ? g.groupName : 'UNKNOWN';
    if (!byGroup[name]) byGroup[name] = { count: 0, users: new Set() };
    byGroup[name].count++;
    byGroup[name].users.add(p.user.name);
  }
  console.log('\n=== Progress 7 fev par groupe ===');
  for (const [name, info] of Object.entries(byGroup)) {
    console.log(name + ':', info.count, 'entries,', info.users.size, 'users:', [...info.users].join(', '));
  }

  // 3. Check week numbers
  const feb7week = getWeekNumber(new Date('2026-02-07'));
  console.log('\n=== Week number Feb 7 ===', feb7week);

  // 4. Check all sessions around that date
  const allSessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date('2026-02-01'), lt: new Date('2026-02-15') } },
    include: { group: { select: { name: true } }, attendance: true, recitations: true },
    orderBy: { date: 'asc' }
  });
  console.log('\n=== Toutes les sessions 1-14 fev ===');
  for (const s of allSessions) {
    const w = getWeekNumber(s.date);
    console.log(s.date.toISOString().slice(0,10), s.group.name, '| sem.stored=' + s.weekNumber, '| sem.calc=' + w, '| att:', s.attendance.length, '| rec:', s.recitations.length, '| id:', s.id);
  }

  // 5. Identify empty/duplicate sessions to clean up
  console.log('\n=== Sessions vides ou doublons a nettoyer ===');
  const sessionsByWeekGroup = {};
  for (const s of allSessions) {
    const key = s.weekNumber + '-' + s.groupId;
    if (!sessionsByWeekGroup[key]) sessionsByWeekGroup[key] = [];
    sessionsByWeekGroup[key].push(s);
  }
  for (const [key, sessions] of Object.entries(sessionsByWeekGroup)) {
    if (sessions.length > 1) {
      console.log('DOUBLON:', key);
      for (const s of sessions) {
        console.log('  ', s.date.toISOString().slice(0,10), s.group.name, '| att:', s.attendance.length, '| rec:', s.recitations.length, '| id:', s.id);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
