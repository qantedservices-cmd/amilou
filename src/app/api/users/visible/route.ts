import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/impersonation'
import { getVisibleUsers } from '@/lib/permissions'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dataType = searchParams.get('dataType') as 'attendance' | 'progress' | 'stats' | 'evaluations'

    if (!dataType || !['attendance', 'progress', 'stats', 'evaluations'].includes(dataType)) {
      return NextResponse.json({ error: 'dataType invalide' }, { status: 400 })
    }

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()

    const users = await getVisibleUsers(effectiveUserId!, dataType)

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching visible users:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}
