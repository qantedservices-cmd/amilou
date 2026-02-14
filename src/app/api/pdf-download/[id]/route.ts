import { NextResponse } from 'next/server'
import { getPdf } from '@/lib/pdf-store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const entry = getPdf(id)
  if (!entry) {
    return NextResponse.json({ error: 'PDF expiré ou introuvable' }, { status: 404 })
  }

  return new Response(new Uint8Array(entry.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${entry.fileName}"`,
      'Content-Length': entry.buffer.length.toString(),
    },
  })
}
