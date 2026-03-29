'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIO: Record<number, string> = {
  1:'Strong bull trend', 2:'Strong bear trend', 3:'Weak rally',
  4:'Weak sell-off',     5:'Bull trap',         6:'Bear trap',
  7:'Long squeeze',      8:'Short squeeze',     9:'Coil / buildup',
}

const RANK_META = {
  S:{bg:'rgba(34,197,94,0.15)',  text:'#22c55e'},
  A:{bg:'rgba(59,130,246,0.15)', text:'#60a5fa'},
  B:{bg:'rgba(245,158,11,0.15)', text:'#f59e0b'},
  C:{bg:'rgba(139,144,168,0.1)', text:'#8b90a8'},
}

const OUTCOME_META: Record<string, {label:string; color:string}> = {
  tp1_hit:  {label:'TP1 Hit',  color:'#22c55e'},
  tp2_hit:  {label:'TP2 Hit',  color:'#16a34a'},
  tp3_hit:  {label:'TP3 Hit',  color:'#15803d'},
  stop_hit: {label:'SL Hit',   color:'#ef4444'},
  expired:  {label:'Expired',  color:'#555870'},
  active:   {label:'Active',   color:'#3b82f6'},
}

function fp(n: number | null) {
  if (!n) return '—'
  if (n >= 1000) return '$' + n.toLocaleString(undefined, {maximumFractionDigits:0})
  if (n >= 100)  return '$' + n.toFixed(2)
  if (n >= 1)    return '$' + n.toFixed(3)
  if (n >= 0.01) return '$' + n.toFixed(5)
  return '$' + n.toFixed(7)
}

function pct(n: number) {
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
}

export default function HistoryPage() {
  const [signals,    setSignals]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(0)
  const [hasMore,    setHasMore]    = useState(true)
  const [filterDir,  setFilterDir]  = useState('all')
  const [filterRank, setFilterRank] = useState('all')
  const [filterOut,  setFilterOut]  = useState('all')
  const [expanded,   setExpanded]   = useState<string|null>(null)

  const PAGE_SIZE = 50

  async function load(reset=false) {
    setLoading(true)
    const supabase = createClient()
    const offset   = reset ? 0 : page * PAGE_SIZE

    let q = supabase
      .from('signals')
      .select('*, signal_outcomes(*)')
      .neq('status', 'active')
      .order('created_at', {ascending:false})
      .range(offset, offset + PAGE_SIZE - 1)

    if (filterDir  !== 'all') q = q.eq('direction',   filterDir)
    if (filterRank !== 'all') q = q.eq('signal_rank', filterRank)
    if (filterOut  !== 'all') q = q.eq('status',      filterOut)

    const {data} = await q
    const rows = data || []
    if (reset) setSignals(rows)
    else       setSignals(prev => [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    if (!reset) setPage(p => p+1)
    setLoading(false)
  }

  useEffect(() => { setPage(0); load(true) }, [filterDir, filterRank, filterOut])

  function loadMore() { load(false) }

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding:'4px 10px', borderRadius:'6px', border:'none', fontSize:'11px',
    fontWeight:'500', cursor:'pointer', fontFamily:F,
    background: active ? '#1e2235' : 'transparent',
    color:      active ? '#e8eaf2'  : '#555870',
  })

  return (
    <div style={{padding:'20px', fontFamily:F}}>

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px', flexWrap:'wrap', gap:'10px'}}>
        <div>
          <h1 style={{fontSize:'18px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'3px'}}>Signal history</h1>
          <p style={{fontSize:'11px', color:'#555870'}}>All resolved and expired signals</p>
        </div>

        {/* Filters */}
        <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
          {/* Direction */}
          <div style={{display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'2px'}}>
            {['all','long','short'].map(f=>(
              <button key={f} onClick={()=>setFilterDir(f)} style={filterBtn(filterDir===f)}>
                {f==='all'?'All dirs':f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>
          {/* Rank */}
          <div style={{display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'2px'}}>
            {['all','S','A','B','C'].map(f=>(
              <button key={f} onClick={()=>setFilterRank(f)} style={filterBtn(filterRank===f)}>
                {f==='all'?'All ranks':f}
              </button>
            ))}
          </div>
          {/* Outcome */}
          <div style={{display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'2px'}}>
            {[
              {v:'all',      l:'All'},
              {v:'tp1_hit',  l:'TP1'},
              {v:'tp2_hit',  l:'TP2'},
              {v:'tp3_hit',  l:'TP3'},
              {v:'stop_hit', l:'SL'},
              {v:'expired',  l:'Expired'},
            ].map(f=>(
              <button key={f.v} onClick={()=>setFilterOut(f.v)} style={filterBtn(filterOut===f.v)}>{f.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', overflow:'hidden'}}>

        {/* Column headers */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 70px 60px 80px 80px 80px 80px 80px', gap:'8px', padding:'8px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em'}}>
          <span>Signal</span>
          <span>Rank</span>
          <span>Dir</span>
          <span>Entry</span>
          <span>Outcome</span>
          <span>P&L</span>
          <span>R:R</span>
          <span>Date</span>
        </div>

        {loading && signals.length === 0 && (
          <div style={{padding:'40px', textAlign:'center', color:'#555870', fontSize:'13px'}}>Loading…</div>
        )}

        {!loading && signals.length === 0 && (
          <div style={{padding:'60px', textAlign:'center'}}>
            <div style={{fontSize:'28px', marginBottom:'10px'}}>📭</div>
            <p style={{color:'#8b90a8', fontSize:'14px', marginBottom:'4px'}}>No history yet</p>
            <p style={{color:'#555870', fontSize:'12px'}}>Signals appear here once they hit TP, SL or expire</p>
          </div>
        )}

        {signals.map(s => {
          const outcome  = s.signal_outcomes?.[0]
          const om       = OUTCOME_META[s.status] || OUTCOME_META.expired
          const rm       = RANK_META[s.signal_rank as keyof typeof RANK_META] || RANK_META.B
          const isOpen   = expanded === s.id
          const pnl      = outcome?.pnl_pct

          return (
            <div key={s.id}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(isOpen ? null : s.id)}
                style={{
                  display:'grid', gridTemplateColumns:'1fr 70px 60px 80px 80px 80px 80px 80px',
                  gap:'8px', padding:'10px 16px', cursor:'pointer',
                  borderBottom:`1px solid ${isOpen ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)'}`,
                  background: isOpen ? 'rgba(59,130,246,0.05)' : 'transparent',
                  alignItems:'center', transition:'background 0.1s',
                }}
                onMouseEnter={e => { if(!isOpen) e.currentTarget.style.background='rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if(!isOpen) e.currentTarget.style.background='transparent' }}
              >
                <div>
                  <div style={{fontSize:'13px', fontWeight:'700', color:'#e8eaf2'}}>
                    {s.symbol?.replace('USDT','')}
                    <span style={{color:'#555870', fontWeight:'400', fontSize:'11px'}}>/USDT</span>
                  </div>
                  <div style={{fontSize:'10px', color:'#555870'}}>S{s.scenario_id} · {SCENARIO[s.scenario_id]}</div>
                </div>
                <span style={{padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontWeight:'700', background:rm.bg, color:rm.text}}>{s.signal_rank}</span>
                <span style={{fontSize:'11px', color: s.direction==='long'?'#22c55e':s.direction==='short'?'#ef4444':'#f59e0b', fontWeight:'600'}}>
                  {s.direction?.toUpperCase()}
                </span>
                <span style={{fontSize:'11px', color:'#8b90a8'}}>{fp(s.price_at_signal)}</span>
                <span style={{padding:'2px 8px', borderRadius:'4px', fontSize:'10px', fontWeight:'600', background:`${om.color}15`, color:om.color}}>
                  {om.label}
                </span>
                <span style={{fontSize:'12px', fontWeight:'600', color: pnl!=null?(pnl>=0?'#22c55e':'#ef4444'):'#555870'}}>
                  {pnl!=null ? pct(pnl) : '—'}
                </span>
                <span style={{fontSize:'11px', color:'#8b90a8'}}>
                  {outcome?.rr_achieved!=null ? outcome.rr_achieved.toFixed(1)+'x' : '—'}
                </span>
                <span style={{fontSize:'10px', color:'#555870'}}>
                  {new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                </span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{padding:'14px 16px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'10px'}}>
                    {[
                      {label:'Entry zone', val:`${fp(s.entry_low)} – ${fp(s.entry_high)}`, color:'#e8eaf2'},
                      {label:'Stop loss',  val:fp(s.stop_loss),  color:'#ef4444'},
                      {label:'TP1',        val:fp(s.tp1),        color:'#22c55e'},
                      {label:'TP2',        val:fp(s.tp2),        color:'#22c55e'},
                      {label:'TP3',        val:fp(s.tp3),        color:'#22c55e'},
                    ].map(item=>(
                      <div key={item.label} style={{background:'rgba(255,255,255,0.03)', borderRadius:'7px', padding:'8px 10px'}}>
                        <div style={{fontSize:'9px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'3px'}}>{item.label}</div>
                        <div style={{fontSize:'12px', fontWeight:'600', color:item.color}}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex', gap:'14px', fontSize:'11px', color:'#555870', alignItems:'center'}}>
                    {s.oi_change_pct!=null  && <span>OI {s.oi_change_pct>0?'+':''}{s.oi_change_pct.toFixed(1)}%</span>}
                    {s.fr_at_signal!=null   && <span>FR {(s.fr_at_signal*100).toFixed(4)}%</span>}
                    {s.adx_value!=null      && <span>ADX {s.adx_value.toFixed(1)}</span>}
                    {s.volume_ratio!=null   && <span>Vol {s.volume_ratio.toFixed(1)}x</span>}
                    {outcome?.duration_minutes!=null && (
                      <span>Held {outcome.duration_minutes>=60?(outcome.duration_minutes/60).toFixed(1)+'h':outcome.duration_minutes+'m'}</span>
                    )}
                    {s.confirmed_bybit && <span style={{color:'#60a5fa'}}>Bybit ✓</span>}
                    <a href={`https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}.P&interval=60`}
                      target="_blank" rel="noopener noreferrer"
                      style={{marginLeft:'auto', padding:'4px 10px', borderRadius:'5px', background:'rgba(59,130,246,0.1)', color:'#60a5fa', fontSize:'10px', fontWeight:'600', border:'1px solid rgba(59,130,246,0.2)', textDecoration:'none'}}>
                      Chart ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Load more */}
        {hasMore && !loading && signals.length > 0 && (
          <div style={{padding:'16px', textAlign:'center'}}>
            <button onClick={loadMore} style={{padding:'8px 24px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#8b90a8', fontSize:'13px', cursor:'pointer', fontFamily:F}}>
              Load more
            </button>
          </div>
        )}

        {loading && signals.length > 0 && (
          <div style={{padding:'16px', textAlign:'center', color:'#555870', fontSize:'12px'}}>Loading…</div>
        )}
      </div>
    </div>
  )
}
