'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

const F  = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const MN = "'JetBrains Mono','Fira Code','SF Mono',monospace"
const API = 'https://intellicoinapp.com/scanner/log_api.php'

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

// ── Per-symbol trade block parser for position monitor ────────────────────
interface TradeBlock {
  symbol: string; direction: string; isOpen: boolean
  latestPnl: string|null; latestPrice: string|null
  latestDecision: {label:string;color:string;bg:string}|null
  lastSeen: string; lines: {ts:string;msg:string;type:string}[]
  hasError: boolean; hasCritical: boolean
}

function decisionTag(msg: string): {label:string;color:string;bg:string}|null {
  const m = msg.toLowerCase()
  if (m.includes('critical')||m.includes('unprotected')) return {label:'🚨 Critical',color:'#dc2626',bg:'rgba(220,38,38,0.15)'}
  if (m.includes('early exit'))  return {label:'⚡ Early Exit',color:'#f59e0b',bg:'rgba(245,158,11,0.12)'}
  if (m.includes('sl moved to tp1')) return {label:'🔒 SL→TP1',color:'#22c55e',bg:'rgba(34,197,94,0.12)'}
  if (m.includes('breakeven set')||m.includes('breakeven sl')) return {label:'⚖️ Breakeven',color:'#60a5fa',bg:'rgba(59,130,246,0.12)'}
  if (m.includes('trail'))       return {label:'📈 Trailing',color:'#a78bfa',bg:'rgba(167,139,250,0.12)'}
  if (m.includes('recovered'))   return {label:'🔧 Recovered',color:'#f59e0b',bg:'rgba(245,158,11,0.12)'}
  if (m.includes('sl missing')||m.includes('missing')) return {label:'⚠ Missing',color:'#ef4444',bg:'rgba(239,68,68,0.12)'}
  if (m.includes('outcome:') && m.includes('tp')) return {label:'✅ TP Hit',color:'#22c55e',bg:'rgba(34,197,94,0.12)'}
  if (m.includes('outcome:') && m.includes('sl_hit')) return {label:'🔴 SL Hit',color:'#ef4444',bg:'rgba(239,68,68,0.12)'}
  if (m.includes('manual close')) return {label:'👤 Manual',color:'#8b90a8',bg:'rgba(139,144,168,0.1)'}
  if (m.includes('hold') && m.includes('all ok')) return {label:'✓ Hold',color:'#22c55e',bg:'rgba(34,197,94,0.08)'}
  return null
}

function parsePositionBlocks(lines: LogLine[]): TradeBlock[] {
  // Lines are newest-first. We process forward and for each symbol
  // only capture its FIRST (most recent) block — that's the current state.
  const blocks: Record<string,TradeBlock> = {}
  const finalized = new Set<string>() // symbols whose current state is captured
  let lastSym = ''

  for (const line of lines) {
    const msg = line.message || ''

    // New symbol block header
    const symMatch = msg.match(/\[([A-Z0-9]+USDT)\]\s+(long|short)/)
    if (symMatch) {
      const sym = symMatch[1]
      lastSym = sym
      // First time we see this symbol = most recent state
      if (!blocks[sym]) {
        blocks[sym] = {
          symbol:sym, direction:symMatch[2], isOpen:true,
          latestPnl:null, latestPrice:null, latestDecision:null,
          lastSeen:line.ts_pkt||'', lines:[], hasError:false, hasCritical:false,
        }
      }
    }

    if (lastSym && blocks[lastSym] && !finalized.has(lastSym)) {
      blocks[lastSym].lines.push({ts:line.ts_pkt||'',msg,type:line.type})

      const pnl = msg.match(/Live P&L:\s*([+-][\d.]+%)/)
      if (pnl && !blocks[lastSym].latestPnl) blocks[lastSym].latestPnl = pnl[1]

      const px = msg.match(/Mkt price:\s*\$?([\d.]+)/)
      if (px && !blocks[lastSym].latestPrice) blocks[lastSym].latestPrice = '$'+px[1]

      // Mark as closed if we see closure in this block
      if (msg.includes('Position CLOSED')||msg.includes('Outcome:')) {
        blocks[lastSym].isOpen = false
      }

      if (line.type==='critical') blocks[lastSym].hasCritical = true
      if (line.type==='error'||line.type==='warning') blocks[lastSym].hasError = true

      const tag = decisionTag(msg)
      if (tag && !blocks[lastSym].latestDecision) blocks[lastSym].latestDecision = tag

      // When we hit a monitor separator line, the current symbol block is done
      if (msg.includes('---') || msg.includes('Position Monitor —')) {
        finalized.add(lastSym)
        lastSym = ''
      }
    }
  }

  return Object.values(blocks).sort((a,b)=>a.isOpen===b.isOpen?0:a.isOpen?-1:1)
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
  const [view,       setView]       = useState<'grouped'|'raw'|'positions'>('grouped')
  const [tradeBlocks,setTradeBlocks]= useState<TradeBlock[]>([])
  const [expandedBlocks,setExpandedBlocks]=useState<Set<string>>(new Set())
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
      setTradeBlocks(parsePositionBlocks(data.lines || []))
    } catch(e: any) {
      setError('Failed to fetch logs: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(activeLog, search)
    if (activeLog === 'position_monitor') setView('positions')
    else if (view === 'positions') setView('grouped')
  }, [activeLog, load])

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
            {(activeLog==='position_monitor'?['positions','grouped','raw']:['grouped','raw'] as const).map((v:any)=>(
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

        {/* ── POSITIONS VIEW (position monitor only) ── */}
        {!loading && view === 'positions' && (
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {tradeBlocks.length===0 && <div style={{textAlign:'center',padding:'60px',color:'#555870'}}>No position data found in logs</div>}
            {tradeBlocks.map(b=>{
              const isExp = expandedBlocks.has(b.symbol)
              const border = b.hasCritical?'rgba(220,38,38,0.35)':b.isOpen?'rgba(59,130,246,0.2)':
                b.latestDecision?.label.includes('TP')?'rgba(34,197,94,0.2)':
                b.latestDecision?.label.includes('SL')?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.05)'
              return (
                <div key={b.symbol} style={{background:b.isOpen?'#0c0e17':'#09090f',border:`1px solid ${border}`,
                  borderRadius:'10px',overflow:'hidden',opacity:b.isOpen?1:0.7}}>
                  {/* Row */}
                  <div onClick={()=>{const n=new Set(expandedBlocks);n.has(b.symbol)?n.delete(b.symbol):n.add(b.symbol);setExpandedBlocks(n)}}
                    style={{display:'grid',gridTemplateColumns:'140px 60px 1fr 90px 90px 40px',
                      gap:'8px',padding:'11px 14px',cursor:'pointer',alignItems:'center'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div>
                      <div style={{fontSize:'14px',fontWeight:'800',color:b.isOpen?'#e8eaf2':'#8b90a8'}}>
                        {b.symbol.replace('USDT','')}<span style={{color:'#555870',fontSize:'10px',fontWeight:'400'}}>/USDT</span>
                      </div>
                      <div style={{fontSize:'9px',color:'#555870'}}>{b.lastSeen}</div>
                    </div>
                    <span style={{padding:'2px 7px',borderRadius:'3px',fontSize:'9px',fontWeight:'800',
                      background:b.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
                      color:b.direction==='long'?'#22c55e':'#ef4444'}}>
                      {b.direction?.toUpperCase()}
                    </span>
                    <div style={{display:'flex',gap:'5px',flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{padding:'1px 7px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',
                        background:b.isOpen?'rgba(59,130,246,0.12)':'rgba(139,144,168,0.1)',
                        color:b.isOpen?'#60a5fa':'#8b90a8'}}>
                        {b.isOpen?'Open':'Closed'}
                      </span>
                      {b.latestDecision && (
                        <span style={{padding:'1px 7px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',
                          background:b.latestDecision.bg,color:b.latestDecision.color}}>
                          {b.latestDecision.label}
                        </span>
                      )}
                      {b.hasCritical && <span style={{padding:'1px 7px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',background:'rgba(220,38,38,0.15)',color:'#dc2626'}}>🚨 Critical</span>}
                      {b.hasError && !b.hasCritical && <span style={{padding:'1px 7px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',background:'rgba(245,158,11,0.1)',color:'#f59e0b'}}>⚠ Warning</span>}
                    </div>
                    <span style={{fontFamily:MN,fontSize:'12px',fontWeight:'700',
                      color:b.latestPnl?.startsWith('+')?'#22c55e':b.latestPnl?.startsWith('-')?'#ef4444':'#8b90a8'}}>
                      {b.latestPnl||'—'}
                    </span>
                    <span style={{fontFamily:MN,fontSize:'11px',color:'#8b90a8'}}>{b.latestPrice||'—'}</span>
                    <span style={{color:'#555870',fontSize:'12px',textAlign:'center',
                      transform:isExp?'rotate(90deg)':'none',transition:'transform 0.15s'}}>▶</span>
                  </div>
                  {/* Accordion */}
                  {isExp && (
                    <div style={{borderTop:'1px solid rgba(255,255,255,0.05)',background:'rgba(0,0,0,0.2)',
                      padding:'10px 14px',maxHeight:'320px',overflowY:'auto'}}>
                      <div style={{fontSize:'10px',color:'#555870',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                        Log ({b.lines.length} entries)
                      </div>
                      {b.lines.slice(0,100).map((l,i)=>{
                        const ts = TYPE_STYLES[l.type]||TYPE_STYLES.info
                        const tag = decisionTag(l.msg)
                        return (
                          <div key={i} style={{display:'grid',gridTemplateColumns:'80px 1fr auto',
                            gap:'8px',padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.02)',alignItems:'start'}}>
                            <span style={{fontFamily:MN,fontSize:'9px',color:'#333650',flexShrink:0}}>{l.ts?.slice(11,19)||''}</span>
                            <span style={{fontFamily:MN,fontSize:'10px',color:ts.color,wordBreak:'break-all',lineHeight:'1.5'}}>
                              {l.msg.trim()}
                            </span>
                            {tag && <span style={{padding:'1px 5px',borderRadius:'3px',fontSize:'9px',
                              fontWeight:'700',background:tag.bg,color:tag.color,whiteSpace:'nowrap',flexShrink:0}}>
                              {tag.label}
                            </span>}
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
