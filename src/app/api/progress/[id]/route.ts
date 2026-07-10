import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { checkDataVisibility } from '@/lib/permissions'
import { sanitizeRichText } from '@/lib/sanitize-rich-text'

/**
 * Retourne une réponse 403 si le viewer n'a pas le droit d'agir sur l'entrée
 * d'`ownerId`, sinon `null`. Le propriétaire agit toujours sur ses entrées.
 */
async function assertCanEditProgress(
  viewerId: string,
  ownerId: string,
  action: 'modifier' | 'supprimer'
): Promise<NextResponse | null> {
  if (ownerId === viewerId) return null

  const { canEdit } = await checkDataVisibility(viewerId, ownerId, 'progress')
  if (canEdit) return null

  return NextResponse.json(
    { error: `Vous n'êtes pas autorisé à ${action} l'avancement de cet utilisateur` },
    { status: 403 }
  )
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const { date, surahNumber, verseStart, verseEnd, repetitions, comment, tafsirBookIds } = await request.json()

    const existing = await prisma.progress.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }

    const denied = await assertCanEditProgress(session.user.id, existing.userId, 'modifier')
    if (denied) return denied

    // Verify surah and verse range if changed
    if (surahNumber) {
      const surah = await prisma.surah.findUnique({
        where: { number: surahNumber },
      })

      if (!surah) {
        return NextResponse.json({ error: 'Sourate non trouvée' }, { status: 400 })
      }

      const start = verseStart || existing.verseStart
      const end = verseEnd || existing.verseEnd

      if (start < 1 || end > surah.totalVerses || start > end) {
        return NextResponse.json(
          { error: `Versets invalides. La sourate ${surah.nameFr} a ${surah.totalVerses} versets.` },
          { status: 400 }
        )
      }
    }

    const progress = await prisma.progress.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        surahNumber,
        verseStart,
        verseEnd,
        repetitions,
        // comment absent du body = champ non modifié ; sinon on assainit
        // (null/'' efface volontairement le commentaire existant)
        ...(comment !== undefined && { comment: sanitizeRichText(comment) }),
        ...(tafsirBookIds !== undefined && { tafsirBookIds }),
      },
      include: {
        program: true,
        surah: true,
      },
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error updating progress:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.progress.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }

    const denied = await assertCanEditProgress(session.user.id, existing.userId, 'supprimer')
    if (denied) return denied

    await prisma.progress.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting progress:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}
