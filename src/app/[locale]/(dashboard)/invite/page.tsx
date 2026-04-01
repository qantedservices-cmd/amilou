'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check, AlertTriangle } from 'lucide-react'

export default function InvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Lien d\'invitation invalide')
      setLoading(false)
      return
    }

    fetch(`/api/invite?token=${token}`)
      .then(async res => {
        if (res.ok) {
          const data = await res.json()
          setUserName(data.name)
          setUserEmail(data.email)
        } else {
          const data = await res.json()
          setError(data.error || 'Lien invalide')
        }
      })
      .catch(() => setError('Erreur de connexion'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caractères')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push(`/${locale}/dashboard`), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur')
      }
    } catch {
      setError('Erreur de connexion')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Check className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">Compte activé</h2>
            <p className="text-muted-foreground">Votre compte a été créé avec succès. Vous allez être redirigé vers la page de connexion...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !userName) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold">Invitation invalide</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => router.push(`/${locale}/dashboard`)}>
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</CardTitle>
          <CardDescription className="text-base">
            Bienvenue sur Aamilou, {userName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={userEmail} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Choisir un mot de passe</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 4 caractères"
                autoFocus
              />
            </div>
            <div>
              <Label>Confirmer le mot de passe</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Activation...</> : 'Activer mon compte'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
