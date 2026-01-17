const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function importData() {
  console.log('📥 Lecture du fichier Excel...');
  const workbook = XLSX.readFile('docs/Suivi cours de coran.xlsx');
  const sheet = workbook.Sheets['Form Responses'];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`📊 ${data.length} lignes à importer`);

  // Récupérer le programme "Mémorisation"
  const memorizationProgram = await prisma.program.findFirst({
    where: { code: 'MEMORIZATION' }
  });

  if (!memorizationProgram) {
    console.error('❌ Programme "memorization" non trouvé');
    process.exit(1);
  }
  console.log(`✅ Programme trouvé: ${memorizationProgram.nameFr}`);

  // Extraire les utilisateurs uniques
  const uniqueUsers = [...new Set(data.map(row => row['Qui']).filter(Boolean))];
  console.log(`👥 ${uniqueUsers.length} utilisateurs uniques:`, uniqueUsers);

  // Récupérer l'admin pour createdBy
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const createdById = admin?.id || 'system';

  // Créer ou récupérer les utilisateurs
  const userMap = {};
  const defaultPassword = await bcrypt.hash('amilou123', 10);

  for (const userName of uniqueUsers) {
    if (!userName) continue;

    // Nettoyer le nom
    const cleanName = userName.trim();
    const email = cleanName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') + '@amilou.local';

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { name: cleanName },
          { email: email }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: email,
          name: cleanName,
          password: defaultPassword,
          role: 'USER'
        }
      });
      console.log(`  ✅ Utilisateur créé: ${cleanName} (${email})`);
    } else {
      console.log(`  ℹ️  Utilisateur existant: ${cleanName}`);
    }

    userMap[userName] = user.id;
  }

  // Importer les entrées de progression
  console.log('\n📝 Import des progressions...');
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of data) {
    try {
      const userName = row['Qui'];
      const surahNumber = row['Num_Sourate'];
      const verseStart = row['Verset début'];
      const verseEnd = row['Verset fin'];

      // Vérifier les données requises
      if (!userName || !surahNumber || !verseStart || !verseEnd) {
        skipped++;
        continue;
      }

      const userId = userMap[userName];
      if (!userId) {
        skipped++;
        continue;
      }

      // Convertir la date Excel en date JS
      let date;
      const excelDate = row['Date'];
      if (typeof excelDate === 'number') {
        // Excel date serial number
        date = new Date((excelDate - 25569) * 86400 * 1000);
      } else if (excelDate) {
        date = new Date(excelDate);
      } else {
        date = new Date();
      }

      // Vérifier si l'entrée existe déjà
      const existing = await prisma.progress.findFirst({
        where: {
          userId: userId,
          programId: memorizationProgram.id,
          date: date,
          surahNumber: parseInt(surahNumber),
          verseStart: parseInt(verseStart),
          verseEnd: parseInt(verseEnd)
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Créer l'entrée de progression
      await prisma.progress.create({
        data: {
          userId: userId,
          programId: memorizationProgram.id,
          date: date,
          surahNumber: parseInt(surahNumber),
          verseStart: parseInt(verseStart),
          verseEnd: parseInt(verseEnd),
          repetitions: row['Répétition'] ? parseInt(row['Répétition']) : null,
          comment: row['Commentaire mémorisation'] || null,
          createdBy: createdById
        }
      });

      imported++;

      if (imported % 100 === 0) {
        console.log(`  📊 ${imported} entrées importées...`);
      }
    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`  ❌ Erreur ligne:`, error.message);
      }
    }
  }

  console.log('\n🎉 Import terminé!');
  console.log(`  ✅ Importées: ${imported}`);
  console.log(`  ⏭️  Ignorées: ${skipped}`);
  console.log(`  ❌ Erreurs: ${errors}`);

  await prisma.$disconnect();
}

importData().catch(console.error);
