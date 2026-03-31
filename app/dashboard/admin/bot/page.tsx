'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:      '#07090f',
  surface: '#0c0e17',
  card:    '#10131e',
  border:  'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.10)',
  text:    '#e2e4f0',
  muted:   '#4a4d63',
  dim:     '#1c1f2e',
  green:   '#16a34a',
  greenL:  '#22c55e',
  red:     '#dc2626',
  redL:    '#ef4444',
  blue:    '#2563eb',
  blueL:   '#60a5fa',
  amber:   '#d97706',
  amberL:  '#fbbf24',
  gray:    '#374151',
}
const F  = "'DM Sans', 'Helvetica Neue', sans-serif"
const MN = "'JetBrains Mono', 'Fira Code', monospace"

// ── Helpers ────────────────────────────────────────────────────────────────
function ago(iso: string) {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}
function fp(n: any) {
  if (n == null || n === '') return '—'
  const v = parseFloat(n); if (isNaN(v)) return '—'
  if (v >= 1000) return '$' + v.toLocaleString(undefined,{maximumFractionDigits:0})
  if (v >= 100)  return '$' + v.toFixed(2)
  if (v >= 1)    return '$' + v.toFixed(4)
  if (v >= 0.01) return '$' + v.toFixed(5)
  return '$' + v.toFixed(7)
}
function signed(n: any, suffix = '%') {
  if (n == null) return '—'
  const v = parseFloat(n); if (isNaN(v)) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(2) + suffix
}

// ── Skip reason meta ───────────────────────────────────────────────────────
const SKIP: Record<string,{short:string; why:string; sev:'info'|'warn'|'err'}> = {
  rank_filter:          {short:'Rank filter',     why:'Signal rank not in your auto-trade rank list',           sev:'info'},
  no_api_keys:          {short:'No API keys',     why:'Binance API key / secret missing in profile',            sev:'err'},
  insufficient_balance: {short:'Low balance',     why:'Account balance below minimum',                         sev:'err'},
  max_trades:           {short:'Max trades',      why:'Already at 3 open positions — bot paused',              sev:'warn'},
  daily_loss:           {short:'Daily loss',      why:'Daily loss limit hit — bot halted for today',           sev:'err'},
  fr_conflict:          {short:'FR conflict',     why:'Funding rate too extreme for this direction',            sev:'warn'},
  duplicate_position:   {short:'Duplicate',       why:'Open position already exists for this symbol',          sev:'info'},
  stale_signal:         {short:'Stale',           why:'Price moved too far from signal zone',                  sev:'info'},
  price_chase:          {short:'Price chase',     why:'Price >3% outside entry zone — skipped to avoid chase', sev:'warn'},
  size_too_small:       {short:'Size too small',  why:'Calculated position size < $5 minimum',                 sev:'info'},
  entry_failed:         {short:'Entry failed',    why:'Binance rejected entry order — check API permissions',  sev:'err'},
  sl_failed:            {short:'SL failed',       why:'Stop-loss placement failed — entry cancelled for safety', sev:'err'},
}

const SEV_C = { info: C.muted, warn: C.amberL, err: C.redL }
const SEV_BG = { info: 'rgba(74,77,99,0.12)', warn: 'rgba(251,191,36,0.1)', err: 'rgba(239,68,68,0.1)' }

// ── Status meta ────────────────────────────────────────────────────────────
const ST: Record<string,{label:string; dot:string; text:string; bg:string}> = {
  pending:   {label:'Pending',  dot:C.amberL, text:C.amberL, bg:'rgba(251,191,36,0.08)'},
  placed:    {label:'Open',     dot:C.blueL,  text:C.blueL,  bg:'rgba(96,165,250,0.08)'},
  tp1_hit:   {label:'TP1 ✓',   dot:C.greenL, text:C.greenL, bg:'rgba(34,197,94,0.08)'},
  tp2_hit:   {label:'TP2 ✓',   dot:C.greenL, text:C.greenL, bg:'rgba(34,197,94,0.1)'},
  tp3_hit:   {label:'TP3 ✓',   dot:C.greenL, text:C.greenL, bg:'rgba(34,197,94,0.14)'},
  sl_hit:    {label:'SL Hit',   dot:C.redL,   text:C.redL,   bg:'rgba(239,68,68,0.08)'},
  closed:    {label:'Closed',   dot:C.muted,  text:C.muted,  bg:'rgba(74,77,99,0.1)'},
  cancelled: {label:'Cancelled',dot:C.muted,  text:C.muted,  bg:'rgba(74,77,99,0.08)'},
  failed:    {label:'Failed',   dot:C.redL,   text:C.redL,   bg:'rgba(239,68,68,0.08)'},
}

// ── Tiny components ────────────────────────────────────────────────────────
function Dot({color, pulse}:{color:string, pulse?:boolean}) {
  return (
    <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',
      background:color, flexShrink:0,
      boxShadow:pulse?`0 0 0 2px ${color}30`:undefined,
      animation:pulse?'pulse 2s infinite':undefined}}/>
  )
}

function StatusPill({status}:{status:string}) {
  const s = ST[status] || ST.failed
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'5px',
      padding:'3px 8px',borderRadius:'20px',fontSize:'10px',fontWeight:'700',
      letterSpacing:'0.04em',background:s.bg,color:s.text}}>
      <Dot color={s.dot} pulse={status==='placed'}/>
      {s.label}
    </span>
  )
}

function OrderDot({ok, label}:{ok:boolean, label:string}) {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'3px',
      fontSize:'9px',fontWeight:'600',letterSpacing:'0.03em',marginRight:'5px',
      color:ok?C.greenL:C.redL, opacity:ok?1:0.7}}>
      <span style={{width:'5px',height:'5px',borderRadius:'50%',
        background:ok?C.greenL:C.redL,
        animation:!ok?'blink 1.2s infinite':undefined}}/>
      {label}
    </span>
  )
}

function MiniStat({label, value, color}:{label:string, value:any, color?:string}) {
  return (
    <div style={{background:C.dim,borderRadius:'8px',padding:'10px 14px'}}>
      <div style={{fontSize:'9px',color:C.muted,textTransform:'uppercase',
        letterSpacing:'0.08em',marginBottom:'5px'}}>{label}</div>
      <div style={{fontSize:'18px',fontWeight:'800',color:color||C.text,
        fontVariantNumeric:'tabular-nums'}}>{value}</div>
    </div>
  )
}

function KV({k,v,vc}:{k:string,v:any,vc?:string}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontSize:'11px',color:C.muted}}>{k}</span>
      <span style={{fontSize:'11px',fontWeight:'600',color:vc||C.text,fontFamily:MN}}>{v||'—'}</span>
    </div>
  )
}

function Tag({label,color,bg,title}:{label:string,color:string,bg:string,title?:string}) {
  return (
    <span title={title} style={{padding:'2px 7px',borderRadius:'4px',fontSize:'10px',
      fontWeight:'600',color,background:bg,cursor:title?'help':undefined}}>{label}</span>
  )
}

// ── Expanded trade detail ──────────────────────────────────────────────────
function TradeDetail({t, events}:{t:any, events:any[]}) {
  const trEvents = events.filter(e=>e.trade_id===t.id)
  const isOpen   = ['placed','pending'].includes(t.status)
  const isFailed = ['failed','cancelled'].includes(t.status)

  const failMsg: Record<string,string> = {
    'SL placement failed': 'Entry was placed but stop-loss failed after 2 retries. Bot cancelled the entry to keep your account safe.',
    'Entry order': 'Binance rejected the entry order. Possible reasons: insufficient margin, invalid quantity, or API permission issue.',
    'not filled': 'LIMIT order sat unfilled for 30 minutes and was automatically cancelled.',
    'cancelled': 'Entry order was cancelled or expired before it could fill.',
  }
  const whyFailed = t.error
    ? Object.entries(failMsg).find(([k])=>t.error.includes(k))?.[1] || t.error
    : null

  return (
    <div style={{padding:'16px 20px 20px',borderTop:`1px solid ${C.border}`,
      background:'rgba(0,0,0,0.2)',display:'grid',
      gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>

      {/* Failure explanation */}
      {(isFailed || t.error) && (
        <div style={{gridColumn:'1/-1',background:'rgba(220,38,38,0.07)',
          border:'1px solid rgba(220,38,38,0.2)',borderRadius:'10px',
          padding:'12px 16px',marginBottom:'4px'}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:C.redL,marginBottom:'6px'}}>
            ❌ Why this trade failed
          </div>
          <div style={{fontSize:'12px',color:'#d1d5db',lineHeight:'1.7'}}>{whyFailed}</div>
          {t.recovery_attempts > 0 && (
            <div style={{marginTop:'6px',fontSize:'11px',color:C.amberL}}>
              Recovery was attempted {t.recovery_attempts}× by position monitor
            </div>
          )}
        </div>
      )}

      {/* Order IDs */}
      <div style={{background:C.dim,borderRadius:'10px',padding:'14px'}}>
        <div style={{fontSize:'10px',fontWeight:'700',color:C.muted,
          textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'10px'}}>
          Orders
        </div>
        {[
          {label:'Entry', id:t.order_id,     ok:!!t.order_id},
          {label:'SL',    id:t.sl_order_id,  ok:!!t.has_sl,  warn:isOpen&&!t.has_sl},
          {label:'TP1',   id:t.tp1_order_id, ok:!!t.has_tp1, warn:isOpen&&!t.has_tp1},
          {label:'TP2',   id:t.tp2_order_id, ok:!!t.has_tp2, skip:!t.tp2_price},
          {label:'TP3',   id:t.tp3_order_id, ok:!!t.has_tp3, skip:!t.tp3_price},
        ].filter(o=>!o.skip).map(o=>(
          <div key={o.label} style={{display:'flex',justifyContent:'space-between',
            alignItems:'center',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{width:'5px',height:'5px',borderRadius:'50%',flexShrink:0,
                background:o.ok?C.greenL:o.warn?C.redL:C.muted,
                animation:o.warn?'blink 1.2s infinite':undefined}}/>
              <span style={{fontSize:'11px',color:C.muted}}>{o.label}</span>
              {o.warn && <span style={{fontSize:'9px',color:C.redL,fontWeight:'700'}}>MISSING</span>}
            </div>
            <span style={{fontFamily:MN,fontSize:'10px',color:o.ok?C.blueL:C.muted}}>
              {o.id ? '#'+String(o.id).slice(-10) : o.ok?'—':'not placed'}
            </span>
          </div>
        ))}
      </div>

      {/* Levels */}
      <div style={{background:C.dim,borderRadius:'10px',padding:'14px'}}>
        <div style={{fontSize:'10px',fontWeight:'700',color:C.muted,
          textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'10px'}}>
          Price Levels
        </div>
        <KV k="Entry price" v={fp(t.entry_price)} vc={C.text}/>
        {t.filled_price && <KV k="Filled at" v={fp(t.filled_price)} vc={C.blueL}/>}
        <KV k="Stop Loss"  v={fp(t.sl_price)}    vc={C.redL}/>
        <KV k="TP1"        v={fp(t.tp1_price)}   vc={C.greenL}/>
        {t.tp2_price && <KV k="TP2" v={fp(t.tp2_price)} vc={C.greenL}/>}
        {t.tp3_price && <KV k="TP3" v={fp(t.tp3_price)} vc={C.greenL}/>}
        {t.pnl_pct != null && (
          <div style={{marginTop:'8px',padding:'8px 0',borderTop:`1px solid ${C.border}`}}>
            <div style={{fontSize:'9px',color:C.muted,marginBottom:'3px'}}>Final P&L</div>
            <div style={{fontSize:'20px',fontWeight:'800',fontFamily:MN,
              color:parseFloat(t.pnl_pct)>=0?C.greenL:C.redL}}>
              {signed(t.pnl_pct)}
            </div>
          </div>
        )}
      </div>

      {/* Event timeline */}
      <div style={{background:C.dim,borderRadius:'10px',padding:'14px',
        maxHeight:'260px',overflowY:'auto'}}>
        <div style={{fontSize:'10px',fontWeight:'700',color:C.muted,
          textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'10px'}}>
          Timeline · {trEvents.length} events
        </div>
        {trEvents.length===0 && (
          <div style={{fontSize:'11px',color:C.muted,lineHeight:'1.6'}}>
            No events recorded.<br/>
            Deploy the new auto_trade.php for full event logging.
          </div>
        )}
        {trEvents.map((e:any)=>{
          const eColor = {ok:C.greenL,warning:C.amberL,error:C.redL,critical:'#dc2626'}[e.status]||C.muted
          const det = typeof e.detail==='string'?JSON.parse(e.detail||'{}'):(e.detail||{})
          return (
            <div key={e.id} style={{marginBottom:'10px',paddingBottom:'10px',
              borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                <span style={{fontSize:'11px',fontWeight:'700',color:eColor}}>
                  {e.status==='critical'&&'🚨 '}
                  {e.status==='warning'&&'⚠ '}
                  {e.event_type?.replace(/_/g,' ')}
                </span>
                <span style={{fontSize:'9px',color:C.muted}}>{ago(e.created_at)}</span>
              </div>
              {(det.reason||det.action||det.message||det.price) && (
                <div style={{fontSize:'10px',color:C.muted,lineHeight:'1.5'}}>
                  {det.price && `@ ${fp(det.price)} `}
                  {det.order_id && <span style={{fontFamily:MN,color:C.blueL}}>#{String(det.order_id).slice(-8)} </span>}
                  {det.reason||det.action||String(det.message||'').slice(0,80)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
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
      sb.from('bot_trades').select('*').order('created_at',{ascending:false}).limit(300),
      sb.from('signal_trade_log').select('*,signals(symbol,signal_rank,scenario_id,direction,price_at_signal,kline_interval,created_at)').order('created_at',{ascending:false}).limit(200),
      sb.from('bot_trade_events').select('*').order('created_at',{ascending:false}).limit(1000),
    ])
    // Open trades always first
    const sorted = (tr.data||[]).sort((a:any,b:any)=>{
      const aO = ['placed','pending'].includes(a.status)?0:1
      const bO = ['placed','pending'].includes(b.status)?0:1
      if (aO!==bO) return aO-bO
      return new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
    })
    setTrades(sorted)
    setSigLog(sl.data||[])
    setEvents(ev.data||[])
    setLoading(false)
  }, [])

  useEffect(()=>{load()},[load,refresh])
  useEffect(()=>{
    const t=setInterval(()=>setRefresh(r=>r+1),30000)
    return()=>clearInterval(t)
  },[])

  // Stats
  const open     = trades.filter(t=>['placed','pending'].includes(t.status))
  const closed   = trades.filter(t=>!['placed','pending'].includes(t.status))
  const wins     = closed.filter(t=>t.status?.includes('tp'))
  const losses   = closed.filter(t=>t.status==='sl_hit')
  const failed   = closed.filter(t=>['failed','cancelled'].includes(t.status))
  const resolved = closed.filter(t=>t.pnl_pct!=null&&!['failed','cancelled'].includes(t.status))
  const totalPnl = resolved.reduce((a:number,t:any)=>a+parseFloat(t.pnl_pct||0),0)
  const wr       = (wins.length+losses.length)>0?Math.round(wins.length/(wins.length+losses.length)*100):null
  const fired    = sigLog.filter(s=>s.triggered)
  const skipped  = sigLog.filter(s=>!s.triggered)
  const skipBreak= skipped.reduce((a:any,s:any)=>{const r=s.skip_reason||'unknown';a[r]=(a[r]||0)+1;return a},{})
  const crits    = events.filter(e=>e.status==='critical')
  const recentCrit = crits.filter(e=>new Date(e.created_at).getTime()>Date.now()-3600000)

  const TABS = [
    {id:'overview', label:'Trades'},
    {id:'pipeline', label:'Pipeline'},
    {id:'history',  label:'History'},
    {id:'events',   label:'Events', warn:recentCrit.length>0},
  ]

  if (loading) return (
    <div style={{padding:'60px',textAlign:'center',color:C.muted,fontFamily:F}}>
      <div style={{fontSize:'13px'}}>Loading trade data…</div>
    </div>
  )

  return (
    <div style={{fontFamily:F,color:C.text,minHeight:'100vh',background:C.bg}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
        .trade-row{transition:background 0.12s}
        .trade-row:hover{background:rgba(255,255,255,0.025)!important}
        .tab-btn{transition:all 0.15s}
        .tab-btn:hover{color:#e2e4f0!important}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1c1f2e;border-radius:2px}
      `}</style>

      {/* ── Header ── */}
      <div style={{padding:'22px 28px 0',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'18px'}}>
          <div>
            <h1 style={{fontSize:'17px',fontWeight:'700',letterSpacing:'-0.3px',marginBottom:'3px'}}>Trade Bot</h1>
            <p style={{fontSize:'11px',color:C.muted}}>Auto-trade lifecycle · refreshes every 30s</p>
          </div>
          <button onClick={()=>setRefresh(r=>r+1)} style={{
            padding:'6px 14px',background:C.dim,border:`1px solid ${C.border2}`,
            borderRadius:'7px',color:C.blueL,fontSize:'11px',fontWeight:'600',
            cursor:'pointer',fontFamily:F,letterSpacing:'0.02em',
          }}>↻ Refresh</button>
        </div>

        {/* Stats row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'8px',marginBottom:'18px'}}>
          <MiniStat label="Open"      value={open.length}       color={open.length>0?C.blueL:C.muted}/>
          <MiniStat label="Win rate"  value={wr!=null?wr+'%':'—'} color={wr!=null?(wr>=50?C.greenL:C.redL):C.muted}/>
          <MiniStat label="Wins"      value={wins.length}       color={C.greenL}/>
          <MiniStat label="Losses"    value={losses.length}     color={losses.length>0?C.redL:C.muted}/>
          <MiniStat label="Failed"    value={failed.length}     color={failed.length>0?C.amberL:C.muted}/>
          <MiniStat label="Skipped"   value={skipped.length}    color={C.muted}/>
          <MiniStat label="Total P&L" value={resolved.length>0?signed(totalPnl):'—'}
            color={totalPnl>=0?C.greenL:C.redL}/>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:'0'}}>
          {TABS.map(t=>(
            <button key={t.id} className="tab-btn" onClick={()=>{setTab(t.id as any);setExpanded(null)}}
              style={{padding:'9px 18px',border:'none',cursor:'pointer',fontFamily:F,
                fontSize:'12px',fontWeight:tab===t.id?'700':'400',letterSpacing:'0.02em',
                color:tab===t.id?C.text:C.muted,background:'transparent',
                borderBottom:`2px solid ${tab===t.id?C.blueL:'transparent'}`,
                marginBottom:'-1px',display:'flex',alignItems:'center',gap:'6px'}}>
              {t.label}
              {(t as any).warn && <span style={{width:'6px',height:'6px',borderRadius:'50%',
                background:C.redL,animation:'pulse 2s infinite'}}/>}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:'20px 28px'}}>

        {/* ═══════════════════════════════════════════════════════
            TRADES TAB — high level table, expand on click
        ═══════════════════════════════════════════════════════ */}
        {tab==='overview' && (
          <div>
            {recentCrit.length>0 && (
              <div style={{background:'rgba(220,38,38,0.07)',border:'1px solid rgba(220,38,38,0.2)',
                borderRadius:'10px',padding:'10px 16px',marginBottom:'14px',
                display:'flex',alignItems:'center',gap:'10px',fontSize:'12px',color:'#f87171'}}>
                <span style={{fontSize:'16px'}}>🚨</span>
                <span>{recentCrit.length} critical event{recentCrit.length>1?'s':''} in the last hour</span>
                <button onClick={()=>setTab('events')} style={{marginLeft:'auto',padding:'4px 12px',
                  background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',
                  borderRadius:'6px',color:'#f87171',fontSize:'11px',cursor:'pointer',fontFamily:F}}>
                  View events →
                </button>
              </div>
            )}

            {/* Column headers */}
            <div style={{display:'grid',
              gridTemplateColumns:'140px 52px 100px 90px 80px 80px 80px 70px 1fr 24px',
              gap:'8px',padding:'7px 14px',fontSize:'9px',color:C.muted,
              textTransform:'uppercase',letterSpacing:'0.08em',
              borderBottom:`1px solid ${C.border}`,marginBottom:'4px'}}>
              <span>Symbol</span><span>Dir</span><span>Status</span>
              <span>Entry</span><span>SL</span><span>TP1</span>
              <span>P&L</span><span>Size</span><span>Orders / Time</span><span/>
            </div>

            {trades.length===0 && (
              <div style={{textAlign:'center',padding:'70px',color:C.muted}}>
                <div style={{fontSize:'32px',marginBottom:'12px',opacity:0.3}}>📭</div>
                <div style={{fontSize:'13px'}}>No trades yet</div>
              </div>
            )}

            {trades.map((t:any)=>{
              const isExp  = expanded===t.id
              const isOpen = ['placed','pending'].includes(t.status)
              const sm     = ST[t.status]||ST.failed
              const pnl    = t.pnl_pct!=null?parseFloat(t.pnl_pct):null
              const hasErr = !!t.error || t.status==='failed'
              const missingOrders = isOpen && (!t.has_sl || !t.has_tp1)

              return (
                <div key={t.id} style={{
                  borderRadius:'10px',overflow:'hidden',marginBottom:'4px',
                  border:`1px solid ${isOpen?C.border2:hasErr?'rgba(239,68,68,0.2)':C.border}`,
                  background:isOpen?'rgba(96,165,250,0.03)':C.card,
                }}>
                  {/* Row */}
                  <div className="trade-row" onClick={()=>setExpanded(isExp?null:t.id)}
                    style={{display:'grid',
                      gridTemplateColumns:'140px 52px 100px 90px 80px 80px 80px 70px 1fr 24px',
                      gap:'8px',padding:'11px 14px',cursor:'pointer',alignItems:'center'}}>

                    {/* Symbol */}
                    <div>
                      <div style={{fontSize:'13px',fontWeight:'700',letterSpacing:'-0.2px'}}>
                        {t.symbol?.replace('USDT','')}
                        <span style={{color:C.muted,fontWeight:'400',fontSize:'10px'}}>/USDT</span>
                      </div>
                      <div style={{fontSize:'9px',color:C.muted,marginTop:'1px'}}>
                        Rank {t.signal_rank} · {ago(t.created_at)}
                      </div>
                    </div>

                    {/* Direction */}
                    <span style={{padding:'2px 7px',borderRadius:'4px',fontSize:'9px',
                      fontWeight:'800',letterSpacing:'0.05em',
                      background:t.direction==='long'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',
                      color:t.direction==='long'?C.greenL:C.redL}}>
                      {t.direction?.toUpperCase()}
                    </span>

                    {/* Status */}
                    <StatusPill status={t.status}/>

                    {/* Entry */}
                    <span style={{fontFamily:MN,fontSize:'11px',color:C.muted}}>
                      {fp(t.filled_price||t.entry_price)}
                    </span>

                    {/* SL */}
                    <span style={{fontFamily:MN,fontSize:'11px',color:'#f87171'}}>
                      {fp(t.sl_price)}
                    </span>

                    {/* TP1 */}
                    <span style={{fontFamily:MN,fontSize:'11px',color:'#4ade80'}}>
                      {fp(t.tp1_price)}
                    </span>

                    {/* P&L */}
                    <span style={{fontFamily:MN,fontSize:'12px',fontWeight:'700',
                      color:pnl==null?C.muted:pnl>=0?C.greenL:C.redL}}>
                      {pnl!=null?signed(pnl):'—'}
                    </span>

                    {/* Size */}
                    <span style={{fontSize:'11px',color:C.muted}}>
                      ${parseFloat(t.size_usdt||0).toFixed(0)}
                      <span style={{fontSize:'9px',display:'block',color:C.muted,opacity:0.6}}>{t.leverage}x</span>
                    </span>

                    {/* Orders + time */}
                    <div style={{display:'flex',alignItems:'center',gap:'2px',flexWrap:'wrap'}}>
                      <OrderDot ok={!!t.has_sl}  label="SL"/>
                      <OrderDot ok={!!t.has_tp1} label="TP1"/>
                      {t.tp2_price && <OrderDot ok={!!t.has_tp2} label="TP2"/>}
                      {hasErr && (
                        <span style={{fontSize:'9px',color:C.amberL,padding:'1px 5px',
                          borderRadius:'3px',background:'rgba(251,191,36,0.08)',
                          fontWeight:'700',marginLeft:'2px'}}>!</span>
                      )}
                    </div>

                    {/* Expand chevron */}
                    <span style={{color:C.muted,fontSize:'11px',transition:'transform 0.2s',
                      transform:isExp?'rotate(180deg)':'none',textAlign:'right'}}>▾</span>
                  </div>

                  {/* Expanded */}
                  {isExp && (
                    <div style={{animation:'slideDown 0.2s ease'}}>
                      <TradeDetail t={t} events={events}/>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            PIPELINE TAB
        ═══════════════════════════════════════════════════════ */}
        {tab==='pipeline' && (
          <div>
            {/* Skip breakdown cards */}
            {Object.keys(skipBreak).length>0 && (
              <div style={{marginBottom:'18px'}}>
                <div style={{fontSize:'11px',fontWeight:'700',color:C.muted,
                  textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'10px'}}>
                  Why signals were skipped
                </div>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {Object.entries(skipBreak).sort(([,a]:any,[,b]:any)=>b-a).map(([r,c]:any)=>{
                    const m=SKIP[r]; const sev=m?.sev||'info'
                    return (
                      <div key={r} title={m?.why}
                        style={{background:C.card,border:`1px solid ${C.border}`,
                          borderRadius:'10px',padding:'12px 16px',cursor:'help',
                          minWidth:'120px',borderLeft:`3px solid ${SEV_C[sev]}`}}>
                        <div style={{fontSize:'22px',fontWeight:'800',color:SEV_C[sev],marginBottom:'3px'}}>{c}</div>
                        <div style={{fontSize:'11px',fontWeight:'600',color:SEV_C[sev]}}>{m?.short||r}</div>
                        <div style={{fontSize:'9px',color:C.muted,marginTop:'3px',lineHeight:'1.4'}}>{m?.why||''}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pipeline table */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',overflow:'hidden'}}>
              <div style={{display:'grid',
                gridTemplateColumns:'130px 52px 55px 75px 110px 1fr 80px',
                gap:'8px',padding:'8px 16px',fontSize:'9px',color:C.muted,
                textTransform:'uppercase',letterSpacing:'0.08em',
                borderBottom:`1px solid ${C.border}`}}>
                <span>Signal</span><span>Dir</span><span>Rank</span>
                <span>Result</span><span>Reason</span><span>Detail</span><span>Time</span>
              </div>
              {sigLog.map((s:any)=>{
                const sig=s.signals||{}
                const det=typeof s.detail==='string'?JSON.parse(s.detail||'{}'):(s.detail||{})
                const m=s.skip_reason?SKIP[s.skip_reason]:null
                const sev=m?.sev||'info'
                return (
                  <div key={s.id} style={{display:'grid',
                    gridTemplateColumns:'130px 52px 55px 75px 110px 1fr 80px',
                    gap:'8px',padding:'10px 16px',
                    borderBottom:`1px solid ${C.border}`,alignItems:'center',
                    background:s.triggered?'transparent':sev==='err'?'rgba(239,68,68,0.02)':'transparent'}}>
                    <div>
                      <div style={{fontSize:'12px',fontWeight:'600'}}>
                        {sig.symbol?.replace('USDT','')||'—'}
                        <span style={{color:C.muted,fontSize:'10px'}}>/USDT</span>
                      </div>
                      <div style={{fontSize:'9px',color:C.muted}}>S{sig.scenario_id} · {sig.kline_interval}</div>
                    </div>
                    <span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'9px',fontWeight:'800',
                      background:sig.direction==='long'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',
                      color:sig.direction==='long'?C.greenL:C.redL}}>
                      {sig.direction?.toUpperCase()||'—'}
                    </span>
                    <span style={{fontSize:'13px',fontWeight:'800',
                      color:sig.signal_rank==='S'?C.greenL:sig.signal_rank==='A'?C.blueL:C.amberL}}>
                      {sig.signal_rank||'—'}
                    </span>
                    <span style={{fontSize:'11px',fontWeight:'700',
                      color:s.triggered?C.greenL:C.redL}}>
                      {s.triggered?'✓ Placed':'✗ Skipped'}
                    </span>
                    <div>
                      {m ? (
                        <span title={m.why} style={{padding:'2px 7px',borderRadius:'4px',fontSize:'10px',
                          fontWeight:'600',color:SEV_C[sev],background:SEV_BG[sev],cursor:'help'}}>
                          {m.short}
                        </span>
                      ) : s.triggered ? (
                        <span style={{fontSize:'10px',color:C.greenL}}>Trade opened</span>
                      ) : '—'}
                    </div>
                    <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                      {det.balance!=null && <Tag label={`bal $${parseFloat(det.balance).toFixed(0)}`} color={C.muted} bg={C.dim}/>}
                      {det.diff_pct!=null && <Tag label={`${parseFloat(det.diff_pct).toFixed(1)}% off`} color={C.amberL} bg='rgba(251,191,36,0.08)'/>}
                      {det.open_trades!=null && <Tag label={`${det.open_trades} open`} color={C.muted} bg={C.dim}/>}
                      {det.leverage!=null && <Tag label={`${det.leverage}x`} color={C.muted} bg={C.dim}/>}
                      {det.entry_type && <Tag label={det.entry_type} color={C.blueL} bg='rgba(96,165,250,0.08)'/>}
                      {det.reason && <Tag label={det.reason.slice(0,30)} color={C.redL} bg='rgba(239,68,68,0.08)' title={det.reason}/>}
                    </div>
                    <span style={{fontSize:'10px',color:C.muted}}>{ago(s.created_at)}</span>
                  </div>
                )
              })}
              {sigLog.length===0 && (
                <div style={{padding:'50px',textAlign:'center',color:C.muted,fontSize:'13px'}}>
                  No pipeline data yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            HISTORY TAB
        ═══════════════════════════════════════════════════════ */}
        {tab==='history' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px',marginBottom:'16px'}}>
              <MiniStat label="Resolved" value={resolved.length} color={C.text}/>
              <MiniStat label="Win rate" value={wr!=null?wr+'%':'—'} color={wr!=null?(wr>=50?C.greenL:C.redL):C.muted}/>
              <MiniStat label="Avg P&L"  value={resolved.length>0?signed(totalPnl/resolved.length):'—'}
                color={totalPnl/Math.max(resolved.length,1)>=0?C.greenL:C.redL}/>
              <MiniStat label="Total P&L" value={resolved.length>0?signed(totalPnl):'—'}
                color={totalPnl>=0?C.greenL:C.redL}/>
              <MiniStat label="TP / SL / Other"
                value={`${wins.length} / ${losses.length} / ${closed.length-wins.length-losses.length}`}
                color={C.muted}/>
            </div>

            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',overflow:'hidden'}}>
              <div style={{display:'grid',
                gridTemplateColumns:'140px 52px 100px 90px 85px 75px 65px 75px 1fr',
                gap:'8px',padding:'8px 16px',fontSize:'9px',color:C.muted,
                textTransform:'uppercase',letterSpacing:'0.08em',
                borderBottom:`1px solid ${C.border}`}}>
                <span>Symbol</span><span>Dir</span><span>Outcome</span>
                <span>Entry</span><span>Exit</span><span>P&L</span>
                <span>Lev</span><span>Size</span><span>Closed</span>
              </div>
              {trades.map((t:any)=>{
                const sm=ST[t.status]||ST.failed
                const pnl=t.pnl_pct!=null?parseFloat(t.pnl_pct):null
                const isOpen=['placed','pending'].includes(t.status)
                const exit=t.status==='sl_hit'?t.sl_price:t.status==='tp1_hit'?t.tp1_price:
                           t.status==='tp2_hit'?t.tp2_price:t.status==='tp3_hit'?t.tp3_price:null
                return (
                  <div key={t.id} style={{display:'grid',
                    gridTemplateColumns:'140px 52px 100px 90px 85px 75px 65px 75px 1fr',
                    gap:'8px',padding:'10px 16px',
                    borderBottom:`1px solid ${C.border}`,alignItems:'center',
                    background:isOpen?'rgba(96,165,250,0.03)':'transparent'}}>
                    <div>
                      <div style={{fontSize:'12px',fontWeight:'600'}}>
                        {t.symbol?.replace('USDT','')}<span style={{color:C.muted,fontSize:'10px'}}>/USDT</span>
                      </div>
                      <div style={{fontSize:'9px',color:C.muted}}>Rank {t.signal_rank}</div>
                    </div>
                    <span style={{padding:'2px 6px',borderRadius:'4px',fontSize:'9px',fontWeight:'800',
                      background:t.direction==='long'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',
                      color:t.direction==='long'?C.greenL:C.redL}}>
                      {t.direction?.toUpperCase()}
                    </span>
                    <StatusPill status={t.status}/>
                    <span style={{fontFamily:MN,fontSize:'11px',color:C.muted}}>{fp(t.filled_price||t.entry_price)}</span>
                    <span style={{fontFamily:MN,fontSize:'11px',color:C.muted}}>{exit?fp(exit):'open'}</span>
                    <span style={{fontFamily:MN,fontSize:'12px',fontWeight:'700',
                      color:pnl==null?C.muted:pnl>=0?C.greenL:C.redL}}>
                      {pnl!=null?signed(pnl):'—'}
                    </span>
                    <span style={{fontSize:'11px',color:C.muted}}>{t.leverage}x</span>
                    <span style={{fontSize:'11px',color:C.muted}}>${parseFloat(t.size_usdt||0).toFixed(0)}</span>
                    <span style={{fontSize:'10px',color:C.muted}}>{ago(t.closed_at||t.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            EVENTS TAB
        ═══════════════════════════════════════════════════════ */}
        {tab==='events' && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',overflow:'hidden'}}>
            <div style={{display:'grid',
              gridTemplateColumns:'160px 90px 120px 1fr 90px',
              gap:'8px',padding:'8px 16px',fontSize:'9px',color:C.muted,
              textTransform:'uppercase',letterSpacing:'0.08em',
              borderBottom:`1px solid ${C.border}`}}>
              <span>Event</span><span>Severity</span><span>Symbol</span><span>Detail</span><span>Time</span>
            </div>
            {events.map((e:any)=>{
              const trade=trades.find(t=>t.id===e.trade_id)
              const det=typeof e.detail==='string'?JSON.parse(e.detail||'{}'):(e.detail||{})
              const ec={ok:C.greenL,warning:C.amberL,error:C.redL,critical:'#f87171'}[e.status]||C.muted
              const ebg={ok:'rgba(34,197,94,0.06)',warning:'rgba(251,191,36,0.06)',
                error:'rgba(239,68,68,0.05)',critical:'rgba(248,113,113,0.07)'}[e.status]||'transparent'
              return (
                <div key={e.id} style={{display:'grid',
                  gridTemplateColumns:'160px 90px 120px 1fr 90px',
                  gap:'8px',padding:'9px 16px',
                  borderBottom:`1px solid ${C.border}`,
                  alignItems:'center',background:ebg}}>
                  <span style={{fontSize:'11px',fontWeight:'700',color:ec}}>
                    {e.status==='critical'&&'🚨 '}{e.status==='error'&&'⚠ '}
                    {e.event_type?.replace(/_/g,' ')}
                  </span>
                  <span style={{padding:'2px 8px',borderRadius:'12px',fontSize:'10px',
                    fontWeight:'600',background:`${ec}18`,color:ec}}>{e.status}</span>
                  <span style={{fontSize:'11px',color:C.muted}}>
                    {trade?.symbol?.replace('USDT','')||'—'}
                    {trade&&<span style={{fontSize:'9px',opacity:.6}}> {trade.direction}</span>}
                  </span>
                  <div style={{fontSize:'10px',color:C.muted,display:'flex',gap:'6px',
                    flexWrap:'wrap',alignItems:'center'}}>
                    {det.order_id&&<span style={{fontFamily:MN,color:C.blueL}}>#{String(det.order_id).slice(-8)}</span>}
                    {det.price&&<span>@ {fp(det.price)}</span>}
                    {det.pnl_pct!=null&&<span style={{color:parseFloat(det.pnl_pct)>=0?C.greenL:C.redL}}>{signed(det.pnl_pct)}</span>}
                    {det.reason&&<Tag label={det.reason.slice(0,40)} color={C.redL} bg='rgba(239,68,68,0.08)' title={det.reason}/>}
                    {det.action&&<Tag label={det.action} color={C.muted} bg={C.dim}/>}
                    {det.orders_cancelled!=null&&<span>{det.orders_cancelled} orders cancelled</span>}
                    {det.message&&<span style={{fontFamily:MN,fontSize:'9px',color:C.redL}}>{String(det.message).slice(0,80)}</span>}
                  </div>
                  <span style={{fontSize:'10px',color:C.muted}}>{ago(e.created_at)}</span>
                </div>
              )
            })}
            {events.length===0&&<div style={{padding:'50px',textAlign:'center',color:C.muted,fontSize:'13px'}}>No events logged yet</div>}
          </div>
        )}
      </div>
    </div>
  )
}
