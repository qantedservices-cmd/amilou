const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const amilou = await prisma.group.findFirst({ where: { name: { contains: 'Amilou' } } })

  // Get Samir's user ID
  const samir = await prisma.user.findFirst({ where: { name: { contains: 'Samir' } } })
  console.log('Samir:', samir?.id, samir?.name)

  // Get TAFSIR program
  const tafsirProg = await prisma.program.findFirst({ where: { code: 'TAFSIR' } })

  // Get all tafsir progress entries for Samir
  const tafsirEntries = await prisma.progress.findMany({
    where: {
      userId: samir.id,
      programId: tafsirProg.id,
    },
    orderBy: { date: 'asc' },
    select: { date: true, surahNumber: true, verseStart: true, verseEnd: true }
  })

  console.log(`\n${tafsirEntries.length} entrées tafsir de Samir:`)
  const tafsirDates = new Set()
  for (const e of tafsirEntries) {
    const d = e.date.toISOString().split('T')[0]
    tafsirDates.add(d)
    console.log(`  ${d} | Sourate ${e.surahNumber} v.${e.verseStart}-${e.verseEnd}`)
  }

  // Get suspicious sessions (only Samir present)
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: amilou.id },
    include: {
      attendance: { where: { present: true }, select: { userId: true } },
    },
    orderBy: { date: 'asc' }
  })

  const suspicious = sessions.filter(s =>
    s.attendance.length === 1 && s.attendance[0].userId === samir.id
  )

  console.log(`\n${suspicious.length} séances avec seul Samir présent:`)
  for (const s of suspicious) {
    const d = s.date.toISOString().split('T')[0]
    // Check if date matches a tafsir entry (same week)
    const sessionDate = new Date(s.date)
    const weekStart = new Date(sessionDate)
    weekStart.setDate(sessionDate.getDate() - sessionDate.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const matchingTafsir = tafsirEntries.filter(e => {
      const td = new Date(e.date)
      return td >= weekStart && td <= weekEnd
    })

    const match = matchingTafsir.length > 0 ? `MATCH tafsir (${matchingTafsir.map(t => 'S' + t.surahNumber).join(',')})` : ''
    console.log(`  ${d} | sem ${s.weekNumber} | id: ${s.id} | ${match}`)
  }

  // Also check: are there Google Forms imports that have the same dates?
  const googleFormsAttendance = await prisma.dailyAttendance.findMany({
    where: { userId: samir.id },
    select: { weekStartDate: true },
    orderBy: { weekStartDate: 'asc' }
  })

  console.log(`\n${googleFormsAttendance.length} entrées Google Forms assiduité pour Samir`)
  const gfWeeks = new Set(googleFormsAttendance.map(a => a.weekStartDate.toISOString().split('T')[0]))

  // Check which suspicious sessions overlap with Google Forms weeks
  console.log('\nCorrespondance Google Forms:')
  for (const s of suspicious) {
    const sessionDate = new Date(s.date)
    const weekStart = new Date(sessionDate)
    weekStart.setDate(sessionDate.getDate() - sessionDate.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]
    const hasGF = gfWeeks.has(weekKey)
    console.log(`  ${s.date.toISOString().split('T')[0]} | Google Forms: ${hasGF ? 'OUI' : 'NON'} | id: ${s.id}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
