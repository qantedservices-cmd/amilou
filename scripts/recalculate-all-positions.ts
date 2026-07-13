/**
 * Recalcule les positions Révision & Lecture de tous les utilisateurs.
 *
 * Contexte : le calcul de `totalHizbs` est passé à un décompte inclusif (+1),
 * et certaines positions sont restées figées (saisies transitoires via Google
 * Forms jamais recalculées). Ce script rejoue le recalcul officiel
 * (recalculatePositionsFromCycles) pour tout le monde.
 *
 * Aperçu (lecture seule, défaut) :
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/recalculate-all-positions.ts
 * Application :
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/recalculate-all-positions.ts --apply
 *
 * Idempotent : réappliquer ne change plus rien une fois les positions à jour.
 */
require('dotenv').config()

// Résolution minimale de l'alias "@/..." vers src/, pour réutiliser le vrai
// code applicatif (quran-utils importe @/lib/db) sans dépendance supplémentaire.
const NodeModule = require('module')
const nodePath = require('path')
const origResolve = NodeModule._resolveFilename
NodeModule._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = nodePath.join(__dirname, '..', 'src', request.slice(2))
  }
  return origResolve.call(this, request, ...rest)
}

const { PrismaClient } = require('@prisma/client')
const { recalculatePositionsFromCycles } = require('../src/lib/quran-utils')

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(APPLY ? '=== MODE APPLY : écriture en base ===\n' : '=== APERÇU (lecture seule ; ajouter --apply pour écrire) ===\n')

  const [rev, read] = await Promise.all([
    prisma.program.findFirst({ where: { code: 'REVISION' } }),
    prisma.program.findFirst({ where: { code: 'READING' } }),
  ])
  const progIds = [rev?.id, read?.id].filter(Boolean) as string[]
  const settings = await prisma.userProgramSettings.findMany({
    where: { isActive: true, programId: { in: progIds } },
    select: { userId: true },
  })
  const userIds = [...new Set(settings.map((s: { userId: string }) => s.userId))] as string[]
  console.log(`${userIds.length} utilisateur(s) avec objectif révision/lecture\n`)

  let changed = 0
  let errors = 0
  for (const uid of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { email: true, revisionCurrentHizb: true, readingCurrentHizb: true, revisionSuspendedHizb: true },
    })
    if (!user) continue
    try {
      // persist=false en aperçu (aucune écriture), persist=true en apply (crée les cycles manquants)
      const p = await recalculatePositionsFromCycles(uid, { persist: APPLY })
      const revDiff = (user.revisionCurrentHizb ?? 0) !== p.revisionHizb
      const readDiff = (user.readingCurrentHizb ?? 0) !== p.readingHizb
      if (revDiff || readDiff) {
        changed++
        console.log(user.email)
        if (revDiff) console.log(`  révision : ${user.revisionCurrentHizb} -> ${p.revisionHizb}`)
        if (readDiff) console.log(`  lecture  : ${user.readingCurrentHizb} -> ${p.readingHizb}`)
        if (APPLY) {
          await prisma.user.update({
            where: { id: uid },
            data: {
              readingCurrentHizb: p.readingHizb,
              revisionCurrentHizb: p.revisionHizb,
              revisionSuspendedHizb: p.revisionSuspended,
            },
          })
        }
      }
    } catch (e) {
      errors++
      console.log(`  [ERREUR] ${user.email}: ${(e as Error).message}`)
    }
  }

  console.log(`\n${changed} utilisateur(s) ${APPLY ? 'recalculé(s)' : 'à recalculer'}${!APPLY && changed ? ' — relancer avec --apply pour écrire' : ''}`)
  if (errors) console.log(`${errors} erreur(s)`)
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
