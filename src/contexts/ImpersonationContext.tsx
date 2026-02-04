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
  effectiveRole: string | null
  refresh: () => Promise<void>
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined)

export function ImpersonationProvider({
  children,
  currentUserId,
  currentUserRole
}: {
  children: React.ReactNode
  currentUserId: string | null
  currentUserRole: string | null
}) {
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    console.log('Checking impersonation status...')
    try {
      const res = await fetch('/api/admin/impersonate')
      console.log('Impersonation check status:', res.status)
      if (res.ok) {
        const data = await res.json()
        console.log('Impersonation data:', data)
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
    console.log('startImpersonation called with userId:', userId)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      console.log('Impersonate response status:', res.status)
      const data = await res.json()
      console.log('Impersonate response data:', data)

      if (res.ok) {
        console.log('Impersonation successful, redirecting to dashboard...')
        await refresh()
        // Redirect to dashboard to see the impersonated user's view
        window.location.href = '/fr/dashboard'
        return true
      }
      console.error('Impersonation failed:', data)
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
  const effectiveRole = impersonationData?.targetRole || currentUserRole

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating: !!impersonationData,
      impersonationData,
      startImpersonation,
      stopImpersonation,
      effectiveUserId,
      effectiveRole,
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
