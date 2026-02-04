'use client'

import { useImpersonation } from '@/contexts/ImpersonationContext'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'

export function ImpersonationBanner() {
  const { isImpersonating, impersonationData, stopImpersonation } = useImpersonation()

  if (!isImpersonating || !impersonationData) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 shadow-md">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            Vous visualisez l'application en tant que{' '}
            <strong>{impersonationData.targetName || impersonationData.targetEmail}</strong>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={stopImpersonation}
          className="bg-white/90 hover:bg-white text-amber-950 border-amber-600 shrink-0"
        >
          <X className="h-4 w-4 mr-1" />
          Revenir à mon compte
        </Button>
      </div>
    </div>
  )
}
