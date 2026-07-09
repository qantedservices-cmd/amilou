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
 *
 * IMPORTANT: `canEdit`/`canView`/`isPrivate` sont calculés **par cible** (pas
 * un booléen global au viewer), et doivent rester cohérents avec
 * `checkDataVisibility(viewerId, targetId, dataType)` pour tout couple
 * (viewer, target) — c'est l'API qui fait foi, l'UI ne doit jamais sur-promettre.
 * Ex: un viewer REFERENT du groupe A et simple MEMBER du groupe B ne doit pas
 * pouvoir éditer/voir un utilisateur qui n'appartient qu'au groupe B.
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

  // Admin sees everyone, full access (matches checkDataVisibility's ADMIN branch)
  if (viewer.role === 'ADMIN') {
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' }
    })

    return allUsers.map(user => ({
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      isPrivate: false, // Admin can see all
      canEdit: true,
      canView: true,
      isSelf: user.id === viewerId
    }))
  }

  // Get viewer's groups (groupId -> role, for THIS viewer)
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
      canView: true,
      isSelf: true
    }]
  }

  const viewerGroupIds = viewerMemberships.map(m => m.groupId)
  const viewerRoleByGroup = new Map(viewerMemberships.map(m => [m.groupId, m.role]))

  // Get all members of viewer's groups, in one query (avoids an N+1 by user).
  // Every row here is, by construction, a group shared with the viewer.
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: { in: viewerGroupIds } },
    select: {
      groupId: true,
      userId: true,
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

  type TargetUser = (typeof groupMembers)[number]['user']

  // For each target user, collect the set of groups shared with the viewer
  // (needed to check, per target, whether the viewer is REFERENT/ADMIN in at
  // least one of THOSE groups specifically — not in any group of the viewer).
  const usersById = new Map<string, TargetUser>()
  const sharedGroupIdsByUser = new Map<string, Set<string>>()

  for (const member of groupMembers) {
    usersById.set(member.userId, member.user)
    if (!sharedGroupIdsByUser.has(member.userId)) {
      sharedGroupIdsByUser.set(member.userId, new Set())
    }
    sharedGroupIdsByUser.get(member.userId)!.add(member.groupId)
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
  const result = Array.from(usersById.values()).map(user => {
    const isSelf = user.id === viewerId

    if (isSelf) {
      return {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        isPrivate: false,
        canEdit: true,
        canView: true,
        isSelf: true
      }
    }

    const isPrivate = user[privacyField] as boolean
    const sharedGroupIds = sharedGroupIdsByUser.get(user.id) ?? new Set<string>()

    // Referent (or admin) in at least one group shared with THIS target.
    const isReferentForTarget = Array.from(sharedGroupIds).some(groupId => {
      const role = viewerRoleByGroup.get(groupId)
      return role === 'REFERENT' || role === 'ADMIN'
    })

    const canEdit = isReferentForTarget
    const canView = isReferentForTarget || !isPrivate

    return {
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      isPrivate: isPrivate && !isReferentForTarget,
      canEdit,
      canView,
      isSelf: false
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
