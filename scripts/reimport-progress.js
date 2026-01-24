const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Read import data
  const dataPath = path.join(__dirname, 'progress_reimport.json');
  const entries = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`Chargement de ${entries.length} entrées...`);

  // Get users
  const users = await prisma.user.findMany();
  const userMap = {};
  users.forEach(u => userMap[u.email] = u.id);

  // Get program (Mémorisation)
  const program = await prisma.program.findFirst({ where: { code: 'MEMORIZATION' } });
  if (!program) {
    console.error('Programme MEMORIZATION non trouvé!');
    process.exit(1);
  }

  // Delete existing progress
  console.log('Suppression des anciennes entrées Progress...');
  const deleted = await prisma.progress.deleteMany({});
  console.log(`${deleted.count} entrées supprimées.`);

  // Import new entries
  console.log('Import des nouvelles entrées...');
  let imported = 0;
  let errors = 0;

  for (const entry of entries) {
    const userId = userMap[entry.email];
    if (!userId) {
      console.warn(`Utilisateur non trouvé: ${entry.email}`);
      errors++;
      continue;
    }

    try {
      await prisma.progress.create({
        data: {
          userId,
          programId: program.id,
          date: new Date(entry.date),
          surahNumber: entry.surah,
          verseStart: entry.verseStart,
          verseEnd: entry.verseEnd,
          repetitions: entry.repetitions,
          comment: entry.comment,
          createdBy: userId
        }
      });
      imported++;
    } catch (err) {
      console.error(`Erreur pour ${entry.email} sourate ${entry.surah}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nTerminé: ${imported} entrées importées, ${errors} erreurs`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
