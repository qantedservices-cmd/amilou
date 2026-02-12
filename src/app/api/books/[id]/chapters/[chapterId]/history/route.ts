import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId: effectiveUserId } = await getEffectiveUserId()
    const userId = effectiveUserId!
    const { chapterId } = await params

    const completedItems = await prisma.userItemProgress.findMany({
      where: {
        userId,
        completed: true,
        item: { chapterId },
      },
      include: {
        item: {
          select: {
            itemNumber: true,
            title: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    })

    return NextResponse.json({
      entries: completedItems.map((p) => ({
        date: p.completedAt?.toISOString() || p.updatedAt.toISOString(),
        description: p.item.title
          ? `#${p.item.itemNumber} — ${p.item.title}`
          : `Élément #${p.item.itemNumber}`,
        itemNumber: p.item.itemNumber,
        completedAt: p.completedAt?.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error fetching chapter history:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    )
  }
}
