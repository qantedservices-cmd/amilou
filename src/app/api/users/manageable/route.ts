import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Récupérer les utilisateurs que l'utilisateur courant peut gérer
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        groupMembers: {
          select: {
            groupId: true,
            role: true
          }
        }
      }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    let users = []

    // L'utilisateur lui-même est toujours inclus en premier
    const selfUser = {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      isSelf: true
    }

    if (currentUser.role === 'ADMIN') {
      // Admin peut voir tous les utilisateurs
      const allUsers = await prisma.user.findMany({
        where: {
          id: { not: currentUser.id }
        },
        select: {
          id: true,
          name: true,
          email: true
        },
        orderBy: { name: 'asc' }
      })
      users = [selfUser, ...allUsers.map(u => ({ ...u, isSelf: false }))]
    } else if (currentUser.role === 'MANAGER') {
      // Manager peut voir les membres des groupes qu'il gère
      const groupIds = currentUser.groupMembers
        .filter(gm => gm.role === 'MANAGER' || gm.role === 'ADMIN')
        .map(gm => gm.groupId)

      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: { in: groupIds },
          userId: { not: currentUser.id }
        },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // Dédupliquer les utilisateurs
      const uniqueUsers = new Map()
      groupMembers.forEach(gm => {
        if (!uniqueUsers.has(gm.user.id)) {
          uniqueUsers.set(gm.user.id, { ...gm.user, isSelf: false })
        }
      })

      users = [selfUser, ...Array.from(uniqueUsers.values()).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      )]
    } else if (currentUser.role === 'REFERENT') {
      // Référent peut voir les membres de ses groupes
      const groupIds = currentUser.groupMembers.map(gm => gm.groupId)

      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: { in: groupIds },
          userId: { not: currentUser.id }
        },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // Dédupliquer les utilisateurs
      const uniqueUsers = new Map()
      groupMembers.forEach(gm => {
        if (!uniqueUsers.has(gm.user.id)) {
          uniqueUsers.set(gm.user.id, { ...gm.user, isSelf: false })
        }
      })

      users = [selfUser, ...Array.from(uniqueUsers.values()).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      )]
    } else {
      // User normal ne voit que lui-même
      users = [selfUser]
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching manageable users:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}
