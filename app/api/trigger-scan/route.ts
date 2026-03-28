import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GITHUB_PAT
  const owner = process.env.GITHUB_OWNER
  const repo  = process.env.GITHUB_REPO || 'intellicoin'

  if (!token || !owner) {
    return NextResponse.json({ ok: false, error: 'GITHUB_PAT and GITHUB_OWNER env vars not set' }, { status: 400 })
  }

  try {
    // Try direct dispatch first - most reliable
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scanner.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    )

    if (res.status === 204) {
      return NextResponse.json({ ok: true })
    }

    const text = await res.text()

    // If 404 try listing to debug
    const listRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )
    const listData = await listRes.json()

    return NextResponse.json({
      ok: false,
      dispatch_status: res.status,
      dispatch_error: text,
      workflows_status: listRes.status,
      workflows_total: listData.total_count,
      workflows: listData.workflows?.map((w: any) => ({ id: w.id, name: w.name, path: w.path, state: w.state })),
      repo_check: `${owner}/${repo}`,
    }, { status: 200 })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
