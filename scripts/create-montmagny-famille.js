const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Élèves Cours Montmagny (14)
const MONTMAGNY_STUDENTS = [
  { name: 'AIT ASSI Nassim', birthYear: 2014 },
  { name: 'ATTAR Yanis', birthYear: 2012 },
  { name: 'BEN BELKACEM Iyad', birthYear: 2012 },
  { name: 'BEN BELKACEM Sabri', birthYear: 2012 },
  { name: 'BOUAZZOUZ Sofiane', birthYear: 2012 },
  { name: 'BRIK Imran', birthYear: 2015 },
  { name: 'DJOUADI Souheil', birthYear: 2013 },
  { name: 'FLILOU Houdeyfa', birthYear: 2012 },
  { name: 'GHANEM Anass', birthYear: 2012 },
  { name: 'KHEIR Mohamed', birthYear: 2012 },
  { name: 'LOGHMARI Bilel', birthYear: 2014 },
  { name: 'MEDINI Younes', birthYear: 2014 },
  { name: 'RAMI Selim', birthYear: 2013 },
  { name: 'TANDJIGORA Luqman', birthYear: 2012 },
];

// Membres Famille (7)
const FAMILLE_MEMBERS = [
  { name: 'Haroun' },
  { name: 'Hiba' },
  { name: 'Bilel' },
  { name: 'Esma' },
  { name: 'Inès' },
  { name: 'Tasnim' },
  { name: 'Siwar' },
];

function generateEmail(name, domain) {
  // Convert "AIT ASSI Nassim" -> "aitassi.nassim@domain"
  const parts = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .split(' ')
    .filter(p => p.length > 0);

  if (parts.length === 1) {
    return `${parts[0]}@${domain}`;
  }

  // Last part is first name, rest is last name
  const firstName = parts[parts.length - 1];
  const lastName = parts.slice(0, -1).join('');
  return `${lastName}.${firstName}@${domain}`;
}

async function main() {
  console.log('=== CRÉATION GROUPES ET UTILISATEURS ===\n');

  const defaultPassword = await bcrypt.hash('amilou2024', 10);

  // 1. Créer groupe Cours Montmagny
  console.log('--- 1. GROUPE COURS MONTMAGNY ---');
  let groupMontmagny = await prisma.group.findFirst({
    where: { name: 'Cours Montmagny' }
  });

  if (!groupMontmagny) {
    groupMontmagny = await prisma.group.create({
      data: {
        name: 'Cours Montmagny',
        description: 'Cours de Coran pour enfants - Montmagny',
        sessionFrequency: 'WEEKLY',
      }
    });
    console.log('  ✓ Groupe créé:', groupMontmagny.name);
  } else {
    console.log('  ○ Groupe existe:', groupMontmagny.name);
  }

  // 2. Créer les élèves Montmagny
  console.log('\n--- 2. ÉLÈVES MONTMAGNY ---');
  const montmagnyUsers = [];

  for (const student of MONTMAGNY_STUDENTS) {
    const email = generateEmail(student.name, 'montmagny.local');

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: student.name,
          email,
          password: defaultPassword,
          role: 'USER',
        }
      });
      console.log('  ✓ Créé:', student.name, `(${email})`);
    } else {
      console.log('  ○ Existe:', student.name, `(${email})`);
    }

    montmagnyUsers.push(user);

    // Ajouter au groupe
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: groupMontmagny.id } }
    });

    if (!membership) {
      await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: groupMontmagny.id,
          role: 'MEMBER',
        }
      });
    }
  }

  // 3. Créer groupe Famille
  console.log('\n--- 3. GROUPE FAMILLE ---');
  let groupFamille = await prisma.group.findFirst({
    where: { name: 'Famille' }
  });

  if (!groupFamille) {
    groupFamille = await prisma.group.create({
      data: {
        name: 'Famille',
        description: 'Suivi familial Coran',
        sessionFrequency: 'WEEKLY',
      }
    });
    console.log('  ✓ Groupe créé:', groupFamille.name);
  } else {
    console.log('  ○ Groupe existe:', groupFamille.name);
  }

  // 4. Créer les membres Famille
  console.log('\n--- 4. MEMBRES FAMILLE ---');
  const familleUsers = [];

  for (const member of FAMILLE_MEMBERS) {
    const email = generateEmail(member.name, 'famille.local');

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: member.name,
          email,
          password: defaultPassword,
          role: 'USER',
        }
      });
      console.log('  ✓ Créé:', member.name, `(${email})`);
    } else {
      console.log('  ○ Existe:', member.name, `(${email})`);
    }

    familleUsers.push(user);

    // Ajouter au groupe
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: groupFamille.id } }
    });

    if (!membership) {
      await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: groupFamille.id,
          role: 'MEMBER',
        }
      });
    }
  }

  // 5. Résumé
  console.log('\n=== RÉSUMÉ ===');
  const groups = await prisma.group.findMany({
    include: { members: { include: { user: true } } }
  });

  for (const group of groups) {
    console.log(`\n${group.name} (${group.members.length} membres):`);
    for (const member of group.members) {
      console.log(`  - ${member.user.name} (${member.user.email}) [${member.role}]`);
    }
  }

  console.log('\n=== STATS FINALES ===');
  console.log('Users:', await prisma.user.count());
  console.log('Groups:', await prisma.group.count());
  console.log('GroupMembers:', await prisma.groupMember.count());

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
