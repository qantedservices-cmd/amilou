import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/impersonation'
import prisma from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { chapterId } = await params
    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const items = await prisma.bookItem.findMany({
      where: { chapterId },
      orderBy: { itemNumber: 'asc' },
      include: {
        progress: {
          where: { userId },
          select: {
            completed: true,
            completedAt: true,
            notes: true,
            rating: true,
          },
        },
      },
    })

    // Flatten progress (single user, so max 1 record per item)
    const result = items.map((item) => ({
      ...item,
      userProgress: item.progress[0] || null,
      progress: undefined,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des éléments' },
      { status: 500 }
    )
  }
}
