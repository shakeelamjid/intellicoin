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

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m/60)}h ago`
}

function fp(n: number | null) {
  if (!n) return '—'
  if (n >= 1000) return '$' + n.toLocaleString(undefined, {maximumFractionDigits:0})
  if (n >= 100)  return '$' + n.toFixed(2)
  if (n >= 1)    return '$' + n.toFixed(3)
  if (n >= 0.01) return '$' + n.toFixed(5)
  return '$' + n.toFixed(7)
}

function SignalRow({ s, isNew }: { s: any; isNew: boolean }) {
  const rank = s.signal_rank || 'B'
  const rm   = RANK_META[rank as keyof typeof RANK_META] || RANK_META.B
  const dir  = s.direction || 'long'
  const dm   = DIR_META[dir as keyof typeof DIR_META] || DIR_META.long
  const sym  = s.symbol?.replace('USDT','')
  const isPremium = rank === 'S'

  return (
    <div style={{
      background: isPremium ? 'rgba(34,197,94,0.03)' : '#111420',
      border: `1px solid ${isPremium ? 'rgba(34,197,94,0.15)' : isNew ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius:'10px', padding:'12px 14px',
      position:'relative', overflow:'hidden',
    }}
      onMouseEnter={e=>(e.currentTarget.style.borderColor = isPremium?'rgba(34,197,94,0.3)':'rgba(255,255,255,0.1)')}
      onMouseLeave={e=>(e.currentTarget.style.borderColor = isPremium?'rgba(34,197,94,0.15)':isNew?'rgba(59,130,246,0.25)':'rgba(255,255,255,0.06)')}
    >
      {isPremium && <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,#22c55e,#16a34a)'}}/>}

      {/* Single compact row */}
      <div style={{display:'grid', gridTemplateColumns:'140px 80px 1fr 90px 90px 90px 90px 90px 60px', gap:'8px', alignItems:'center'}}>

        {/* Symbol + badges */}
        <div style={{display:'flex', alignItems:'center', gap:'6px', minWidth:0}}>
          <span style={{fontSize:'14px', fontWeight:'800', color:'#e8eaf2', letterSpacing:'-0.3px', whiteSpace:'nowrap'}}>
            {sym}
          </span>
          <span style={{padding:'1px 5px', borderRadius:'3px', fontSize:'9px', fontWeight:'700', background:dm.bg, color:dm.text, flexShrink:0}}>
            {dir.toUpperCase()}
          </span>
        </div>

        {/* Rank */}
        <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
          <span style={{padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontWeight:'700', background:rm.bg, color:rm.text, border:`1px solid ${rm.border}`}}>
            {isPremium ? '⭐ ' : ''}{rank}
          </span>
          {s.confirmed_bybit && <span style={{fontSize:'9px', color:'#60a5fa'}}>B✓</span>}
          {isNew && <span style={{fontSize:'9px', color:'#3b82f6', fontWeight:'700'}}>NEW</span>}
        </div>

        {/* Entry zone */}
        <div style={{minWidth:0}}>
          <div style={{fontSize:'9px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em'}}>Entry</div>
          <div style={{fontSize:'12px', fontWeight:'600', color:'#e8eaf2', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
            {fp(s.entry_low)} – {fp(s.entry_high)}
          </div>
        </div>

        {/* Stop */}
        <div>
          <div style={{fontSize:'9px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em'}}>Stop</div>
          <div style={{fontSize:'12px', fontWeight:'600', color:'#ef4444'}}>{fp(s.stop_loss)}</div>
        </div>

        {/* TP1 */}
        <div>
          <div style={{fontSize:'9px', color:'#555870'}}>TP1 {s.rr_ratio ? `·${(s.rr_ratio*0.5).toFixed(1)}x`:''}</div>
          <div style={{fontSize:'12px', fontWeight:'600', color:'#22c55e'}}>{fp(s.tp1)}</div>
        </div>

        {/* TP2 */}
        <div>
          <div style={{fontSize:'9px', color:'#555870'}}>TP2 {s.rr_ratio ? `·${s.rr_ratio.toFixed(1)}x`:''}</div>
          <div style={{fontSize:'12px', fontWeight:'600', color:'#22c55e'}}>{fp(s.tp2)}</div>
        </div>

        {/* TP3 */}
        <div>
          <div style={{fontSize:'9px', color:'#555870'}}>TP3 {s.rr_ratio ? `·${(s.rr_ratio*1.6).toFixed(1)}x`:''}</div>
          <div style={{fontSize:'12px', fontWeight:'600', color:'#22c55e'}}>{fp(s.tp3)}</div>
        </div>

        {/* Indicators */}
        <div style={{fontSize:'10px', color:'#555870', lineHeight:'1.6'}}>
          {s.oi_change_pct!=null && <div style={{color:s.oi_change_pct>3?'#22c55e':s.oi_change_pct<-3?'#ef4444':'#555870'}}>OI {s.oi_change_pct>0?'+':''}{s.oi_change_pct.toFixed(1)}%</div>}
          {s.adx_value!=null && <div style={{color:s.adx_value>30?'#22c55e':s.adx_value>22?'#f59e0b':'#555870'}}>ADX {s.adx_value.toFixed(0)}</div>}
        </div>

        {/* Time + chart */}
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px'}}>
          <span style={{fontSize:'10px', color:'#555870'}}>{timeAgo(s.created_at)}</span>
          <a href={`https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}.P&interval=60`}
            target="_blank" rel="noopener noreferrer"
            style={{padding:'3px 8px', borderRadius:'5px', background:'rgba(59,130,246,0.1)', color:'#60a5fa', fontSize:'10px', fontWeight:'600', border:'1px solid rgba(59,130,246,0.2)', textDecoration:'none'}}
            onClick={e=>e.stopPropagation()}>
            Chart
          </a>
        </div>

      </div>

      {/* Indicators row — only show if has extra data */}
      {(s.fr_at_signal!=null || s.volume_ratio!=null || s.suggested_leverage) && (
        <div style={{display:'flex', gap:'10px', marginTop:'6px', paddingTop:'6px', borderTop:'1px solid rgba(255,255,255,0.04)', fontSize:'10px', color:'#555870'}}>
          {s.fr_at_signal!=null && <span>FR {(s.fr_at_signal*100).toFixed(4)}%</span>}
          {s.volume_ratio!=null && <span>Vol {s.volume_ratio.toFixed(1)}x</span>}
          {s.suggested_leverage && <span>Lev {s.suggested_leverage}x</span>}
        </div>
      )}
    </div>
  )
}

export default function SignalsPage() {
  const [signals,    setSignals]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterDir,  setFilterDir]  = useState('all')
  const [filterRank, setFilterRank] = useState('all')
  const [newIds,     setNewIds]     = useState<Set<string>>(new Set())
  const [newCount,   setNewCount]   = useState(0)
  const timers = useRef<any>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.from('signals').select('*').eq('status','active')
      .order('created_at',{ascending:false}).limit(300)
      .then(({data}) => { setSignals(data||[]); setLoading(false) })

    const ch = supabase.channel('signals_live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'signals'}, p => {
        const sig = p.new as any
        setSignals(prev=>[sig,...prev])
        setNewCount(n=>n+1)
        setNewIds(prev=>new Set(Array.from(prev).concat(sig.id)))
        timers.current[sig.id] = setTimeout(()=>{
          setNewIds(prev=>{const s=new Set(Array.from(prev));s.delete(sig.id);return s})
        }, 30000)
      }).subscribe()

    return ()=>{ supabase.removeChannel(ch); Object.values(timers.current).forEach(t=>clearTimeout(t as any)) }
  },[])

  const filtered = signals.filter(s=>{
    if (filterDir  !== 'all' && s.direction   !== filterDir)  return false
    if (filterRank !== 'all' && s.signal_rank !== filterRank) return false
    return true
  })

  // Group by rank → scenario
  const groups: Record<string, Record<number,any[]>> = {}
  for (const rank of ['S','A','B','C']) {
    const rs = filtered.filter(s=>s.signal_rank===rank)
    if (!rs.length) continue
    groups[rank] = {}
    for (const s of rs) {
      if (!groups[rank][s.scenario_id]) groups[rank][s.scenario_id]=[]
      groups[rank][s.scenario_id].push(s)
    }
  }

  const counts = {
    S: signals.filter(s=>s.signal_rank==='S').length,
    A: signals.filter(s=>s.signal_rank==='A').length,
    B: signals.filter(s=>s.signal_rank==='B').length,
    C: signals.filter(s=>s.signal_rank==='C').length,
  }

  return (
    <div style={{padding:'20px', fontFamily:F}}>

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px'}}>
        <div>
          <h1 style={{fontSize:'18px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'3px', display:'flex', alignItems:'center', gap:'8px'}}>
            Live signals
            <span style={{width:'6px', height:'6px', borderRadius:'50%', background:'#22c55e', display:'inline-block', boxShadow:'0 0 6px #22c55e', animation:'pulse 2s infinite'}}/>
          </h1>
          <p style={{fontSize:'11px', color:'#555870'}}>
            {filtered.length} active
            {newCount > 0 && <span style={{marginLeft:'8px', color:'#22c55e', fontWeight:'600'}}>+{newCount} new this session</span>}
          </p>
        </div>

        {/* Filters */}
        <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
          <div style={{display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'2px'}}>
            {['all','long','short','watch'].map(f=>(
              <button key={f} onClick={()=>setFilterDir(f)} style={{
                padding:'4px 10px', borderRadius:'6px', border:'none', fontSize:'11px', fontWeight:'500', cursor:'pointer', fontFamily:F,
                background:filterDir===f?'#1e2235':'transparent',
                color:filterDir===f?'#e8eaf2':'#555870',
              }}>{f==='all'?'All dirs':f.charAt(0).toUpperCase()+f.slice(1)}</button>
            ))}
          </div>
          <div style={{display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'2px', gap:'2px'}}>
            <button onClick={()=>setFilterRank('all')} style={{padding:'4px 10px', borderRadius:'6px', border:'none', fontSize:'11px', cursor:'pointer', fontFamily:F, background:filterRank==='all'?'#1e2235':'transparent', color:filterRank==='all'?'#e8eaf2':'#555870'}}>All</button>
            {(['S','A','B','C'] as const).map(r=>{
              const rm=RANK_META[r]
              return (
                <button key={r} onClick={()=>setFilterRank(r)} style={{
                  padding:'4px 10px', borderRadius:'6px', border:'none', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:F,
                  background:filterRank===r?rm.bg:'transparent',
                  color:filterRank===r?rm.text:'#555870',
                }}>
                  {r} {counts[r]>0?`(${counts[r]})`:''}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && signals.length > 0 && (
        <div style={{display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap'}}>
          {(['S','A','B','C'] as const).filter(r=>counts[r]>0).map(r=>{
            const rm=RANK_META[r]
            return (
              <button key={r} onClick={()=>setFilterRank(filterRank===r?'all':r)} style={{
                padding:'5px 12px', borderRadius:'7px', cursor:'pointer', fontFamily:F,
                background:filterRank===r?rm.bg:'rgba(255,255,255,0.03)',
                border:`1px solid ${filterRank===r?rm.border:'rgba(255,255,255,0.07)'}`,
                color:filterRank===r?rm.text:'#555870',
                fontSize:'12px', fontWeight:'600', transition:'all 0.15s',
              }}>
                {r==='S'?'⭐ ':''}Rank {r} · {rm.full} — {counts[r]}
              </button>
            )
          })}
        </div>
      )}

      {loading && <div style={{textAlign:'center', padding:'60px', color:'#555870'}}>Loading signals…</div>}

      {!loading && signals.length === 0 && (
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'60px', textAlign:'center'}}>
          <div style={{fontSize:'32px', marginBottom:'10px'}}>📡</div>
          <p style={{color:'#8b90a8', fontSize:'14px', marginBottom:'5px'}}>No signals yet</p>
          <p style={{color:'#555870', fontSize:'12px'}}>Scanner runs every hour — check back soon</p>
        </div>
      )}

      {/* Grouped signals */}
      {Object.entries(groups).map(([rank, scenarioMap])=>{
        const rm=RANK_META[rank as keyof typeof RANK_META]
        const total=Object.values(scenarioMap).flat().length
        return (
          <div key={rank} style={{marginBottom:'20px'}}>
            {/* Rank header — only show if showing multiple ranks */}
            {filterRank==='all' && (
              <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px'}}>
                <span style={{fontSize:'11px', fontWeight:'700', color:rm.text, padding:'2px 8px', borderRadius:'5px', background:rm.bg, border:`1px solid ${rm.border}`}}>
                  {rank==='S'?'⭐ ':''}Rank {rank} — {rm.full}
                </span>
                <div style={{height:'1px', flex:1, background:'rgba(255,255,255,0.05)'}}/>
                <span style={{fontSize:'10px', color:'#555870'}}>{total} signal{total>1?'s':''}</span>
              </div>
            )}

            {/* Scenario sub-groups */}
            {Object.entries(scenarioMap).map(([scId, sigs])=>{
              const sc=SCENARIO[parseInt(scId)]
              const dc=sc?.dir==='long'?'#22c55e':sc?.dir==='short'?'#ef4444':'#f59e0b'
              return (
                <div key={scId} style={{marginBottom:'10px'}}>
                  <div style={{fontSize:'10px', color:'#555870', marginBottom:'5px', paddingLeft:'2px', display:'flex', alignItems:'center', gap:'6px'}}>
                    <span style={{fontWeight:'600', color:'#8b90a8'}}>S{scId} · {sc?.name}</span>
                    <span style={{padding:'1px 5px', borderRadius:'3px', fontSize:'9px', background:`${dc}18`, color:dc}}>{sc?.dir?.toUpperCase()}</span>
                    <span>· {(sigs as any[]).length}</span>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                    {(sigs as any[]).map(s=>(
                      <SignalRow key={s.id} s={s} isNew={newIds.has(s.id)}/>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
