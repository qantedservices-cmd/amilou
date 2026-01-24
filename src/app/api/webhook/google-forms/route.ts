import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'amilou_webhook_2026';

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

function getMondayOfWeek(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const isoWeekStart = simple;
  if (dow <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return isoWeekStart;
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

  const date = getMondayOfWeek(data.annee, data.semaine);

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

  return NextResponse.json({ success: true, id: progress.id });
}

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

  const date = getMondayOfWeek(data.annee, data.semaine);

  const attendance = await prisma.dailyAttendance.upsert({
    where: {
      userId_date: { userId: user.id, date }
    },
    update: {
      sunday: (data.dimanche || 0) > 0,
      monday: (data.lundi || 0) > 0,
      tuesday: (data.mardi || 0) > 0,
      wednesday: (data.mercredi || 0) > 0,
      thursday: (data.jeudi || 0) > 0,
      friday: (data.vendredi || 0) > 0,
      saturday: (data.samedi || 0) > 0,
      comment: data.commentaire || null,
    },
    create: {
      userId: user.id,
      date,
      sunday: (data.dimanche || 0) > 0,
      monday: (data.lundi || 0) > 0,
      tuesday: (data.mardi || 0) > 0,
      wednesday: (data.mercredi || 0) > 0,
      thursday: (data.jeudi || 0) > 0,
      friday: (data.vendredi || 0) > 0,
      saturday: (data.samedi || 0) > 0,
      comment: data.commentaire || null,
      createdBy: user.id,
    }
  });

  return NextResponse.json({ success: true, id: attendance.id });
}
