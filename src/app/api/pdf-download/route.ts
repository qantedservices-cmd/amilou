import { NextResponse } from 'next/server'
import { storePdf } from '@/lib/pdf-store'

export async function POST(request: Request) {
  try {
    const { data, fileName } = await request.json()

    if (!data || !fileName) {
      return NextResponse.json({ error: 'Missing data or fileName' }, { status: 400 })
    }

    const buffer = Buffer.from(data, 'base64')
    const id = storePdf(buffer, fileName)

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Error storing PDF:', error)
    return NextResponse.json({ error: 'Erreur PDF' }, { status: 500 })
  }
}
