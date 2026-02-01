/**
 * Import Suivi Famille data from Excel
 *
 * Status codes:
 * - X: Supposé connu
 * - AM: À mémoriser
 * - V{n}: Validé à la séance n (ex: V4, V12)
 * - S{n}: Récité à un élève à la séance n (ex: S4, S12)
 * - 0.5, 0.51, 0.9: Pourcentages
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-suivi-famille.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

const STUDENT_START_COL = 8;

// Parse status code to extract base status and week number
function parseStatusCode(code: string | number): { status: string; weekNumber: number | null } {
  if (code === null || code === undefined || code === '') return { status: '', weekNumber: null };

  // Handle numeric values (percentages stored as decimals)
  if (typeof code === 'number') {
    if (code === 0.5) return { status: '50%', weekNumber: null };
    if (code === 0.51) return { status: '51%', weekNumber: null };
    if (code === 0.9) return { status: '90%', weekNumber: null };
    // Other numbers, convert to string
    return { status: String(code), weekNumber: null };
  }

  const normalized = code.trim().toUpperCase();

  // Handle percentage strings
  if (normalized === '50%' || normalized === '0.5') return { status: '50%', weekNumber: null };
  if (normalized === '51%' || normalized === '0.51') return { status: '51%', weekNumber: null };
  if (normalized === '90%' || normalized === '0.9') return { status: '90%', weekNumber: null };

  // V{n} -> status: V, weekNumber: n
  const vMatch = normalized.match(/^V(\d+)$/);
  if (vMatch) {
    return { status: 'V', weekNumber: parseInt(vMatch[1]) };
  }

  // S{n} -> status: S, weekNumber: n
  const sMatch = normalized.match(/^S(\d+)$/);
  if (sMatch) {
    return { status: 'S', weekNumber: parseInt(sMatch[1]) };
  }

  // AM, X, etc. -> as is
  return { status: normalized, weekNumber: null };
}

async function main() {
  console.log('🚀 Import Suivi Famille\n');

  // 1. Find the group
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Famille' } }
  });

  if (!group) {
    console.error('❌ Groupe "Famille" non trouvé');
    return;
  }
  console.log(`✅ Groupe trouvé: ${group.name}\n`);

  // 2. Get group members
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true }
  });

  // Create name to userId mapping (flexible matching)
  const nameToUserId: Record<string, string> = {};
  for (const m of members) {
    if (m.user.name) {
      // Store full name
      nameToUserId[m.user.name] = m.user.id;
      // Also store first name for matching
      const firstName = m.user.name.split(' ')[0];
      if (firstName) {
        nameToUserId[firstName] = m.user.id;
      }
    }
  }
  console.log(`👥 ${members.length} membres trouvés:`);
  members.forEach(m => console.log(`   - ${m.user.name}`));
  console.log('');

  // 3. Read Excel file
  const excelPath = path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Suivi Famille'];

  if (!sheet) {
    console.error('❌ Feuille "Suivi Famille" non trouvée');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // 4. Get header row (student names)
  const headerRow = data[0];
  const studentNames = headerRow.slice(STUDENT_START_COL);
  console.log(`📋 Étudiants dans Excel: ${studentNames.join(', ')}\n`);

  // Map Excel names to user IDs
  const excelNameToUserId: Record<number, string | null> = {};
  studentNames.forEach((name, idx) => {
    if (name && typeof name === 'string') {
      const userId = nameToUserId[name] || nameToUserId[name.split(' ')[0]];
      excelNameToUserId[idx] = userId || null;
      if (userId) {
        console.log(`   ✓ "${name}" -> trouvé`);
      } else {
        console.log(`   ✗ "${name}" -> non trouvé`);
      }
    }
  });
  console.log('');

  // 5. Get sessions for week number mapping
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    orderBy: { weekNumber: 'asc' }
  });
  const weekToSession: Record<number, string> = {};
  for (const s of sessions) {
    if (s.weekNumber) {
      weekToSession[s.weekNumber] = s.id;
    }
  }
  console.log(`📅 ${sessions.length} séances trouvées\n`);

  // 6. Clear existing SurahMastery for this group's users
  const userIds = members.map(m => m.userId);
  const deleted = await prisma.surahMastery.deleteMany({
    where: { userId: { in: userIds } }
  });
  console.log(`🗑️  Supprimé ${deleted.count} enregistrements SurahMastery existants\n`);

  // 7. Process each surah row
  let masteryCreated = 0;
  let recitationsCreated = 0;
  let skipped = 0;

  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    const surahNumber = row[1]; // Numéro de sourate is in column 1

    if (!surahNumber || typeof surahNumber !== 'number') continue;

    // Process each student column
    for (let colIdx = 0; colIdx < studentNames.length; colIdx++) {
      const userId = excelNameToUserId[colIdx];

      if (!userId) {
        continue;
      }

      const cellValue = row[STUDENT_START_COL + colIdx];
      if (!cellValue) continue;

      const { status, weekNumber } = parseStatusCode(cellValue);
      if (!status) continue;

      // Create SurahMastery record
      await prisma.surahMastery.upsert({
        where: {
          userId_surahNumber: {
            userId,
            surahNumber
          }
        },
        create: {
          userId,
          surahNumber,
          status,
          validatedWeek: weekNumber,
          validatedAt: weekNumber ? new Date() : null
        },
        update: {
          status,
          validatedWeek: weekNumber,
          validatedAt: weekNumber ? new Date() : null
        }
      });
      masteryCreated++;

      // If there's a week number, also create a recitation in that session
      if (weekNumber && weekToSession[weekNumber]) {
        const sessionId = weekToSession[weekNumber];
        const surah = await prisma.surah.findUnique({ where: { number: surahNumber } });

        if (surah) {
          // Check if recitation already exists
          const existing = await prisma.surahRecitation.findFirst({
            where: {
              sessionId,
              userId,
              surahNumber
            }
          });

          if (!existing) {
            await prisma.surahRecitation.create({
              data: {
                sessionId,
                userId,
                surahNumber,
                type: 'MEMORIZATION',
                verseStart: 1,
                verseEnd: surah.totalVerses,
                status,
                comment: `Import: ${cellValue}`,
                createdBy: userId
              }
            });
            recitationsCreated++;
          }
        }
      }
    }
  }

  console.log(`\n✨ Import terminé!`);
  console.log(`📊 Résumé:`);
  console.log(`   - ${masteryCreated} enregistrements SurahMastery créés`);
  console.log(`   - ${recitationsCreated} récitations créées`);

  // Summary by status
  const masteryStats = await prisma.surahMastery.groupBy({
    by: ['status'],
    where: { userId: { in: userIds } },
    _count: { status: true }
  });

  console.log(`\n📊 Distribution par statut:`);
  for (const stat of masteryStats) {
    console.log(`   ${stat.status}: ${stat._count.status}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
