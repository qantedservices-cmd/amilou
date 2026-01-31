const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const EXCEL_FILE = path.join(__dirname, '../docs/Suivi cours de coran.xlsx');

// User mapping (Excel name -> email)
const USER_EMAILS = {
  'Samir': 'samir@amilou.com',
  'Mohamed B.': 'mohamedb@amilou.com',
  'Yazid': 'yazid@amilou.com',
  'Ibrahim': 'ibrahim@amilou.com',
  'Abdelmoughite': 'abdelmoughite@amilou.com',
  'Mohamed Koucha': 'mohamedkoucha@amilou.com',
  'Amine': 'amine@amilou.com',
};

async function main() {
  console.log('=== IMPORT EXCEL DATA TO SUPABASE ===\n');

  // Load Excel file
  const workbook = XLSX.readFile(EXCEL_FILE);

  // Get programs
  const programs = await prisma.program.findMany();
  const programMap = {};
  programs.forEach(p => programMap[p.code] = p.id);
  console.log('Programs loaded:', Object.keys(programMap).join(', '));

  // Get surahs
  const surahs = await prisma.surah.findMany();
  const surahMap = {};
  surahs.forEach(s => surahMap[s.number] = s.id);
  console.log('Surahs loaded:', surahs.length);

  // 1. Import Verses (Pages_Versets sheet)
  console.log('\n--- 1. IMPORTING VERSES ---');
  const versesSheet = workbook.Sheets['Pages_Versets'];
  const versesData = XLSX.utils.sheet_to_json(versesSheet);

  let versesCreated = 0;
  for (const row of versesData) {
    // Column names: Num_Sourate, Num_Verset, Page
    const surahNumber = row['Num_Sourate'];
    const verseNumber = row['Num_Verset'];
    const page = row['Page'];

    if (!surahNumber || !verseNumber || !page) continue;

    try {
      await prisma.verse.upsert({
        where: {
          surahNumber_verseNumber: {
            surahNumber: parseInt(surahNumber),
            verseNumber: parseInt(verseNumber)
          }
        },
        update: {
          page: parseInt(page),
        },
        create: {
          surahNumber: parseInt(surahNumber),
          verseNumber: parseInt(verseNumber),
          page: parseInt(page),
        }
      });
      versesCreated++;
    } catch (e) {
      // Skip errors
      if (versesCreated < 5) console.log(`  Verse error: ${e.message}`);
    }
  }
  console.log(`Verses created/updated: ${versesCreated}`);

  // 2. Create Users
  console.log('\n--- 2. CREATING USERS ---');
  const userMap = {};
  const defaultPassword = await bcrypt.hash('amilou2024', 10);

  for (const [name, email] of Object.entries(USER_EMAILS)) {
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: defaultPassword,
          role: 'USER',
        }
      });
      console.log(`  Created: ${name} (${email})`);
    } else {
      console.log(`  Exists: ${name} (${email})`);
    }
    userMap[name] = user.id;
  }

  // 3. Import Form Responses
  console.log('\n--- 3. IMPORTING FORM RESPONSES ---');
  const formSheet = workbook.Sheets['Form Responses'];
  const formData = XLSX.utils.sheet_to_json(formSheet);

  let progressCreated = 0;
  let attendanceCreated = 0;

  for (const row of formData) {
    const userName = row['Qui'];
    const userId = userMap[userName];

    if (!userId) {
      console.log(`  Skip: Unknown user ${userName}`);
      continue;
    }

    const type = row['Type de suivi'];
    const year = row['Année'];
    const week = row['Semaine'];

    if (type === 'Avancement Mémorisation') {
      // Parse sourate number from string like "البقرة N° 2 // 286 versets"
      const sourateMatch = row['Sourate']?.match(/N°\s*(\d+)/);
      const surahNumber = sourateMatch ? parseInt(sourateMatch[1]) : null;

      if (!surahNumber || !row['Verset début'] || !row['Verset fin']) continue;

      // Calculate date from year and week
      const date = getDateFromYearWeek(year, week);

      try {
        await prisma.progress.create({
          data: {
            userId,
            programId: programMap['MEMORIZATION'],
            surahId: surahMap[surahNumber],
            surahNumber,
            verseStart: parseInt(row['Verset début']),
            verseEnd: parseInt(row['Verset fin']),
            date,
            createdBy: userId,
          }
        });
        progressCreated++;
      } catch (e) {
        // Skip if already exists or error
        if (!e.message.includes('Unique constraint')) {
          console.log(`  Error Progress: ${e.message}`);
        }
      }
    } else if (type === 'Assiduité au quotidien') {
      // Calculate week start date (Sunday)
      const weekStart = getWeekStart(year, week);

      try {
        await prisma.dailyAttendance.upsert({
          where: {
            userId_date: {
              userId,
              date: weekStart
            }
          },
          update: {
            sunday: parseInt(row['Dimanche']) || 0,
            monday: parseInt(row['Lundi']) || 0,
            tuesday: parseInt(row['Mardi']) || 0,
            wednesday: parseInt(row['Mercredi']) || 0,
            thursday: parseInt(row['Jeudi']) || 0,
            friday: parseInt(row['Vendredi']) || 0,
            saturday: parseInt(row['Samedi']) || 0,
            comment: row['Commentaire assiduité'] || null,
          },
          create: {
            userId,
            date: weekStart,
            sunday: parseInt(row['Dimanche']) || 0,
            monday: parseInt(row['Lundi']) || 0,
            tuesday: parseInt(row['Mardi']) || 0,
            wednesday: parseInt(row['Mercredi']) || 0,
            thursday: parseInt(row['Jeudi']) || 0,
            friday: parseInt(row['Vendredi']) || 0,
            saturday: parseInt(row['Samedi']) || 0,
            comment: row['Commentaire assiduité'] || null,
            createdBy: userId,
          }
        });
        attendanceCreated++;
      } catch (e) {
        console.log(`  Error Attendance: ${e.message}`);
      }
    }
  }

  console.log(`Progress entries created: ${progressCreated}`);
  console.log(`Attendance entries created: ${attendanceCreated}`);

  // Final counts
  console.log('\n=== FINAL COUNTS ===');
  console.log('Users:', await prisma.user.count());
  console.log('Verses:', await prisma.verse.count());
  console.log('Progress:', await prisma.progress.count());
  console.log('DailyAttendance:', await prisma.dailyAttendance.count());

  await prisma.$disconnect();
}

// Get date from year and week number (week starts on Sunday)
function getDateFromYearWeek(year, week) {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay(); // 0 = Sunday

  // First Sunday of the year
  const firstSunday = new Date(year, 0, 1 - jan1Day);

  // Add weeks
  const date = new Date(firstSunday);
  date.setDate(firstSunday.getDate() + (week - 1) * 7);

  return date;
}

// Get week start (Sunday) from year and week
function getWeekStart(year, week) {
  return getDateFromYearWeek(year, week);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
