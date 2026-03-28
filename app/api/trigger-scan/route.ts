import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GITHUB_PAT
  const owner = process.env.GITHUB_OWNER
  const repo  = process.env.GITHUB_REPO || 'intellicoin'

  if (!token || !owner) {
    return NextResponse.json({ ok: false, error: 'GITHUB_PAT and GITHUB_OWNER env vars not set' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scanner.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    )

    if (res.status === 204) {
      return NextResponse.json({ ok: true })
    } else {
      const text = await res.text()
      return NextResponse.json({ ok: false, error: text }, { status: res.status })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
