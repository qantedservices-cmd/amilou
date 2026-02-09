/**
 * Import Sujets de Recherche from Excel
 *
 * Reads the "Recherches" sheet from docs/Suivi_Cours_Montmagny.xlsx
 * Columns: A=Id, B=N° séance, C=Élève(s), D=Question, E=Réponse, F=Validé, G=Envoyé
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-research-topics.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Import Sujets de Recherche\n');

  // 1. Find the group
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Montmagny' } }
  });

  if (!group) {
    console.error('❌ Groupe "Cours Montmagny" non trouvé');
    return;
  }
  console.log(`✅ Groupe trouvé: ${group.name}\n`);

  // 2. Get sessions for session number mapping
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    orderBy: { date: 'asc' },
    select: { id: true, date: true }
  });
  // sessionNumber is 1-based chronological index
  const sessionNumberToId: Record<number, string> = {};
  sessions.forEach((s, idx) => {
    sessionNumberToId[idx + 1] = s.id;
  });
  console.log(`📅 ${sessions.length} séances trouvées\n`);

  // 3. Read Excel file
  const excelPath = path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Recherches'];

  if (!sheet) {
    console.error('❌ Feuille "Recherches" non trouvée dans le fichier Excel');
    console.log('Feuilles disponibles:', workbook.SheetNames.join(', '));
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  console.log(`📋 ${data.length} lignes trouvées (inclut l'en-tête)\n`);

  // 4. Delete existing research topics for this group
  const deleted = await prisma.researchTopic.deleteMany({
    where: { groupId: group.id }
  });
  console.log(`🗑️  Supprimé ${deleted.count} sujets existants\n`);

  // 5. Process each row (skip header)
  let created = 0;
  let skipped = 0;

  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row || row.length === 0) continue;

    const id = row[0];          // A: Id
    const sessionNum = row[1];  // B: N° séance
    const assignedTo = row[2];  // C: Élève(s)
    const question = row[3];    // D: Question
    const answer = row[4];      // E: Éléments de réponse
    const validated = row[5];   // F: Validé (x)
    // const sent = row[6];     // G: Envoyé (x) - not stored

    // Skip rows without a question
    if (!question || String(question).trim() === '') {
      skipped++;
      continue;
    }

    const sessionNumber = sessionNum ? parseInt(String(sessionNum)) : null;
    const sessionId = sessionNumber && sessionNumberToId[sessionNumber]
      ? sessionNumberToId[sessionNumber]
      : null;

    const isValidated = validated
      ? String(validated).trim().toLowerCase() === 'x'
      : false;

    await prisma.researchTopic.create({
      data: {
        groupId: group.id,
        sessionId,
        assignedTo: assignedTo ? String(assignedTo).trim() : 'Non assigné',
        question: String(question).trim(),
        answer: answer ? String(answer).trim() : null,
        isValidated
      }
    });

    created++;
    console.log(`  ✅ S${sessionNumber || '?'} | ${String(assignedTo || '').trim().substring(0, 20)} | ${String(question).trim().substring(0, 50)}...`);
  }

  console.log(`\n✨ Import terminé!`);
  console.log(`   ${created} sujets créés`);
  if (skipped > 0) console.log(`   ${skipped} lignes ignorées (pas de question)`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
