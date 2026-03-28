import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GITHUB_PAT
  const owner = process.env.GITHUB_OWNER
  const repo  = process.env.GITHUB_REPO || 'intellicoin'

  if (!token || !owner) {
    return NextResponse.json({ ok: false, error: 'GITHUB_PAT and GITHUB_OWNER env vars not set' }, { status: 400 })
  }

  try {
    // First get the workflow ID
    const listRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )
    const listData = await listRes.json()
    const workflows = listData.workflows || []
    
    // Find scanner workflow
    const workflow = workflows.find((w: any) => 
      w.path.includes('scanner') || w.name.toLowerCase().includes('scanner')
    )
    
    if (!workflow) {
      return NextResponse.json({ 
        ok: false, 
        error: `No scanner workflow found. Available: ${workflows.map((w: any) => w.path).join(', ')}` 
      }, { status: 404 })
    }

    // Trigger it
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow.id}/dispatches`,
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
