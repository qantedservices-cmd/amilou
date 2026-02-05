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
import { Switch } from '@/components/ui/switch'
import { User, Lock, Mail, Calendar, Shield, Check, X, Target, Save, History, Eye, EyeOff } from 'lucide-react'

interface UserProfile {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  createdAt: string
  privateAttendance: boolean
  privateProgress: boolean
  privateStats: boolean
  privateEvaluations: boolean
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
  startDate: string
  endDate: string | null
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

  // Privacy settings
  const [privateAttendance, setPrivateAttendance] = useState(false)
  const [privateProgress, setPrivateProgress] = useState(false)
  const [privateStats, setPrivateStats] = useState(false)
  const [privateEvaluations, setPrivateEvaluations] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [privacyMessage, setPrivacyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Program settings
  const [programs, setPrograms] = useState<Program[]>([])
  const [programSettings, setProgramSettings] = useState<ProgramSetting[]>([])
  const [settingsHistory, setSettingsHistory] = useState<ProgramSetting[]>([])
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formData, setFormData] = useState<Record<string, { quantity: string; unit: string; period: string }>>({})

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
        // Set privacy settings
        setPrivateAttendance(data.privateAttendance || false)
        setPrivateProgress(data.privateProgress || false)
        setPrivateStats(data.privateStats || false)
        setPrivateEvaluations(data.privateEvaluations || false)
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
      const [activeRes, historyRes] = await Promise.all([
        fetch('/api/settings/programs'),
        fetch('/api/settings/programs?history=true'),
      ])
      if (activeRes.ok) {
        const data = await activeRes.json()
        const active = (Array.isArray(data) ? data : []).filter((s: ProgramSetting) => s.isActive)
        setProgramSettings(active)
        // Initialize form data from active settings
        const newFormData: Record<string, { quantity: string; unit: string; period: string }> = {}
        programs.forEach(prog => {
          const setting = active.find((s: ProgramSetting) => s.programId === prog.id)
          newFormData[prog.id] = {
            quantity: setting?.quantity?.toString() || '1',
            unit: setting?.unit || 'PAGE',
            period: setting?.period || 'DAY',
          }
        })
        setFormData(newFormData)
      }
      if (historyRes.ok) {
        const data = await historyRes.json()
        const inactive = (Array.isArray(data) ? data : []).filter((s: ProgramSetting) => !s.isActive)
        setSettingsHistory(inactive)
      }
    } catch (error) {
      console.error('Error fetching program settings:', error)
    }
  }

  // Initialize formData when programs are loaded
  useEffect(() => {
    if (programs.length > 0 && Object.keys(formData).length === 0) {
      const newFormData: Record<string, { quantity: string; unit: string; period: string }> = {}
      programs.forEach(prog => {
        const setting = programSettings.find(s => s.programId === prog.id)
        newFormData[prog.id] = {
          quantity: setting?.quantity?.toString() || '1',
          unit: setting?.unit || 'PAGE',
          period: setting?.period || 'DAY',
        }
      })
      setFormData(newFormData)
    }
  }, [programs, programSettings])

  async function saveAllSettings() {
    setSavingSettings(true)
    setSettingsMessage(null)

    try {
      const settings = programs.map(prog => ({
        programId: prog.id,
        quantity: parseFloat(formData[prog.id]?.quantity || '1'),
        unit: formData[prog.id]?.unit || 'PAGE',
        period: formData[prog.id]?.period || 'DAY',
      }))

      const res = await fetch('/api/settings/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (res.ok) {
        await fetchProgramSettings()
        setSettingsMessage({ type: 'success', text: 'Objectifs enregistrés' })
        setTimeout(() => setSettingsMessage(null), 3000)
      } else {
        const data = await res.json()
        setSettingsMessage({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (error) {
      setSettingsMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement' })
    } finally {
      setSavingSettings(false)
    }
  }

  function updateFormField(programId: string, field: 'quantity' | 'unit' | 'period', value: string) {
    setFormData(prev => ({
      ...prev,
      [programId]: {
        ...prev[programId],
        [field]: value
      }
    }))
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

  async function handlePrivacySubmit() {
    setSavingPrivacy(true)
    setPrivacyMessage(null)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateAttendance,
          privateProgress,
          privateStats,
          privateEvaluations,
        }),
      })

      if (res.ok) {
        setPrivacyMessage({ type: 'success', text: 'Paramètres de confidentialité enregistrés' })
        setTimeout(() => setPrivacyMessage(null), 3000)
      } else {
        const data = await res.json()
        setPrivacyMessage({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (error) {
      setPrivacyMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' })
    } finally {
      setSavingPrivacy(false)
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

      {/* Privacy Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Confidentialité
          </CardTitle>
          <CardDescription>
            Choisissez quelles données masquer aux autres membres de votre groupe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {privacyMessage && (
            <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${
              privacyMessage.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {privacyMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {privacyMessage.text}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Les données privées restent visibles pour vous, les administrateurs et les référents de votre groupe.
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Assiduité quotidienne</Label>
                <p className="text-sm text-muted-foreground">
                  Masquer votre assiduité aux autres membres
                </p>
              </div>
              <Switch
                checked={privateAttendance}
                onCheckedChange={setPrivateAttendance}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Avancement</Label>
                <p className="text-sm text-muted-foreground">
                  Masquer votre progression aux autres membres
                </p>
              </div>
              <Switch
                checked={privateProgress}
                onCheckedChange={setPrivateProgress}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Statistiques</Label>
                <p className="text-sm text-muted-foreground">
                  Masquer vos statistiques aux autres membres
                </p>
              </div>
              <Switch
                checked={privateStats}
                onCheckedChange={setPrivateStats}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Évaluations</Label>
                <p className="text-sm text-muted-foreground">
                  Masquer vos évaluations aux autres membres
                </p>
              </div>
              <Switch
                checked={privateEvaluations}
                onCheckedChange={setPrivateEvaluations}
              />
            </div>
          </div>

          <Button
            onClick={handlePrivacySubmit}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={savingPrivacy}
          >
            {savingPrivacy ? t('common.loading') : 'Enregistrer'}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Program Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Mes objectifs par programme
              </CardTitle>
              <CardDescription>
                Définissez vos objectifs pour chaque programme
              </CardDescription>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={savingSettings}
              onClick={saveAllSettings}
            >
              {savingSettings ? '...' : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
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

          {/* Active settings date */}
          {programSettings.length > 0 && (
            <p className="text-xs text-muted-foreground mb-4">
              En vigueur depuis: {new Date(programSettings[0].startDate).toLocaleDateString('fr-FR')}
            </p>
          )}

          <div className="space-y-3">
            {programs.map((program) => {
              const data = formData[program.id] || { quantity: '1', unit: 'PAGE', period: 'DAY' }
              return (
                <div key={program.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <Badge className={`min-w-[110px] justify-center text-xs ${getProgramColor(program.code)}`}>
                    {program.nameFr}
                  </Badge>

                  <Select value={data.quantity} onValueChange={(v) => updateFormField(program.id, 'quantity', v)}>
                    <SelectTrigger className="w-[70px] h-9">
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

                  <Select value={data.unit} onValueChange={(v) => updateFormField(program.id, 'unit', v)}>
                    <SelectTrigger className="w-[110px] h-9">
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

                  <span className="text-sm text-muted-foreground">par</span>

                  <Select value={data.period} onValueChange={(v) => updateFormField(program.id, 'period', v)}>
                    <SelectTrigger className="w-[110px] h-9">
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
                </div>
              )
            })}
          </div>

          {/* History section */}
          {settingsHistory.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                <History className="h-4 w-4" />
                Historique des objectifs
              </h4>
              <div className="space-y-2">
                {/* Group history by date range */}
                {(() => {
                  const groups: Record<string, ProgramSetting[]> = {}
                  settingsHistory.forEach(s => {
                    const key = `${s.startDate}_${s.endDate || ''}`
                    if (!groups[key]) groups[key] = []
                    groups[key].push(s)
                  })
                  return Object.entries(groups).map(([key, items]) => (
                    <div key={key} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {new Date(items[0].startDate).toLocaleDateString('fr-FR')}
                        {items[0].endDate && ` → ${new Date(items[0].endDate).toLocaleDateString('fr-FR')}`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {items.map(s => (
                          <span key={s.id} className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {s.program.nameFr}: {s.quantity} {UNITS.find(u => u.value === s.unit)?.label}/{PERIODS.find(p => p.value === s.period)?.label}
                            </Badge>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
