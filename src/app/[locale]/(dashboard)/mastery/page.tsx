'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Grid3X3, Users, ChevronRight } from 'lucide-react'

interface GroupInfo {
  id: string
  name: string
  memberCount: number
}

export default function MasteryPage() {
  const locale = useLocale()
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups')
        if (res.ok) {
          const data = await res.json()
          const groupList = (data.groups || data || []).map((g: { id: string; name: string; _count?: { members: number }; members?: unknown[] }) => ({
            id: g.id,
            name: g.name,
            memberCount: g._count?.members || g.members?.length || 0,
          }))
          setGroups(groupList)

          // If only one group, redirect directly
          if (groupList.length === 1) {
            window.location.href = `/${locale}/groups/${groupList[0].id}/mastery`
            return
          }
        }
      } catch (error) {
        console.error('Error fetching groups:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchGroups()
  }, [locale])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Grid3X3 className="h-8 w-8 text-emerald-600" />
          Grille de suivi
        </h1>
        <p className="text-muted-foreground mt-1">
          Sélectionnez un groupe pour accéder à sa grille de suivi
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex h-[200px] items-center justify-center">
            <p className="text-muted-foreground">Aucun groupe disponible</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200"
              onClick={() => window.location.href = `/${locale}/groups/${group.id}/mastery`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>{group.name}</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {group.memberCount} membres
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
