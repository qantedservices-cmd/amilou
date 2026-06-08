const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const amilou = await prisma.group.findFirst({ where: { name: { contains: 'Amilou' } } });
  const memProg = await prisma.program.findFirst({ where: { code: 'MEMORIZATION' } });

  // 1. Add missing Progress for Abdelmoughite: S30 v.29-52
  const abdel = await prisma.user.findFirst({ where: { name: { contains: 'Abdelmoughite' } } });
  if (abdel) {
    const existing = await prisma.progress.findFirst({
      where: { userId: abdel.id, surahNumber: 30, verseStart: 29, verseEnd: 52, programId: memProg.id }
    });
    if (!existing) {
      const p = await prisma.progress.create({
        data: {
          userId: abdel.id,
          surahNumber: 30,
          verseStart: 29,
          verseEnd: 52,
          programId: memProg.id,
          date: new Date('2026-02-09'),
          createdBy: abdel.id,
          comment: 'Import depuis Excel'
        }
      });
      console.log('Created Progress for Abdelmoughite S30 v.29-52:', p.id);
    } else {
      console.log('Abdelmoughite S30 v.29-52 already exists');
    }
  }

  // 2. Create SurahMastery 'V' for Samir on S4 (An-Nissa) and S5 (Al-Maidah)
  const samir = await prisma.user.findFirst({ where: { name: 'Samir' } });
  if (samir) {
    for (const surahNum of [4, 5]) {
      const existing = await prisma.surahMastery.findFirst({
        where: { userId: samir.id, surahNumber: surahNum }
      });
      if (!existing) {
        const m = await prisma.surahMastery.create({
          data: {
            userId: samir.id,
            surahNumber: surahNum,
            status: 'V',
            validatedWeek: null,
            validatedAt: new Date()
          }
        });
        console.log('Created SurahMastery V for Samir S' + surahNum + ':', m.id);
      } else {
        console.log('SurahMastery for Samir S' + surahNum + ' already exists:', existing.status);
        if (existing.status !== 'V') {
          await prisma.surahMastery.update({
            where: { id: existing.id },
            data: { status: 'V', validatedAt: new Date() }
          });
          console.log('  Updated to V');
        }
      }
    }
  }

  // Verify
  console.log('\n=== Vérification ===');
  const samirMastery = await prisma.surahMastery.findMany({
    where: { userId: samir.id },
    include: { surah: { select: { nameFr: true } } },
    orderBy: { surahNumber: 'asc' }
  });
  console.log('SurahMastery Samir:', samirMastery.length, 'entrées');
  for (const m of samirMastery) {
    console.log('  S' + m.surahNumber, m.surah.nameFr, '| status:', m.status);
  }

  const abdelProg = await prisma.progress.findMany({
    where: { userId: abdel.id, surahNumber: 30, programId: memProg.id }
  });
  console.log('\nProgress Abdelmoughite S30:', abdelProg.length, 'entrées');
  for (const p of abdelProg) {
    console.log('  v.' + p.verseStart + '-' + p.verseEnd);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
