import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Support impersonation
    const { userId: effectiveUserId } = await getEffectiveUserId()
    const userId = effectiveUserId!

    // Get user's groups (as MEMBER only, not as REFERENT/ADMIN)
    const userMemberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              where: {
                role: 'MEMBER' // Only include members, not referents/admins
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Get memorization progress for all users in user's groups
    const memberIds = new Set<string>()
    for (const membership of userMemberships) {
      for (const member of membership.group.members) {
        memberIds.add(member.userId)
      }
    }

    // Get memorization entries for all members
    const memorizationProgram = await prisma.program.findFirst({
      where: { code: 'MEMORIZATION' }
    })

    if (!memorizationProgram) {
      return NextResponse.json({ groups: [] })
    }

    const allProgress = await prisma.progress.findMany({
      where: {
        userId: { in: Array.from(memberIds) },
        programId: memorizationProgram.id
      }
    })

    // Calculate memorized verses per user
    const userMemorization: Record<string, Set<string>> = {}
    for (const entry of allProgress) {
      if (!userMemorization[entry.userId]) {
        userMemorization[entry.userId] = new Set()
      }
      for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
        userMemorization[entry.userId].add(`${entry.surahNumber}:${v}`)
      }
    }

    // Build rankings for each group
    const groupRankings = userMemberships.map(membership => {
      const group = membership.group

      // Build member stats
      const memberStats = group.members.map(member => {
        const memorizedVerses = userMemorization[member.userId]?.size || 0
        const memorizedPages = Math.round(memorizedVerses / 15) // Approximate pages
        const memorizedJuz = Math.round((memorizedVerses / 6236) * 30 * 10) / 10 // Juz with 1 decimal

        return {
          userId: member.userId,
          name: member.user.name || member.user.email?.split('@')[0] || 'Utilisateur',
          image: member.user.image,
          memorizedVerses,
          memorizedPages,
          memorizedJuz,
          percentage: Math.round((memorizedVerses / 6236) * 100)
        }
      })

      // Sort by memorized verses (descending)
      memberStats.sort((a, b) => b.memorizedVerses - a.memorizedVerses)

      // Add rank
      const rankedMembers = memberStats.map((member, index) => ({
        ...member,
        rank: index + 1
      }))

      // Find current user's rank
      const currentUserRank = rankedMembers.find(m => m.userId === userId)?.rank || null

      return {
        groupId: group.id,
        groupName: group.name,
        members: rankedMembers,
        currentUserRank,
        totalMembers: rankedMembers.length
      }
    })

    // Filter out groups where user is not a member (e.g., only referent)
    const filteredRankings = groupRankings.filter(g =>
      g.members.some(m => m.userId === userId)
    )

    return NextResponse.json({
      groups: filteredRankings
    })
  } catch (error) {
    console.error('Error fetching group ranking:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du classement' },
      { status: 500 }
    )
  }
}
