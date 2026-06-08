const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check key verses
  const samples = [
    { s: 1, v: 1, expectedHizb: 1, expectedJuz: 1 },
    { s: 2, v: 75, expectedHizb: 2, expectedJuz: 1 },
    { s: 2, v: 142, expectedHizb: 3, expectedJuz: 2 },
    { s: 7, v: 1, expectedHizb: 16, expectedJuz: 8 },
    { s: 78, v: 1, expectedHizb: 59, expectedJuz: 30 },
    { s: 87, v: 1, expectedHizb: 60, expectedJuz: 30 },
  ];

  console.log('=== Etat actuel hizb/juz dans Supabase ===');
  for (const s of samples) {
    const verse = await prisma.verse.findUnique({
      where: { surahNumber_verseNumber: { surahNumber: s.s, verseNumber: s.v } }
    });
    const ok = verse.hizb === s.expectedHizb && verse.juz === s.expectedJuz;
    console.log(`S${s.s}:v${s.v} => hizb=${verse.hizb} (attendu ${s.expectedHizb}) juz=${verse.juz} (attendu ${s.expectedJuz}) ${ok ? 'OK' : 'WRONG'}`);
  }

  // Count distinct hizb values and check for fractional
  const distinctHizb = await prisma.$queryRawUnsafe('SELECT COUNT(DISTINCT hizb) as cnt FROM "Verse"');
  console.log('\nNombre de valeurs hizb distinctes:', distinctHizb[0].cnt.toString());

  const fractional = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "Verse" WHERE hizb != FLOOR(hizb)');
  console.log('Versets avec hizb fractionnaire:', fractional[0].cnt.toString());

  const distinctJuz = await prisma.$queryRawUnsafe('SELECT COUNT(DISTINCT juz) as cnt FROM "Verse"');
  console.log('Nombre de valeurs juz distinctes:', distinctJuz[0].cnt.toString());
}

main().catch(console.error).finally(() => prisma.$disconnect());
