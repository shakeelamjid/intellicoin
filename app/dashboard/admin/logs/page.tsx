'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

const F  = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const MN = "'JetBrains Mono','Fira Code','SF Mono',monospace"
const API = '/api/logs'

const LOGS = [
  { id: 'auto_trade',        label: 'Auto Trade',       icon: '🤖' },
  { id: 'position_monitor',  label: 'Position Monitor', icon: '👁' },
  { id: 'scanner',           label: 'Scanner',          icon: '📡' },
  { id: 'trade_engine',      label: 'Trade Engine',     icon: '⚙️' },
]

const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)'  },
  success: { color: '#22c55e', bg: 'rgba(34,197,94,0.06)'   },
  order:   { color: '#60a5fa', bg: 'rgba(59,130,246,0.06)'  },
  header:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.06)' },
  section: { color: '#60a5fa', bg: 'transparent'            },
  skip:    { color: '#555870', bg: 'transparent'            },
  info:    { color: '#8b90a8', bg: 'transparent'            },
}

const GROUP_PATTERNS = [
  { pattern: /=== SIGNAL: (\w+) (long|short|watch) Rank (\w+)/, label: (m: any) => `${m[1]} ${m[2].toUpperCase()} Rank ${m[3]}` },
  { pattern: /Position Monitor/, label: () => 'Monitor run' },
  { pattern: /IntelliCoin Scanner/, label: () => 'Scanner run' },
]

interface LogLine {
  ts_pkt: string
  ts_utc: string
  message: string
  type: string
  raw: string
}

interface LogGroup {
  id: string
  label: string
  ts: string
  lines: LogLine[]
  hasError: boolean
  hasWarning: boolean
  hasSuccess: boolean
  expanded: boolean
}

function groupLines(lines: LogLine[]): LogGroup[] {
  const groups: LogGroup[] = []
  let current: LogGroup | null = null
  let gid = 0

  for (const line of lines) {
    // Check if this line starts a new group
    let isGroupStart = false
    let groupLabel = ''

    for (const pat of GROUP_PATTERNS) {
      const m = line.message.match(pat.pattern)
      if (m) {
        isGroupStart = true
        groupLabel = pat.label(m)
        break
      }
    }

    // Also treat === headers as group starts
    if (!isGroupStart && (line.message.includes('===') || line.message.includes('---'))) {
      isGroupStart = true
      groupLabel = line.message.replace(/[=\-]/g, '').trim() || 'Session'
    }

    if (isGroupStart) {
      if (current) groups.push(current)
      current = {
        id: String(gid++),
        label: groupLabel || line.message.slice(0, 50),
        ts: line.ts_pkt || '',
        lines: [line],
        hasError: line.type === 'error',
        hasWarning: line.type === 'warning',
        hasSuccess: line.type === 'success',
        expanded: false,
      }
    } else if (current) {
      current.lines.push(line)
      if (line.type === 'error')   current.hasError   = true
      if (line.type === 'warning') current.hasWarning = true
      if (line.type === 'success') current.hasSuccess = true
    } else {
      // No group yet — create a catch-all
      current = {
        id: String(gid++),
        label: 'Log entries',
        ts: line.ts_pkt || '',
        lines: [line],
        hasError: false, hasWarning: false, hasSuccess: false,
        expanded: false,
      }
    }
  }
  if (current) groups.push(current)
  return groups
}

export default function LogsPage() {
  const [activeLog,  setActiveLog]  = useState('auto_trade')
  const [search,     setSearch]     = useState('')
  const [lines,      setLines]      = useState<LogLine[]>([])
  const [meta,       setMeta]       = useState<any>({})
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [view,       setView]       = useState<'grouped'|'raw'>('grouped')
  const [groups,     setGroups]     = useState<LogGroup[]>([])
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())
  const [autoRefresh,setAutoRefresh]= useState(false)
  const [filter,     setFilter]     = useState<'all'|'error'|'warning'|'success'>('all')
  const timerRef = useRef<any>(null)

  const load = useCallback(async (log: string, q: string) => {
    setLoading(true); setError('')
    try {
      const url = `${API}?log=${log}&q=${encodeURIComponent(q)}&limit=500`
      const r = await fetch(url)
      const data = await r.json()
      if (data.error) { setError(data.error); setLines([]); setGroups([]); return }
      setLines(data.lines || [])
      setMeta({ total: data.total, filtered: data.filtered, file: data.file, last_modified: data.last_modified })
      setGroups(groupLines(data.lines || []))
    } catch(e: any) {
      setError('Failed to fetch logs: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(activeLog, search) }, [activeLog, load])

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => load(activeLog, search), 10000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, activeLog, search, load])

  function toggleGroup(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function expandAll()   { setExpanded(new Set(groups.map(g=>g.id))) }
  function collapseAll() { setExpanded(new Set()) }

  // Filter lines for raw view
  const filteredLines = filter === 'all' ? lines : lines.filter(l => l.type === filter)

  // Filter groups
  const filteredGroups = groups.filter(g => {
    if (filter === 'error')   return g.hasError
    if (filter === 'warning') return g.hasWarning
    if (filter === 'success') return g.hasSuccess
    return true
  })

  const errorCount   = lines.filter(l=>l.type==='error').length
  const warningCount = lines.filter(l=>l.type==='warning').length
  const successCount = lines.filter(l=>l.type==='success').length

  return (
    <div style={{fontFamily:F, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>

      {/* ── Header ── */}
      <div style={{padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)',
        background:'#0c0e17', flexShrink:0}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'}}>
          <div>
            <h1 style={{fontSize:'17px', fontWeight:'700', color:'#e8eaf2', marginBottom:'2px'}}>Log Viewer</h1>
            <div style={{fontSize:'11px', color:'#555870'}}>
              {meta.file && <span>{meta.file} · {meta.total} total lines · last modified: {meta.last_modified}</span>}
            </div>
          </div>
          <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            {/* Auto refresh toggle */}
            <button onClick={()=>setAutoRefresh(r=>!r)} style={{
              padding:'5px 12px', borderRadius:'6px', border:'1px solid',
              borderColor: autoRefresh ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
              background: autoRefresh ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: autoRefresh ? '#22c55e' : '#555870',
              fontSize:'11px', cursor:'pointer', fontFamily:F,
              display:'flex', alignItems:'center', gap:'5px',
            }}>
              <span style={{width:'6px',height:'6px',borderRadius:'50%',
                background:autoRefresh?'#22c55e':'#555870',
                animation:autoRefresh?'pulse 1.5s infinite':'none'}}/>
              {autoRefresh ? 'Live' : 'Auto-refresh off'}
            </button>
            <button onClick={()=>load(activeLog,search)} style={{
              padding:'5px 12px', background:'rgba(59,130,246,0.1)',
              border:'1px solid rgba(59,130,246,0.2)', borderRadius:'6px',
              color:'#60a5fa', fontSize:'11px', cursor:'pointer', fontFamily:F,
            }}>↻ Refresh</button>
          </div>
        </div>

        {/* Log tabs */}
        <div style={{display:'flex', gap:'4px', marginBottom:'12px'}}>
          {LOGS.map(l => (
            <button key={l.id} onClick={()=>{setActiveLog(l.id);setExpanded(new Set())}} style={{
              padding:'5px 14px', borderRadius:'6px', border:'none', cursor:'pointer',
              fontSize:'12px', fontWeight:'500', fontFamily:F,
              background: activeLog===l.id ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: activeLog===l.id ? '#60a5fa' : '#555870',
              display:'flex', alignItems:'center', gap:'5px',
            }}>
              <span>{l.icon}</span>{l.label}
            </button>
          ))}
        </div>

        {/* Controls row */}
        <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
          {/* Search */}
          <div style={{display:'flex', gap:'6px', flex:1, maxWidth:'360px'}}>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&load(activeLog,search)}
              placeholder="Search logs... (press Enter)"
              style={{flex:1, padding:'6px 10px', background:'#131620',
                border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px',
                color:'#e8eaf2', fontSize:'12px', outline:'none', fontFamily:F}}
            />
            <button onClick={()=>load(activeLog,search)} style={{
              padding:'6px 12px', background:'rgba(59,130,246,0.1)',
              border:'1px solid rgba(59,130,246,0.2)', borderRadius:'6px',
              color:'#60a5fa', fontSize:'12px', cursor:'pointer', fontFamily:F,
            }}>Go</button>
            {search && <button onClick={()=>{setSearch('');load(activeLog,'')}} style={{
              padding:'6px 10px', background:'rgba(239,68,68,0.1)',
              border:'1px solid rgba(239,68,68,0.2)', borderRadius:'6px',
              color:'#ef4444', fontSize:'12px', cursor:'pointer', fontFamily:F,
            }}>✕</button>}
          </div>

          {/* Filter pills */}
          <div style={{display:'flex', gap:'4px'}}>
            {[
              {id:'all',     label:'All',                    color:'#8b90a8'},
              {id:'error',   label:`Errors (${errorCount})`, color:'#ef4444'},
              {id:'warning', label:`Warn (${warningCount})`, color:'#f59e0b'},
              {id:'success', label:`OK (${successCount})`,   color:'#22c55e'},
            ].map(f=>(
              <button key={f.id} onClick={()=>setFilter(f.id as any)} style={{
                padding:'4px 10px', borderRadius:'5px', border:'1px solid',
                borderColor: filter===f.id?`${f.color}40`:'rgba(255,255,255,0.06)',
                background: filter===f.id?`${f.color}18`:'transparent',
                color: filter===f.id?f.color:'#555870',
                fontSize:'11px', cursor:'pointer', fontFamily:F,
              }}>{f.label}</button>
            ))}
          </div>

          {/* View toggle */}
          <div style={{display:'flex', gap:'2px', background:'rgba(255,255,255,0.04)',
            borderRadius:'6px', padding:'2px'}}>
            {(['grouped','raw'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{
                padding:'4px 10px', borderRadius:'4px', border:'none', cursor:'pointer',
                fontSize:'11px', fontFamily:F,
                background: view===v?'rgba(255,255,255,0.08)':'transparent',
                color: view===v?'#e8eaf2':'#555870',
              }}>{v==='grouped'?'📦 Grouped':'📄 Raw'}</button>
            ))}
          </div>

          {view==='grouped' && (
            <div style={{display:'flex', gap:'4px'}}>
              <button onClick={expandAll} style={{padding:'4px 8px',fontSize:'10px',cursor:'pointer',
                background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',
                borderRadius:'4px',color:'#555870',fontFamily:F}}>Expand all</button>
              <button onClick={collapseAll} style={{padding:'4px 8px',fontSize:'10px',cursor:'pointer',
                background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',
                borderRadius:'4px',color:'#555870',fontFamily:F}}>Collapse all</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{flex:1, overflow:'auto', padding:'16px 24px'}}>

        {loading && (
          <div style={{textAlign:'center', padding:'40px', color:'#555870'}}>
            Loading logs...
          </div>
        )}

        {error && (
          <div style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
            borderRadius:'8px', padding:'14px', color:'#ef4444', fontSize:'13px', marginBottom:'16px'}}>
            ⚠ {error}
          </div>
        )}

        {/* ── GROUPED VIEW ── */}
        {!loading && view === 'grouped' && (
          <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
            {filteredGroups.length === 0 && (
              <div style={{textAlign:'center', padding:'60px', color:'#555870'}}>
                No log groups found
              </div>
            )}
            {filteredGroups.map(g => {
              const isExp = expanded.has(g.id)
              const borderColor = g.hasError
                ? 'rgba(239,68,68,0.25)'
                : g.hasWarning
                ? 'rgba(245,158,11,0.2)'
                : g.hasSuccess
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(255,255,255,0.06)'
              const statusDot = g.hasError ? '#ef4444' : g.hasWarning ? '#f59e0b' : g.hasSuccess ? '#22c55e' : '#555870'

              return (
                <div key={g.id} style={{background:'#0c0e17', border:`1px solid ${borderColor}`,
                  borderRadius:'8px', overflow:'hidden'}}>

                  {/* Group header */}
                  <div onClick={()=>toggleGroup(g.id)} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'10px 14px', cursor:'pointer',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <span style={{color:'#555870', fontSize:'11px', transition:'transform 0.15s',
                      display:'inline-block', transform:isExp?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
                    <span style={{width:'7px', height:'7px', borderRadius:'50%',
                      background:statusDot, flexShrink:0}}/>
                    <span style={{fontSize:'12px', fontWeight:'600', color:'#e8eaf2', flex:1,
                      fontFamily:MN, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {g.label}
                    </span>
                    <span style={{fontSize:'10px', color:'#555870', flexShrink:0}}>
                      {g.ts ? g.ts + ' PKT' : ''}
                    </span>
                    <span style={{fontSize:'10px', color:'#555870', flexShrink:0}}>
                      {g.lines.length} lines
                    </span>
                    <div style={{display:'flex', gap:'4px', flexShrink:0}}>
                      {g.hasError   && <span style={{padding:'1px 5px',borderRadius:'3px',fontSize:'9px',background:'rgba(239,68,68,0.15)',color:'#ef4444'}}>ERR</span>}
                      {g.hasWarning && <span style={{padding:'1px 5px',borderRadius:'3px',fontSize:'9px',background:'rgba(245,158,11,0.12)',color:'#f59e0b'}}>WARN</span>}
                      {g.hasSuccess && <span style={{padding:'1px 5px',borderRadius:'3px',fontSize:'9px',background:'rgba(34,197,94,0.12)',color:'#22c55e'}}>OK</span>}
                    </div>
                  </div>

                  {/* Group lines */}
                  {isExp && (
                    <div style={{borderTop:'1px solid rgba(255,255,255,0.05)',
                      padding:'8px 0', background:'rgba(0,0,0,0.2)'}}>
                      {g.lines.map((line, i) => {
                        const ts = TYPE_STYLES[line.type] || TYPE_STYLES.info
                        return (
                          <div key={i} style={{
                            display:'grid', gridTemplateColumns:'140px 1fr',
                            gap:'12px', padding:'3px 14px',
                            background: line.type==='error'?'rgba(239,68,68,0.04)':
                              line.type==='warning'?'rgba(245,158,11,0.03)':'transparent',
                          }}>
                            <span style={{fontFamily:MN, fontSize:'10px', color:'#333650',
                              flexShrink:0, whiteSpace:'nowrap'}}>
                              {line.ts_pkt ? line.ts_pkt.slice(11) + ' PKT' : ''}
                            </span>
                            <span style={{fontFamily:MN, fontSize:'11px', color:ts.color,
                              lineHeight:'1.6', wordBreak:'break-all'}}>
                              {line.message}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── RAW VIEW ── */}
        {!loading && view === 'raw' && (
          <div style={{background:'#0c0e17', border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'8px', overflow:'auto'}}>
            {filteredLines.length === 0 && (
              <div style={{padding:'40px', textAlign:'center', color:'#555870'}}>No entries</div>
            )}
            {filteredLines.map((line, i) => {
              const ts = TYPE_STYLES[line.type] || TYPE_STYLES.info
              return (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'160px 1fr',
                  gap:'12px', padding:'4px 16px',
                  borderBottom:'1px solid rgba(255,255,255,0.02)',
                  background: line.type==='error'?'rgba(239,68,68,0.04)':
                    line.type==='warning'?'rgba(245,158,11,0.03)':'transparent',
                }}>
                  <span style={{fontFamily:MN, fontSize:'10px', color:'#333650',
                    flexShrink:0, whiteSpace:'nowrap', paddingTop:'2px'}}>
                    {line.ts_pkt || '—'}
                  </span>
                  <span style={{fontFamily:MN, fontSize:'11px', color:ts.color,
                    lineHeight:'1.7', wordBreak:'break-all'}}>
                    {line.message}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}
