import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/impersonation'
import prisma from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { bookId } = await params

    await prisma.userBook.delete({
      where: { userId_bookId: { userId, bookId } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing user book:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du livre' },
      { status: 500 }
    )
  }
}
