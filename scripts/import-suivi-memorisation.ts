/**
 * Import Suivi Mémorisation data from Excel
 *
 * Status codes:
 * - X: Supposé connu
 * - AM: À mémoriser
 * - V{n}: Validé à la séance n (ex: V4, V12)
 * - S{n}: Récité à un élève à la séance n (ex: S4, S12)
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-suivi-memorisation.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Statuses that count as validated for Progress
const VALIDATED_STATUSES = ['V', 'X', '50%', '51%', '90%'];

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
  console.log('🚀 Import Suivi Mémorisation\n');

  // 1. Find the group
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Montmagny' } }
  });

  if (!group) {
    console.error('❌ Groupe "Cours Montmagny" non trouvé');
    return;
  }
  console.log(`✅ Groupe trouvé: ${group.name}\n`);

  // 2. Get group members
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true }
  });

  // Create name to userId mapping
  const nameToUserId: Record<string, string> = {};
  for (const m of members) {
    if (m.user.name) {
      nameToUserId[m.user.name] = m.user.id;
    }
  }
  console.log(`👥 ${members.length} membres trouvés\n`);

  // 3. Read Excel file
  const excelPath = path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Suivi Mémorisation'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // 4. Get header row (student names)
  const headerRow = data[0];
  const studentNames = headerRow.slice(STUDENT_START_COL);
  console.log(`📋 Étudiants: ${studentNames.join(', ')}\n`);

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

  // 5b. Get MEMORIZATION program for Progress entries
  const memorizationProgram = await prisma.program.findFirst({
    where: { code: 'MEMORIZATION' }
  });
  if (!memorizationProgram) {
    console.error('❌ Programme MEMORIZATION non trouvé');
    return;
  }

  // 6. Clear existing SurahMastery and Progress for this group's users
  const userIds = members.map(m => m.userId);
  const deletedMastery = await prisma.surahMastery.deleteMany({
    where: { userId: { in: userIds } }
  });
  const deletedProgress = await prisma.progress.deleteMany({
    where: {
      userId: { in: userIds },
      programId: memorizationProgram.id,
      comment: { startsWith: 'Import depuis' }
    }
  });
  console.log(`🗑️  Supprimé ${deletedMastery.count} SurahMastery, ${deletedProgress.count} Progress existants\n`);

  // 7. Process each surah row
  let masteryCreated = 0;
  let recitationsCreated = 0;
  let progressCreated = 0;

  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    const surahNumber = row[1];

    if (!surahNumber || typeof surahNumber !== 'number') continue;

    // Process each student column
    for (let colIdx = 0; colIdx < studentNames.length; colIdx++) {
      const studentName = studentNames[colIdx];
      const userId = nameToUserId[studentName];

      if (!userId) continue;

      const cellValue = row[STUDENT_START_COL + colIdx];
      if (!cellValue) continue;

      const { status, weekNumber } = parseStatusCode(String(cellValue));
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

      // Also create Progress entry for validated statuses (for dashboard)
      if (VALIDATED_STATUSES.includes(status)) {
        const surah = await prisma.surah.findUnique({ where: { number: surahNumber } });
        if (surah) {
          // Calculate verse range based on status
          let verseEnd = surah.totalVerses;
          if (status === '50%' || status === '51%') {
            verseEnd = Math.ceil(surah.totalVerses * 0.5);
          } else if (status === '90%') {
            verseEnd = Math.ceil(surah.totalVerses * 0.9);
          }

          // Check if Progress already exists
          const existingProgress = await prisma.progress.findFirst({
            where: {
              userId,
              surahNumber,
              programId: memorizationProgram.id
            }
          });

          if (!existingProgress) {
            await prisma.progress.create({
              data: {
                id: randomUUID(),
                userId,
                surahNumber,
                programId: memorizationProgram.id,
                verseStart: 1,
                verseEnd,
                date: new Date(),
                comment: `Import depuis SurahMastery (${status})`,
                createdBy: userId,
                updatedAt: new Date()
              }
            });
            progressCreated++;
          }
        }
      }

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
  console.log(`   - ${progressCreated} enregistrements Progress créés (dashboard)`);
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
