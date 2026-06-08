const XLSX = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function excelDateToJS(serial) {
  if (!serial || serial === '') return null;
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + serial * 86400000);
}

async function main() {
  const wb = XLSX.readFile(path.join(__dirname, '..', 'docs', 'Suivi cours de coran.xlsx'));
  const data = XLSX.utils.sheet_to_json(wb.Sheets['Form Responses'], { header: 1, defval: '' });

  // Get all Amilou group members
  const amilou = await prisma.group.findFirst({ where: { name: { contains: 'Amilou' } } });
  const members = await prisma.groupMember.findMany({
    where: { groupId: amilou.id },
    include: { user: { select: { id: true, name: true } } }
  });
  console.log('=== Membres Amilou ===');
  members.forEach(m => console.log(' ', m.user.name, '(' + m.role + ')'));

  // Get MEMORIZATION program
  const memProg = await prisma.program.findFirst({ where: { code: 'MEMORIZATION' } });

  // Parse Excel entries (memorisation only)
  const excelEntries = [];
  for (let i = 1; i < data.length; i++) {
    const type = String(data[i][1]);
    if (!type.includes('morisation')) continue;
    const who = String(data[i][6]).trim();
    const surahNum = parseInt(data[i][8]);
    const vs = parseInt(data[i][9]);
    const ve = parseInt(data[i][10]);
    const dateRaw = data[i][2];
    if (!surahNum || !vs || !ve) continue;
    excelEntries.push({ who, surahNum, vs, ve, dateRaw });
  }

  // Map Excel names to DB users
  const nameMap = {};
  for (const m of members) {
    const nameLower = m.user.name.toLowerCase();
    nameMap[nameLower] = m.user;
    // Also try first name
    const parts = m.user.name.split(' ');
    for (const p of parts) {
      nameMap[p.toLowerCase()] = m.user;
    }
  }
  // Manual mappings
  nameMap['mohamed b.'] = members.find(m => m.user.name.includes('Mohamed'))?.user;
  nameMap['yazid'] = members.find(m => m.user.name.toLowerCase().includes('yazid'))?.user;
  nameMap['yazid c'] = members.find(m => m.user.name.toLowerCase().includes('yazid'))?.user;

  // Get all existing Progress entries for Amilou members
  const memberIds = members.map(m => m.userId);
  const existingProgress = await prisma.progress.findMany({
    where: { userId: { in: memberIds }, programId: memProg.id },
    select: { userId: true, surahNumber: true, verseStart: true, verseEnd: true, date: true }
  });

  // Build existing set: userId-surahNum-vs-ve
  const existingSet = new Set();
  for (const p of existingProgress) {
    existingSet.add(`${p.userId}-${p.surahNumber}-${p.verseStart}-${p.verseEnd}`);
  }

  // Compare
  let missing = 0;
  let found = 0;
  let noMatch = 0;
  const missingEntries = [];
  const unmatchedNames = new Set();

  for (const e of excelEntries) {
    const whoLower = e.who.toLowerCase().trim();
    const user = nameMap[whoLower];
    if (!user) {
      unmatchedNames.add(e.who);
      noMatch++;
      continue;
    }
    const key = `${user.id}-${e.surahNum}-${e.vs}-${e.ve}`;
    if (existingSet.has(key)) {
      found++;
    } else {
      missing++;
      missingEntries.push({ ...e, userId: user.id, userName: user.name });
    }
  }

  console.log('\n=== Comparaison Excel vs DB ===');
  console.log('Trouvés en DB:', found);
  console.log('Manquants en DB:', missing);
  console.log('Noms non matchés:', noMatch, [...unmatchedNames].join(', '));

  if (missingEntries.length > 0) {
    console.log('\n=== Entrées manquantes ===');
    for (const e of missingEntries) {
      const dateStr = e.dateRaw ? excelDateToJS(e.dateRaw)?.toISOString().slice(0, 10) : 'no-date';
      console.log(' ', e.userName, '| S' + e.surahNum, 'v.' + e.vs + '-' + e.ve, '| date:', dateStr);
    }
  }

  // Coverage comparison per user per surah
  console.log('\n=== Couverture par utilisateur (Excel vs DB) ===');
  for (const m of members) {
    // Excel coverage
    const userExcel = excelEntries.filter(e => {
      const u = nameMap[e.who.toLowerCase().trim()];
      return u && u.id === m.userId;
    });
    const excelCoverage = {};
    for (const e of userExcel) {
      if (!excelCoverage[e.surahNum]) excelCoverage[e.surahNum] = new Set();
      for (let v = e.vs; v <= e.ve; v++) excelCoverage[e.surahNum].add(v);
    }

    // DB coverage
    const userDB = existingProgress.filter(p => p.userId === m.userId);
    const dbCoverage = {};
    for (const p of userDB) {
      if (!dbCoverage[p.surahNumber]) dbCoverage[p.surahNumber] = new Set();
      for (let v = p.verseStart; v <= p.verseEnd; v++) dbCoverage[p.surahNumber].add(v);
    }

    const allSurahs = new Set([...Object.keys(excelCoverage), ...Object.keys(dbCoverage)].map(Number));
    const diffs = [];
    for (const s of [...allSurahs].sort((a, b) => a - b)) {
      const ec = excelCoverage[s]?.size || 0;
      const dc = dbCoverage[s]?.size || 0;
      if (ec !== dc) {
        diffs.push(`S${s}:excel=${ec}/db=${dc}`);
      }
    }
    if (diffs.length > 0) {
      console.log(' ', m.user.name, ':', diffs.join(', '));
    } else {
      console.log(' ', m.user.name, ': OK (identique)');
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
