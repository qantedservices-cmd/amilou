/**
 * Backfill : assainit les commentaires HTML déjà stockés en base.
 *
 * Contexte : `SurahRecitation.comment` et `Progress.comment` sont rendus via
 * `dangerouslySetInnerHTML` (grille de suivi, séances, tafsir). Les endpoints
 * assainissent désormais à l'écriture, mais les lignes antérieures peuvent
 * contenir du HTML arbitraire (XSS stocké).
 *
 * Idempotent : réassainir une valeur déjà propre la laisse inchangée.
 *
 * Usage :
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sanitize-existing-comments.ts            # dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sanitize-existing-comments.ts --apply    # écrit
 */
import { PrismaClient } from '@prisma/client'
import { sanitizeRichText } from '../src/lib/sanitize-rich-text'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

type Row = { id: string; comment: string | null }

function preview(s: string | null, max = 70): string {
  if (s === null) return '<null>'
  const one = s.replace(/\s+/g, ' ')
  return one.length > max ? one.slice(0, max) + '…' : one
}

async function processTable(
  label: string,
  fetchAll: () => Promise<Row[]>,
  update: (id: string, comment: string | null) => Promise<unknown>
) {
  const rows = await fetchAll()
  let changed = 0

  for (const row of rows) {
    const clean = sanitizeRichText(row.comment)
    if (clean === row.comment) continue

    changed++
    console.log(`  [${label}] ${row.id}`)
    console.log(`      avant : ${preview(row.comment)}`)
    console.log(`      après : ${preview(clean)}`)
    if (APPLY) await update(row.id, clean)
  }

  console.log(`  ${label} : ${changed} ligne(s) à modifier sur ${rows.length} avec commentaire\n`)
  return changed
}

async function main() {
  console.log(APPLY ? '=== MODE APPLY : la base sera modifiée ===\n' : '=== DRY-RUN : aucune écriture (ajouter --apply pour écrire) ===\n')

  const recitations = await processTable(
    'SurahRecitation',
    () => prisma.surahRecitation.findMany({ where: { comment: { not: null } }, select: { id: true, comment: true } }),
    (id, comment) => prisma.surahRecitation.update({ where: { id }, data: { comment } })
  )

  const progress = await processTable(
    'Progress',
    () => prisma.progress.findMany({ where: { comment: { not: null } }, select: { id: true, comment: true } }),
    (id, comment) => prisma.progress.update({ where: { id }, data: { comment } })
  )

  const total = recitations + progress
  if (!APPLY && total > 0) {
    console.log(`${total} ligne(s) seraient modifiées. Relancer avec --apply pour écrire.`)
  } else if (APPLY) {
    console.log(`${total} ligne(s) modifiées.`)
  } else {
    console.log('Rien à faire : tous les commentaires sont déjà assainis.')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
