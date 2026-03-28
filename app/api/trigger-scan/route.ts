import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GITHUB_PAT
  const owner = process.env.GITHUB_OWNER || 'shakeelamjid'
  const repo  = process.env.GITHUB_REPO  || 'intellicoin'

  if (!token) {
    return NextResponse.json({ ok: false, error: 'GITHUB_PAT not set in Vercel environment variables' }, { status: 400 })
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scanner.yml/dispatches`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  })

  if (res.status === 204) {
    return NextResponse.json({ ok: true })
  }

  const body = await res.text()
  return NextResponse.json({
    ok: false,
    error: `GitHub returned ${res.status}: ${body}`
  })
}
