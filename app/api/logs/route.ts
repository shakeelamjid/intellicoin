import { NextRequest, NextResponse } from 'next/server'

const GODADDY = 'https://intellicoinapp.com/scanner/log_api.php'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const log   = searchParams.get('log')   || 'auto_trade'
  const q     = searchParams.get('q')     || ''
  const limit = searchParams.get('limit') || '500'

  try {
    const url = `${GODADDY}?log=${log}&q=${encodeURIComponent(q)}&limit=${limit}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'IntelliCoin-Dashboard/1.0' },
      next: { revalidate: 0 }, // never cache
    })
    if (!res.ok) throw new Error(`GoDaddy returned ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
