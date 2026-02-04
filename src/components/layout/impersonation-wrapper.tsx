'use client'

import { ImpersonationProvider, useImpersonation } from '@/contexts/ImpersonationContext'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'

function ImpersonationContent({ children }: { children: React.ReactNode }) {
  const { isImpersonating } = useImpersonation()

  return (
    <div className={isImpersonating ? 'pt-12' : ''}>
      {children}
    </div>
  )
}

export function ImpersonationWrapper({
  children,
  currentUserId,
  currentUserRole
}: {
  children: React.ReactNode
  currentUserId: string | null
  currentUserRole: string | null
}) {
  return (
    <ImpersonationProvider currentUserId={currentUserId} currentUserRole={currentUserRole}>
      <ImpersonationBanner />
      <ImpersonationContent>
        {children}
      </ImpersonationContent>
    </ImpersonationProvider>
  )
}
