/**
 * Import Cours Montmagny sessions from Excel
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-montmagny-sessions.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// Excel date to JS Date
function excelToDate(excelDate: number): Date {
  return new Date((excelDate - 25569) * 86400 * 1000);
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Mapping from Excel full names to database names (first names)
const NAME_MAPPING: Record<string, string> = {
  'AIT ASSI Nassim': 'Nassim',
  'ATTAR Yanis': 'Yanis',
  'BEN BELKACEM Iyad': 'Iyad',
  'BEN BELKACEM Sabri': 'Sabri',
  'BOUAZZOUZ Sofiane': 'Sofiane',
  'BRIK Imran': 'Imran',
  'DJOUADI Souheil': 'Souheil',
  'FLILOU Houdeyfa': 'Houdeyfa',
  'GHANEM Anass': 'Anass',
  'KHEIR Mohamed': 'Mohamed',
  'LOGHMARI Bilel': 'Bilel',
  'MEDINI Younes': 'Younes',
  'RAMI Selim': 'Selim',
  'TANDJIGORA Luqman': 'Luqman',
};

// Mapping from comment first names to full database names
const COMMENT_NAME_MAPPING: Record<string, string> = {
  'Luqman': 'TANDJIGORA Luqman',
  'Anass': 'GHANEM Anass',
  'Yanis': 'ATTAR Yanis',
  'Iyed': 'BEN BELKACEM Iyad',
  'Iyad': 'BEN BELKACEM Iyad',
  'Souheil': 'DJOUADI Souheil',
  'Selim': 'RAMI Selim',
  'Soufiane': 'BOUAZZOUZ Sofiane',
  'Sofiane': 'BOUAZZOUZ Sofiane',
  'Mohamed': 'KHEIR Mohamed',
  'Sabri': 'BEN BELKACEM Sabri',
  'Nassim': 'AIT ASSI Nassim',
  'Houdeyfa': 'FLILOU Houdeyfa',
  'Imran': 'BRIK Imran',
  'Bilel': 'LOGHMARI Bilel',
  'Younes': 'MEDINI Younes',
};

// Surah name mapping (approximate)
const SURAH_MAPPING: Record<string, number> = {
  'fatiha': 1,
  'nas': 114,
  'falaq': 113,
  'fala9': 113,
  'ikhlass': 112,
  'ikhlas': 112,
  'massad': 111,
  'nasr': 110,
  'kafiroun': 109,
  'kawthar': 108,
  'ma3oun': 107,
  'maoun': 107,
  'quraish': 106,
  'quraysh': 106,
  'fil': 105,
  'houmaza': 104,
  'houmza': 104,
  'asr': 103,
  'takathor': 102,
  'talathor': 102,
  'qari3a': 101,
  'qariyya': 101,
  '3adiyat': 100,
  'adiyat': 100,
  'zalzala': 99,
  '9al9ala': 99,
  'bayyina': 98,
  'qadr': 97,
  '3alaq': 96,
  'tin': 95,
  'sharh': 94,
  'inshirah': 94,
  'duha': 93,
  'layl': 92,
  'shams': 91,
  'balad': 90,
  'fajr': 89,
  'ghashiya': 88,
  'a3la': 87,
  'tariq': 86,
  'buruj': 85,
  'inshiqaq': 84,
  'mutaffifin': 83,
  'infitar': 82,
  'takwir': 81,
};

function findSurahNumber(surahName: string): number | null {
  if (!surahName) return null;
  const normalized = surahName.toLowerCase()
    .replace(/^al[- ]?/, '')
    .replace(/^an[- ]?/, '')
    .replace(/^at[- ]?/, '')
    .replace(/'/g, '')
    .trim();

  for (const [key, num] of Object.entries(SURAH_MAPPING)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return num;
    }
  }
  return null;
}

async function main() {
  console.log('🚀 Import des séances Cours Montmagny\n');

  // 1. Find the group
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Montmagny' } }
  });

  if (!group) {
    console.error('❌ Groupe "Cours Montmagny" non trouvé');
    return;
  }
  console.log(`✅ Groupe trouvé: ${group.name} (${group.id})\n`);

  // 2. Get group members
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true }
  });
  console.log(`👥 ${members.length} membres dans le groupe\n`);

  // Create name to userId mapping
  const nameToUserId: Record<string, string> = {};
  for (const m of members) {
    if (m.user.name) {
      nameToUserId[m.user.name] = m.user.id;
    }
  }
  console.log('Mapping noms -> userId:', Object.keys(nameToUserId));

  // 3. Delete existing test sessions
  console.log('\n🗑️  Suppression des séances existantes...');
  const existingSessions = await prisma.groupSession.findMany({
    where: { groupId: group.id }
  });

  for (const session of existingSessions) {
    await prisma.surahRecitation.deleteMany({ where: { sessionId: session.id } });
    await prisma.sessionAttendance.deleteMany({ where: { sessionId: session.id } });
    await prisma.groupSession.delete({ where: { id: session.id } });
  }
  console.log(`   Supprimé ${existingSessions.length} séances\n`);

  // 4. Read Excel file
  const excelPath = path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx');
  const workbook = XLSX.readFile(excelPath);

  // 5. Read sessions from "Suivi Forms"
  const formsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Suivi Forms'], { header: 1 }) as any[][];
  const sessionsData = formsSheet.slice(1, 13); // 12 sessions

  // 6. Read comments from "Suivi Sécances"
  const commentsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Suivi Sécances'], { header: 1 }) as any[][];
  const commentsData = commentsSheet.slice(1).filter(row => row[0]); // Skip header, filter empty

  // Group comments by session number
  const commentsBySession: Record<number, { name: string; surah: string; comment: string }[]> = {};
  for (const row of commentsData) {
    const sessionMatch = String(row[0]).match(/S(\d+)/);
    if (sessionMatch) {
      const sessionNum = parseInt(sessionMatch[1]);
      if (!commentsBySession[sessionNum]) {
        commentsBySession[sessionNum] = [];
      }
      commentsBySession[sessionNum].push({
        name: row[1],
        surah: row[2] || '',
        comment: row[3] || ''
      });
    }
  }

  // Find admin user for createdBy
  const adminUser = await prisma.user.findFirst({
    where: { email: 'sinlatourelle@gmail.com' }
  });
  const createdById = adminUser?.id || members[0]?.userId;

  // 7. Create sessions
  console.log('📅 Création des 12 séances...\n');

  for (let i = 0; i < sessionsData.length; i++) {
    const row = sessionsData[i];
    const sessionNum = i + 1;
    const excelDate = row[4] || row[0];
    const date = excelToDate(excelDate);
    const weekNumber = getWeekNumber(date);
    const absentsStr = row[2] || '';
    const presentsStr = row[3] || '';

    console.log(`Séance ${sessionNum}: ${date.toISOString().split('T')[0]}`);

    // Parse present/absent names - keep full names as they match database
    const presentNames = presentsStr.split(', ').filter(Boolean).map((n: string) => n.trim());
    const absentNames = absentsStr.split(', ').filter(Boolean).map((n: string) => n.trim());

    // Create session
    const session = await prisma.groupSession.create({
      data: {
        groupId: group.id,
        date: date,
        weekNumber: weekNumber,
        notes: `Séance ${sessionNum}`,
        createdBy: createdById,
      }
    });

    // Create attendance records
    const studentMembers = members.filter(m => m.role === 'MEMBER');
    for (const member of studentMembers) {
      const userName = member.user.name;
      const isPresent = presentNames.includes(userName);

      await prisma.sessionAttendance.create({
        data: {
          sessionId: session.id,
          userId: member.userId,
          present: isPresent,
          excused: false,
        }
      });
    }
    console.log(`   ✅ ${presentNames.length} présents, ${absentNames.length} absents`);

    // Create recitations from comments
    const sessionComments = commentsBySession[sessionNum] || [];
    let recitationCount = 0;

    for (const comment of sessionComments) {
      const dbName = COMMENT_NAME_MAPPING[comment.name] || comment.name;
      const userId = nameToUserId[dbName];

      if (!userId) {
        console.log(`   ⚠️  Utilisateur non trouvé: ${comment.name} -> ${dbName}`);
        continue;
      }

      const surahNumber = findSurahNumber(comment.surah);
      if (!surahNumber) {
        console.log(`   ⚠️  Sourate non trouvée: ${comment.surah}`);
        continue;
      }

      // Get surah details
      const surah = await prisma.surah.findUnique({ where: { number: surahNumber } });
      if (!surah) continue;

      await prisma.surahRecitation.create({
        data: {
          sessionId: session.id,
          userId: userId,
          surahNumber: surahNumber,
          type: 'MEMORIZATION',
          verseStart: 1,
          verseEnd: surah.totalVerses,
          status: 'PARTIAL',
          comment: comment.comment,
          createdBy: createdById,
        }
      });
      recitationCount++;
    }

    if (recitationCount > 0) {
      console.log(`   📝 ${recitationCount} récitations importées`);
    }
  }

  console.log('\n✨ Import terminé !');

  // Summary
  const totalSessions = await prisma.groupSession.count({ where: { groupId: group.id } });
  const totalAttendance = await prisma.sessionAttendance.count({
    where: { session: { groupId: group.id } }
  });
  const totalRecitations = await prisma.surahRecitation.count({
    where: { session: { groupId: group.id } }
  });

  console.log(`\n📊 Résumé:`);
  console.log(`   - ${totalSessions} séances`);
  console.log(`   - ${totalAttendance} enregistrements de présence`);
  console.log(`   - ${totalRecitations} récitations avec commentaires`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
