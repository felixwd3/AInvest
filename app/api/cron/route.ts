import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Kalder dit eksisterende analyze-endpoint for at opdatere kurser og tjekke markedet
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'

    const res = await fetch(`${protocol}://${host}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    
    const data = await res.json()

    return NextResponse.json({ success: true, message: 'Automatisk baggrundstjek gennemført', data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}