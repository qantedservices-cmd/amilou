import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const data = formData.get('data') as string
    const fileName = formData.get('fileName') as string

    if (!data || !fileName) {
      return NextResponse.json({ error: 'Missing data or fileName' }, { status: 400 })
    }

    const buffer = Buffer.from(data, 'base64')

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error serving PDF:', error)
    return NextResponse.json({ error: 'Erreur PDF' }, { status: 500 })
  }
}
