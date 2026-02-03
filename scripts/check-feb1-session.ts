import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find session for Feb 1, 2026
  const session = await prisma.groupSession.findFirst({
    where: {
      group: { name: { contains: 'Amilou' } },
      date: {
        gte: new Date('2026-01-31'),
        lt: new Date('2026-02-02')
      }
    },
    include: {
      attendance: {
        include: { user: { select: { name: true } } }
      }
    }
  });

  if (session) {
    console.log('Séance trouvée:', session.date.toISOString().split('T')[0]);
    console.log('Semaine:', session.weekNumber);
    console.log('Notes séance:', session.notes);
    console.log('\nPrésences:');
    for (const a of session.attendance) {
      console.log('  ' + a.user.name + ': présent=' + a.present + ', note=' + (a.note || '(vide)'));
    }
  } else {
    console.log('Séance non trouvée');
  }

  // Check Progress entries for that date
  console.log('\n=== Progress du 1er février ===');
  const progress = await prisma.progress.findMany({
    where: {
      date: {
        gte: new Date('2026-01-31'),
        lt: new Date('2026-02-02')
      }
    },
    include: {
      user: { select: { name: true } },
      surah: { select: { nameFr: true } }
    }
  });

  for (const p of progress) {
    console.log(p.user.name + ': ' + (p.surah?.nameFr || 'Sourate ' + p.surahNumber) + ' v' + p.verseStart + '-' + p.verseEnd + ' | commentaire: ' + (p.comment || '(vide)'));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
