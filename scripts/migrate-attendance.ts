/**
 * Migration Script: Convert old attendance scores (0-5) to new program-based tracking
 *
 * Score mapping:
 * 0 = No programs
 * 1 = MEMORIZATION
 * 2 = MEMORIZATION + CONSOLIDATION
 * 3 = MEMORIZATION + CONSOLIDATION + REVISION
 * 4 = MEMORIZATION + CONSOLIDATION + REVISION + READING
 * 5 = All 4 programs + TAFSIR weekly objective
 *
 * Run with: npx ts-node scripts/migrate-attendance.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Daily programs in order (score 1-4)
const DAILY_PROGRAMS = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING']

async function main() {
  console.log('Starting attendance migration...')

  // Get all programs
  const programs = await prisma.program.findMany()
  const programMap = new Map(programs.map(p => [p.code, p.id]))

  console.log('Programs found:', Array.from(programMap.keys()))

  // Get TAFSIR program for weekly objectives
  const tafsirProgramId = programMap.get('TAFSIR')

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true }
  })

  console.log(`Found ${users.length} users`)

  // Get all existing attendance records
  const attendanceRecords = await prisma.dailyAttendance.findMany({
    orderBy: { date: 'asc' }
  })

  console.log(`Found ${attendanceRecords.length} attendance records to migrate`)

  const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

  let completionsCreated = 0
  let objectivesCreated = 0
  let objectiveCompletionsCreated = 0

  for (const record of attendanceRecords) {
    const weekStartDate = new Date(record.date)
    weekStartDate.setHours(0, 0, 0, 0)

    // Check if user has Tafsir weekly objective, create if not exists
    let tafsirObjective = await prisma.weeklyObjective.findFirst({
      where: {
        userId: record.userId,
        programId: tafsirProgramId,
        name: 'Tafsir'
      }
    })

    if (!tafsirObjective && tafsirProgramId) {
      tafsirObjective = await prisma.weeklyObjective.create({
        data: {
          userId: record.userId,
          name: 'Tafsir',
          programId: tafsirProgramId,
          isCustom: false,
          isActive: true
        }
      })
      objectivesCreated++
    }

    // Process each day of the week
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayField = dayFields[dayIndex]
      const score = record[dayField] as number

      if (score === 0) continue

      // Calculate the actual date for this day
      const dayDate = new Date(weekStartDate)
      dayDate.setDate(weekStartDate.getDate() + dayIndex)

      // Create DailyProgramCompletion records based on score
      const programsToMark = Math.min(score, 4) // Max 4 daily programs

      for (let i = 0; i < programsToMark; i++) {
        const programCode = DAILY_PROGRAMS[i]
        const programId = programMap.get(programCode)

        if (programId) {
          try {
            await prisma.dailyProgramCompletion.upsert({
              where: {
                userId_programId_date: {
                  userId: record.userId,
                  programId: programId,
                  date: dayDate
                }
              },
              update: {
                completed: true
              },
              create: {
                userId: record.userId,
                programId: programId,
                date: dayDate,
                completed: true,
                createdBy: record.createdBy
              }
            })
            completionsCreated++
          } catch (error) {
            // Skip if already exists
          }
        }
      }

      // If score is 5, mark Tafsir weekly objective as completed for this week
      if (score === 5 && tafsirObjective) {
        try {
          await prisma.weeklyObjectiveCompletion.upsert({
            where: {
              weeklyObjectiveId_weekStartDate: {
                weeklyObjectiveId: tafsirObjective.id,
                weekStartDate: weekStartDate
              }
            },
            update: {
              completed: true
            },
            create: {
              weeklyObjectiveId: tafsirObjective.id,
              weekStartDate: weekStartDate,
              completed: true,
              createdBy: record.createdBy
            }
          })
          objectiveCompletionsCreated++
        } catch (error) {
          // Skip if already exists
        }
      }
    }
  }

  console.log('\nMigration completed!')
  console.log(`- Daily program completions created: ${completionsCreated}`)
  console.log(`- Weekly objectives created: ${objectivesCreated}`)
  console.log(`- Weekly objective completions created: ${objectiveCompletionsCreated}`)

  // Create default Hadith objective for all users who don't have one
  console.log('\nCreating default Hadith objectives for all users...')

  let hadithObjectivesCreated = 0
  for (const user of users) {
    const existingHadith = await prisma.weeklyObjective.findFirst({
      where: {
        userId: user.id,
        name: 'Hadith'
      }
    })

    if (!existingHadith) {
      await prisma.weeklyObjective.create({
        data: {
          userId: user.id,
          name: 'Hadith',
          isCustom: false,
          isActive: true
        }
      })
      hadithObjectivesCreated++
    }
  }

  console.log(`- Hadith objectives created: ${hadithObjectivesCreated}`)
}

main()
  .catch((e) => {
    console.error('Migration error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
