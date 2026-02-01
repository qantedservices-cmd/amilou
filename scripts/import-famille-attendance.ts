/**
 * Import Famille attendance from Excel Suivi Famille Commentaires
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-famille-attendance.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Import Présences Famille\n');

  // 1. Find the group
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Famille' } },
    include: {
      members: {
        include: { user: true }
      }
    }
  });

  if (!group) {
    console.error('❌ Groupe Famille non trouvé');
    return;
  }
  console.log(`✅ Groupe trouvé: ${group.name}\n`);

  // Normalize string (remove accents)
  function normalize(str: string): string {
    return str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // 2. Create name mapping (flexible)
  const nameToUserId: Record<string, string> = {};
  for (const m of group.members) {
    if (m.user.name) {
      nameToUserId[normalize(m.user.name)] = m.userId;
      const firstName = m.user.name.split(' ')[0];
      nameToUserId[normalize(firstName)] = m.userId;
    }
  }
  console.log('👥 Membres:', group.members.map(m => m.user.name).join(', '));

  // 3. Read Excel and extract attendance by week
  const excelPath = path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Suivi Famille Commentaires'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Group by week
  const byWeek: Record<string, Set<string>> = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row && row[0] && row[1]) {
      const week = row[0] as string; // e.g., 'S49'
      const who = row[1] as string;  // e.g., 'Esma'
      if (!byWeek[week]) byWeek[week] = new Set();
      byWeek[week].add(who);
    }
  }

  console.log('\n📋 Présences trouvées dans Excel:');
  Object.keys(byWeek).sort().forEach(week => {
    console.log(`  ${week}: ${[...byWeek[week]].join(', ')}`);
  });

  // 4. Get sessions
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    orderBy: { weekNumber: 'asc' }
  });

  console.log(`\n📅 ${sessions.length} séances trouvées\n`);

  // 5. Create attendance records
  let attendanceCreated = 0;
  const allMemberIds = group.members.map(m => m.userId);

  for (const session of sessions) {
    const weekKey = `S${session.weekNumber}`;
    const presentNames = byWeek[weekKey] || new Set();

    // Delete existing attendance for this session
    await prisma.sessionAttendance.deleteMany({
      where: { sessionId: session.id }
    });

    // Create attendance for all members
    for (const member of group.members) {
      const memberName = normalize(member.user.name || '');
      const firstName = normalize(member.user.name?.split(' ')[0] || '');
      const isPresent = [...presentNames].some(name =>
        normalize(name) === firstName ||
        normalize(name) === memberName
      );

      await prisma.sessionAttendance.create({
        data: {
          sessionId: session.id,
          userId: member.userId,
          present: isPresent
        }
      });
      attendanceCreated++;
    }

    const presentList = [...presentNames].join(', ') || '(aucun enregistré)';
    console.log(`${weekKey} (${session.date.toISOString().split('T')[0]}): ${presentList}`);
  }

  console.log(`\n✨ Import terminé!`);
  console.log(`📊 ${attendanceCreated} enregistrements de présence créés`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
