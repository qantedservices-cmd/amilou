const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function importData() {
  console.log('📥 Lecture du fichier Excel...');
  const workbook = XLSX.readFile('docs/Suivi cours de coran.xlsx');
  const sheet = workbook.Sheets['Form Responses'];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`📊 ${data.length} lignes totales`);

  // Séparer par type
  const memorisationRows = data.filter(r => r['Type de suivi'] === 'Avancement Mémorisation');
  const assiduitéRows = data.filter(r => r['Type de suivi'] === 'Assiduité au quotidien');

  console.log(`  - Mémorisation: ${memorisationRows.length} entrées`);
  console.log(`  - Assiduité: ${assiduitéRows.length} entrées`);

  // Récupérer le programme "Mémorisation"
  const memorizationProgram = await prisma.program.findFirst({
    where: { code: 'MEMORIZATION' }
  });

  if (!memorizationProgram) {
    console.error('❌ Programme "MEMORIZATION" non trouvé. Lancez d\'abord le seed.');
    process.exit(1);
  }
  console.log(`✅ Programme trouvé: ${memorizationProgram.nameFr}`);

  // Extraire les utilisateurs uniques des deux types
  const allUsers = [...memorisationRows, ...assiduitéRows].map(row => row['Qui']).filter(Boolean);
  const uniqueUsers = [...new Set(allUsers)];
  console.log(`\n👥 ${uniqueUsers.length} utilisateurs uniques:`, uniqueUsers);

  // Récupérer l'admin pour createdBy
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const createdById = admin?.id || 'system';

  // Créer ou récupérer les utilisateurs
  const userMap = {};
  const defaultPassword = await bcrypt.hash('amilou123', 10);

  for (const userName of uniqueUsers) {
    if (!userName) continue;

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

  // ========================================
  // IMPORT MÉMORISATION
  // ========================================
  console.log('\n📝 Import des progressions (Mémorisation)...');
  let importedProgress = 0;
  let skippedProgress = 0;
  let errorsProgress = 0;

  for (const row of memorisationRows) {
    try {
      const userName = row['Qui'];
      const surahNumber = row['Num_Sourate'];
      const verseStart = row['Verset début'];
      const verseEnd = row['Verset fin'];

      if (!userName || !surahNumber || !verseStart || !verseEnd) {
        skippedProgress++;
        continue;
      }

      const userId = userMap[userName];
      if (!userId) {
        skippedProgress++;
        continue;
      }

      // Convertir la date Excel
      let date;
      const excelDate = row['Date'];
      if (typeof excelDate === 'number') {
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
          surahNumber: parseInt(surahNumber),
          verseStart: parseInt(verseStart),
          verseEnd: parseInt(verseEnd)
        }
      });

      if (existing) {
        skippedProgress++;
        continue;
      }

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

      importedProgress++;
    } catch (error) {
      errorsProgress++;
      if (errorsProgress <= 5) {
        console.error(`  ❌ Erreur progression:`, error.message);
      }
    }
  }

  console.log(`  ✅ Importées: ${importedProgress}`);
  console.log(`  ⏭️  Ignorées: ${skippedProgress}`);
  console.log(`  ❌ Erreurs: ${errorsProgress}`);

  // ========================================
  // IMPORT ASSIDUITÉ
  // ========================================
  console.log('\n📅 Import de l\'assiduité...');
  let importedAttendance = 0;
  let skippedAttendance = 0;
  let errorsAttendance = 0;

  for (const row of assiduitéRows) {
    try {
      const userName = row['Qui'];
      if (!userName) {
        skippedAttendance++;
        continue;
      }

      const userId = userMap[userName];
      if (!userId) {
        skippedAttendance++;
        continue;
      }

      // Convertir la date Excel (utiliser Timestamp ou Date)
      let date;
      const excelDate = row['Date'] || row['Timestamp'];
      if (typeof excelDate === 'number') {
        date = new Date((excelDate - 25569) * 86400 * 1000);
      } else if (excelDate) {
        date = new Date(excelDate);
      } else {
        date = new Date();
      }

      // Normaliser la date au début de semaine (dimanche)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      weekStart.setHours(0, 0, 0, 0);

      // Convertir les valeurs en booléens (> 0 = présent)
      const sunday = row['Dimanche'] > 0;
      const monday = row['Lundi'] > 0;
      const tuesday = row['Mardi'] > 0;
      const wednesday = row['Mercredi'] > 0;
      const thursday = row['Jeudi'] > 0;
      const friday = row['Vendredi'] > 0;
      const saturday = row['Samedi'] > 0;

      // Vérifier si l'entrée existe déjà
      const existing = await prisma.dailyAttendance.findFirst({
        where: {
          userId: userId,
          date: weekStart
        }
      });

      if (existing) {
        // Mettre à jour l'existant
        await prisma.dailyAttendance.update({
          where: { id: existing.id },
          data: {
            sunday, monday, tuesday, wednesday, thursday, friday, saturday,
            comment: row['Commentaire assiduité'] || existing.comment
          }
        });
        skippedAttendance++;
        continue;
      }

      await prisma.dailyAttendance.create({
        data: {
          userId: userId,
          date: weekStart,
          sunday,
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          comment: row['Commentaire assiduité'] || null,
          createdBy: createdById
        }
      });

      importedAttendance++;
    } catch (error) {
      errorsAttendance++;
      if (errorsAttendance <= 5) {
        console.error(`  ❌ Erreur assiduité:`, error.message);
      }
    }
  }

  console.log(`  ✅ Importées: ${importedAttendance}`);
  console.log(`  ⏭️  Ignorées/MAJ: ${skippedAttendance}`);
  console.log(`  ❌ Erreurs: ${errorsAttendance}`);

  // ========================================
  // RÉSUMÉ
  // ========================================
  console.log('\n🎉 Import terminé!');
  console.log('=====================================');
  console.log(`Utilisateurs: ${Object.keys(userMap).length}`);
  console.log(`Progressions: ${importedProgress} importées`);
  console.log(`Assiduité: ${importedAttendance} importées`);
  console.log('=====================================');
  console.log('\n💡 Les utilisateurs créés ont le mot de passe: amilou123');

  await prisma.$disconnect();
}

importData().catch(console.error);
