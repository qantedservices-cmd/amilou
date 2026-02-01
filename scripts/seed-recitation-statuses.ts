/**
 * Seed default recitation status codes
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-recitation-statuses.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  {
    code: 'X',
    label: 'Supposé connu',
    tooltip: 'Sourate supposée connue avant le suivi',
    color: '#6B7280', // gray
    sortOrder: 1,
    isDefault: true,
  },
  {
    code: 'AM',
    label: 'À mémoriser',
    tooltip: 'Sourate en cours de mémorisation',
    color: '#3B82F6', // blue
    sortOrder: 2,
    isDefault: true,
  },
  {
    code: '50%',
    label: 'Partiel',
    tooltip: 'Partiellement acquis, à reprendre',
    color: '#F59E0B', // amber
    sortOrder: 3,
    isDefault: true,
  },
  {
    code: '51%',
    label: '1ère reprise',
    tooltip: '1ère reprise, non validé',
    color: '#F97316', // orange
    sortOrder: 4,
    isDefault: true,
  },
  {
    code: '90%',
    label: 'À consolider',
    tooltip: 'Presque acquis, à consolider',
    color: '#8B5CF6', // violet
    sortOrder: 5,
    isDefault: true,
  },
  {
    code: 'V',
    label: 'Validé',
    tooltip: 'Validé lors d\'une séance',
    color: '#10B981', // green
    sortOrder: 6,
    isDefault: true,
  },
  {
    code: 'S',
    label: 'Récité élève',
    tooltip: 'Récité à un élève, à valider par le professeur',
    color: '#14B8A6', // teal
    sortOrder: 7,
    isDefault: true,
  },
];

async function main() {
  console.log('🚀 Seeding recitation statuses...\n');

  for (const status of DEFAULT_STATUSES) {
    const existing = await prisma.recitationStatus.findUnique({
      where: { code: status.code }
    });

    if (existing) {
      // Update existing
      await prisma.recitationStatus.update({
        where: { code: status.code },
        data: status,
      });
      console.log(`✅ Updated: ${status.code} - ${status.label}`);
    } else {
      // Create new
      await prisma.recitationStatus.create({
        data: status,
      });
      console.log(`✅ Created: ${status.code} - ${status.label}`);
    }
  }

  console.log('\n✨ Done!');

  // List all statuses
  const all = await prisma.recitationStatus.findMany({
    orderBy: { sortOrder: 'asc' }
  });
  console.log('\n📋 All statuses:');
  for (const s of all) {
    console.log(`   ${s.code.padEnd(5)} | ${s.label.padEnd(15)} | ${s.tooltip}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
