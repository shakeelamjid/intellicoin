'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIO: Record<number, { name: string; dir: string }> = {
  1:{name:'Strong bull trend', dir:'long' }, 2:{name:'Strong bear trend', dir:'short'},
  3:{name:'Weak rally',        dir:'short'}, 4:{name:'Weak sell-off',     dir:'long' },
  5:{name:'Bull trap',         dir:'short'}, 6:{name:'Bear trap',         dir:'long' },
  7:{name:'Long squeeze',      dir:'short'}, 8:{name:'Short squeeze',     dir:'long' },
  9:{name:'Coil / buildup',    dir:'watch'},
}

const RANK_META = {
  S:{bg:'rgba(34,197,94,0.15)',  text:'#22c55e', border:'rgba(34,197,94,0.3)',  full:'Premium'},
  A:{bg:'rgba(59,130,246,0.15)', text:'#60a5fa', border:'rgba(59,130,246,0.3)', full:'Strong' },
  B:{bg:'rgba(245,158,11,0.15)', text:'#f59e0b', border:'rgba(245,158,11,0.3)', full:'Standard'},
  C:{bg:'rgba(139,144,168,0.1)', text:'#8b90a8', border:'rgba(139,144,168,0.2)',full:'Watchlist'},
}

const DIR_META = {
  long: {bg:'rgba(34,197,94,0.15)',  text:'#22c55e'},
  short:{bg:'rgba(239,68,68,0.15)',  text:'#ef4444'},
  watch:{bg:'rgba(245,158,11,0.12)', text:'#f59e0b'},
}

const TF_LABEL: Record<string, string> = {
  '1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m',
  '1h':'1h','4h':'4h','1d':'1d',
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)    return 'just now'
  if (m < 60)   return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return `${Math.floor(m/1440)}d ago`
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false }) +
    ' · ' + d.toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

function fp(n: number | null) {
  if (!n) return '—'
  if (n >= 1000) return '$' + n.toLocaleString(undefined, {maximumFractionDigits:0})
  if (n >= 100)  return '$' + n.toFixed(2)
  if (n >= 1)    return '$' + n.toFixed(3)
  if (n >= 0.01) return '$' + n.toFixed(5)
  return '$' + n.toFixed(7)
}

function FilterPill({
  active, onClick, children, color
}: { active:boolean; onClick:()=>void; children:React.ReactNode; color?:string }) {
  return (
    <button onClick={onClick} style={{
      padding:'4px 10px', borderRadius:'6px', border:'none', fontSize:'11px',
      fontWeight: active ? '700' : '500', cursor:'pointer', fontFamily:F,
      background: active ? (color ? color+'25' : '#1e2235') : 'transparent',
      color: active ? (color || '#e8eaf2') : '#555870',
      transition:'all 0.1s',
    }}>{children}</button>
  )
}

function SignalRow({ s, isNew }: { s: any; isNew: boolean }) {
  const rank = s.signal_rank || 'B'
  const rm   = RANK_META[rank as keyof typeof RANK_META] || RANK_META.B
  const dir  = s.direction || 'long'
  const dm   = DIR_META[dir as keyof typeof DIR_META] || DIR_META.long
  const sym  = s.symbol?.replace('USDT','')
  const isPremium = rank === 'S'
  const tf   = s.kline_interval || '1h'

  return (
    <div style={{
      background: isPremium ? 'rgba(34,197,94,0.03)' : '#111420',
      border:`1px solid ${isPremium?'rgba(34,197,94,0.15)':isNew?'rgba(59,130,246,0.25)':'rgba(255,255,255,0.06)'}`,
      borderRadius:'10px', padding:'11px 14px',
      position:'relative', overflow:'hidden',
    }}
      onMouseEnter={e=>(e.currentTarget.style.borderColor=isPremium?'rgba(34,197,94,0.3)':'rgba(255,255,255,0.1)')}
      onMouseLeave={e=>(e.currentTarget.style.borderColor=isPremium?'rgba(34,197,94,0.15)':isNew?'rgba(59,130,246,0.25)':'rgba(255,255,255,0.06)')}
    >
      {isPremium && <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,#22c55e,#16a34a)'}}/>}

      <div style={{display:'grid', gridTemplateColumns:'150px 90px 1fr 85px 85px 85px 85px 85px 110px', gap:'6px', alignItems:'center'}}>

        {/* Symbol + direction */}
        <div style={{display:'flex', alignItems:'center', gap:'5px', minWidth:0}}>
          <span style={{fontSize:'14px', fontWeight:'800', color:'#e8eaf2', letterSpacing:'-0.3px', whiteSpace:'nowrap'}}>{sym}</span>
          <span style={{padding:'1px 5px', borderRadius:'3px', fontSize:'9px', fontWeight:'700', background:dm.bg, color:dm.text, flexShrink:0}}>{dir.toUpperCase()}</span>
        </div>

        {/* Rank + badges */}
        <div style={{display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap'}}>
          <span style={{padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontWeight:'700', background:rm.bg, color:rm.text, border:`1px solid ${rm.border}`}}>
            {isPremium?'⭐ ':''}{rank}
          </span>
          {/* Timeframe badge */}
          <span style={{padding:'1px 5px', borderRadius:'3px', fontSize:'9px', fontWeight:'600', background:'rgba(139,144,168,0.1)', color:'#8b90a8'}}>
            {TF_LABEL[tf] || tf}
          </span>
          {s.confirmed_bybit && <span style={{fontSize:'9px', color:'#60a5fa', fontWeight:'700'}}>B✓</span>}
          {isNew && <span style={{fontSize:'9px', color:'#3b82f6', fontWeight:'700', animation:'pulse 2s infinite'}}>NEW</span>}
        </div>

        {/* Entry */}
        <div style={{minWidth:0}}>
          <div style={{fontSize:'9px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'1px'}}>Entry</div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#e8eaf2', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
            {fp(s.entry_low)} – {fp(s.entry_high)}
          </div>
        </div>

        {/* Stop */}
        <div>
          <div style={{fontSize:'9px', color:'#555870', marginBottom:'1px'}}>Stop</div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#ef4444'}}>{fp(s.stop_loss)}</div>
        </div>

        {/* TP1 */}
        <div>
          <div style={{fontSize:'9px', color:'#555870', marginBottom:'1px'}}>TP1{s.rr_ratio?` ·${(s.rr_ratio*0.5).toFixed(1)}x`:''}</div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#22c55e'}}>{fp(s.tp1)}</div>
        </div>

        {/* TP2 */}
        <div>
          <div style={{fontSize:'9px', color:'#555870', marginBottom:'1px'}}>TP2{s.rr_ratio?` ·${s.rr_ratio.toFixed(1)}x`:''}</div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#22c55e'}}>{fp(s.tp2)}</div>
        </div>

        {/* TP3 */}
        <div>
          <div style={{fontSize:'9px', color:'#555870', marginBottom:'1px'}}>TP3{s.rr_ratio?` ·${(s.rr_ratio*1.6).toFixed(1)}x`:''}</div>
          <div style={{fontSize:'11px', fontWeight:'600', color:'#22c55e'}}>{fp(s.tp3)}</div>
        </div>

        {/* Indicators */}
        <div style={{fontSize:'10px', color:'#555870', lineHeight:'1.7'}}>
          {s.oi_change_pct!=null && <div style={{color:s.oi_change_pct>3?'#22c55e':s.oi_change_pct<-3?'#ef4444':'#555870'}}>OI {s.oi_change_pct>0?'+':''}{s.oi_change_pct.toFixed(1)}%</div>}
          {s.adx_value!=null && <div style={{color:s.adx_value>30?'#22c55e':s.adx_value>22?'#f59e0b':'#555870'}}>ADX {s.adx_value.toFixed(0)}</div>}
        </div>

        {/* Time + chart */}
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'3px'}}>
          <span style={{fontSize:'10px', color:'#e8eaf2', fontWeight:'500'}}>{fmtTime(s.created_at)}</span>
          <span style={{fontSize:'10px', color:'#555870'}}>{timeAgo(s.created_at)}</span>
          <a href={`https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}.P&interval=60`}
            target="_blank" rel="noopener noreferrer"
            style={{padding:'2px 8px', borderRadius:'4px', background:'rgba(59,130,246,0.1)', color:'#60a5fa', fontSize:'10px', fontWeight:'600', border:'1px solid rgba(59,130,246,0.15)', textDecoration:'none'}}
            onClick={e=>e.stopPropagation()}>
            Chart
          </a>
        </div>
      </div>

      {/* Sub-row indicators */}
      {(s.fr_at_signal!=null || s.volume_ratio!=null || s.suggested_leverage) && (
        <div style={{display:'flex', gap:'10px', marginTop:'5px', paddingTop:'5px', borderTop:'1px solid rgba(255,255,255,0.04)', fontSize:'10px', color:'#555870'}}>
          <span>S{s.scenario_id} · {SCENARIO[s.scenario_id]?.name}</span>
          {s.fr_at_signal!=null && <span>FR {(s.fr_at_signal*100).toFixed(4)}%</span>}
          {s.volume_ratio!=null && <span>Vol {s.volume_ratio.toFixed(1)}x</span>}
          {s.suggested_leverage && <span>Lev {s.suggested_leverage}x</span>}
        </div>
      )}
    </div>
  )
}

export default function SignalsPage() {
  const [signals,      setSignals]      = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterDir,    setFilterDir]    = useState('all')
  const [filterRank,   setFilterRank]   = useState<string[]>([])
  const [filterSc,     setFilterSc]     = useState<number[]>([])
  const [filterTime,   setFilterTime]   = useState('all')
  const [filterBybit,  setFilterBybit]  = useState(false)
  const [filterTf,     setFilterTf]     = useState('all')
  const [sortBy,       setSortBy]       = useState<'time'|'rank'|'oi'|'adx'>('time')
  const [newIds,       setNewIds]       = useState<Set<string>>(new Set())
  const [newCount,     setNewCount]     = useState(0)
  const timers = useRef<any>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.from('signals').select('*').eq('status','active')
      .order('created_at',{ascending:false}).limit(500)
      .then(({data}) => { setSignals(data||[]); setLoading(false) })

    const ch = supabase.channel('signals_live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'signals'}, p => {
        const sig = p.new as any
        setSignals(prev=>[sig,...prev])
        setNewCount(n=>n+1)
        setNewIds(prev=>new Set(Array.from(prev).concat(sig.id)))
        timers.current[sig.id] = setTimeout(()=>{
          setNewIds(prev=>{const s=new Set(Array.from(prev));s.delete(sig.id);return s})
        }, 60000)
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'signals'}, p => {
        const sig = p.new as any
        if (sig.status === 'active') {
          setSignals(prev => prev.map(s => s.id===sig.id ? sig : s))
        } else {
          setSignals(prev => prev.filter(s => s.id!==sig.id))
        }
      })
      .subscribe()

    return ()=>{
      supabase.removeChannel(ch)
      Object.values(timers.current).forEach(t=>clearTimeout(t as any))
    }
  },[])

  // ── Filtering ─────────────────────────────────────────────────────────────
  const now = Date.now()
  const timeMs: Record<string,number> = {
    '1h':  3600000, '4h': 14400000, '24h': 86400000, 'all': Infinity
  }

  let filtered = signals.filter(s => {
    if (filterDir !== 'all' && s.direction !== filterDir) return false
    if (filterRank.length > 0 && !filterRank.includes(s.signal_rank)) return false
    if (filterSc.length > 0   && !filterSc.includes(s.scenario_id))   return false
    if (filterBybit && !s.confirmed_bybit) return false
    if (filterTf !== 'all' && (s.kline_interval||'1h') !== filterTf) return false
    if (filterTime !== 'all') {
      const age = now - new Date(s.created_at).getTime()
      if (age > timeMs[filterTime]) return false
    }
    return true
  })

  // ── Sorting ───────────────────────────────────────────────────────────────
  const rankOrder: Record<string,number> = {S:4,A:3,B:2,C:1}
  filtered = [...filtered].sort((a,b) => {
    if (sortBy === 'rank') return (rankOrder[b.signal_rank]||0) - (rankOrder[a.signal_rank]||0)
    if (sortBy === 'oi')   return (Math.abs(b.oi_change_pct||0)) - (Math.abs(a.oi_change_pct||0))
    if (sortBy === 'adx')  return (b.adx_value||0) - (a.adx_value||0)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Counts
  const counts = {
    S: signals.filter(s=>s.signal_rank==='S').length,
    A: signals.filter(s=>s.signal_rank==='A').length,
    B: signals.filter(s=>s.signal_rank==='B').length,
    C: signals.filter(s=>s.signal_rank==='C').length,
  }

  // Unique timeframes in current signals
  const tfs = Array.from(new Set(signals.map(s=>s.kline_interval||'1h').filter(Boolean)))

  function toggleRank(r: string) {
    setFilterRank(prev => prev.includes(r) ? prev.filter(x=>x!==r) : [...prev, r])
  }

  function toggleSc(id: number) {
    setFilterSc(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }

  function clearFilters() {
    setFilterDir('all'); setFilterRank([]); setFilterSc([])
    setFilterTime('all'); setFilterBybit(false); setFilterTf('all')
  }

  const hasFilters = filterDir!=='all' || filterRank.length>0 || filterSc.length>0 ||
                     filterTime!=='all' || filterBybit || filterTf!=='all'

  const filterRow: React.CSSProperties = {
    display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap',
    padding:'8px 12px', background:'rgba(255,255,255,0.02)',
    borderBottom:'1px solid rgba(255,255,255,0.05)',
  }
  const filterLabel: React.CSSProperties = {
    fontSize:'9px', color:'#555870', textTransform:'uppercase',
    letterSpacing:'0.06em', marginRight:'2px', flexShrink:0,
  }

  return (
    <div style={{padding:'20px', fontFamily:F}}>

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px'}}>
        <div>
          <h1 style={{fontSize:'18px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'3px', display:'flex', alignItems:'center', gap:'8px'}}>
            Live signals
            <span style={{width:'6px', height:'6px', borderRadius:'50%', background:'#22c55e', display:'inline-block', boxShadow:'0 0 6px #22c55e', animation:'pulse 2s infinite'}}/>
          </h1>
          <p style={{fontSize:'11px', color:'#555870'}}>
            {filtered.length} of {signals.length} signals
            {newCount > 0 && <span style={{marginLeft:'8px', color:'#22c55e', fontWeight:'600'}}>+{newCount} new</span>}
          </p>
        </div>

        {/* Sort */}
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
          <span style={{fontSize:'11px', color:'#555870'}}>Sort:</span>
          <div style={{display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'7px', padding:'2px'}}>
            {[
              {v:'time', l:'Latest'  },
              {v:'rank', l:'Rank'    },
              {v:'oi',   l:'OI'      },
              {v:'adx',  l:'ADX'     },
            ].map(s=>(
              <button key={s.v} onClick={()=>setSortBy(s.v as any)} style={{
                padding:'3px 9px', borderRadius:'5px', border:'none', fontSize:'11px', cursor:'pointer', fontFamily:F,
                background:sortBy===s.v?'#1e2235':'transparent',
                color:sortBy===s.v?'#e8eaf2':'#555870',
              }}>{s.l}</button>
            ))}
          </div>
          {hasFilters && (
            <button onClick={clearFilters} style={{padding:'3px 10px', borderRadius:'6px', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#ef4444', fontSize:'11px', cursor:'pointer', fontFamily:F}}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', marginBottom:'14px', overflow:'hidden'}}>

        {/* Direction */}
        <div style={filterRow}>
          <span style={filterLabel}>Direction</span>
          {['all','long','short','watch'].map(f=>(
            <FilterPill key={f} active={filterDir===f} onClick={()=>setFilterDir(f)}
              color={f==='long'?'#22c55e':f==='short'?'#ef4444':f==='watch'?'#f59e0b':undefined}>
              {f==='all'?'All':f.charAt(0).toUpperCase()+f.slice(1)}
            </FilterPill>
          ))}
        </div>

        {/* Rank */}
        <div style={filterRow}>
          <span style={filterLabel}>Rank</span>
          {(['S','A','B','C'] as const).map(r=>{
            const rm=RANK_META[r]
            const on=filterRank.includes(r)
            return (
              <button key={r} onClick={()=>toggleRank(r)} style={{
                padding:'3px 10px', borderRadius:'5px', border:`1px solid ${on?rm.border:'rgba(255,255,255,0.07)'}`,
                background:on?rm.bg:'transparent', color:on?rm.text:'#555870',
                fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:F,
              }}>
                {r==='S'?'⭐ ':''}{r} {counts[r]>0?`(${counts[r]})`:''}
              </button>
            )
          })}
          {filterRank.length===0 && <span style={{fontSize:'10px', color:'#3a3d52'}}>All ranks shown</span>}
        </div>

        {/* Scenario */}
        <div style={filterRow}>
          <span style={filterLabel}>Scenario</span>
          <div style={{display:'flex', flexWrap:'wrap', gap:'4px'}}>
            {Object.entries(SCENARIO).map(([id, sc])=>{
              const on=filterSc.includes(parseInt(id))
              const dc=sc.dir==='long'?'#22c55e':sc.dir==='short'?'#ef4444':'#f59e0b'
              return (
                <button key={id} onClick={()=>toggleSc(parseInt(id))} style={{
                  padding:'3px 8px', borderRadius:'5px', fontSize:'10px', fontWeight:'500', cursor:'pointer', fontFamily:F,
                  border:`1px solid ${on?dc+'50':'rgba(255,255,255,0.07)'}`,
                  background:on?dc+'18':'transparent',
                  color:on?dc:'#555870',
                }}>S{id}</button>
              )
            })}
          </div>
          {filterSc.length===0 && <span style={{fontSize:'10px', color:'#3a3d52', marginLeft:'4px'}}>All scenarios shown</span>}
        </div>

        {/* Time range + Timeframe + Bybit */}
        <div style={filterRow}>
          <span style={filterLabel}>Posted</span>
          {[
            {v:'1h', l:'Last 1h'},
            {v:'4h', l:'Last 4h'},
            {v:'24h',l:'Last 24h'},
            {v:'all',l:'All time'},
          ].map(f=>(
            <FilterPill key={f.v} active={filterTime===f.v} onClick={()=>setFilterTime(f.v)}>
              {f.l}
            </FilterPill>
          ))}

          <div style={{width:'1px', height:'16px', background:'rgba(255,255,255,0.08)', margin:'0 4px'}}/>

          {tfs.length > 1 && <>
            <span style={filterLabel}>TF</span>
            <FilterPill active={filterTf==='all'} onClick={()=>setFilterTf('all')}>All TF</FilterPill>
            {tfs.map(tf=>(
              <FilterPill key={tf} active={filterTf===tf} onClick={()=>setFilterTf(tf)}>{tf}</FilterPill>
            ))}
            <div style={{width:'1px', height:'16px', background:'rgba(255,255,255,0.08)', margin:'0 4px'}}/>
          </>}

          <button onClick={()=>setFilterBybit(!filterBybit)} style={{
            padding:'3px 10px', borderRadius:'5px', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:F,
            border:`1px solid ${filterBybit?'rgba(59,130,246,0.4)':'rgba(255,255,255,0.07)'}`,
            background:filterBybit?'rgba(59,130,246,0.15)':'transparent',
            color:filterBybit?'#60a5fa':'#555870',
          }}>Bybit ✓ only</button>
        </div>
      </div>

      {/* Results count */}
      {hasFilters && (
        <div style={{fontSize:'11px', color:'#555870', marginBottom:'10px', paddingLeft:'2px'}}>
          Showing <span style={{color:'#e8eaf2', fontWeight:'600'}}>{filtered.length}</span> signals matching filters
          {filterSc.length>0 && ` · Scenarios: ${filterSc.map(id=>`S${id} ${SCENARIO[id]?.name}`).join(', ')}`}
        </div>
      )}

      {loading && <div style={{textAlign:'center', padding:'60px', color:'#555870'}}>Loading signals…</div>}

      {!loading && signals.length === 0 && (
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'60px', textAlign:'center'}}>
          <div style={{fontSize:'32px', marginBottom:'10px'}}>📡</div>
          <p style={{color:'#8b90a8', fontSize:'14px', marginBottom:'5px'}}>No signals yet</p>
          <p style={{color:'#555870', fontSize:'12px'}}>Scanner runs hourly — check back soon</p>
        </div>
      )}

      {!loading && signals.length > 0 && filtered.length === 0 && (
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'40px', textAlign:'center'}}>
          <p style={{color:'#8b90a8', fontSize:'13px', marginBottom:'8px'}}>No signals match your filters</p>
          <button onClick={clearFilters} style={{padding:'6px 16px', borderRadius:'7px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#8b90a8', fontSize:'12px', cursor:'pointer', fontFamily:F}}>
            Clear all filters
          </button>
        </div>
      )}

      {/* Signal list — flat, sorted */}
      {!loading && filtered.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
          {filtered.map(s=>(
            <SignalRow key={s.id} s={s} isNew={newIds.has(s.id)}/>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
