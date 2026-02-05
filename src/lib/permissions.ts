import prisma from '@/lib/db'

interface VisibilityResult {
  canView: boolean
  canEdit: boolean
  isPrivate: boolean
}

/**
 * Check if a user can view/edit another user's data
 * @param viewerId - The user trying to view the data
 * @param targetId - The user whose data is being viewed
 * @param dataType - The type of data being accessed
 * @returns Visibility permissions
 */
export async function checkDataVisibility(
  viewerId: string,
  targetId: string,
  dataType: 'attendance' | 'progress' | 'stats' | 'evaluations'
): Promise<VisibilityResult> {
  // Same user - full access
  if (viewerId === targetId) {
    return { canView: true, canEdit: true, isPrivate: false }
  }

  // Get viewer's role and group memberships
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { role: true }
  })

  // Admin - full access to everything
  if (viewer?.role === 'ADMIN') {
    return { canView: true, canEdit: true, isPrivate: false }
  }

  // Get target user's privacy settings
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      privateAttendance: true,
      privateProgress: true,
      privateStats: true,
      privateEvaluations: true
    }
  })

  if (!target) {
    return { canView: false, canEdit: false, isPrivate: false }
  }

  // Check if data type is private
  const privacyMap = {
    attendance: target.privateAttendance,
    progress: target.privateProgress,
    stats: target.privateStats,
    evaluations: target.privateEvaluations
  }
  const isPrivate = privacyMap[dataType]

  // Check if viewer is in the same group as target
  const viewerGroups = await prisma.groupMember.findMany({
    where: { userId: viewerId },
    select: { groupId: true, role: true }
  })

  const targetGroups = await prisma.groupMember.findMany({
    where: { userId: targetId },
    select: { groupId: true }
  })

  const viewerGroupIds = viewerGroups.map(g => g.groupId)
  const targetGroupIds = targetGroups.map(g => g.groupId)
  const sharedGroups = viewerGroupIds.filter(id => targetGroupIds.includes(id))

  // Not in the same group - no access
  if (sharedGroups.length === 0) {
    return { canView: false, canEdit: false, isPrivate }
  }

  // Check if viewer is REFERENT in any shared group
  const isReferent = viewerGroups.some(
    g => sharedGroups.includes(g.groupId) && (g.role === 'REFERENT' || g.role === 'ADMIN')
  )

  // Referent - can view and edit even if private
  if (isReferent) {
    return { canView: true, canEdit: true, isPrivate }
  }

  // Regular group member - can view if not private, cannot edit
  return { canView: !isPrivate, canEdit: false, isPrivate }
}

/**
 * Get users visible to a viewer (for selectors)
 * Returns users in the same group with privacy status
 */
export async function getVisibleUsers(
  viewerId: string,
  dataType: 'attendance' | 'progress' | 'stats' | 'evaluations'
) {
  // Get viewer info
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { id: true, name: true, email: true, role: true }
  })

  if (!viewer) {
    return []
  }

  // Admin sees everyone
  if (viewer.role === 'ADMIN') {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        privateAttendance: true,
        privateProgress: true,
        privateStats: true,
        privateEvaluations: true
      },
      orderBy: { name: 'asc' }
    })

    return allUsers.map(user => ({
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      isPrivate: false, // Admin can see all
      canEdit: true,
      isSelf: user.id === viewerId
    }))
  }

  // Get viewer's groups
  const viewerMemberships = await prisma.groupMember.findMany({
    where: { userId: viewerId },
    select: { groupId: true, role: true }
  })

  if (viewerMemberships.length === 0) {
    // User has no groups - only see themselves
    return [{
      id: viewer.id,
      name: viewer.name || viewer.email,
      email: viewer.email,
      isPrivate: false,
      canEdit: true,
      isSelf: true
    }]
  }

  const viewerGroupIds = viewerMemberships.map(m => m.groupId)
  const isReferentInAnyGroup = viewerMemberships.some(m => m.role === 'REFERENT' || m.role === 'ADMIN')

  // Get all members of viewer's groups
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: { in: viewerGroupIds } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          privateAttendance: true,
          privateProgress: true,
          privateStats: true,
          privateEvaluations: true
        }
      }
    }
  })

  // Get unique users
  const uniqueUsers = new Map<string, typeof groupMembers[0]['user'] & { memberRole?: string }>()
  for (const member of groupMembers) {
    if (!uniqueUsers.has(member.user.id)) {
      uniqueUsers.set(member.user.id, { ...member.user, memberRole: member.role })
    } else {
      // Keep highest role
      const existing = uniqueUsers.get(member.user.id)!
      if (member.role === 'ADMIN' || (member.role === 'REFERENT' && existing.memberRole !== 'ADMIN')) {
        uniqueUsers.set(member.user.id, { ...member.user, memberRole: member.role })
      }
    }
  }

  // Privacy field mapping
  const privacyFieldMap = {
    attendance: 'privateAttendance',
    progress: 'privateProgress',
    stats: 'privateStats',
    evaluations: 'privateEvaluations'
  } as const

  const privacyField = privacyFieldMap[dataType]

  // Build result
  const result = Array.from(uniqueUsers.values()).map(user => {
    const isSelf = user.id === viewerId
    const isPrivate = user[privacyField] as boolean

    // Determine if viewer can edit
    let canEdit = isSelf
    if (isReferentInAnyGroup && !isSelf) {
      canEdit = true // Referent can edit group members
    }

    // Determine if viewer can view
    let canView = isSelf || isReferentInAnyGroup || !isPrivate

    return {
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      isPrivate: isPrivate && !isSelf && !isReferentInAnyGroup,
      canEdit,
      canView,
      isSelf
    }
  })

  // Sort: self first, then by name
  result.sort((a, b) => {
    if (a.isSelf) return -1
    if (b.isSelf) return 1
    return (a.name || '').localeCompare(b.name || '')
  })

  return result
}
