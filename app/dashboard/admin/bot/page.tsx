'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const F  = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const MN = "'SF Mono','Fira Code',monospace"

function ago(iso: string) {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return `${Math.floor(m/1440)}d ago`
}
function fp(n: any) {
  if (n == null || n === '') return '—'
  const v = parseFloat(n); if (isNaN(v)) return '—'
  if (v >= 1000) return '$' + v.toLocaleString(undefined,{maximumFractionDigits:0})
  if (v >= 100) return '$' + v.toFixed(2)
  if (v >= 1)   return '$' + v.toFixed(3)
  if (v >= 0.01)return '$' + v.toFixed(5)
  return '$' + v.toFixed(7)
}
function pct(n: any, lev = 1) {
  if (n == null) return '—'
  const v = parseFloat(n); if (isNaN(v)) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%'
}

const SKIP_REASONS: Record<string,{label:string, color:string, explain:string}> = {
  rank_filter:           {label:'Rank filter',         color:'#8b90a8', explain:'Signal rank not in your allowed ranks list'},
  no_api_keys:           {label:'No API keys',         color:'#ef4444', explain:'Binance API key/secret not configured in profile'},
  insufficient_balance:  {label:'Low balance',         color:'#ef4444', explain:'Account balance below minimum threshold'},
  max_trades:            {label:'Max trades',          color:'#f59e0b', explain:'Already at maximum 3 open trades'},
  daily_loss:            {label:'Daily loss limit',    color:'#ef4444', explain:'Daily loss limit reached — bot paused for today'},
  fr_conflict:           {label:'FR conflict',         color:'#f59e0b', explain:'Funding rate too extreme for this direction'},
  duplicate_position:    {label:'Duplicate',           color:'#8b90a8', explain:'Already have an open position in this symbol'},
  stale_signal:          {label:'Stale signal',        color:'#8b90a8', explain:'Price moved too far from signal zone before execution'},
  price_chase:           {label:'Price chase',         color:'#f59e0b', explain:'Price moved >3% outside entry zone'},
  size_too_small:        {label:'Size too small',      color:'#8b90a8', explain:'Calculated position size below $5 minimum'},
  entry_failed:          {label:'Entry failed',        color:'#ef4444', explain:'Binance rejected the entry order — check API permissions'},
  sl_failed:             {label:'SL failed',           color:'#dc2626', explain:'Stop loss placement failed — entry was cancelled for safety'},
}

const STATUS_META: Record<string,{c:string;bg:string;label:string}> = {
  pending:  {c:'#f59e0b', bg:'rgba(245,158,11,0.12)', label:'Pending'},
  placed:   {c:'#3b82f6', bg:'rgba(59,130,246,0.12)', label:'Open'},
  tp1_hit:  {c:'#22c55e', bg:'rgba(34,197,94,0.12)',  label:'TP1 ✓'},
  tp2_hit:  {c:'#22c55e', bg:'rgba(34,197,94,0.18)',  label:'TP2 ✓'},
  tp3_hit:  {c:'#22c55e', bg:'rgba(34,197,94,0.24)',  label:'TP3 ✓'},
  sl_hit:   {c:'#ef4444', bg:'rgba(239,68,68,0.12)',  label:'SL Hit'},
  closed:   {c:'#8b90a8', bg:'rgba(139,144,168,0.1)', label:'Manual Close'},
  cancelled:{c:'#555870', bg:'rgba(85,88,112,0.1)',   label:'Cancelled'},
  failed:   {c:'#ef4444', bg:'rgba(239,68,68,0.12)',  label:'Failed'},
}

const EV_META: Record<string,string> = {
  ok:'#22c55e', warning:'#f59e0b', error:'#ef4444', critical:'#dc2626'
}

function Pill({children, color, bg}:{children:any, color:string, bg:string}) {
  return <span style={{padding:'2px 8px',borderRadius:'4px',fontSize:'10px',fontWeight:'700',color,background:bg}}>{children}</span>
}

function OrderBadge({ok, label, missing}:{ok:boolean, label:string, missing?:boolean}) {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'3px',marginRight:'6px',
      padding:'1px 5px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',
      background:ok?'rgba(34,197,94,0.1)':missing?'rgba(239,68,68,0.15)':'rgba(85,88,112,0.1)',
      color:ok?'#22c55e':missing?'#ef4444':'#555870'}}>
      <span style={{width:'5px',height:'5px',borderRadius:'50%',
        background:ok?'#22c55e':missing?'#ef4444':'#555870',
        animation:missing?'blink 1s infinite':'none'}}/>
      {label}
    </span>
  )
}

function SkipReasonTag({reason}:{reason:string}) {
  const meta = SKIP_REASONS[reason]
  if (!meta) return <span style={{fontSize:'11px',color:'#555870'}}>{reason?.replace(/_/g,' ')||'—'}</span>
  return (
    <span title={meta.explain} style={{padding:'2px 7px',borderRadius:'4px',fontSize:'10px',
      fontWeight:'600',color:meta.color,background:`${meta.color}18`,cursor:'help'}}>
      {meta.label}
    </span>
  )
}

function Section({title, count, children}:{title:string, count?:number, children:any}) {
  return (
    <div style={{marginBottom:'20px'}}>
      <div style={{fontSize:'11px',fontWeight:'600',color:'#555870',textTransform:'uppercase',
        letterSpacing:'0.06em',marginBottom:'10px',display:'flex',alignItems:'center',gap:'8px'}}>
        {title}
        {count != null && <span style={{padding:'1px 6px',borderRadius:'8px',fontSize:'10px',
          fontWeight:'700',background:'rgba(255,255,255,0.06)',color:'#8b90a8'}}>{count}</span>}
      </div>
      {children}
    </div>
  )
}

export default function BotPage() {
  const [tab,      setTab]      = useState<'overview'|'pipeline'|'history'|'events'>('overview')
  const [trades,   setTrades]   = useState<any[]>([])
  const [sigLog,   setSigLog]   = useState<any[]>([])
  const [events,   setEvents]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [refresh,  setRefresh]  = useState(0)

  const load = useCallback(async () => {
    const sb = createClient()
    const [tr, sl, ev] = await Promise.all([
      // Open trades first, then closed — sorted by status priority + time
      sb.from('bot_trades').select('*').order('created_at',{ascending:false}).limit(300),
      sb.from('signal_trade_log')
        .select('*,signals(symbol,signal_rank,scenario_id,direction,price_at_signal,created_at,kline_interval)')
        .order('created_at',{ascending:false}).limit(200),
      sb.from('bot_trade_events').select('*').order('created_at',{ascending:false}).limit(1000),
    ])
    // Sort: open first, then by time
    const sorted = (tr.data || []).sort((a:any,b:any) => {
      const aOpen = ['placed','pending'].includes(a.status) ? 0 : 1
      const bOpen = ['placed','pending'].includes(b.status) ? 0 : 1
      if (aOpen !== bOpen) return aOpen - bOpen
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    setTrades(sorted)
    setSigLog(sl.data || [])
    setEvents(ev.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refresh])
  useEffect(() => {
    const t = setInterval(() => setRefresh(r=>r+1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── Computed stats ─────────────────────────────────────────────────────────
  const open      = trades.filter(t=>['placed','pending'].includes(t.status))
  const closed    = trades.filter(t=>!['placed','pending'].includes(t.status))
  const wins      = closed.filter(t=>t.status?.includes('tp'))
  const losses    = closed.filter(t=>t.status==='sl_hit')
  const failed    = closed.filter(t=>['failed','cancelled'].includes(t.status))
  const manual    = closed.filter(t=>t.status==='closed')
  const resolved  = closed.filter(t=>t.pnl_pct!=null && !['failed','cancelled'].includes(t.status))
  const totalPnl  = resolved.reduce((a:number,t:any)=>a+parseFloat(t.pnl_pct||0),0)
  const winRate   = (wins.length+losses.length)>0 ? Math.round(wins.length/(wins.length+losses.length)*100) : null

  // Pipeline stats
  const fired     = sigLog.filter(s=>s.triggered)
  const skipped   = sigLog.filter(s=>!s.triggered)
  const skipBreakdown = skipped.reduce((acc:any,s:any)=>{
    const r = s.skip_reason || 'unknown'
    acc[r] = (acc[r]||0)+1
    return acc
  },{})

  // Critical events
  const critEvents = events.filter(e=>e.status==='critical')
  const warnEvents = events.filter(e=>e.status==='warning')

  const TABS = [
    {id:'overview', label:'Overview',        badge:open.length>0?open.length:undefined, warn:critEvents.length>0},
    {id:'pipeline', label:'Signal Pipeline', badge:sigLog.length},
    {id:'history',  label:'Trade History',   badge:resolved.length},
    {id:'events',   label:'Event Log',       badge:critEvents.length>0?critEvents.length:undefined, warn:critEvents.length>0},
  ]

  if (loading) return <div style={{padding:'40px',color:'#555870',fontFamily:F}}>Loading…</div>

  return (
    <div style={{fontFamily:F,padding:'24px'}}>

      {/* ── Header ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'18px',fontWeight:'700',color:'#e8eaf2',marginBottom:'3px'}}>Trade Bot</h1>
          <p style={{fontSize:'12px',color:'#555870'}}>Full lifecycle · refreshes every 30s</p>
        </div>
        <button onClick={()=>setRefresh(r=>r+1)} style={{
          padding:'6px 14px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',
          borderRadius:'7px',color:'#60a5fa',fontSize:'12px',cursor:'pointer',fontFamily:F,
        }}>↻ Refresh</button>
      </div>

      {/* ── Critical alert ── */}
      {critEvents.filter(e=>new Date(e.created_at).getTime()>Date.now()-3600000).length>0 && (
        <div style={{background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.3)',
          borderRadius:'8px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:'#dc2626',
          display:'flex',gap:'8px',alignItems:'center'}}>
          <span>🚨</span>
          <span>{critEvents.filter(e=>new Date(e.created_at).getTime()>Date.now()-3600000).length} critical event(s) in the last hour — check Event Log</span>
          <button onClick={()=>setTab('events')} style={{marginLeft:'auto',padding:'3px 10px',
            background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'5px',
            color:'#dc2626',fontSize:'11px',cursor:'pointer',fontFamily:F}}>View →</button>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'8px',marginBottom:'20px'}}>
        {[
          {l:'Open',     v:open.length,      c:'#3b82f6', sub:'active trades'},
          {l:'Wins',     v:wins.length,       c:'#22c55e', sub:winRate!=null?winRate+'% win rate':'—'},
          {l:'Losses',   v:losses.length,     c:'#ef4444', sub:'SL hit'},
          {l:'Manual',   v:manual.length,     c:'#8b90a8', sub:'user closed'},
          {l:'Failed',   v:failed.length,     c:'#f59e0b', sub:'not executed'},
          {l:'Skipped',  v:skipped.length,    c:'#555870', sub:'signals skipped'},
          {l:'Total P&L',v:resolved.length>0?(totalPnl>0?'+':'')+totalPnl.toFixed(1)+'%':'—',
           c:totalPnl>=0?'#22c55e':'#ef4444', sub:`${resolved.length} resolved`},
        ].map(s=>(
          <div key={s.l} style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:'10px',padding:'12px 14px'}}>
            <div style={{fontSize:'9px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'5px'}}>{s.l}</div>
            <div style={{fontSize:'20px',fontWeight:'800',color:s.c,marginBottom:'2px'}}>{s.v}</div>
            <div style={{fontSize:'9px',color:'#555870'}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{display:'flex',gap:'0',borderBottom:'1px solid rgba(255,255,255,0.07)',marginBottom:'20px'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)} style={{
            padding:'8px 18px',border:'none',cursor:'pointer',fontFamily:F,
            fontSize:'13px',fontWeight:tab===t.id?'600':'400',
            color:tab===t.id?'#e8eaf2':'#555870',
            borderBottom:`2px solid ${tab===t.id?'#3b82f6':'transparent'}`,
            background:'transparent',display:'flex',alignItems:'center',gap:'6px',marginBottom:'-1px',
          }}>
            {t.label}
            {t.badge!=null && <span style={{padding:'1px 6px',borderRadius:'10px',fontSize:'10px',
              fontWeight:'700',background:(t as any).warn?'rgba(220,38,38,0.15)':'rgba(255,255,255,0.08)',
              color:(t as any).warn?'#dc2626':'#8b90a8'}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ════════════════════════════════════════════════════════════════ */}
      {tab==='overview' && (
        <div>
          {/* Open trades first */}
          {open.length > 0 && (
            <Section title="Open Trades" count={open.length}>
              {open.map(t => <TradeCard key={t.id} t={t} events={events}
                expanded={expanded===t.id} onToggle={()=>setExpanded(expanded===t.id?null:t.id)} isOpen/>)}
            </Section>
          )}

          {/* Failed trades — need explanation */}
          {failed.length > 0 && (
            <Section title="Failed / Cancelled" count={failed.length}>
              {failed.map(t => <TradeCard key={t.id} t={t} events={events}
                expanded={expanded===t.id} onToggle={()=>setExpanded(expanded===t.id?null:t.id)}/>)}
            </Section>
          )}

          {open.length===0 && failed.length===0 && (
            <div style={{textAlign:'center',padding:'60px',color:'#555870'}}>
              <div style={{fontSize:'32px',marginBottom:'12px'}}>📭</div>
              <div>No open or failed trades</div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SIGNAL PIPELINE TAB
      ════════════════════════════════════════════════════════════════ */}
      {tab==='pipeline' && (
        <div>
          {/* Skip breakdown */}
          {Object.keys(skipBreakdown).length > 0 && (
            <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:'10px',padding:'16px',marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:'600',color:'#555870',
                textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'12px'}}>
                Why Signals Were Skipped
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {Object.entries(skipBreakdown).sort(([,a]:any,[,b]:any)=>b-a).map(([reason, count]:any)=>{
                  const meta = SKIP_REASONS[reason]
                  return (
                    <div key={reason} title={meta?.explain||reason}
                      style={{background:'#0d1018',borderRadius:'8px',padding:'10px 14px',
                        cursor:'help',minWidth:'130px'}}>
                      <div style={{fontSize:'18px',fontWeight:'800',
                        color:meta?.color||'#8b90a8',marginBottom:'3px'}}>{count}</div>
                      <div style={{fontSize:'11px',fontWeight:'600',color:meta?.color||'#555870'}}>{meta?.label||reason}</div>
                      <div style={{fontSize:'10px',color:'#555870',marginTop:'2px'}}>{meta?.explain||''}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pipeline table */}
          <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',overflow:'hidden'}}>
            <div style={{display:'grid',
              gridTemplateColumns:'130px 50px 55px 70px 110px 1fr 80px',
              gap:'8px',padding:'8px 16px',fontSize:'10px',color:'#555870',
              textTransform:'uppercase',letterSpacing:'0.05em',
              borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <span>Signal</span><span>Dir</span><span>Rank</span>
              <span>Fired?</span><span>Skip Reason</span><span>Detail</span><span>Time</span>
            </div>

            {sigLog.map(s=>{
              const sig = s.signals || {}
              const det = typeof s.detail === 'string' ? JSON.parse(s.detail||'{}') : (s.detail||{})
              const isTriggered = s.triggered
              return (
                <div key={s.id} style={{
                  display:'grid',
                  gridTemplateColumns:'130px 50px 55px 70px 110px 1fr 80px',
                  gap:'8px',padding:'10px 16px',
                  borderBottom:'1px solid rgba(255,255,255,0.03)',
                  alignItems:'center',
                  background:isTriggered?'transparent':s.skip_reason==='sl_failed'||s.skip_reason==='entry_failed'
                    ?'rgba(239,68,68,0.03)':'transparent',
                }}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'600',color:'#e8eaf2'}}>
                      {sig.symbol?.replace('USDT','')||'—'}<span style={{color:'#555870',fontSize:'10px'}}>/USDT</span>
                    </div>
                    <div style={{fontSize:'9px',color:'#555870'}}>S{sig.scenario_id} · {sig.kline_interval||'—'}</div>
                  </div>
                  <span style={{padding:'2px 5px',borderRadius:'3px',fontSize:'9px',fontWeight:'800',
                    background:sig.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
                    color:sig.direction==='long'?'#22c55e':'#ef4444'}}>
                    {sig.direction?.toUpperCase()||'—'}
                  </span>
                  <span style={{fontSize:'13px',fontWeight:'800',
                    color:sig.signal_rank==='S'?'#22c55e':sig.signal_rank==='A'?'#60a5fa':'#f59e0b'}}>
                    {sig.signal_rank||'—'}
                  </span>
                  <span style={{fontSize:'12px',fontWeight:'700',
                    color:isTriggered?'#22c55e':'#ef4444'}}>
                    {isTriggered?'✓ Yes':'✗ No'}
                  </span>
                  <div>
                    {s.skip_reason ? <SkipReasonTag reason={s.skip_reason}/> : (isTriggered ? <span style={{fontSize:'10px',color:'#22c55e'}}>Trade placed</span> : '—')}
                  </div>
                  <div style={{fontSize:'10px',color:'#555870',display:'flex',flexWrap:'wrap',gap:'6px'}}>
                    {det.balance!=null && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(255,255,255,0.04)',color:'#8b90a8'}}>bal: ${parseFloat(det.balance).toFixed(1)}</span>}
                    {det.diff_pct!=null && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(255,255,255,0.04)',color:'#8b90a8'}}>diff: {parseFloat(det.diff_pct).toFixed(1)}%</span>}
                    {det.open_trades!=null && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(255,255,255,0.04)',color:'#8b90a8'}}>open: {det.open_trades}</span>}
                    {det.size_usdt!=null && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(255,255,255,0.04)',color:'#8b90a8'}}>size: ${parseFloat(det.size_usdt).toFixed(0)}</span>}
                    {det.leverage!=null && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(255,255,255,0.04)',color:'#8b90a8'}}>{det.leverage}x</span>}
                    {det.entry_type!=null && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(255,255,255,0.04)',color:'#8b90a8'}}>{det.entry_type}</span>}
                    {det.reason && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(239,68,68,0.08)',color:'#ef4444'}}>{det.reason}</span>}
                    {det.response && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(239,68,68,0.08)',color:'#ef4444',fontFamily:MN,fontSize:'9px'}}>{JSON.stringify(det.response).slice(0,60)}</span>}
                  </div>
                  <span style={{fontSize:'10px',color:'#555870'}}>{ago(s.created_at)}</span>
                </div>
              )
            })}
            {sigLog.length===0 && <div style={{padding:'40px',textAlign:'center',color:'#555870',fontSize:'13px'}}>No pipeline data yet — signals haven't triggered auto-trade</div>}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          HISTORY TAB
      ════════════════════════════════════════════════════════════════ */}
      {tab==='history' && (
        <div>
          {/* P&L breakdown by outcome */}
          {resolved.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'16px'}}>
              {[
                {l:'TP1 hits', v:wins.filter((t:any)=>t.status==='tp1_hit').length, c:'#22c55e'},
                {l:'TP2 hits', v:wins.filter((t:any)=>t.status==='tp2_hit').length, c:'#22c55e'},
                {l:'TP3 hits', v:wins.filter((t:any)=>t.status==='tp3_hit').length, c:'#22c55e'},
                {l:'SL hits',  v:losses.length,                                     c:'#ef4444'},
              ].map(s=>(
                <div key={s.l} style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'12px 14px'}}>
                  <div style={{fontSize:'9px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'5px'}}>{s.l}</div>
                  <div style={{fontSize:'22px',fontWeight:'800',color:s.c}}>{s.v}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'130px 55px 90px 80px 80px 75px 65px 70px 1fr',
              gap:'8px',padding:'8px 16px',fontSize:'10px',color:'#555870',
              textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <span>Symbol</span><span>Dir</span><span>Outcome</span>
              <span>Entry</span><span>Exit</span><span>P&L</span><span>Lev</span><span>Size</span><span>Closed</span>
            </div>
            {/* Open first, then closed */}
            {trades.map(t=>{
              const sm = STATUS_META[t.status]||STATUS_META.failed
              const pnlVal = t.pnl_pct!=null?parseFloat(t.pnl_pct):null
              const exitPrice = t.status==='sl_hit'?t.sl_price:t.status==='tp1_hit'?t.tp1_price:t.status==='tp2_hit'?t.tp2_price:t.status==='tp3_hit'?t.tp3_price:null
              const isOpenTrade = ['placed','pending'].includes(t.status)
              return (
                <div key={t.id} style={{
                  display:'grid',gridTemplateColumns:'130px 55px 90px 80px 80px 75px 65px 70px 1fr',
                  gap:'8px',padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',
                  alignItems:'center',
                  background:isOpenTrade?'rgba(59,130,246,0.03)':'transparent',
                }}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'600',color:'#e8eaf2'}}>
                      {t.symbol?.replace('USDT','')}<span style={{color:'#555870',fontSize:'10px'}}>/USDT</span>
                    </div>
                    <div style={{fontSize:'9px',color:'#555870'}}>{t.signal_rank} · {ago(t.created_at)}</div>
                  </div>
                  <span style={{padding:'2px 5px',borderRadius:'3px',fontSize:'9px',fontWeight:'800',
                    background:t.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
                    color:t.direction==='long'?'#22c55e':'#ef4444'}}>
                    {t.direction?.toUpperCase()}
                  </span>
                  <span style={{padding:'2px 7px',borderRadius:'4px',fontSize:'10px',fontWeight:'700',
                    background:sm.bg,color:sm.c}}>{sm.label}</span>
                  <span style={{fontFamily:MN,fontSize:'11px',color:'#8b90a8'}}>{fp(t.filled_price||t.entry_price)}</span>
                  <span style={{fontFamily:MN,fontSize:'11px',color:'#8b90a8'}}>{exitPrice?fp(exitPrice):'open'}</span>
                  <span style={{fontSize:'13px',fontWeight:'700',
                    color:pnlVal==null?'#555870':pnlVal>=0?'#22c55e':'#ef4444'}}>
                    {pnlVal!=null?pct(pnlVal):'—'}
                  </span>
                  <span style={{fontSize:'11px',color:'#8b90a8'}}>{t.leverage}x</span>
                  <span style={{fontSize:'11px',color:'#8b90a8'}}>${parseFloat(t.size_usdt||0).toFixed(0)}</span>
                  <div style={{fontSize:'10px',color:'#555870'}}>
                    {t.close_reason&&<span style={{color:'#555870'}}>{t.close_reason?.replace(/_/g,' ')} · </span>}
                    {ago(t.closed_at||t.created_at)}
                  </div>
                </div>
              )
            })}
            {trades.length===0 && <div style={{padding:'40px',textAlign:'center',color:'#555870',fontSize:'13px'}}>No trades yet</div>}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          EVENT LOG TAB
      ════════════════════════════════════════════════════════════════ */}
      {tab==='events' && (
        <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'150px 90px 120px 1fr 90px',
            gap:'8px',padding:'8px 16px',fontSize:'10px',color:'#555870',
            textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <span>Event</span><span>Severity</span><span>Symbol</span><span>Detail</span><span>Time</span>
          </div>
          {events.map(e=>{
            const trade = trades.find(t=>t.id===e.trade_id)
            const det = typeof e.detail==='string'?JSON.parse(e.detail||'{}'):(e.detail||{})
            const evColor = EV_META[e.status]||'#8b90a8'
            return (
              <div key={e.id} style={{
                display:'grid',gridTemplateColumns:'150px 90px 120px 1fr 90px',
                gap:'8px',padding:'9px 16px',
                borderBottom:'1px solid rgba(255,255,255,0.03)',
                alignItems:'center',
                background:e.status==='critical'?'rgba(220,38,38,0.05)':e.status==='error'?'rgba(239,68,68,0.03)':'transparent',
              }}>
                <span style={{fontSize:'11px',fontWeight:'600',color:evColor}}>
                  {e.status==='critical'&&'🚨 '}{e.status==='error'&&'⚠ '}
                  {e.event_type?.replace(/_/g,' ')}
                </span>
                <span style={{padding:'1px 7px',borderRadius:'3px',fontSize:'10px',fontWeight:'600',
                  background:`${evColor}18`,color:evColor}}>{e.status}</span>
                <span style={{fontSize:'11px',color:'#8b90a8'}}>
                  {trade?.symbol?.replace('USDT','')||'—'}
                  {trade && <span style={{color:'#555870',fontSize:'9px'}}> {trade.direction}</span>}
                </span>
                <div style={{fontSize:'10px',color:'#555870',display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                  {det.order_id && <span style={{fontFamily:MN,color:'#60a5fa'}}>#{String(det.order_id).slice(-8)}</span>}
                  {det.price && <span>@ {fp(det.price)}</span>}
                  {det.pnl_pct!=null && <span style={{color:parseFloat(det.pnl_pct)>=0?'#22c55e':'#ef4444'}}>{pct(det.pnl_pct)}</span>}
                  {det.reason && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(239,68,68,0.08)',color:'#ef4444'}}>{det.reason}</span>}
                  {det.action && <span style={{padding:'1px 5px',borderRadius:'3px',background:'rgba(255,255,255,0.04)',color:'#8b90a8'}}>{det.action}</span>}
                  {det.orders_cancelled!=null && <span>{det.orders_cancelled} orders cancelled</span>}
                  {det.age_mins!=null && <span>after {det.age_mins}min</span>}
                  {det.message && <span style={{color:'#ef4444',fontFamily:MN,fontSize:'9px'}}>{String(det.message).slice(0,80)}</span>}
                </div>
                <span style={{fontSize:'10px',color:'#555870'}}>{ago(e.created_at)}</span>
              </div>
            )
          })}
          {events.length===0 && <div style={{padding:'40px',textAlign:'center',color:'#555870',fontSize:'13px'}}>No events logged yet</div>}
        </div>
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
    </div>
  )
}

// ── Trade Card Component ────────────────────────────────────────────────────
function TradeCard({t, events, expanded, onToggle, isOpen=false}:
  {t:any, events:any[], expanded:boolean, onToggle:()=>void, isOpen?:boolean}) {
  const F  = "'Helvetica Neue', Helvetica, Arial, sans-serif"
  const MN = "'SF Mono','Fira Code',monospace"
  const sm = STATUS_META[t.status]||STATUS_META.failed
  const tradeEvents = events.filter(e=>e.trade_id===t.id)
  const hasErr = !!t.error
  const missingOrders = !t.has_sl || !t.has_tp1

  // Explain the failure
  const failureExplanation = (status: string, error: string) => {
    if (status === 'failed') {
      if (error?.includes('SL placement')) return 'Entry was placed but SL order failed after 2 retries. Bot cancelled the entry to prevent an unprotected position.'
      if (error?.includes('Entry order')) return 'The entry order was rejected by Binance. Check API permissions and available balance.'
      if (error?.includes('not filled')) return 'Limit order was not filled within 30 minutes and was cancelled.'
      return error || 'Unknown failure — check Event Log for details.'
    }
    if (status === 'cancelled') return error || 'Trade was cancelled — entry order was not filled.'
    return error
  }

  return (
    <div style={{marginBottom:'10px',background:'#111420',
      border:`1px solid ${t.status==='failed'?'rgba(239,68,68,0.3)':missingOrders&&isOpen?'rgba(245,158,11,0.3)':'rgba(255,255,255,0.07)'}`,
      borderRadius:'12px',overflow:'hidden'}}>

      {/* Header row */}
      <div onClick={onToggle} style={{
        display:'grid',
        gridTemplateColumns:'140px 60px 100px 90px 90px 90px 80px 1fr',
        gap:'8px',padding:'13px 16px',cursor:'pointer',alignItems:'center',
      }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
      >
        <div>
          <div style={{fontSize:'14px',fontWeight:'800',color:'#e8eaf2'}}>
            {t.symbol?.replace('USDT','')}<span style={{color:'#555870',fontWeight:'400',fontSize:'11px'}}>/USDT</span>
          </div>
          <div style={{fontSize:'10px',color:'#555870'}}>{ago(t.created_at)}</div>
        </div>
        <span style={{padding:'2px 7px',borderRadius:'3px',fontSize:'9px',fontWeight:'800',
          background:t.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
          color:t.direction==='long'?'#22c55e':'#ef4444'}}>
          {t.direction?.toUpperCase()}
        </span>
        <span style={{padding:'2px 8px',borderRadius:'4px',fontSize:'10px',fontWeight:'700',
          background:sm.bg,color:sm.c}}>{sm.label}</span>

        {/* Order health */}
        <div style={{display:'flex',flexWrap:'wrap',gap:'3px'}}>
          <OrderBadge ok={!!t.has_sl}  label="SL"  missing={isOpen&&!t.has_sl}/>
          <OrderBadge ok={!!t.has_tp1} label="TP1" missing={isOpen&&!t.has_tp1}/>
          {t.tp2_price && <OrderBadge ok={!!t.has_tp2} label="TP2"/>}
        </div>

        <span style={{fontFamily:MN,fontSize:'11px',color:'#8b90a8'}}>{fp(t.entry_price)}</span>
        <span style={{fontFamily:MN,fontSize:'11px',color:'#ef4444'}}>{fp(t.sl_price)}</span>
        <span style={{fontFamily:MN,fontSize:'11px',color:'#22c55e'}}>{fp(t.tp1_price)}</span>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:'12px',fontWeight:'700',
            color:t.pnl_pct!=null?(parseFloat(t.pnl_pct)>=0?'#22c55e':'#ef4444'):'#555870'}}>
            {t.pnl_pct!=null?pct(t.pnl_pct):'—'}
          </div>
          <div style={{fontSize:'10px',color:'#555870'}}>${parseFloat(t.size_usdt||0).toFixed(0)} · {t.leverage}x</div>
        </div>
      </div>

      {/* Failure explanation banner */}
      {(t.status==='failed'||t.status==='cancelled'||hasErr) && (
        <div style={{margin:'0 16px 12px',padding:'10px 12px',borderRadius:'8px',
          background:t.status==='failed'?'rgba(239,68,68,0.08)':'rgba(245,158,11,0.06)',
          border:`1px solid ${t.status==='failed'?'rgba(239,68,68,0.2)':'rgba(245,158,11,0.15)'}`}}>
          <div style={{fontSize:'11px',fontWeight:'700',
            color:t.status==='failed'?'#ef4444':'#f59e0b',marginBottom:'4px'}}>
            {t.status==='failed'?'❌ Why it failed:':'⚠ Warning:'}
          </div>
          <div style={{fontSize:'12px',color:'#c4c6d8',lineHeight:'1.6'}}>
            {failureExplanation(t.status, t.error)}
          </div>
          {t.recovery_attempts>0 && (
            <div style={{fontSize:'11px',color:'#f59e0b',marginTop:'6px'}}>
              Recovery attempted {t.recovery_attempts} time(s)
            </div>
          )}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{padding:'0 16px 16px',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginTop:'12px'}}>

            {/* Order IDs */}
            <div style={{background:'#0d1018',borderRadius:'8px',padding:'12px'}}>
              <div style={{fontSize:'10px',color:'#555870',marginBottom:'8px',
                textTransform:'uppercase',letterSpacing:'0.05em'}}>Order IDs</div>
              {[
                ['Entry', t.order_id,    true,           ''],
                ['SL',    t.sl_order_id, t.has_sl,       isOpen&&!t.has_sl?'MISSING — at risk':''],
                ['TP1',   t.tp1_order_id,t.has_tp1,      isOpen&&!t.has_tp1?'MISSING':''],
                ['TP2',   t.tp2_order_id,t.has_tp2,      t.tp2_price&&isOpen&&!t.has_tp2?'MISSING':''],
                ['TP3',   t.tp3_order_id,t.has_tp3,      t.tp3_price&&isOpen&&!t.has_tp3?'MISSING':''],
              ].map(([l,id,ok,warn])=>(
                <div key={l as string} style={{marginBottom:'6px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'11px',color:'#555870'}}>{l as string}</span>
                    <span style={{fontFamily:MN,fontSize:'10px',color:(ok)?'#60a5fa':'#ef4444'}}>
                      {id?'#'+(id as string).slice(-10):'✗ not placed'}
                    </span>
                  </div>
                  {warn && <div style={{fontSize:'9px',color:'#ef4444',marginTop:'1px'}}>{warn as string}</div>}
                </div>
              ))}
            </div>

            {/* Price levels */}
            <div style={{background:'#0d1018',borderRadius:'8px',padding:'12px'}}>
              <div style={{fontSize:'10px',color:'#555870',marginBottom:'8px',
                textTransform:'uppercase',letterSpacing:'0.05em'}}>Levels</div>
              {[
                ['Requested entry', t.entry_price,  '#555870'],
                ['Filled at',       t.filled_price, '#60a5fa'],
                ['Stop Loss',       t.sl_price,     '#ef4444'],
                ['TP1',             t.tp1_price,    '#22c55e'],
                ['TP2',             t.tp2_price,    '#22c55e'],
                ['TP3',             t.tp3_price,    '#22c55e'],
                ['Final P&L',       t.pnl_pct!=null?(parseFloat(t.pnl_pct)>0?'+':'')+parseFloat(t.pnl_pct).toFixed(2)+'%':null, parseFloat(t.pnl_pct||0)>=0?'#22c55e':'#ef4444'],
              ].filter(([,v])=>v!=null).map(([l,v,c])=>(
                <div key={l as string} style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                  <span style={{fontSize:'11px',color:'#555870'}}>{l as string}</span>
                  <span style={{fontFamily:MN,fontSize:'11px',color:c as string}}>{v as string}</span>
                </div>
              ))}
            </div>

            {/* Event timeline */}
            <div style={{background:'#0d1018',borderRadius:'8px',padding:'12px',
              maxHeight:'220px',overflowY:'auto'}}>
              <div style={{fontSize:'10px',color:'#555870',marginBottom:'8px',
                textTransform:'uppercase',letterSpacing:'0.05em'}}>
                Timeline ({tradeEvents.length} events)
              </div>
              {tradeEvents.length===0 && (
                <div style={{fontSize:'11px',color:'#555870'}}>
                  No events recorded. The new auto_trade.php logs events — older trades won't have them.
                </div>
              )}
              {tradeEvents.map(e=>{
                const evColor = EV_META[e.status]||'#8b90a8'
                const det = typeof e.detail==='string'?JSON.parse(e.detail||'{}'):(e.detail||{})
                return (
                  <div key={e.id} style={{marginBottom:'8px',paddingBottom:'8px',
                    borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}>
                      <span style={{fontSize:'11px',fontWeight:'600',color:evColor}}>
                        {e.status==='critical'&&'🚨 '}
                        {e.status==='warning'&&'⚠ '}
                        {e.event_type?.replace(/_/g,' ')}
                      </span>
                      <span style={{fontSize:'9px',color:'#555870'}}>{ago(e.created_at)}</span>
                    </div>
                    {(det.reason||det.action||det.message) && (
                      <div style={{fontSize:'10px',color:'#555870'}}>
                        {det.reason||det.action||String(det.message||'').slice(0,60)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
