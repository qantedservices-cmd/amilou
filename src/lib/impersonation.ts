import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

const IMPERSONATE_COOKIE = 'amilou_impersonate'

interface ImpersonationData {
  adminId: string
  adminName: string
  targetId: string
  targetName: string
  targetEmail: string
  targetRole: string
}

/**
 * Get the effective user ID for API calls.
 * If an admin is impersonating another user, returns the impersonated user's ID.
 * Otherwise returns the logged-in user's ID.
 */
export async function getEffectiveUserId(): Promise<{
  userId: string | null
  isImpersonating: boolean
  impersonationData: ImpersonationData | null
}> {
  const session = await auth()

  if (!session?.user?.id) {
    return { userId: null, isImpersonating: false, impersonationData: null }
  }

  const cookieStore = await cookies()
  const impersonateCookie = cookieStore.get(IMPERSONATE_COOKIE)

  if (impersonateCookie?.value) {
    try {
      const data: ImpersonationData = JSON.parse(impersonateCookie.value)

      // Verify the current user is the admin who started impersonation
      // and that they are still an ADMIN
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })

      if (currentUser?.role === 'ADMIN') {
        return {
          userId: data.targetId,
          isImpersonating: true,
          impersonationData: data
        }
      }
    } catch {
      // Invalid cookie, ignore
    }
  }

  return {
    userId: session.user.id,
    isImpersonating: false,
    impersonationData: null
  }
}

/**
 * Get the actual logged-in user ID (ignoring impersonation).
 * Use this for operations that should always use the real user.
 */
export async function getRealUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id || null
}
