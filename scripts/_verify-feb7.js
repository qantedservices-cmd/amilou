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
  // Simulate what the calendar API does now
  const groupMembers = await prisma.groupMember.findMany({
    include: { group: { select: { id: true, name: true } } }
  });

  // 1. GroupSessions Feb 1-14
  const groupSessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date('2026-02-01'), lt: new Date('2026-02-15') } },
    include: { group: { select: { id: true, name: true } }, attendance: true, recitations: true },
    orderBy: { date: 'asc' }
  });

  console.log('=== Real GroupSessions ===');
  for (const s of groupSessions) {
    console.log(s.date.toISOString().slice(0,10), s.group.name, '| stored W' + s.weekNumber, '| calc W' + getWeekNumber(s.date), '| att:', s.attendance.length, '| rec:', s.recitations.length);
  }

  // 2. Build groupSessionWeeks set (new logic with flatMap)
  const groupSessionWeeks = new Set();
  for (const s of groupSessions) {
    const calcWeek = getWeekNumber(s.date);
    const yr = s.date.getFullYear();
    groupSessionWeeks.add(yr + '-W' + calcWeek + '-' + s.groupId);
    if (s.weekNumber && s.weekNumber !== calcWeek) {
      groupSessionWeeks.add(yr + '-W' + s.weekNumber + '-' + s.groupId);
    }
  }
  console.log('\n=== groupSessionWeeks set ===');
  for (const k of groupSessionWeeks) console.log(' ', k);

  // 3. Progress entries Feb 7 grouped by date+group
  const userGroupMap = {};
  for (const m of groupMembers) {
    if (!userGroupMap[m.userId] || m.role === 'MEMBER') {
      userGroupMap[m.userId] = { groupId: m.group.id, groupName: m.group.name };
    }
  }

  const progress = await prisma.progress.findMany({
    where: { date: { gte: new Date('2026-02-01'), lt: new Date('2026-02-15') } },
    include: { user: { select: { name: true } } }
  });

  const progressByDateGroup = {};
  for (const p of progress) {
    const dateKey = p.date.toISOString().slice(0,10);
    const g = userGroupMap[p.userId];
    const grpId = g ? g.groupId : 'unknown';
    const key = dateKey + '|' + grpId;
    if (!progressByDateGroup[key]) progressByDateGroup[key] = { count: 0, groupName: g ? g.groupName : '?', grpId };
    progressByDateGroup[key].count++;
  }

  console.log('\n=== Progress sessions (virtual) ===');
  for (const [key, info] of Object.entries(progressByDateGroup)) {
    const [dateKey, grpId] = key.split('|');
    const weekNum = getWeekNumber(new Date(dateKey));
    const yr = new Date(dateKey).getFullYear();
    const filterKey = yr + '-W' + weekNum + '-' + grpId;
    const filtered = groupSessionWeeks.has(filterKey);
    console.log(dateKey, info.groupName, '| W' + weekNum, '|', info.count, 'entries', filtered ? '→ FILTERED (doublon)' : '→ SHOWN');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
