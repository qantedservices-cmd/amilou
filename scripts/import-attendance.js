const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(__dirname, 'attendance_import.json');
  const entries = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`Chargement de ${entries.length} entrées d'assiduité...`);

  // Get users
  const users = await prisma.user.findMany();
  const userMap = {};
  users.forEach(u => userMap[u.email] = u.id);

  // Delete existing attendance
  const deleted = await prisma.dailyAttendance.deleteMany({});
  console.log(`${deleted.count} entrées existantes supprimées.`);

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
      await prisma.dailyAttendance.upsert({
        where: {
          userId_date: {
            userId,
            date: new Date(entry.date)
          }
        },
        update: {
          sunday: entry.sunday,
          monday: entry.monday,
          tuesday: entry.tuesday,
          wednesday: entry.wednesday,
          thursday: entry.thursday,
          friday: entry.friday,
          saturday: entry.saturday,
          comment: entry.comment
        },
        create: {
          userId,
          date: new Date(entry.date),
          sunday: entry.sunday,
          monday: entry.monday,
          tuesday: entry.tuesday,
          wednesday: entry.wednesday,
          thursday: entry.thursday,
          friday: entry.friday,
          saturday: entry.saturday,
          comment: entry.comment,
          createdBy: userId
        }
      });
      imported++;
    } catch (err) {
      console.error(`Erreur pour ${entry.email} ${entry.date}: ${err.message}`);
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
