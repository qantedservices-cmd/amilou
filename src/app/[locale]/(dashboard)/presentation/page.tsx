'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  BookOpen,
  Star,
  Heart,
  Award,
  RefreshCw,
  BookMarked,
  Layers,
  GraduationCap,
  Sparkles,
  Target,
  Clock,
  TrendingUp,
  LayoutDashboard,
  Settings,
  Users,
  Shield,
  Navigation,
  BarChart3,
  CalendarCheck,
  Library,
  Grid3X3,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Info,
  List
} from 'lucide-react'

const guideSections = [
  { id: 'guide-dashboard', icon: LayoutDashboard, label: 'Le Tableau de Bord', color: 'text-blue-600' },
  { id: 'guide-programmes', icon: CalendarCheck, label: 'Programmes Journaliers', color: 'text-emerald-600' },
  { id: 'guide-objectifs', icon: Target, label: 'Objectifs & Paramètres', color: 'text-amber-600' },
  { id: 'guide-tracker', icon: Navigation, label: 'Tracker Révision & Lecture', color: 'text-teal-600' },
  { id: 'guide-cycles', icon: RefreshCw, label: 'Cycles de Complétion', color: 'text-purple-600' },
  { id: 'guide-mastery', icon: Grid3X3, label: 'Grille de Suivi (Mastery)', color: 'text-indigo-600' },
  { id: 'guide-livres', icon: Library, label: 'Livres (Mutun & Hadiths)', color: 'text-rose-600' },
  { id: 'guide-roles', icon: Shield, label: 'Rôles & Permissions', color: 'text-slate-600' },
]

export default function PresentationPage() {
  const [guideExpanded, setGuideExpanded] = useState(true)

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</h1>
        <p className="text-muted-foreground">Au nom d'Allah, le Tout Miséricordieux, le Très Miséricordieux</p>
      </div>

      {/* Importance du Coran */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <BookOpen className="h-6 w-6" />
            L'importance du Coran dans la vie du musulman
          </CardTitle>
          <CardDescription>
            La parole d'Allah, guide et lumière pour l'humanité
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Parole Sacrée */}
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <Star className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">La Parole Sacrée d'Allah</h3>
              <p className="text-muted-foreground">
                Le Coran est la parole d'Allah révélée au Prophète Muhammad ﷺ par l'intermédiaire de l'ange Jibril (Gabriel).
                C'est le dernier livre révélé, préservé lettre par lettre depuis plus de 1400 ans.
              </p>
              <blockquote className="mt-3 border-l-4 border-emerald-500 pl-4 italic text-sm">
                « C'est Nous qui avons fait descendre le Rappel (le Coran), et c'est Nous qui en sommes les gardiens. »
                <span className="block text-xs text-muted-foreground mt-1">— Sourate Al-Hijr (15:9)</span>
              </blockquote>
            </div>
          </div>

          <Separator />

          {/* Rétribution */}
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">La rétribution pour la récitation</h3>
              <p className="text-muted-foreground">
                Chaque lettre récitée du Coran est récompensée par dix bonnes actions (hassanates).
              </p>
              <blockquote className="mt-3 border-l-4 border-amber-500 pl-4 italic text-sm">
                « Celui qui récite une lettre du Livre d'Allah aura une bonne action, et la bonne action sera multipliée par dix.
                Je ne dis pas que "Alif Lam Mim" est une lettre, mais "Alif" est une lettre, "Lam" est une lettre et "Mim" est une lettre. »
                <span className="block text-xs text-muted-foreground mt-1">— Hadith rapporté par At-Tirmidhi</span>
              </blockquote>
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <p className="text-sm font-medium">Exemple : La sourate Al-Fatiha contient environ 140 lettres = <span className="text-amber-600 font-bold">1400 hassanates</span> minimum !</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Intercession */}
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Heart className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">L'intercession le Jour du Jugement</h3>
              <p className="text-muted-foreground">
                Le Coran intercédera pour ceux qui le récitaient et le mettaient en pratique.
              </p>
              <blockquote className="mt-3 border-l-4 border-purple-500 pl-4 italic text-sm">
                « Lisez le Coran, car il viendra le Jour de la Résurrection comme intercesseur pour ceux qui le récitaient. »
                <span className="block text-xs text-muted-foreground mt-1">— Hadith rapporté par Muslim</span>
              </blockquote>
            </div>
          </div>

          <Separator />

          {/* Élévation */}
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">L'élévation des rangs au Paradis</h3>
              <p className="text-muted-foreground">
                Le mémorisateur du Coran (Hafidh) aura un rang élevé au Paradis, ainsi que ses parents.
              </p>
              <blockquote className="mt-3 border-l-4 border-blue-500 pl-4 italic text-sm">
                « Il sera dit au lecteur du Coran : "Lis et élève-toi, récite comme tu récitais dans le bas monde,
                car ta place sera au dernier verset que tu réciteras." »
                <span className="block text-xs text-muted-foreground mt-1">— Hadith rapporté par Abu Dawud et At-Tirmidhi</span>
              </blockquote>
              <blockquote className="mt-3 border-l-4 border-blue-500 pl-4 italic text-sm">
                « Celui qui récite le Coran, l'apprend et le met en pratique, on fera porter à ses parents le Jour de la Résurrection
                une couronne de lumière dont l'éclat sera semblable à celui du soleil. »
                <span className="block text-xs text-muted-foreground mt-1">— Hadith rapporté par Al-Hakim</span>
              </blockquote>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Les Programmes d'apprentissage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            Les programmes d'apprentissage
          </CardTitle>
          <CardDescription>
            Comprendre chaque programme pour organiser votre apprentissage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mémorisation */}
          <div className="p-4 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">Mémorisation</h3>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">Nouveau</Badge>
                </div>
                <p className="text-muted-foreground mb-3">
                  Apprendre de nouveaux versets du Coran par cœur.
                </p>
                <div className="bg-white dark:bg-background p-3 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-emerald-600" />
                    <span><strong>Objectif :</strong> Définir une quantité hebdomadaire (ex: 1 page/semaine)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span><strong>Méthode :</strong> Répéter la portion un certain nombre de fois quotidiennement</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span><strong>Conseil :</strong> La régularité prime sur la quantité. Mieux vaut peu mais constant.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Consolidation */}
          <div className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">Consolidation</h3>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Renforcement</Badge>
                </div>
                <p className="text-muted-foreground mb-3">
                  Renforcer ce qui vient d'être mémorisé récemment.
                </p>
                <div className="bg-white dark:bg-background p-3 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span><strong>Objectif :</strong> Lire les X dernières pages mémorisées chaque jour</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span><strong>Méthode :</strong> La zone de consolidation avance avec la mémorisation</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span><strong>Exemple :</strong> Si vous mémorisez la page 50, consolidez les pages 45-49</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Révision */}
          <div className="p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">Révision</h3>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Ancien</Badge>
                </div>
                <p className="text-muted-foreground mb-3">
                  Réviser régulièrement tout ce qui a été mémorisé pour ne pas l'oublier.
                </p>
                <div className="bg-white dark:bg-background p-3 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-amber-600" />
                    <span><strong>Objectif :</strong> Définir une quantité quotidienne (ex: 5 pages/jour)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span><strong>Méthode :</strong> Parcourir tout le mémorisé en boucle (cycle)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                    <span><strong>Suivi :</strong> Comptez vos cycles de révision complète</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lecture */}
          <div className="p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <BookMarked className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">Lecture</h3>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">Tilawa</Badge>
                </div>
                <p className="text-muted-foreground mb-3">
                  Lire le Coran en entier régulièrement, même sans mémorisation.
                </p>
                <div className="bg-white dark:bg-background p-3 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span><strong>Objectif :</strong> Fixer une quantité quotidienne (ex: 2 pages/jour)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span><strong>Méthode :</strong> Lecture complète du Coran (Khatma)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <span><strong>Suivi :</strong> Comptez vos Khatma (lectures complètes)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tafsir */}
          <div className="p-4 rounded-lg border-2 border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">Tafsir</h3>
                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100">Compréhension</Badge>
                </div>
                <p className="text-muted-foreground mb-3">
                  Étudier l'exégèse du Coran pour comprendre le sens profond des versets.
                </p>
                <div className="bg-white dark:bg-background p-3 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-rose-600" />
                    <span><strong>Objectif :</strong> Étudier le tafsir d'une sourate ou d'un passage</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-rose-600" />
                    <span><strong>Méthode :</strong> Utiliser des livres de tafsir reconnus</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-rose-600" />
                    <span><strong>Conseil :</strong> Comprendre ce qu'on récite augmente la concentration</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conseils pratiques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-600" />
            Conseils pour réussir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">1. La régularité</h4>
              <p className="text-sm text-muted-foreground">
                « Les actes les plus aimés d'Allah sont les plus réguliers, même s'ils sont peu nombreux. » (Hadith)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">2. L'intention sincère</h4>
              <p className="text-sm text-muted-foreground">
                Purifiez votre intention : apprenez pour Allah, pas pour les éloges des gens.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">3. Le moment propice</h4>
              <p className="text-sm text-muted-foreground">
                Les meilleurs moments : après Fajr, avant le coucher. Choisissez votre créneau et respectez-le.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">4. L'environnement</h4>
              <p className="text-sm text-muted-foreground">
                Trouvez un endroit calme, éloignez les distractions (téléphone, TV...).
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">5. La récitation à voix haute</h4>
              <p className="text-sm text-muted-foreground">
                Récitez à voix haute pour mieux mémoriser et corriger votre prononciation.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">6. L'écoute répétée</h4>
              <p className="text-sm text-muted-foreground">
                Écoutez les récitateurs pour améliorer votre tajwid et ancrer les versets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invocation finale */}
      <Card className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 border-emerald-200 dark:border-emerald-800">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-2xl font-arabic">اللَّهُمَّ اجْعَلْنَا مِنْ أَهْلِ القُرْآنِ الَّذِينَ هُمْ أَهْلُكَ وَخَاصَّتُكَ</p>
            <p className="text-muted-foreground italic">
              « Ô Allah, fais de nous des gens du Coran, qui sont Tes gens et Tes proches. »
            </p>
            <p className="text-xs text-muted-foreground">Amine</p>
          </div>
        </CardContent>
      </Card>

      {/* ====================================== */}
      {/* GUIDE DE L'APPLICATION                 */}
      {/* ====================================== */}

      <div className="relative py-8">
        <Separator />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
          <span className="bg-background px-4 text-sm font-medium text-muted-foreground">Guide Pratique</span>
        </div>
      </div>

      {/* Table des matières */}
      <Card id="guide" className="border-2 border-slate-200 dark:border-slate-700">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setGuideExpanded(!guideExpanded)}
        >
          <CardTitle className="flex items-center gap-2">
            <List className="h-6 w-6 text-slate-600" />
            Guide de l'Application
            <span className="ml-auto">
              {guideExpanded
                ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
                : <ChevronDown className="h-5 w-5 text-muted-foreground" />
              }
            </span>
          </CardTitle>
          <CardDescription>
            Comment utiliser Amilou pour suivre votre apprentissage du Coran
          </CardDescription>
        </CardHeader>
        {guideExpanded && (
          <CardContent>
            <nav className="grid gap-2 sm:grid-cols-2">
              {guideSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <section.icon className={`h-5 w-5 ${section.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-sm font-medium">{section.label}</span>
                </a>
              ))}
            </nav>
          </CardContent>
        )}
      </Card>

      {/* Section 1 : Le Tableau de Bord */}
      <Card id="guide-dashboard">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-blue-600" />
            Le Tableau de Bord
          </CardTitle>
          <CardDescription>Votre centre de contrôle quotidien</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Le tableau de bord est la page principale de l'application. Il regroupe toutes vos statistiques et votre avancement en un coup d'oeil.
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <h4 className="font-semibold text-sm mb-1">Sélecteur de période</h4>
              <p className="text-xs text-muted-foreground">
                En haut de la page, choisissez la période d'affichage : <strong>Année</strong>, <strong>Mois</strong>, ou <strong>Global</strong> (tout l'historique). Toutes les statistiques s'adaptent automatiquement à la période choisie.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <h4 className="font-semibold text-sm mb-1">Avancement Global</h4>
              <p className="text-xs text-muted-foreground">
                La barre de progression en haut montre votre pourcentage total de mémorisation du Coran (versets, pages, hizbs). Elle est toujours globale, indépendante de la période.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <h4 className="font-semibold text-sm mb-1">Cartes statistiques</h4>
              <p className="text-xs text-muted-foreground">
                4 cartes rapides affichent : les versets de la période, les pages, la série quotidienne (streak) et la série hebdomadaire. La série quotidienne compte les jours consécutifs avec au moins un programme complété.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <h4 className="font-semibold text-sm mb-1">Navigation par semaine</h4>
              <p className="text-xs text-muted-foreground">
                Utilisez les flèches ou le calendrier pour naviguer entre les semaines dans la grille des programmes journaliers. Le numéro de semaine (S1, S2...) s'affiche en haut.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 : Programmes Journaliers */}
      <Card id="guide-programmes">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Programmes Journaliers
          </CardTitle>
          <CardDescription>Cocher ses programmes chaque jour</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Chaque jour, cochez les programmes que vous avez complétés. C'est le coeur du suivi quotidien.
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <h4 className="font-semibold text-sm mb-1">La grille hebdomadaire</h4>
              <p className="text-xs text-muted-foreground">
                Une grille 7 jours x 4 programmes (Mémorisation, Consolidation, Révision, Lecture) s'affiche.
                Cliquez sur une case pour cocher/décocher. Les cases vertes = complété, grises = non fait.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <h4 className="font-semibold text-sm mb-1">Objectifs hebdomadaires</h4>
              <p className="text-xs text-muted-foreground">
                Sous la grille, vos objectifs hebdomadaires (Tafsir, Hadith, etc.) apparaissent.
                Cochez-les quand la semaine est terminée. Vous pouvez en créer de nouveaux dans les Paramètres.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <h4 className="font-semibold text-sm mb-1">Taux de complétion</h4>
              <p className="text-xs text-muted-foreground">
                Sous la grille, un résumé montre le taux de complétion par programme sur la semaine, le mois et l'année.
                Ce taux est calculé depuis votre <strong>date d'adoption</strong> (premier jour d'utilisation).
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Astuce :</strong> Seuls les programmes que vous avez activés dans les Paramètres apparaissent dans la grille. Si un programme ne s'affiche pas, vérifiez vos paramètres.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 : Objectifs & Paramètres */}
      <Card id="guide-objectifs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-600" />
            Objectifs & Paramètres
          </CardTitle>
          <CardDescription>Configurer ses objectifs et préférences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Allez dans <strong>Paramètres</strong> (menu latéral) pour configurer votre profil, vos objectifs et vos préférences.
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <h4 className="font-semibold text-sm mb-1">Objectifs par programme</h4>
              <p className="text-xs text-muted-foreground">
                Définissez votre objectif pour chaque programme : quantité (1, 2...) + unité (page, hizb, juz...) + période (jour, semaine...).
                Exemple : "2 hizbs par jour" pour la Révision. Ces objectifs sont utilisés par le simulateur et le tracker d'avancement.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <h4 className="font-semibold text-sm mb-1">Programmes activés</h4>
              <p className="text-xs text-muted-foreground">
                Activez ou désactivez les programmes qui vous concernent. Un programme désactivé ne s'affichera plus dans la grille journalière ni dans les statistiques.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <h4 className="font-semibold text-sm mb-1">Point de départ mémorisation</h4>
              <p className="text-xs text-muted-foreground">
                Indiquez la sourate et le verset où vous avez commencé votre mémorisation, et le sens (vers An-Nas ou vers Al-Fatiha).
                Cela permet de calculer automatiquement votre zone mémorisée et le nombre de hizbs.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <h4 className="font-semibold text-sm mb-1">Confidentialité</h4>
              <p className="text-xs text-muted-foreground">
                Choisissez quelles données rendre privées : assiduité, avancement, statistiques, évaluations.
                Les données privées restent visibles pour vous, votre référent et l'administrateur.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <h4 className="font-semibold text-sm mb-1">Historique des objectifs</h4>
              <p className="text-xs text-muted-foreground">
                Chaque modification d'objectif est sauvegardée dans l'historique. Vous pouvez ainsi suivre l'évolution de vos objectifs dans le temps.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 : Tracker Révision & Lecture */}
      <Card id="guide-tracker">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-teal-600" />
            Tracker Révision & Lecture
          </CardTitle>
          <CardDescription>Suivre sa position dans les cycles en cours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Le tracker affiche en temps réel votre position actuelle dans les cycles de Révision et de Lecture (sourate, verset, hizb, page, pourcentage).
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/30">
              <h4 className="font-semibold text-sm mb-1">Comment ça marche</h4>
              <p className="text-xs text-muted-foreground">
                Chaque jour où vous cochez "Révision" ou "Lecture" dans la grille, votre position avance selon l'objectif que vous avez défini.
                Exemple : si votre objectif est "2 hizbs/jour" en Révision, chaque jour coché avance de 2 hizbs.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/30">
              <h4 className="font-semibold text-sm mb-1">Recalculer</h4>
              <p className="text-xs text-muted-foreground">
                Le bouton <strong>Recalculer</strong> recompte les jours complétés depuis votre dernier cycle et met à jour votre position. Si votre position dépasse la fin d'un cycle, un nouveau cycle est automatiquement créé.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/30">
              <h4 className="font-semibold text-sm mb-1">Modifier manuellement</h4>
              <p className="text-xs text-muted-foreground">
                Cliquez sur <strong>Modifier</strong> pour ajuster votre position si elle ne correspond pas à la réalité (ex : vous avez avancé plus vite certains jours).
              </p>
            </div>

            <div className="p-3 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                <Info className="h-4 w-4 text-amber-600" />
                Phase combinée
              </h4>
              <p className="text-xs text-muted-foreground">
                Quand votre lecture (Tilawa) entre dans votre zone mémorisée, la Révision se suspend automatiquement car vous révisez de fait via la Lecture.
                Pendant cette phase, la Lecture avance à vitesse doublée. Quand elle sort de la zone mémorisée, un cycle de Révision est créé automatiquement
                et la Révision reprend là où elle s'était arrêtée.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5 : Cycles de Complétion */}
      <Card id="guide-cycles">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-purple-600" />
            Cycles de Complétion
          </CardTitle>
          <CardDescription>Comptabiliser les tours complets du Coran</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Un cycle représente un tour complet : soit de votre zone mémorisée (Révision), soit du Coran entier (Lecture/Khatma).
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
              <h4 className="font-semibold text-sm mb-1">Ajouter un cycle</h4>
              <p className="text-xs text-muted-foreground">
                Cliquez sur <strong>Ajouter</strong> dans la carte Révision ou Lecture pour enregistrer un nouveau cycle. Indiquez la date de complétion et une note optionnelle.
                Pour la Révision, le nombre de hizbs est calculé automatiquement depuis votre progression.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
              <h4 className="font-semibold text-sm mb-1">Historique</h4>
              <p className="text-xs text-muted-foreground">
                Cliquez sur la carte pour voir l'historique complet de vos cycles. Vous pouvez modifier la date, les notes, ou supprimer un cycle.
                Le nombre de jours entre chaque cycle est recalculé automatiquement.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
              <h4 className="font-semibold text-sm mb-1">Statistiques affichées</h4>
              <p className="text-xs text-muted-foreground">
                Pour chaque type : nombre total de cycles, date du dernier, jours écoulés depuis, et moyenne de jours par cycle.
                La couleur des jours change selon l'urgence (vert, orange, rouge).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 6 : Grille de Suivi (Mastery) */}
      <Card id="guide-mastery">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-indigo-600" />
            Grille de Suivi (Mastery)
          </CardTitle>
          <CardDescription>Vue matricielle du niveau de maîtrise par sourate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Accessible depuis la page d'un groupe, la grille de suivi montre le niveau de maîtrise de chaque élève pour chaque sourate.
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
              <h4 className="font-semibold text-sm mb-2">Codes de statut</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 text-xs px-1.5">V7</Badge>
                  <span className="text-muted-foreground">Validé semaine 7</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs px-1.5">C</Badge>
                  <span className="text-muted-foreground">Supposé connu, à valider</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200 text-xs px-1.5">90%</Badge>
                  <span className="text-muted-foreground">90% maîtrisé</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 text-xs px-1.5">50%</Badge>
                  <span className="text-muted-foreground">Partiellement maîtrisé</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 text-xs px-1.5">AM</Badge>
                  <span className="text-muted-foreground">À mémoriser</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100 text-xs px-1.5">S7</Badge>
                  <span className="text-muted-foreground">Récité à un élève sem. 7</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
              <h4 className="font-semibold text-sm mb-1">Commentaires</h4>
              <p className="text-xs text-muted-foreground">
                Un point orange sur une cellule indique des commentaires (ex : "Hésitation v.8").
                Cliquez sur la cellule pour les voir. Le référent peut ajouter, modifier ou supprimer les commentaires.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
              <h4 className="font-semibold text-sm mb-1">Export</h4>
              <p className="text-xs text-muted-foreground">
                La grille peut être exportée en <strong>PNG</strong> (image haute qualité) ou en <strong>PDF</strong> (A4 paysage avec les commentaires en annexe).
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Seul le <strong>référent</strong> du groupe peut modifier les statuts et les commentaires. Les membres voient la grille en lecture seule.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 7 : Livres */}
      <Card id="guide-livres">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-rose-600" />
            Livres (Mutun & Hadiths)
          </CardTitle>
          <CardDescription>Suivre sa progression dans les textes islamiques</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La section Livres permet de suivre votre avancement dans les textes de science islamique (Mutun, collections de hadiths).
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30">
              <h4 className="font-semibold text-sm mb-1">Catalogue</h4>
              <p className="text-xs text-muted-foreground">
                Parcourez le catalogue par discipline (Aqeedah, Hadith, Fiqh...) ou par collection (ex : Mutun Talib al-'Ilm par niveau).
                Ajoutez un livre à votre liste personnelle pour commencer le suivi.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30">
              <h4 className="font-semibold text-sm mb-1">Progression par item</h4>
              <p className="text-xs text-muted-foreground">
                Chaque livre contient des chapitres et des items (hadiths, points, versets). Cochez chaque item complété.
                La progression se calcule en cascade : items terminés = % du chapitre = % du livre.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30">
              <h4 className="font-semibold text-sm mb-1">Livres de groupe</h4>
              <p className="text-xs text-muted-foreground">
                Le référent peut assigner des livres au groupe. Une matrice montre la progression de chaque membre.
                Les livres de groupe apparaissent automatiquement dans "Mes Livres" pour chaque membre.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 8 : Rôles & Permissions */}
      <Card id="guide-roles">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-600" />
            Rôles & Permissions
          </CardTitle>
          <CardDescription>Qui peut voir et faire quoi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            L'application distingue 3 niveaux d'accès pour protéger vos données tout en permettant le suivi collectif.
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-slate-600" />
                <h4 className="font-semibold text-sm">Utilisateur (USER)</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Voit et modifie ses propres données</li>
                <li>Voit les données publiques des membres de son groupe en lecture seule</li>
                <li>Ne voit pas les données marquées comme privées des autres membres</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-blue-600" />
                <h4 className="font-semibold text-sm">Référent (REFERENT)</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Tout ce qu'un utilisateur peut faire</li>
                <li>Voit et modifie les données de tous les membres de son groupe (y compris privées)</li>
                <li>Gère la grille de suivi (mastery) : statuts et commentaires</li>
                <li>Assigne des livres au groupe</li>
                <li>Ajoute/active/désactive des membres du groupe</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-amber-600" />
                <h4 className="font-semibold text-sm">Administrateur (ADMIN)</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Accès total à toutes les données de tous les utilisateurs</li>
                <li>Gestion des utilisateurs (création, modification, suppression)</li>
                <li>Fonction "Voir en tant que" (impersonation) pour dépanner un utilisateur</li>
                <li>Voit tous les groupes et peut tout modifier</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
            <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>Confidentialité :</strong> Par défaut, toutes vos données sont publiques au sein de votre groupe. Vous pouvez rendre privées l'assiduité, l'avancement, les statistiques et les évaluations dans les Paramètres.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Retour en haut */}
      <div className="text-center pb-4">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Retour en haut
        </button>
      </div>
    </div>
  )
}
