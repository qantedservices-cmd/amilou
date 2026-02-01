import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/students/[id]/recitations - Get recitation history for a student
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: studentId } = await params
    const { searchParams } = new URL(request.url)
    const surahNumber = searchParams.get('surahNumber')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get student info
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true }
    })

    if (!student) {
      return NextResponse.json({ error: 'Élève non trouvé' }, { status: 404 })
    }

    // Build where clause
    const where: { userId: string; surahNumber?: number } = { userId: studentId }
    if (surahNumber) {
      where.surahNumber = parseInt(surahNumber)
    }

    const recitations = await prisma.surahRecitation.findMany({
      where,
      include: {
        session: {
          select: {
            id: true,
            date: true,
            weekNumber: true,
            group: { select: { id: true, name: true } }
          }
        },
        surah: {
          select: { number: true, nameFr: true, nameAr: true, totalVerses: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    // Group by surah if no specific surah requested
    if (!surahNumber) {
      const grouped: Record<number, typeof recitations> = {}
      for (const rec of recitations) {
        if (!grouped[rec.surahNumber]) {
          grouped[rec.surahNumber] = []
        }
        grouped[rec.surahNumber].push(rec)
      }

      return NextResponse.json({
        student,
        recitationsBySurah: grouped,
        totalRecitations: recitations.length
      })
    }

    return NextResponse.json({
      student,
      recitations,
      surahNumber: parseInt(surahNumber)
    })
  } catch (error) {
    console.error('Error fetching recitations:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des récitations' },
      { status: 500 }
    )
  }
}
