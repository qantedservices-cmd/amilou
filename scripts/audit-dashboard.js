// Dashboard Data Coherence Audit Script
// Usage: node scripts/audit-dashboard.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMIR_EMAIL = 'sinlatourelle@gmail.com';
const OTHER_USERS = [
  { name: 'Mohamed Koucha', email: null }, // will search by name
  { name: 'Abdelmoughite', email: null },
];

// ─── Utility Functions ───

function pad(str, len, char = ' ') {
  return String(str).padEnd(len, char);
}

function rpad(str, len) {
  return String(str).padStart(len);
}

function formatDate(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return dt.toISOString().split('T')[0];
}

function daysBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function objectiveToHizbPerDay(quantity, unit, period) {
  let hizbsPerUnit;
  switch (unit) {
    case 'QUART': hizbsPerUnit = 0.25; break;
    case 'DEMI_HIZB': hizbsPerUnit = 0.5; break;
    case 'HIZB': hizbsPerUnit = 1; break;
    case 'JUZ': hizbsPerUnit = 2; break;
    case 'PAGE': hizbsPerUnit = 1 / 10.07; break;
    default: hizbsPerUnit = 1 / 10.07;
  }
  const totalHizbs = quantity * hizbsPerUnit;
  switch (period) {
    case 'DAY': return totalHizbs;
    case 'WEEK': return totalHizbs / 7;
    case 'MONTH': return totalHizbs / 30;
    case 'YEAR': return totalHizbs / 365;
    default: return totalHizbs;
  }
}

function status(pass) {
  return pass ? '[PASS]' : '[FAIL]';
}

function separator(title) {
  console.log('');
  console.log('='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function subSection(title) {
  console.log('');
  console.log(`--- ${title} ---`);
}

// ─── Main Audit ───

async function main() {
  console.log('');
  console.log('#'.repeat(80));
  console.log('#  AMILOU DASHBOARD DATA COHERENCE AUDIT');
  console.log(`#  Date: ${new Date().toISOString()}`);
  console.log('#'.repeat(80));

  // ─── Get Samir ───
  const samir = await prisma.user.findUnique({
    where: { email: SAMIR_EMAIL },
    include: {
      groupMembers: { include: { group: true } },
    }
  });

  if (!samir) {
    console.log('ERROR: User Samir not found with email ' + SAMIR_EMAIL);
    return;
  }

  // Get all programs
  const programs = await prisma.program.findMany();
  const programMap = {};
  programs.forEach(p => { programMap[p.code] = p; });

  // ════════════════════════════════════════════════════════════════════
  // SECTION 1: Current User State
  // ════════════════════════════════════════════════════════════════════
  separator('1. CURRENT USER STATE');

  console.log(`  User: ${samir.name} (${samir.email})`);
  console.log(`  ID: ${samir.id}`);
  console.log(`  Role: ${samir.role}`);
  console.log('');
  console.log('  Groups:');
  for (const gm of samir.groupMembers) {
    console.log(`    - ${gm.group.name} (role: ${gm.role}, active: ${gm.isActive})`);
  }

  subSection('Progress Tracker Positions');
  console.log(`  readingCurrentHizb:     ${samir.readingCurrentHizb ?? 'null'}`);
  console.log(`  revisionCurrentHizb:    ${samir.revisionCurrentHizb ?? 'null'}`);
  console.log(`  revisionSuspendedHizb:  ${samir.revisionSuspendedHizb ?? 'null'}`);

  subSection('Memorization Settings');
  console.log(`  memorizationStartSurah:  ${samir.memorizationStartSurah ?? 'null (default: 1)'}`);
  console.log(`  memorizationStartVerse:  ${samir.memorizationStartVerse ?? 'null (default: 1)'}`);
  console.log(`  memorizationDirection:   ${samir.memorizationDirection ?? 'null (default: FORWARD)'}`);

  subSection('User Program Settings (Active Objectives)');
  const allSettings = await prisma.userProgramSettings.findMany({
    where: { userId: samir.id, isActive: true },
    include: { program: true },
    orderBy: { createdAt: 'desc' }
  });

  if (allSettings.length === 0) {
    console.log('  No active program settings found.');
  } else {
    console.log(`  ${pad('Program', 16)} ${pad('Quantity', 10)} ${pad('Unit', 12)} ${pad('Period', 8)} ${pad('Hizb/Day', 10)}`);
    console.log(`  ${'-'.repeat(56)}`);
    for (const s of allSettings) {
      const hpd = objectiveToHizbPerDay(s.quantity, s.unit, s.period);
      console.log(`  ${pad(s.program.code, 16)} ${pad(s.quantity, 10)} ${pad(s.unit, 12)} ${pad(s.period, 8)} ${hpd.toFixed(4)}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 2: Memorized Zone
  // ════════════════════════════════════════════════════════════════════
  separator('2. MEMORIZED ZONE');

  const memProgram = programMap['MEMORIZATION'];

  // Find last memorization entry
  const lastMem = await prisma.progress.findFirst({
    where: { userId: samir.id, programId: memProgram.id },
    orderBy: [{ date: 'desc' }, { surahNumber: 'desc' }, { verseEnd: 'desc' }],
    include: { surah: true }
  });

  if (lastMem) {
    console.log(`  Last memorization entry:`);
    console.log(`    Surah: ${lastMem.surahNumber} (${lastMem.surah.nameAr} / ${lastMem.surah.nameFr})`);
    console.log(`    Verses: ${lastMem.verseStart}-${lastMem.verseEnd}`);
    console.log(`    Date: ${formatDate(lastMem.date)}`);
  } else {
    console.log('  No memorization Progress entries found.');
  }

  // Calculate memorized zone
  const startSurah = samir.memorizationStartSurah || 1;
  const startVerse = samir.memorizationStartVerse || 1;
  const direction = samir.memorizationDirection || 'FORWARD';

  const startVerseRecord = await prisma.verse.findUnique({
    where: { surahNumber_verseNumber: { surahNumber: startSurah, verseNumber: startVerse } }
  });

  let zone = null;
  if (lastMem) {
    const endVerseRecord = await prisma.verse.findUnique({
      where: { surahNumber_verseNumber: { surahNumber: lastMem.surahNumber, verseNumber: lastMem.verseEnd } }
    });

    if (startVerseRecord && endVerseRecord) {
      const startHizbRaw = startVerseRecord.hizb || 1;
      const endHizbRaw = endVerseRecord.hizb || 1;

      if (direction === 'FORWARD') {
        zone = {
          startHizb: Math.floor(startHizbRaw),
          endHizb: Math.ceil(endHizbRaw),
          totalHizbs: Math.ceil(endHizbRaw) - Math.floor(startHizbRaw) + 1
        };
      } else {
        zone = {
          startHizb: Math.floor(endHizbRaw),
          endHizb: Math.ceil(startHizbRaw),
          totalHizbs: Math.ceil(startHizbRaw) - Math.floor(endHizbRaw) + 1
        };
      }
    }
  }

  if (zone) {
    console.log('');
    console.log(`  Memorized Zone:`);
    console.log(`    Start Hizb: ${zone.startHizb}`);
    console.log(`    End Hizb:   ${zone.endHizb}`);
    console.log(`    Total Hizbs: ${zone.totalHizbs}`);
    console.log(`    (Direction: ${direction}, Start: S${startSurah}V${startVerse})`);
  } else {
    console.log('  Could not calculate memorized zone.');
  }

  // Count total memorization entries
  const memCount = await prisma.progress.count({
    where: { userId: samir.id, programId: memProgram.id }
  });
  console.log(`  Total memorization Progress entries: ${memCount}`);

  // ════════════════════════════════════════════════════════════════════
  // SECTION 3: CompletionCycle Records
  // ════════════════════════════════════════════════════════════════════
  separator('3. COMPLETION CYCLE RECORDS');

  const allCycles = await prisma.completionCycle.findMany({
    where: { userId: samir.id },
    orderBy: [{ type: 'asc' }, { completedAt: 'asc' }]
  });

  const revisionCycles = allCycles.filter(c => c.type === 'REVISION');
  const lectureCycles = allCycles.filter(c => c.type === 'LECTURE');

  subSection('REVISION Cycles');
  if (revisionCycles.length === 0) {
    console.log('  No revision cycles.');
  } else {
    console.log(`  ${pad('#', 4)} ${pad('CompletedAt', 12)} ${pad('DaysToComplete', 16)} ${pad('HizbCount', 10)} ${pad('Notes', 40)}`);
    console.log(`  ${'-'.repeat(82)}`);
    let revPasses = 0;
    for (let i = 0; i < revisionCycles.length; i++) {
      const c = revisionCycles[i];
      const expectedDays = i > 0 ? daysBetween(revisionCycles[i - 1].completedAt, c.completedAt) : null;
      const daysMatch = expectedDays === null || c.daysToComplete === expectedDays;
      if (daysMatch) revPasses++;
      const daysNote = expectedDays !== null && !daysMatch
        ? ` (expected ${expectedDays})`
        : '';
      console.log(`  ${pad(i + 1, 4)} ${pad(formatDate(c.completedAt), 12)} ${pad((c.daysToComplete ?? 'null') + daysNote, 16)} ${pad(c.hizbCount ?? 'null', 10)} ${pad(c.notes || '', 40)}`);
    }
    console.log(`  Total: ${revisionCycles.length} cycles`);
    console.log(`  DaysToComplete consistency: ${status(revPasses === revisionCycles.length)} (${revPasses}/${revisionCycles.length} correct)`);
  }

  subSection('LECTURE Cycles');
  if (lectureCycles.length === 0) {
    console.log('  No lecture cycles.');
  } else {
    console.log(`  ${pad('#', 4)} ${pad('CompletedAt', 12)} ${pad('DaysToComplete', 16)} ${pad('HizbCount', 10)} ${pad('Notes', 40)}`);
    console.log(`  ${'-'.repeat(82)}`);
    let lecPasses = 0;
    for (let i = 0; i < lectureCycles.length; i++) {
      const c = lectureCycles[i];
      const expectedDays = i > 0 ? daysBetween(lectureCycles[i - 1].completedAt, c.completedAt) : null;
      const daysMatch = expectedDays === null || c.daysToComplete === expectedDays;
      if (daysMatch) lecPasses++;
      const daysNote = expectedDays !== null && !daysMatch
        ? ` (expected ${expectedDays})`
        : '';
      console.log(`  ${pad(i + 1, 4)} ${pad(formatDate(c.completedAt), 12)} ${pad((c.daysToComplete ?? 'null') + daysNote, 16)} ${pad(c.hizbCount ?? 'null', 10)} ${pad(c.notes || '', 40)}`);
    }
    console.log(`  Total: ${lectureCycles.length} cycles`);
    console.log(`  DaysToComplete consistency: ${status(lecPasses === lectureCycles.length)} (${lecPasses}/${lectureCycles.length} correct)`);
  }

  // Check for automatic/combined notes
  const autoNotes = allCycles.filter(c => c.notes && (c.notes.includes('automatique') || c.notes.includes('combiné') || c.notes.includes('Mode combiné')));
  console.log(`\n  Cycles with "automatique"/"combiné" notes: ${autoNotes.length}`);
  for (const c of autoNotes) {
    console.log(`    - ${c.type} ${formatDate(c.completedAt)}: "${c.notes}"`);
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 4: DailyProgramCompletion
  // ════════════════════════════════════════════════════════════════════
  separator('4. DAILY PROGRAM COMPLETION');

  subSection('Total Completed Days per Program');
  const programCodes = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING', 'TAFSIR'];

  const completionCounts = {};
  for (const code of programCodes) {
    const prog = programMap[code];
    if (!prog) {
      completionCounts[code] = { total: 0, sinceLastRevCycle: 0, sinceLastLecCycle: 0 };
      continue;
    }
    const total = await prisma.dailyProgramCompletion.count({
      where: { userId: samir.id, programId: prog.id, completed: true }
    });

    const lastRevCycle = revisionCycles.length > 0 ? revisionCycles[revisionCycles.length - 1] : null;
    const lastLecCycle = lectureCycles.length > 0 ? lectureCycles[lectureCycles.length - 1] : null;

    const sinceLastRevCycle = lastRevCycle ? await prisma.dailyProgramCompletion.count({
      where: {
        userId: samir.id,
        programId: prog.id,
        completed: true,
        date: { gt: lastRevCycle.completedAt }
      }
    }) : total;

    const sinceLastLecCycle = lastLecCycle ? await prisma.dailyProgramCompletion.count({
      where: {
        userId: samir.id,
        programId: prog.id,
        completed: true,
        date: { gt: lastLecCycle.completedAt }
      }
    }) : total;

    completionCounts[code] = { total, sinceLastRevCycle, sinceLastLecCycle };
  }

  console.log(`  ${pad('Program', 16)} ${rpad('Total', 8)} ${rpad('Since Last Rev Cycle', 22)} ${rpad('Since Last Lec Cycle', 22)}`);
  console.log(`  ${'-'.repeat(68)}`);
  for (const code of programCodes) {
    const cc = completionCounts[code];
    console.log(`  ${pad(code, 16)} ${rpad(cc.total, 8)} ${rpad(cc.sinceLastRevCycle, 22)} ${rpad(cc.sinceLastLecCycle, 22)}`);
  }

  subSection('Actual Dates of REVISION completions since last REVISION cycle');
  const lastRevCycle = revisionCycles.length > 0 ? revisionCycles[revisionCycles.length - 1] : null;
  const revisionProg = programMap['REVISION'];
  if (revisionProg && lastRevCycle) {
    const revDates = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: samir.id,
        programId: revisionProg.id,
        completed: true,
        date: { gt: lastRevCycle.completedAt }
      },
      orderBy: { date: 'asc' },
      select: { date: true }
    });
    console.log(`  Last REVISION cycle: ${formatDate(lastRevCycle.completedAt)}`);
    console.log(`  Completed days since: ${revDates.length}`);
    if (revDates.length > 0 && revDates.length <= 60) {
      for (const d of revDates) {
        console.log(`    ${formatDate(d.date)}`);
      }
    } else if (revDates.length > 60) {
      console.log(`    (showing first 10 and last 10 of ${revDates.length})`);
      for (const d of revDates.slice(0, 10)) console.log(`    ${formatDate(d.date)}`);
      console.log('    ...');
      for (const d of revDates.slice(-10)) console.log(`    ${formatDate(d.date)}`);
    }
  } else {
    console.log('  No revision cycles or program found.');
  }

  subSection('Actual Dates of READING completions since last LECTURE cycle');
  const lastLecCycle = lectureCycles.length > 0 ? lectureCycles[lectureCycles.length - 1] : null;
  const readingProg = programMap['READING'];
  if (readingProg && lastLecCycle) {
    const readDates = await prisma.dailyProgramCompletion.findMany({
      where: {
        userId: samir.id,
        programId: readingProg.id,
        completed: true,
        date: { gt: lastLecCycle.completedAt }
      },
      orderBy: { date: 'asc' },
      select: { date: true }
    });
    console.log(`  Last LECTURE cycle: ${formatDate(lastLecCycle.completedAt)}`);
    console.log(`  Completed days since: ${readDates.length}`);
    if (readDates.length > 0 && readDates.length <= 60) {
      for (const d of readDates) {
        console.log(`    ${formatDate(d.date)}`);
      }
    } else if (readDates.length > 60) {
      console.log(`    (showing first 10 and last 10 of ${readDates.length})`);
      for (const d of readDates.slice(0, 10)) console.log(`    ${formatDate(d.date)}`);
      console.log('    ...');
      for (const d of readDates.slice(-10)) console.log(`    ${formatDate(d.date)}`);
    }
  } else {
    console.log('  No lecture cycles or program found.');
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 5: Recalculate Positions from Scratch
  // ════════════════════════════════════════════════════════════════════
  separator('5. RECALCULATE POSITIONS FROM SCRATCH');

  // Get active objectives for reading and revision
  const readingSettings = allSettings.find(s => s.program.code === 'READING');
  const revisionSettings = allSettings.find(s => s.program.code === 'REVISION');

  const readingHizbPerDay = readingSettings ? objectiveToHizbPerDay(readingSettings.quantity, readingSettings.unit, readingSettings.period) : 0;
  const revisionHizbPerDay = revisionSettings ? objectiveToHizbPerDay(revisionSettings.quantity, revisionSettings.unit, revisionSettings.period) : 0;

  console.log(`  Reading objective: ${readingSettings ? `${readingSettings.quantity} ${readingSettings.unit}/${readingSettings.period}` : 'NONE'} => ${readingHizbPerDay.toFixed(4)} hizb/day`);
  console.log(`  Revision objective: ${revisionSettings ? `${revisionSettings.quantity} ${revisionSettings.unit}/${revisionSettings.period}` : 'NONE'} => ${revisionHizbPerDay.toFixed(4)} hizb/day`);

  if (zone) {
    console.log(`  Memorized zone: [${zone.startHizb}, ${zone.endHizb}] (${zone.totalHizbs} hizbs)`);
  }

  // Get completed days since last cycles
  const readingDaysSinceLastCycle = readingProg ? await prisma.dailyProgramCompletion.findMany({
    where: {
      userId: samir.id,
      programId: readingProg.id,
      completed: true,
      ...(lastLecCycle ? { date: { gt: lastLecCycle.completedAt } } : {})
    },
    orderBy: { date: 'asc' },
    select: { date: true }
  }) : [];

  const revisionDaysSinceLastCycle = revisionProg ? await prisma.dailyProgramCompletion.findMany({
    where: {
      userId: samir.id,
      programId: revisionProg.id,
      completed: true,
      ...(lastRevCycle ? { date: { gt: lastRevCycle.completedAt } } : {})
    },
    orderBy: { date: 'asc' },
    select: { date: true }
  }) : [];

  console.log(`  Reading days since last LECTURE cycle: ${readingDaysSinceLastCycle.length}`);
  console.log(`  Revision days since last REVISION cycle: ${revisionDaysSinceLastCycle.length}`);

  // Simulate day by day
  const readingDateSet = new Set(readingDaysSinceLastCycle.map(d => d.date.toISOString().split('T')[0]));
  const revisionDateSet = new Set(revisionDaysSinceLastCycle.map(d => d.date.toISOString().split('T')[0]));
  const allDates = [...new Set([...readingDateSet, ...revisionDateSet])].sort();

  let readingHizb = 0;
  let revisionHizb = 0;
  let revisionSuspended = null;
  let cycleWraps = 0;

  const isInMemorizedZone = (hizb) => {
    if (!zone || zone.totalHizbs <= 0) return false;
    return hizb >= zone.startHizb && hizb <= zone.endHizb;
  };

  subSection('Day-by-day Simulation');
  const showAll = allDates.length <= 100;

  if (showAll) {
    console.log(`  ${pad('Date', 12)} ${pad('R?', 3)} ${pad('V?', 3)} ${pad('ReadHizb', 10)} ${pad('RevHizb', 10)} ${pad('InZone?', 8)} ${pad('Suspended?', 12)} ${pad('Notes', 30)}`);
    console.log(`  ${'-'.repeat(88)}`);
  } else {
    console.log(`  (${allDates.length} days total, showing first 20, last 20, and any events)`);
    console.log(`  ${pad('Date', 12)} ${pad('R?', 3)} ${pad('V?', 3)} ${pad('ReadHizb', 10)} ${pad('RevHizb', 10)} ${pad('InZone?', 8)} ${pad('Suspended?', 12)} ${pad('Notes', 30)}`);
    console.log(`  ${'-'.repeat(88)}`);
  }

  const events = [];

  for (let di = 0; di < allDates.length; di++) {
    const dateStr = allDates[di];
    const hasReading = readingDateSet.has(dateStr);
    const hasRevision = revisionDateSet.has(dateStr);
    let notes = '';

    // Process reading
    if (hasReading && readingHizbPerDay > 0) {
      const wasInZone = isInMemorizedZone(readingHizb);
      const speed = wasInZone ? 2 : 1;
      readingHizb += speed * readingHizbPerDay;

      // Handle wrap
      while (readingHizb >= 60) {
        readingHizb -= 60;
        cycleWraps++;
        notes += `LECTURE WRAP #${cycleWraps}; `;
        if (revisionSuspended !== null) {
          revisionHizb = revisionSuspended;
          revisionSuspended = null;
          notes += 'REV RESUME; ';
        }
        if (isInMemorizedZone(readingHizb) && revisionSuspended === null) {
          revisionSuspended = revisionHizb;
          notes += 'REV SUSPEND; ';
        }
      }

      if (readingHizb < 60) {
        const isNowInZone = isInMemorizedZone(readingHizb);
        if (!wasInZone && isNowInZone && revisionSuspended === null) {
          revisionSuspended = revisionHizb;
          notes += 'ENTER ZONE => REV SUSPEND; ';
        }
        if (wasInZone && !isNowInZone && revisionSuspended !== null) {
          revisionHizb = revisionSuspended;
          revisionSuspended = null;
          notes += 'EXIT ZONE => REV RESUME; ';
        }
      }
    }

    // Process revision (only if not suspended)
    if (hasRevision && revisionHizbPerDay > 0 && revisionSuspended === null && zone && zone.totalHizbs > 0) {
      revisionHizb += revisionHizbPerDay;
      while (revisionHizb >= zone.totalHizbs) {
        revisionHizb -= zone.totalHizbs;
        notes += 'REV CYCLE WRAP; ';
      }
    }

    const shouldShow = showAll || di < 20 || di >= allDates.length - 20 || notes.length > 0;
    if (shouldShow) {
      console.log(`  ${pad(dateStr, 12)} ${pad(hasReading ? 'Y' : '', 3)} ${pad(hasRevision ? 'Y' : '', 3)} ${pad(readingHizb.toFixed(2), 10)} ${pad(revisionHizb.toFixed(2), 10)} ${pad(isInMemorizedZone(readingHizb) ? 'YES' : 'no', 8)} ${pad(revisionSuspended !== null ? revisionSuspended.toFixed(2) : '-', 12)} ${notes}`);
    }

    if (!showAll && di === 19 && allDates.length > 40) {
      console.log(`  ... (${allDates.length - 40} days omitted) ...`);
    }

    if (notes.length > 0) {
      events.push({ date: dateStr, readingHizb, revisionHizb, revisionSuspended, notes });
    }
  }

  subSection('Final Calculated Positions');
  const calcReadingRounded = Math.round(readingHizb);
  const calcRevisionRounded = Math.round(revisionHizb);
  const calcSuspendedRounded = revisionSuspended !== null ? Math.round(revisionSuspended) : null;

  console.log(`  Reading:   ${readingHizb.toFixed(4)} (rounded: ${calcReadingRounded})`);
  console.log(`  Revision:  ${revisionHizb.toFixed(4)} (rounded: ${calcRevisionRounded})`);
  console.log(`  Suspended: ${revisionSuspended !== null ? revisionSuspended.toFixed(4) : 'null'} (rounded: ${calcSuspendedRounded ?? 'null'})`);

  subSection('Comparison with Stored Positions');
  const storedReading = samir.readingCurrentHizb;
  const storedRevision = samir.revisionCurrentHizb;
  const storedSuspended = samir.revisionSuspendedHizb;

  const readingMatch = storedReading === calcReadingRounded || storedReading === null && calcReadingRounded === 0;
  const revisionMatch = storedRevision === calcRevisionRounded || storedRevision === null && calcRevisionRounded === 0;
  const suspendedMatch = (storedSuspended === null && calcSuspendedRounded === null) ||
    (storedSuspended !== null && calcSuspendedRounded !== null && storedSuspended === calcSuspendedRounded);

  console.log(`  ${pad('Field', 25)} ${pad('Stored', 12)} ${pad('Calculated', 12)} ${pad('Match?', 10)}`);
  console.log(`  ${'-'.repeat(59)}`);
  console.log(`  ${pad('readingCurrentHizb', 25)} ${pad(storedReading ?? 'null', 12)} ${pad(calcReadingRounded, 12)} ${status(readingMatch)}`);
  console.log(`  ${pad('revisionCurrentHizb', 25)} ${pad(storedRevision ?? 'null', 12)} ${pad(calcRevisionRounded, 12)} ${status(revisionMatch)}`);
  console.log(`  ${pad('revisionSuspendedHizb', 25)} ${pad(storedSuspended ?? 'null', 12)} ${pad(calcSuspendedRounded ?? 'null', 12)} ${status(suspendedMatch)}`);

  // Also compare with raw (non-rounded) values
  subSection('Close-match Analysis (non-rounded)');
  console.log(`  Reading:  stored=${storedReading ?? 'null'}, calc=${readingHizb.toFixed(4)}, diff=${storedReading != null ? Math.abs(storedReading - readingHizb).toFixed(4) : 'N/A'}`);
  console.log(`  Revision: stored=${storedRevision ?? 'null'}, calc=${revisionHizb.toFixed(4)}, diff=${storedRevision != null ? Math.abs(storedRevision - revisionHizb).toFixed(4) : 'N/A'}`);
  console.log(`  Lecture cycle wraps during current period: ${cycleWraps}`);

  // ════════════════════════════════════════════════════════════════════
  // SECTION 6: Dashboard Stats Verification
  // ════════════════════════════════════════════════════════════════════
  separator('6. DASHBOARD STATS VERIFICATION');

  // Simulate what the progress-tracker API returns
  if (zone) {
    const readHizb = samir.readingCurrentHizb ?? 0;
    const revHizb = samir.revisionCurrentHizb ?? 0;
    const isSuspended = samir.revisionSuspendedHizb !== null && samir.revisionSuspendedHizb !== undefined;

    // Reading position: hizbToPosition(readHizb + 1)
    // Find the verse at the reading position
    const readingTargetHizb = readHizb > 0 ? readHizb + 1 : 1;
    let readVerse = null;
    if (readingTargetHizb <= 1) {
      readVerse = await prisma.verse.findFirst({
        orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
        include: { surah: true }
      });
    } else {
      const marker = await prisma.verse.findFirst({
        where: { hizb: { gte: readingTargetHizb + 0.05 } },
        orderBy: { hizb: 'asc' }
      });
      if (marker) {
        readVerse = await prisma.verse.findFirst({
          where: { page: marker.page },
          orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
          include: { surah: true }
        });
      }
    }

    // Revision position: hizbToPosition(zone.startHizb + revHizb)
    const revTargetHizb = zone.startHizb + revHizb;
    let revVerse = null;
    if (revTargetHizb <= 1) {
      revVerse = await prisma.verse.findFirst({
        orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
        include: { surah: true }
      });
    } else {
      const marker = await prisma.verse.findFirst({
        where: { hizb: { gte: revTargetHizb + 0.05 } },
        orderBy: { hizb: 'asc' }
      });
      if (marker) {
        revVerse = await prisma.verse.findFirst({
          where: { page: marker.page },
          orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
          include: { surah: true }
        });
      }
    }

    console.log('  Reading (what dashboard shows):');
    console.log(`    currentHizb: ${readHizb}`);
    console.log(`    percentage:  ${Math.round((readHizb / 60) * 100)}%`);
    if (readVerse) {
      console.log(`    position:    Surah ${readVerse.surahNumber} (${readVerse.surah.nameAr}) V${readVerse.verseNumber}, Page ${readVerse.page}`);
    }

    console.log('  Revision (what dashboard shows):');
    console.log(`    currentHizb: ${revHizb}`);
    console.log(`    totalHizbs:  ${zone.totalHizbs}`);
    console.log(`    percentage:  ${zone.totalHizbs > 0 ? Math.round((revHizb / zone.totalHizbs) * 100) : 0}%`);
    console.log(`    isSuspended: ${isSuspended}`);
    if (revVerse) {
      console.log(`    position:    Surah ${revVerse.surahNumber} (${revVerse.surah.nameAr}) V${revVerse.verseNumber}, Page ${revVerse.page}`);
    }

    // Consistency check
    const dashReadingConsistent = (readHizb === calcReadingRounded) || Math.abs(readHizb - readingHizb) < 1;
    const dashRevisionConsistent = (revHizb === calcRevisionRounded) || Math.abs(revHizb - revisionHizb) < 1;
    console.log('');
    console.log(`  Dashboard reading consistent with recalc:  ${status(dashReadingConsistent)}`);
    console.log(`  Dashboard revision consistent with recalc: ${status(dashRevisionConsistent)}`);
  } else {
    console.log('  Cannot verify - no memorized zone.');
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 7: Cross-check with Attendance
  // ════════════════════════════════════════════════════════════════════
  separator('7. CROSS-CHECK WITH ATTENDANCE');

  const totalRevisionDays = completionCounts['REVISION']?.total ?? 0;
  const totalReadingDays = completionCounts['READING']?.total ?? 0;

  const totalRevCycles = revisionCycles.length;
  const totalLecCycles = lectureCycles.length;

  // Figure out average hizbCount for revision cycles
  const avgRevHizbCount = totalRevCycles > 0
    ? revisionCycles.reduce((s, c) => s + (c.hizbCount || 0), 0) / totalRevCycles
    : 0;

  console.log(`  Total REVISION completed days: ${totalRevisionDays}`);
  console.log(`  Total REVISION cycles: ${totalRevCycles}`);
  if (totalRevCycles > 0 && revisionHizbPerDay > 0) {
    const totalRevHizbsNeeded = revisionCycles.reduce((s, c) => s + (c.hizbCount || zone?.totalHizbs || 0), 0);
    const daysNeeded = totalRevHizbsNeeded / revisionHizbPerDay;
    const remainingRevHizbs = revisionHizb;
    const totalConsumed = totalRevHizbsNeeded + remainingRevHizbs;
    console.log(`  Total hizbs covered by ${totalRevCycles} cycles: ${totalRevHizbsNeeded}`);
    console.log(`  Current partial progress: ${revisionHizb.toFixed(2)} hizbs`);
    console.log(`  Total hizbs consumed: ${totalConsumed.toFixed(2)}`);
    console.log(`  Days needed at ${revisionHizbPerDay.toFixed(4)} hizb/day: ${(totalConsumed / revisionHizbPerDay).toFixed(0)}`);
    console.log(`  Actual revision days available: ${totalRevisionDays}`);
    const revRatio = totalRevisionDays / (totalConsumed / revisionHizbPerDay);
    console.log(`  Ratio (actual/expected): ${revRatio.toFixed(2)} ${status(Math.abs(revRatio - 1) < 0.15)}`);
  }

  console.log('');
  console.log(`  Total READING completed days: ${totalReadingDays}`);
  console.log(`  Total LECTURE cycles: ${totalLecCycles}`);
  if (totalLecCycles > 0 && readingHizbPerDay > 0) {
    const totalLecHizbsNeeded = totalLecCycles * 60;
    const remainingReadHizbs = readingHizb;
    const totalConsumed = totalLecHizbsNeeded + remainingReadHizbs;
    console.log(`  Total hizbs covered by ${totalLecCycles} cycles: ${totalLecHizbsNeeded}`);
    console.log(`  Current partial progress: ${readingHizb.toFixed(2)} hizbs`);
    console.log(`  Total hizbs consumed: ${totalConsumed.toFixed(2)}`);
    // Note: reading goes 2x in memorized zone, so effective days needed is less
    console.log(`  Days needed at ${readingHizbPerDay.toFixed(4)} hizb/day (no zone boost): ${(totalConsumed / readingHizbPerDay).toFixed(0)}`);
    console.log(`  Actual reading days available: ${totalReadingDays}`);
    // With zone boost, effective consumption per day is higher, so ratio > 1 is expected
    const readRatio = totalReadingDays / (totalConsumed / readingHizbPerDay);
    console.log(`  Ratio (actual/expected, without zone boost): ${readRatio.toFixed(2)}`);
    console.log(`  Note: Ratio < 1.0 is expected because reading goes 2x speed in memorized zone`);
  }

  // Check for anomalies
  subSection('Anomaly Detection');

  // Check for days with REVISION completion but no READING (unusual?)
  if (revisionProg && readingProg) {
    const allRevDates = await prisma.dailyProgramCompletion.findMany({
      where: { userId: samir.id, programId: revisionProg.id, completed: true },
      select: { date: true }
    });
    const allReadDates = await prisma.dailyProgramCompletion.findMany({
      where: { userId: samir.id, programId: readingProg.id, completed: true },
      select: { date: true }
    });
    const revDateSet2 = new Set(allRevDates.map(d => d.date.toISOString().split('T')[0]));
    const readDateSet2 = new Set(allReadDates.map(d => d.date.toISOString().split('T')[0]));

    const revOnlyDays = [...revDateSet2].filter(d => !readDateSet2.has(d));
    const readOnlyDays = [...readDateSet2].filter(d => !revDateSet2.has(d));

    console.log(`  Days with REVISION only (no READING): ${revOnlyDays.length}`);
    if (revOnlyDays.length > 0 && revOnlyDays.length <= 10) {
      for (const d of revOnlyDays) console.log(`    ${d}`);
    }
    console.log(`  Days with READING only (no REVISION): ${readOnlyDays.length}`);
    if (readOnlyDays.length > 0 && readOnlyDays.length <= 10) {
      for (const d of readOnlyDays) console.log(`    ${d}`);
    }
  }

  // Check for gaps > 7 days in recent completions
  if (readingDaysSinceLastCycle.length > 1) {
    const gaps = [];
    for (let i = 1; i < readingDaysSinceLastCycle.length; i++) {
      const gap = daysBetween(readingDaysSinceLastCycle[i - 1].date, readingDaysSinceLastCycle[i].date);
      if (gap > 7) {
        gaps.push({ from: formatDate(readingDaysSinceLastCycle[i - 1].date), to: formatDate(readingDaysSinceLastCycle[i].date), days: gap });
      }
    }
    if (gaps.length > 0) {
      console.log(`  Gaps > 7 days in READING (since last cycle):`);
      for (const g of gaps) {
        console.log(`    ${g.from} -> ${g.to} (${g.days} days)`);
      }
    } else {
      console.log(`  No gaps > 7 days in READING since last cycle.`);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 8: Other Users Check
  // ════════════════════════════════════════════════════════════════════
  separator('8. OTHER USERS CHECK');

  // Find Mohamed Koucha and Abdelmoughite
  const otherUsersRaw = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'Koucha', mode: 'insensitive' } },
        { name: { contains: 'Mohamed', mode: 'insensitive' } },
        { name: { contains: 'Abdelmoughite', mode: 'insensitive' } },
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      readingCurrentHizb: true,
      revisionCurrentHizb: true,
      revisionSuspendedHizb: true,
      memorizationStartSurah: true,
      memorizationStartVerse: true,
      memorizationDirection: true,
    }
  });

  // Filter to just the two we want (avoid Samir if name contains Mohamed)
  const otherUsers = otherUsersRaw.filter(u => u.id !== samir.id);

  for (const user of otherUsers) {
    subSection(`${user.name} (${user.email})`);
    console.log(`  ID: ${user.id}`);
    console.log(`  readingCurrentHizb:    ${user.readingCurrentHizb ?? 'null'}`);
    console.log(`  revisionCurrentHizb:   ${user.revisionCurrentHizb ?? 'null'}`);
    console.log(`  revisionSuspendedHizb: ${user.revisionSuspendedHizb ?? 'null'}`);

    // Check cycles
    const userCycles = await prisma.completionCycle.findMany({
      where: { userId: user.id },
      orderBy: [{ type: 'asc' }, { completedAt: 'asc' }]
    });
    console.log(`  Completion cycles: ${userCycles.length}`);
    for (const c of userCycles) {
      console.log(`    ${c.type} ${formatDate(c.completedAt)} (days: ${c.daysToComplete ?? '?'}, hizbs: ${c.hizbCount ?? '?'})`);
    }

    // Check completed days for reading and revision
    for (const code of ['READING', 'REVISION']) {
      const prog = programMap[code];
      if (!prog) continue;
      const count = await prisma.dailyProgramCompletion.count({
        where: { userId: user.id, programId: prog.id, completed: true }
      });
      console.log(`  ${code} completed days: ${count}`);
    }

    // Active objectives
    const userSettings = await prisma.userProgramSettings.findMany({
      where: { userId: user.id, isActive: true },
      include: { program: true }
    });
    if (userSettings.length > 0) {
      console.log('  Active objectives:');
      for (const s of userSettings) {
        const hpd = objectiveToHizbPerDay(s.quantity, s.unit, s.period);
        console.log(`    ${s.program.code}: ${s.quantity} ${s.unit}/${s.period} => ${hpd.toFixed(4)} hizb/day`);
      }
    }

    // Quick consistency: if they have cycles and positions, do a quick recalc
    const userLastRevCycle = userCycles.filter(c => c.type === 'REVISION').slice(-1)[0] || null;
    const userLastLecCycle = userCycles.filter(c => c.type === 'LECTURE').slice(-1)[0] || null;

    const userReadSettings = userSettings.find(s => s.program.code === 'READING');
    const userRevSettings = userSettings.find(s => s.program.code === 'REVISION');

    if (userReadSettings || userRevSettings) {
      const userReadHpd = userReadSettings ? objectiveToHizbPerDay(userReadSettings.quantity, userReadSettings.unit, userReadSettings.period) : 0;
      const userRevHpd = userRevSettings ? objectiveToHizbPerDay(userRevSettings.quantity, userRevSettings.unit, userRevSettings.period) : 0;

      // Count days since last cycles
      if (readingProg) {
        const readDaysSince = await prisma.dailyProgramCompletion.count({
          where: {
            userId: user.id,
            programId: readingProg.id,
            completed: true,
            ...(userLastLecCycle ? { date: { gt: userLastLecCycle.completedAt } } : {})
          }
        });
        const expectedReadHizb = readDaysSince * userReadHpd;
        console.log(`  Expected reading hizb (${readDaysSince} days * ${userReadHpd.toFixed(4)}): ~${expectedReadHizb.toFixed(2)}`);
        console.log(`  Stored reading hizb: ${user.readingCurrentHizb ?? 'null'}`);
        if (user.readingCurrentHizb != null) {
          const diff = Math.abs(user.readingCurrentHizb - expectedReadHizb);
          console.log(`  Difference: ${diff.toFixed(2)} ${status(diff < 5)}`);
        }
      }

      if (revisionProg) {
        const revDaysSince = await prisma.dailyProgramCompletion.count({
          where: {
            userId: user.id,
            programId: revisionProg.id,
            completed: true,
            ...(userLastRevCycle ? { date: { gt: userLastRevCycle.completedAt } } : {})
          }
        });
        const expectedRevHizb = revDaysSince * userRevHpd;
        console.log(`  Expected revision hizb (${revDaysSince} days * ${userRevHpd.toFixed(4)}): ~${expectedRevHizb.toFixed(2)}`);
        console.log(`  Stored revision hizb: ${user.revisionCurrentHizb ?? 'null'}`);
        if (user.revisionCurrentHizb != null) {
          const diff = Math.abs(user.revisionCurrentHizb - expectedRevHizb);
          console.log(`  Difference: ${diff.toFixed(2)} ${status(diff < 5)}`);
        }
      }
    } else {
      console.log('  No active reading/revision objectives - skipping position check.');
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ════════════════════════════════════════════════════════════════════
  separator('SUMMARY');

  const checks = [
    { name: 'Memorized zone calculable', pass: zone !== null },
    { name: 'Revision cycle daysToComplete consistent', pass: (() => {
      for (let i = 1; i < revisionCycles.length; i++) {
        if (revisionCycles[i].daysToComplete !== daysBetween(revisionCycles[i-1].completedAt, revisionCycles[i].completedAt)) return false;
      }
      return true;
    })() },
    { name: 'Lecture cycle daysToComplete consistent', pass: (() => {
      for (let i = 1; i < lectureCycles.length; i++) {
        if (lectureCycles[i].daysToComplete !== daysBetween(lectureCycles[i-1].completedAt, lectureCycles[i].completedAt)) return false;
      }
      return true;
    })() },
    { name: 'readingCurrentHizb matches recalc', pass: readingMatch },
    { name: 'revisionCurrentHizb matches recalc', pass: revisionMatch },
    { name: 'revisionSuspendedHizb matches recalc', pass: suspendedMatch },
  ];

  console.log(`  ${pad('Check', 50)} ${pad('Result', 10)}`);
  console.log(`  ${'-'.repeat(60)}`);
  for (const c of checks) {
    console.log(`  ${pad(c.name, 50)} ${status(c.pass)}`);
  }

  const passCount = checks.filter(c => c.pass).length;
  console.log('');
  console.log(`  Total: ${passCount}/${checks.length} checks passed`);
  if (passCount === checks.length) {
    console.log('  OVERALL: ALL CHECKS PASSED');
  } else {
    console.log('  OVERALL: SOME CHECKS FAILED - review details above');
  }

  console.log('');
  console.log('#'.repeat(80));
  console.log('#  END OF AUDIT');
  console.log('#'.repeat(80));
}

main()
  .catch(e => {
    console.error('AUDIT ERROR:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
