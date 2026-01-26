/**
 * Script de synchronisation des données Google Sheets vers Amilou
 * Usage: npx ts-node scripts/sync-from-sheets.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Mapping des noms vers les emails
const USER_MAP: Record<string, string> = {
  'Mohamed B.': 'mohamed.b.@amilou.local',
  'Yazid': 'yazid@amilou.local',
  'Samir': 'sinlatourelle@gmail.com',
  'Ibrahim': 'ibrahim@amilou.local',
  'Amine': 'amine@amilou.local',
  'Abdelmoughite': 'abdelmoughite@amilou.local',
  'Mohamed Koucha': 'mohamed.koucha@amilou.local',
};

// Get Sunday (week start for Sun-Sat weeks) from year and week number
function getSundayOfWeek(year: number, week: number): Date {
  // Find the Monday of the ISO week
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    monday.setDate(simple.getDate() + 8 - simple.getDay());
  }
  // Subtract 1 day to get Sunday (week start for Sun-Sat)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

interface AssiduiteEntry {
  qui: string;
  annee: number;
  semaine: number;
  dimanche: number;
  lundi: number;
  mardi: number;
  mercredi: number;
  jeudi: number;
  vendredi: number;
  samedi: number;
  commentaire: string;
}

interface MemorisationEntry {
  qui: string;
  annee: number;
  semaine: number;
  numSourate: number;
  versetDebut: number;
  versetFin: number;
  commentaire: string;
  timestamp: Date;
}

async function parseCSV(filePath: string): Promise<{ assiduite: AssiduiteEntry[], memorisation: MemorisationEntry[] }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const assiduiteMap = new Map<string, AssiduiteEntry>();
  const memorisation: MemorisationEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Parse CSV line (handle commas in quoted strings)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] || '';
    });

    const type = row['Type de suivi'];
    const qui = row['Qui'];
    const annee = parseInt(row['Année']) || new Date().getFullYear();
    const semaine = parseInt(row['Semaine']) || 1;

    if (!qui) continue;

    if (type === 'Assiduité au quotidien') {
      const key = `${qui}-${annee}-${semaine}`;

      if (!assiduiteMap.has(key)) {
        assiduiteMap.set(key, {
          qui,
          annee,
          semaine,
          dimanche: 0,
          lundi: 0,
          mardi: 0,
          mercredi: 0,
          jeudi: 0,
          vendredi: 0,
          samedi: 0,
          commentaire: '',
        });
      }

      const entry = assiduiteMap.get(key)!;

      // Cumulative update - only update if new value > 0
      const dim = parseFloat(row['Dimanche']) || 0;
      const lun = parseFloat(row['Lundi']) || 0;
      const mar = parseFloat(row['Mardi']) || 0;
      const mer = parseFloat(row['Mercredi']) || 0;
      const jeu = parseFloat(row['Jeudi']) || 0;
      const ven = parseFloat(row['Vendredi']) || 0;
      const sam = parseFloat(row['Samedi']) || 0;

      if (dim > 0) entry.dimanche = Math.min(Math.round(dim), 5);
      if (lun > 0) entry.lundi = Math.min(Math.round(lun), 5);
      if (mar > 0) entry.mardi = Math.min(Math.round(mar), 5);
      if (mer > 0) entry.mercredi = Math.min(Math.round(mer), 5);
      if (jeu > 0) entry.jeudi = Math.min(Math.round(jeu), 5);
      if (ven > 0) entry.vendredi = Math.min(Math.round(ven), 5);
      if (sam > 0) entry.samedi = Math.min(Math.round(sam), 5);

      const comment = row['Commentaire assiduité'];
      if (comment) entry.commentaire = comment;

    } else if (type === 'Avancement Mémorisation') {
      const numSourate = parseInt(row['Num_Sourate']) || 0;
      const versetDebut = parseInt(row['Verset début']) || 1;
      const versetFin = parseInt(row['Verset fin']) || 1;

      if (numSourate > 0) {
        memorisation.push({
          qui,
          annee,
          semaine,
          numSourate,
          versetDebut,
          versetFin,
          commentaire: row['Commentaire mémorisation'] || '',
          timestamp: new Date(row['Timestamp']),
        });
      }
    }
  }

  return {
    assiduite: Array.from(assiduiteMap.values()),
    memorisation,
  };
}

async function syncAssiduite(entries: AssiduiteEntry[]) {
  console.log(`\n=== Synchronisation Assiduité (${entries.length} semaines) ===\n`);

  for (const entry of entries) {
    const email = USER_MAP[entry.qui];
    if (!email) {
      console.log(`⚠️  Utilisateur inconnu: ${entry.qui}`);
      continue;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`⚠️  Utilisateur non trouvé: ${email}`);
      continue;
    }

    const date = getSundayOfWeek(entry.annee, entry.semaine);

    // Check existing
    const existing = await prisma.dailyAttendance.findUnique({
      where: { userId_date: { userId: user.id, date } }
    });

    // Merge with existing (cumulative)
    const sunday = entry.dimanche > 0 ? entry.dimanche : (existing?.sunday ?? 0);
    const monday = entry.lundi > 0 ? entry.lundi : (existing?.monday ?? 0);
    const tuesday = entry.mardi > 0 ? entry.mardi : (existing?.tuesday ?? 0);
    const wednesday = entry.mercredi > 0 ? entry.mercredi : (existing?.wednesday ?? 0);
    const thursday = entry.jeudi > 0 ? entry.jeudi : (existing?.thursday ?? 0);
    const friday = entry.vendredi > 0 ? entry.vendredi : (existing?.friday ?? 0);
    const saturday = entry.samedi > 0 ? entry.samedi : (existing?.saturday ?? 0);
    const comment = entry.commentaire || existing?.comment || null;

    await prisma.dailyAttendance.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: { sunday, monday, tuesday, wednesday, thursday, friday, saturday, comment },
      create: {
        userId: user.id,
        date,
        sunday, monday, tuesday, wednesday, thursday, friday, saturday,
        comment,
        createdBy: user.id,
      }
    });

    console.log(`✓ ${entry.qui} S${entry.semaine}/${entry.annee}: dim=${sunday} lun=${monday} mar=${tuesday} mer=${wednesday} jeu=${thursday} ven=${friday} sam=${saturday}`);
  }
}

async function syncMemorisation(entries: MemorisationEntry[]) {
  console.log(`\n=== Synchronisation Mémorisation (${entries.length} entrées) ===\n`);

  const program = await prisma.program.findFirst({ where: { code: 'MEMORIZATION' } });
  if (!program) {
    console.log('❌ Programme MEMORIZATION non trouvé');
    return;
  }

  for (const entry of entries) {
    const email = USER_MAP[entry.qui];
    if (!email) {
      console.log(`⚠️  Utilisateur inconnu: ${entry.qui}`);
      continue;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`⚠️  Utilisateur non trouvé: ${email}`);
      continue;
    }

    const date = getSundayOfWeek(entry.annee, entry.semaine);

    // Check if this exact entry already exists (avoid duplicates)
    const existing = await prisma.progress.findFirst({
      where: {
        userId: user.id,
        programId: program.id,
        surahNumber: entry.numSourate,
        verseStart: entry.versetDebut,
        verseEnd: entry.versetFin,
        date: {
          gte: new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000),
        }
      }
    });

    if (existing) {
      console.log(`⏭️  ${entry.qui} Sourate ${entry.numSourate} v${entry.versetDebut}-${entry.versetFin} (déjà présent)`);
      continue;
    }

    await prisma.progress.create({
      data: {
        userId: user.id,
        programId: program.id,
        date,
        surahNumber: entry.numSourate,
        verseStart: entry.versetDebut,
        verseEnd: entry.versetFin,
        comment: entry.commentaire || null,
        createdBy: user.id,
      }
    });

    console.log(`✓ ${entry.qui} Sourate ${entry.numSourate} v${entry.versetDebut}-${entry.versetFin} S${entry.semaine}/${entry.annee}`);
  }
}

async function main() {
  const csvPath = path.join(__dirname, '../docs/temp_export.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('❌ Fichier CSV non trouvé:', csvPath);
    console.log('Exportez d\'abord les données avec Python.');
    process.exit(1);
  }

  console.log('📂 Lecture du fichier CSV...');
  const { assiduite, memorisation } = await parseCSV(csvPath);

  console.log(`📊 Trouvé: ${assiduite.length} semaines d'assiduité, ${memorisation.length} entrées mémorisation`);

  await syncAssiduite(assiduite);
  await syncMemorisation(memorisation);

  console.log('\n✅ Synchronisation terminée!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
