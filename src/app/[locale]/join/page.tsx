'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const code = searchParams.get('code')

  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [group, setGroup] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!code) { setError('Code manquant'); setLoading(false); return }
    fetch(`/api/join?code=${code}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error) }))
      .then(data => setGroup(data))
      .catch(e => setError(e.message || 'Code invalide'))
      .finally(() => setLoading(false))
  }, [code])

  async function handleJoin() {
    if (!code) return
    setJoining(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push(`/${locale}/groups`), 2000)
      } else if (res.status === 401) {
        window.location.href = `/${locale}/login`
      } else {
        setError(data.error || 'Erreur')
      }
    } catch { setError('Erreur réseau') }
    setJoining(false)
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950 dark:to-black">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
            <Users className="h-6 w-6 text-emerald-600" />
          </div>
          <CardTitle>
            {success ? 'Bienvenue !' : error ? 'Erreur' : `Rejoindre ${group?.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {success ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-12 w-12 text-emerald-600" />
              <p className="text-muted-foreground">Vous avez rejoint le groupe. Redirection...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={() => router.push(`/${locale}/login`)}>Se connecter</Button>
            </div>
          ) : group ? (
            <>
              {group.description && <p className="text-muted-foreground text-sm">{group.description}</p>}
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleJoin} disabled={joining}>
                {joining ? 'Inscription...' : 'Rejoindre le groupe'}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
