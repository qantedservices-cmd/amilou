import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const programs = await prisma.program.findMany({
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(programs)
  } catch (error) {
    console.error('Error fetching programs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des programmes' },
      { status: 500 }
    )
  }
}
