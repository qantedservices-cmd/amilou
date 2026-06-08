const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const samir = await prisma.user.findFirst({
    where: { email: 'sinlatourelle@gmail.com' },
    select: { id: true, readingCurrentHizb: true, revisionCurrentHizb: true, revisionSuspendedHizb: true }
  });
  console.log('Current positions:', samir);
  console.log('Expected: reading=18, revision=0, suspended=0');
  console.log('Match:', samir.readingCurrentHizb === 18 && samir.revisionCurrentHizb === 0 && samir.revisionSuspendedHizb === 0 ? 'OK' : 'MISMATCH');
}

main().catch(console.error).finally(() => prisma.$disconnect());
