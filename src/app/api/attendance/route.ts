import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // Format: YYYY-MM

    let startDate: Date
    let endDate: Date

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      startDate = new Date(year, monthNum - 1, 1)
      endDate = new Date(year, monthNum, 0)
    } else {
      // Default to current month
      const now = new Date()
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const attendance = await prisma.dailyAttendance.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'assiduité' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { date, days, comment } = await request.json()

    if (!date) {
      return NextResponse.json({ error: 'Date requise' }, { status: 400 })
    }

    // Get start of the week for the given date
    const weekDate = new Date(date)
    weekDate.setHours(0, 0, 0, 0)
    const dayOfWeek = weekDate.getDay()
    const weekStart = new Date(weekDate)
    weekStart.setDate(weekDate.getDate() - dayOfWeek)

    const attendance = await prisma.dailyAttendance.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date: weekStart,
        },
      },
      update: {
        sunday: days?.sunday ?? false,
        monday: days?.monday ?? false,
        tuesday: days?.tuesday ?? false,
        wednesday: days?.wednesday ?? false,
        thursday: days?.thursday ?? false,
        friday: days?.friday ?? false,
        saturday: days?.saturday ?? false,
        comment: comment || null,
      },
      create: {
        userId: session.user.id,
        date: weekStart,
        sunday: days?.sunday ?? false,
        monday: days?.monday ?? false,
        tuesday: days?.tuesday ?? false,
        wednesday: days?.wednesday ?? false,
        thursday: days?.thursday ?? false,
        friday: days?.friday ?? false,
        saturday: days?.saturday ?? false,
        comment: comment || null,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error saving attendance:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement de l\'assiduité' },
      { status: 500 }
    )
  }
}
