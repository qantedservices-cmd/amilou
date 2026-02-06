'use client'

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
  TrendingUp
} from 'lucide-react'

export default function PresentationPage() {
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
    </div>
  )
}
