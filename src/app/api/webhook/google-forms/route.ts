import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'amilou_webhook_2026';

// Groupe Amilou name (must match exactly in DB)
const GROUPE_AMILOU_NAME = 'Groupe Amilou';

// User name to email mapping
const USER_MAP: Record<string, string> = {
  'Mohamed B.': 'mohamed.b.@amilou.local',
  'Yazid': 'yazid@amilou.local',
  'Samir': 'sinlatourelle@gmail.com',
  'Ibrahim': 'ibrahim@amilou.local',
  'Amine': 'amine@amilou.local',
  'Abdelmoughite': 'abdelmoughite@amilou.local',
  'Mohamed Koucha': 'mohamed.koucha@amilou.local',
};

// Get Sunday (week start for Sun-Sat weeks) from ISO week number
function getSundayOfWeek(year: number, week: number): Date {
  // ISO week 1 is the week containing January 4th
  // Find January 4th of the given year
  const jan4 = new Date(Date.UTC(year, 0, 4));

  // Find the Monday of week 1 (ISO week starts on Monday)
  const dayOfWeek = jan4.getUTCDay(); // 0=Sun, 1=Mon, ...
  const mondayWeek1 = new Date(jan4);
  // Move back to Monday (if Jan 4 is Sunday, go back 6 days; if Monday, 0 days; etc.)
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  mondayWeek1.setUTCDate(jan4.getUTCDate() - daysToMonday);

  // Now find the Monday of the requested week
  const targetMonday = new Date(mondayWeek1);
  targetMonday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

  // Subtract 1 day to get Sunday (week start for Sun-Sat calendar)
  const sunday = new Date(targetMonday);
  sunday.setUTCDate(targetMonday.getUTCDate() - 1);

  // Return at midnight UTC
  return new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()));
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-webhook-secret');
    if (authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    if (type === 'memorisation') {
      return handleMemorisation(data);
    } else if (type === 'assiduite') {
      return handleAssiduite(data);
    }

    return NextResponse.json({ error: 'Type inconnu' }, { status: 400 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleMemorisation(data: {
  qui: string;
  annee: number;
  semaine: number;
  numSourate: number;
  versetDebut: number;
  versetFin: number;
  repetition?: number;
  commentaire?: string;
}) {
  const email = USER_MAP[data.qui];
  if (!email) {
    return NextResponse.json({ error: `Utilisateur inconnu: ${data.qui}` }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: `Utilisateur non trouvé: ${email}` }, { status: 404 });
  }

  const program = await prisma.program.findFirst({ where: { code: 'MEMORIZATION' } });
  if (!program) {
    return NextResponse.json({ error: 'Programme MEMORIZATION non trouvé' }, { status: 500 });
  }

  const date = getSundayOfWeek(data.annee, data.semaine);
  const weekNumber = data.semaine;

  // Create Progress entry
  const progress = await prisma.progress.create({
    data: {
      userId: user.id,
      programId: program.id,
      date,
      surahNumber: data.numSourate,
      verseStart: data.versetDebut,
      verseEnd: data.versetFin,
      repetitions: data.repetition || null,
      comment: data.commentaire || null,
      createdBy: user.id,
    }
  });

  // === Create/Update GroupSession for Amilou ===
  const group = await prisma.group.findFirst({
    where: { name: GROUPE_AMILOU_NAME }
  });

  if (group) {
    // Check if session exists for this WEEK (not specific date)
    // Look for session with same weekNumber in the same year
    const yearStart = new Date(data.annee, 0, 1);
    const yearEnd = new Date(data.annee, 11, 31, 23, 59, 59);

    let session = await prisma.groupSession.findFirst({
      where: {
        groupId: group.id,
        weekNumber: weekNumber,
        date: {
          gte: yearStart,
          lte: yearEnd
        }
      }
    });

    // Create session if it doesn't exist for this week
    if (!session) {
      // Get all participating members (MEMBER + REFERENT, exclude ADMIN)
      const participatingMembers = await prisma.groupMember.findMany({
        where: {
          groupId: group.id,
          role: { in: ['MEMBER', 'REFERENT'] }
        },
        select: { userId: true }
      });

      session = await prisma.groupSession.create({
        data: {
          groupId: group.id,
          date: date, // Sunday of the week
          weekNumber: weekNumber,
          notes: null,
          attendance: {
            create: participatingMembers.map(m => ({
              userId: m.userId,
              present: false,
              excused: false
            }))
          }
        }
      });
    }

    // Build note with submission timestamp and comment
    const submissionTime = new Date().toLocaleString('fr-FR', {
      timeZone: 'America/Toronto',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const noteContent = data.commentaire
      ? `[${submissionTime}] ${data.commentaire}`
      : `[${submissionTime}]`;

    // Update attendance: mark user as present with timestamp + comment
    await prisma.sessionAttendance.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: user.id
        }
      },
      update: {
        present: true,
        note: noteContent
      },
      create: {
        sessionId: session.id,
        userId: user.id,
        present: true,
        excused: false,
        note: noteContent
      }
    });
  }

  return NextResponse.json({ success: true, id: progress.id, sessionCreated: !!group });
}

// Daily programs in order (score 1-4)
const DAILY_PROGRAMS = ['MEMORIZATION', 'CONSOLIDATION', 'REVISION', 'READING'];

async function handleAssiduite(data: {
  qui: string;
  annee: number;
  semaine: number;
  dimanche?: number;
  lundi?: number;
  mardi?: number;
  mercredi?: number;
  jeudi?: number;
  vendredi?: number;
  samedi?: number;
  commentaire?: string;
}) {
  const email = USER_MAP[data.qui];
  if (!email) {
    return NextResponse.json({ error: `Utilisateur inconnu: ${data.qui}` }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: `Utilisateur non trouvé: ${email}` }, { status: 404 });
  }

  const weekStart = getSundayOfWeek(data.annee, data.semaine);

  // Fetch existing record to merge with new data (cumulative update)
  const existing = await prisma.dailyAttendance.findUnique({
    where: { userId_date: { userId: user.id, date: weekStart } }
  });

  // Helper to clamp score between 0-5
  const clamp = (val: number) => Math.min(Math.max(Math.round(val), 0), 5);

  // Only update days that have non-zero values in incoming data
  // Keep existing values for days with zero/undefined in incoming data
  const sunday = data.dimanche && data.dimanche > 0 ? clamp(data.dimanche) : (existing?.sunday ?? 0);
  const monday = data.lundi && data.lundi > 0 ? clamp(data.lundi) : (existing?.monday ?? 0);
  const tuesday = data.mardi && data.mardi > 0 ? clamp(data.mardi) : (existing?.tuesday ?? 0);
  const wednesday = data.mercredi && data.mercredi > 0 ? clamp(data.mercredi) : (existing?.wednesday ?? 0);
  const thursday = data.jeudi && data.jeudi > 0 ? clamp(data.jeudi) : (existing?.thursday ?? 0);
  const friday = data.vendredi && data.vendredi > 0 ? clamp(data.vendredi) : (existing?.friday ?? 0);
  const saturday = data.samedi && data.samedi > 0 ? clamp(data.samedi) : (existing?.saturday ?? 0);

  // Only update comment if provided
  const comment = data.commentaire || existing?.comment || null;

  // Write to old DailyAttendance table (backward compatibility)
  const attendance = await prisma.dailyAttendance.upsert({
    where: {
      userId_date: { userId: user.id, date: weekStart }
    },
    update: {
      sunday, monday, tuesday, wednesday, thursday, friday, saturday,
      comment,
    },
    create: {
      userId: user.id,
      date: weekStart,
      sunday, monday, tuesday, wednesday, thursday, friday, saturday,
      comment,
      createdBy: user.id,
    }
  });

  // --- NEW: Also write to DailyProgramCompletion table ---
  // Get all programs
  const programs = await prisma.program.findMany({
    where: { code: { in: DAILY_PROGRAMS } }
  });
  const programMap = new Map(programs.map(p => [p.code, p.id]));

  // Get TAFSIR program for weekly objectives
  const tafsirProgram = await prisma.program.findFirst({ where: { code: 'TAFSIR' } });

  // Process each day's score
  const dayScores = [sunday, monday, tuesday, wednesday, thursday, friday, saturday];
  const dayFields = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const incomingData = [data.dimanche, data.lundi, data.mardi, data.mercredi, data.jeudi, data.vendredi, data.samedi];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const score = dayScores[dayIndex];

    // Only process if this day had data in the incoming request
    if (!incomingData[dayIndex] || incomingData[dayIndex] === 0) continue;

    // Calculate the actual date for this day
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + dayIndex);

    // Create/update DailyProgramCompletion records based on score
    const programsToMark = Math.min(score, 4); // Max 4 daily programs

    for (let i = 0; i < DAILY_PROGRAMS.length; i++) {
      const programCode = DAILY_PROGRAMS[i];
      const programId = programMap.get(programCode);

      if (programId) {
        const shouldBeCompleted = i < programsToMark;

        if (shouldBeCompleted) {
          await prisma.dailyProgramCompletion.upsert({
            where: {
              userId_programId_date: {
                userId: user.id,
                programId: programId,
                date: dayDate
              }
            },
            update: { completed: true },
            create: {
              userId: user.id,
              programId: programId,
              date: dayDate,
              completed: true,
              createdBy: user.id
            }
          });
        } else {
          // Remove completion if score dropped
          await prisma.dailyProgramCompletion.deleteMany({
            where: {
              userId: user.id,
              programId: programId,
              date: dayDate
            }
          });
        }
      }
    }

    // If score is 5, mark Tafsir weekly objective as completed for this week
    if (score === 5 && tafsirProgram) {
      // Find or create Tafsir weekly objective
      let tafsirObjective = await prisma.weeklyObjective.findFirst({
        where: {
          userId: user.id,
          programId: tafsirProgram.id,
          name: 'Tafsir'
        }
      });

      if (!tafsirObjective) {
        tafsirObjective = await prisma.weeklyObjective.create({
          data: {
            userId: user.id,
            name: 'Tafsir',
            programId: tafsirProgram.id,
            isCustom: false,
            isActive: true
          }
        });
      }

      await prisma.weeklyObjectiveCompletion.upsert({
        where: {
          weeklyObjectiveId_weekStartDate: {
            weeklyObjectiveId: tafsirObjective.id,
            weekStartDate: weekStart
          }
        },
        update: { completed: true },
        create: {
          weeklyObjectiveId: tafsirObjective.id,
          weekStartDate: weekStart,
          completed: true,
          createdBy: user.id
        }
      });
    }
  }

  return NextResponse.json({ success: true, id: attendance.id });
}
