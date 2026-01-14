import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const surahs = await prisma.surah.findMany({
      orderBy: { number: 'asc' },
    })

    return NextResponse.json(surahs)
  } catch (error) {
    console.error('Error fetching surahs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sourates' },
      { status: 500 }
    )
  }
}
