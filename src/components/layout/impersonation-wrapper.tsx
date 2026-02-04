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
  currentUserId
}: {
  children: React.ReactNode
  currentUserId: string | null
}) {
  return (
    <ImpersonationProvider currentUserId={currentUserId}>
      <ImpersonationBanner />
      <ImpersonationContent>
        {children}
      </ImpersonationContent>
    </ImpersonationProvider>
  )
}
