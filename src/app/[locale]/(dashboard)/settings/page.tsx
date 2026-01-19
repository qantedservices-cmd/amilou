'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Lock, Mail, Calendar, Shield, Check, X, Target } from 'lucide-react'

interface UserProfile {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  createdAt: string
}

interface Program {
  id: string
  code: string
  nameFr: string
  nameAr: string
}

interface ProgramSetting {
  id: string
  programId: string
  quantity: number
  unit: string
  period: string
  isActive: boolean
  program: Program
}

const QUANTITIES = [
  { value: '0.25', label: '1/4' },
  { value: '0.33', label: '1/3' },
  { value: '0.5', label: '1/2' },
  { value: '0.75', label: '3/4' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
]

const UNITS = [
  { value: 'PAGE', label: 'Page' },
  { value: 'QUART', label: 'Quart' },
  { value: 'DEMI_HIZB', label: 'Demi-hizb' },
  { value: 'HIZB', label: 'Hizb' },
  { value: 'JUZ', label: 'Juz' },
]

const PERIODS = [
  { value: 'DAY', label: 'Jour' },
  { value: 'WEEK', label: 'Semaine' },
  { value: 'MONTH', label: 'Mois' },
  { value: 'YEAR', label: 'Année' },
]

export default function SettingsPage() {
  const t = useTranslations()
  const { data: session, update: updateSession } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [name, setName] = useState('')
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  // Program settings
  const [programs, setPrograms] = useState<Program[]>([])
  const [programSettings, setProgramSettings] = useState<ProgramSetting[]>([])
  const [savingSettings, setSavingSettings] = useState<string | null>(null)
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchProfile()
    fetchPrograms()
    fetchProgramSettings()
  }, [])

  async function fetchProfile() {
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setName(data.name || '')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPrograms() {
    try {
      const res = await fetch('/api/programs')
      if (res.ok) {
        const data = await res.json()
        setPrograms(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
    }
  }

  async function fetchProgramSettings() {
    try {
      const res = await fetch('/api/settings/programs')
      if (res.ok) {
        const data = await res.json()
        setProgramSettings(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching program settings:', error)
    }
  }

  async function saveProgramSetting(programId: string, quantity: string, unit: string, period: string) {
    setSavingSettings(programId)
    setSettingsMessage(null)

    try {
      const res = await fetch('/api/settings/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId,
          quantity: parseFloat(quantity),
          unit,
          period,
          isActive: true
        }),
      })

      if (res.ok) {
        await fetchProgramSettings()
        setSettingsMessage({ type: 'success', text: 'Objectif enregistré' })
      } else {
        const data = await res.json()
        setSettingsMessage({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (error) {
      setSettingsMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement' })
    } finally {
      setSavingSettings(null)
    }
  }

  function getSettingForProgram(programId: string) {
    return programSettings.find(s => s.programId === programId)
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMessage(null)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (res.ok) {
        setProfile(data)
        setProfileMessage({ type: 'success', text: 'Profil mis à jour avec succès' })
        // Update session
        await updateSession({ name })
      } else {
        setProfileMessage({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (error) {
      setProfileMessage({ type: 'error', text: 'Erreur lors de la mise à jour' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSavingPassword(true)
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
      setSavingPassword(false)
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères' })
      setSavingPassword(false)
      return
    }

    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'Mot de passe modifié avec succès' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordMessage({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (error) {
      setPasswordMessage({ type: 'error', text: 'Erreur lors du changement de mot de passe' })
    } finally {
      setSavingPassword(false)
    }
  }

  function getRoleBadge(role: string) {
    const roleConfig: Record<string, { label: string; className: string }> = {
      ADMIN: { label: t('roles.admin'), className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
      MANAGER: { label: t('roles.manager'), className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100' },
      REFERENT: { label: t('roles.referent'), className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
      USER: { label: t('roles.user'), className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' },
    }
    const config = roleConfig[role] || roleConfig.USER
    return <Badge className={config.className}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.settings')}</h1>
        <p className="text-muted-foreground">Gérez votre profil et vos préférences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations du compte
            </CardTitle>
            <CardDescription>Vos informations personnelles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Rôle</p>
                <div className="mt-1">{profile && getRoleBadge(profile.role)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Membre depuis</p>
                <p className="font-medium">
                  {profile && new Date(profile.createdAt).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Modifier le profil</CardTitle>
            <CardDescription>Mettez à jour vos informations</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileMessage && (
                <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                  profileMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {profileMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {profileMessage.text}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={savingProfile || name === profile?.name}
              >
                {savingProfile ? t('common.loading') : t('common.save')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>
            Modifiez votre mot de passe de connexion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
            {passwordMessage && (
              <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                passwordMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {passwordMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {passwordMessage.text}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {savingPassword ? t('common.loading') : 'Changer le mot de passe'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Program Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Mes objectifs par programme
          </CardTitle>
          <CardDescription>
            Définissez vos objectifs quotidiens pour chaque programme de suivi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsMessage && (
            <div className={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${
              settingsMessage.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {settingsMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {settingsMessage.text}
            </div>
          )}
          <div className="space-y-4">
            {programs.map((program) => {
              const setting = getSettingForProgram(program.id)
              return (
                <ProgramSettingRow
                  key={program.id}
                  program={program}
                  setting={setting}
                  saving={savingSettings === program.id}
                  onSave={saveProgramSetting}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Composant pour une ligne de paramètre de programme
function ProgramSettingRow({
  program,
  setting,
  saving,
  onSave,
}: {
  program: Program
  setting?: ProgramSetting
  saving: boolean
  onSave: (programId: string, quantity: string, unit: string, period: string) => void
}) {
  const [quantity, setQuantity] = useState(setting?.quantity?.toString() || '1')
  const [unit, setUnit] = useState(setting?.unit || 'PAGE')
  const [period, setPeriod] = useState(setting?.period || 'DAY')
  const [modified, setModified] = useState(false)

  useEffect(() => {
    if (setting) {
      setQuantity(setting.quantity.toString())
      setUnit(setting.unit)
      setPeriod(setting.period)
      setModified(false)
    }
  }, [setting])

  function handleChange(type: 'quantity' | 'unit' | 'period', value: string) {
    if (type === 'quantity') setQuantity(value)
    else if (type === 'unit') setUnit(value)
    else setPeriod(value)
    setModified(true)
  }

  function getProgramColor(code: string) {
    const colors: Record<string, string> = {
      MEMORIZATION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
      CONSOLIDATION: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      REVISION: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
      READING: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      TAFSIR: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
    }
    return colors[code] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
      <Badge className={`min-w-[120px] justify-center ${getProgramColor(program.code)}`}>
        {program.nameFr}
      </Badge>

      <Select value={quantity} onValueChange={(v) => handleChange('quantity', v)}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUANTITIES.map((q) => (
            <SelectItem key={q.value} value={q.value}>
              {q.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={unit} onValueChange={(v) => handleChange('unit', v)}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u.value} value={u.value}>
              {u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground">par</span>

      <Select value={period} onValueChange={(v) => handleChange('period', v)}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        className="ml-auto bg-emerald-600 hover:bg-emerald-700"
        disabled={saving || !modified}
        onClick={() => onSave(program.id, quantity, unit, period)}
      >
        {saving ? '...' : setting ? 'Modifier' : 'Définir'}
      </Button>
    </div>
  )
}
