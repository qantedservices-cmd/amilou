import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

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
    const { date, surahNumber, verseStart, verseEnd, repetitions, comment } = await request.json()

    const existing = await prisma.progress.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }

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
        comment,
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

    const existing = await prisma.progress.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Entrée non trouvée' }, { status: 404 })
    }

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
