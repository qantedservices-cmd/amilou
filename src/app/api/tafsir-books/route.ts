import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET — List all tafsir books
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const books = await prisma.tafsirBook.findMany({
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json({ books })
  } catch (error) {
    console.error('Error fetching tafsir books:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des tafsirs' },
      { status: 500 }
    )
  }
}
