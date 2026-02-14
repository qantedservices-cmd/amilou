import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getEffectiveUserId } from '@/lib/impersonation'

const PAGES = [
  { name: 'Tableau de bord', path: '/dashboard', keywords: ['dashboard', 'tableau', 'bord', 'accueil'] },
  { name: 'Avancement', path: '/progress', keywords: ['avancement', 'progression', 'progress', 'memorisation'] },
  { name: 'Assiduité', path: '/attendance', keywords: ['assiduité', 'attendance', 'présence', 'assiduite'] },
  { name: 'Livres', path: '/books', keywords: ['livres', 'books', 'mutun', 'hadith', 'matn'] },
  { name: 'Groupes', path: '/groups', keywords: ['groupes', 'groups', 'groupe'] },
  { name: 'Séances', path: '/sessions', keywords: ['séances', 'seances', 'sessions', 'cours'] },
  { name: 'Évaluations', path: '/evaluations', keywords: ['évaluations', 'evaluations', 'notes', 'test'] },
  { name: 'Tafsir', path: '/tafsir', keywords: ['tafsir', 'exégèse', 'exegese', 'interprétation'] },
  { name: 'Paramètres', path: '/settings', keywords: ['paramètres', 'parametres', 'settings', 'profil', 'config'] },
  { name: 'Présentation', path: '/presentation', keywords: ['présentation', 'presentation', 'spirituel'] },
]

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { userId } = await getEffectiveUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim().toLowerCase()

    if (!q || q.length < 1) {
      return NextResponse.json({ pages: [], surahs: [], books: [], students: [] })
    }

    // Check user role for student search
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    const isAdmin = user?.role === 'ADMIN'
    const referentGroups = await prisma.groupMember.findMany({
      where: { userId, role: { in: ['REFERENT', 'ADMIN'] } },
      select: { groupId: true }
    })
    const canSearchStudents = isAdmin || referentGroups.length > 0

    // Search in parallel
    const [surahs, books, students] = await Promise.all([
      // Search surahs
      prisma.surah.findMany({
        where: {
          OR: [
            { nameFr: { contains: q, mode: 'insensitive' } },
            { nameAr: { contains: q } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            ...(isNaN(Number(q)) ? [] : [{ number: Number(q) }])
          ]
        },
        take: 10,
        orderBy: { number: 'asc' }
      }),

      // Search books
      prisma.book.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { titleAr: { contains: q } },
            { author: { contains: q, mode: 'insensitive' } },
            { authorAr: { contains: q } }
          ]
        },
        take: 10,
        orderBy: { title: 'asc' },
        select: { id: true, title: true, titleAr: true, author: true, discipline: true }
      }),

      // Search students (admin/referent only)
      canSearchStudents
        ? (async () => {
            if (isAdmin) {
              return prisma.user.findMany({
                where: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } }
                  ]
                },
                take: 10,
                orderBy: { name: 'asc' },
                select: { id: true, name: true, email: true }
              })
            }
            // Referent: search only in their groups
            const groupIds = referentGroups.map(g => g.groupId)
            const members = await prisma.groupMember.findMany({
              where: { groupId: { in: groupIds } },
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            })
            const seen = new Set<string>()
            return members
              .filter(m => {
                if (seen.has(m.userId)) return false
                seen.add(m.userId)
                const name = (m.user.name || '').toLowerCase()
                const email = m.user.email.toLowerCase()
                return name.includes(q) || email.includes(q)
              })
              .map(m => m.user)
              .slice(0, 10)
          })()
        : Promise.resolve([])
    ])

    // Filter pages
    const matchedPages = PAGES.filter(page =>
      page.name.toLowerCase().includes(q) ||
      page.keywords.some(k => k.includes(q))
    )

    return NextResponse.json({
      pages: matchedPages,
      surahs: surahs.map(s => ({
        number: s.number,
        nameFr: s.nameFr,
        nameAr: s.nameAr,
        totalVerses: s.totalVerses
      })),
      books,
      students
    })
  } catch (error) {
    console.error('Error searching:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recherche' },
      { status: 500 }
    )
  }
}
