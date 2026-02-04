'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface ImpersonationData {
  adminId: string
  adminName: string
  targetId: string
  targetName: string
  targetEmail: string
  targetRole: string
}

interface ImpersonationContextType {
  isImpersonating: boolean
  impersonationData: ImpersonationData | null
  startImpersonation: (userId: string) => Promise<boolean>
  stopImpersonation: () => Promise<void>
  effectiveUserId: string | null
  refresh: () => Promise<void>
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined)

export function ImpersonationProvider({
  children,
  currentUserId
}: {
  children: React.ReactNode
  currentUserId: string | null
}) {
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/impersonate')
      if (res.ok) {
        const data = await res.json()
        setImpersonationData(data.impersonating || null)
      }
    } catch (error) {
      console.error('Failed to check impersonation:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const startImpersonation = async (userId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (res.ok) {
        await refresh()
        // Reload to apply impersonation across the app
        window.location.reload()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to start impersonation:', error)
      return false
    }
  }

  const stopImpersonation = async () => {
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' })
      setImpersonationData(null)
      // Reload to clear impersonation
      window.location.reload()
    } catch (error) {
      console.error('Failed to stop impersonation:', error)
    }
  }

  const effectiveUserId = impersonationData?.targetId || currentUserId

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating: !!impersonationData,
      impersonationData,
      startImpersonation,
      stopImpersonation,
      effectiveUserId,
      refresh
    }}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext)
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider')
  }
  return context
}
