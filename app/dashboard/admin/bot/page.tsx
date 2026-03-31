'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const MN = "'SF Mono','Fira Code',monospace"

// ── Helpers ────────────────────────────────────────────────────────────────
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
  const v = parseFloat(n)
  if (isNaN(v)) return '—'
  if (v >= 1000) return '$' + v.toLocaleString(undefined,{maximumFractionDigits:0})
  if (v >= 100)  return '$' + v.toFixed(2)
  if (v >= 1)    return '$' + v.toFixed(3)
  if (v >= 0.01) return '$' + v.toFixed(5)
  return '$' + v.toFixed(7)
}
function pct(n: any) {
  if (n == null) return '—'
  const v = parseFloat(n)
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%'
}

const STATUS: Record<string,{c:string;bg:string;label:string}> = {
  pending:  {c:'#f59e0b',bg:'rgba(245,158,11,0.12)', label:'Pending'},
  placed:   {c:'#3b82f6',bg:'rgba(59,130,246,0.12)', label:'Open'},
  tp1_hit:  {c:'#22c55e',bg:'rgba(34,197,94,0.12)',  label:'TP1 ✓'},
  tp2_hit:  {c:'#22c55e',bg:'rgba(34,197,94,0.18)',  label:'TP2 ✓'},
  tp3_hit:  {c:'#22c55e',bg:'rgba(34,197,94,0.24)',  label:'TP3 ✓'},
  sl_hit:   {c:'#ef4444',bg:'rgba(239,68,68,0.12)',  label:'SL Hit'},
  closed:   {c:'#8b90a8',bg:'rgba(139,144,168,0.1)', label:'Closed'},
  cancelled:{c:'#555870',bg:'rgba(85,88,112,0.1)',   label:'Cancelled'},
  failed:   {c:'#ef4444',bg:'rgba(239,68,68,0.12)',  label:'Failed'},
}

const EV_STATUS: Record<string,string> = {
  ok:'#22c55e', warning:'#f59e0b', error:'#ef4444', critical:'#dc2626'
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Badge({status}:{status:string}) {
  const s = STATUS[status] || STATUS.failed
  return <span style={{padding:'2px 8px',borderRadius:'4px',fontSize:'10px',fontWeight:'700',background:s.bg,color:s.c}}>{s.label}</span>
}

function OrderDot({ok, label}:{ok:boolean,label:string}) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
      <span style={{width:'7px',height:'7px',borderRadius:'50%',background:ok?'#22c55e':'#ef4444',flexShrink:0}}/>
      <span style={{fontSize:'10px',color:ok?'#22c55e':'#ef4444'}}>{label}</span>
    </div>
  )
}

function Tab({label,active,count,warn,onClick}:{label:string,active:boolean,count?:number,warn?:boolean,onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{
      padding:'8px 16px',border:'none',cursor:'pointer',fontFamily:F,
      fontSize:'13px',fontWeight:active?'600':'400',
      color:active?'#e8eaf2':'#555870',
      borderBottom:`2px solid ${active?'#3b82f6':'transparent'}`,
      background:'transparent',display:'flex',alignItems:'center',gap:'6px',
      transition:'all 0.15s',
    }}>
      {label}
      {count != null && <span style={{padding:'1px 6px',borderRadius:'10px',fontSize:'10px',fontWeight:'700',
        background:warn?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.08)',
        color:warn?'#ef4444':'#8b90a8'}}>{count}</span>}
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function BotPage() {
  const [tab,     setTab]     = useState<'active'|'pipeline'|'history'|'events'>('active')
  const [trades,  setTrades]  = useState<any[]>([])
  const [sigLog,  setSigLog]  = useState<any[]>([])
  const [events,  setEvents]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded,setExpanded]= useState<string|null>(null)
  const [refresh, setRefresh] = useState(0)

  const load = useCallback(async () => {
    const sb = createClient()
    const [tr, sl, ev] = await Promise.all([
      sb.from('bot_trades').select('*').order('created_at',{ascending:false}).limit(200),
      sb.from('signal_trade_log').select('*,signals(symbol,signal_rank,scenario_id,direction,price_at_signal,created_at)').order('created_at',{ascending:false}).limit(100),
      sb.from('bot_trade_events').select('*').order('created_at',{ascending:false}).limit(500),
    ])
    setTrades(tr.data || [])
    setSigLog(sl.data || [])
    setEvents(ev.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refresh])
  useEffect(() => {
    const t = setInterval(() => setRefresh(r=>r+1), 30000)
    return () => clearInterval(t)
  }, [])

  // ── Stats ──────────────────────────────────────────────────────────────
  const open      = trades.filter(t=>t.status==='placed')
  const wins      = trades.filter(t=>t.status?.includes('tp'))
  const losses    = trades.filter(t=>t.status==='sl_hit')
  const failed    = trades.filter(t=>['failed','cancelled'].includes(t.status))
  const warnings  = trades.filter(t=>t.error && ['placed','pending'].includes(t.status))
  const resolved  = trades.filter(t=>!['placed','pending','failed','cancelled'].includes(t.status))
  const totalPnl  = resolved.reduce((a,t)=>a+parseFloat(t.pnl_pct||0),0)
  const critEvents= events.filter(e=>e.status==='critical')

  const TABS = [
    {id:'active',   label:'Active Trades',     count:open.length,   warn:warnings.length>0},
    {id:'pipeline', label:'Signal Pipeline',   count:sigLog.length},
    {id:'history',  label:'Trade History',     count:resolved.length},
    {id:'events',   label:'Event Log',         count:critEvents.length, warn:critEvents.length>0},
  ] as const

  if (loading) return <div style={{padding:'40px',color:'#555870',fontFamily:F}}>Loading…</div>

  return (
    <div style={{fontFamily:F,minHeight:'100vh'}}>

      {/* Header */}
      <div style={{padding:'20px 24px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
          <div>
            <h1 style={{fontSize:'18px',fontWeight:'700',color:'#e8eaf2',marginBottom:'3px'}}>Trade Bot</h1>
            <p style={{fontSize:'12px',color:'#555870'}}>Full lifecycle monitoring · refreshes every 30s</p>
          </div>
          <button onClick={()=>setRefresh(r=>r+1)} style={{
            padding:'6px 14px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',
            borderRadius:'7px',color:'#60a5fa',fontSize:'12px',cursor:'pointer',fontFamily:F,
          }}>↻ Refresh</button>
        </div>

        {/* Summary strip */}
        <div style={{display:'flex',gap:'16px',marginBottom:'16px',flexWrap:'wrap'}}>
          {[
            {l:'Open',  v:open.length,         c:'#3b82f6'},
            {l:'Wins',  v:wins.length,          c:'#22c55e'},
            {l:'Losses',v:losses.length,        c:'#ef4444'},
            {l:'Failed',v:failed.length,        c:'#f59e0b'},
            {l:'⚠ Warnings',v:warnings.length,  c:'#f59e0b'},
            {l:'🚨 Critical',v:critEvents.length,c:'#dc2626'},
            {l:'Total P&L',v:pct(totalPnl),    c:totalPnl>=0?'#22c55e':'#ef4444'},
          ].map(s=>(
            <div key={s.l} style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'8px',padding:'10px 14px',minWidth:'80px'}}>
              <div style={{fontSize:'9px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'4px'}}>{s.l}</div>
              <div style={{fontSize:'18px',fontWeight:'800',color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:'0'}}>
          {TABS.map(t=>(
            <Tab key={t.id} label={t.label} active={tab===t.id}
              count={t.count} warn={(t as any).warn} onClick={()=>setTab(t.id as any)}/>
          ))}
        </div>
      </div>

      <div style={{padding:'20px 24px'}}>

        {/* ── ACTIVE TRADES ─────────────────────────────────────────── */}
        {tab==='active' && (
          <div>
            {warnings.length > 0 && (
              <div style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'8px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:'#f59e0b'}}>
                ⚠ {warnings.length} open trade{warnings.length>1?'s':''} have warnings — check order status below
              </div>
            )}
            {critEvents.filter(e=>new Date(e.created_at).getTime()>Date.now()-3600000).length>0 && (
              <div style={{background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'8px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:'#dc2626'}}>
                🚨 Critical events in the last hour — check Event Log
              </div>
            )}

            {open.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px',color:'#555870'}}>
                <div style={{fontSize:'32px',marginBottom:'12px'}}>📭</div>
                <div style={{fontSize:'14px'}}>No open trades</div>
              </div>
            ) : open.map(t => {
              const isExp = expanded === t.id
              const tradeEvents = events.filter(e=>e.trade_id===t.id)
              const hasWarn = !!t.error
              return (
                <div key={t.id} style={{marginBottom:'10px',background:'#111420',border:`1px solid ${hasWarn?'rgba(245,158,11,0.25)':'rgba(255,255,255,0.07)'}`,borderRadius:'12px',overflow:'hidden'}}>
                  {/* Trade header */}
                  <div onClick={()=>setExpanded(isExp?null:t.id)} style={{
                    display:'grid',gridTemplateColumns:'120px 60px 90px 80px 80px 80px 80px 1fr 80px',
                    gap:'8px',padding:'12px 16px',cursor:'pointer',alignItems:'center',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <div>
                      <div style={{fontSize:'14px',fontWeight:'700',color:'#e8eaf2'}}>{t.symbol?.replace('USDT','')}<span style={{color:'#555870',fontWeight:'400',fontSize:'11px'}}>/USDT</span></div>
                      <div style={{fontSize:'10px',color:'#555870'}}>{ago(t.created_at)}</div>
                    </div>
                    <span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'9px',fontWeight:'800',
                      background:t.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
                      color:t.direction==='long'?'#22c55e':'#ef4444'}}>
                      {t.direction?.toUpperCase()}
                    </span>
                    <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
                      <OrderDot ok={!!t.has_sl}  label="SL" />
                      <OrderDot ok={!!t.has_tp1} label="TP1"/>
                      {t.tp2_price && <OrderDot ok={!!t.has_tp2} label="TP2"/>}
                    </div>
                    <span style={{fontFamily:MN,fontSize:'11px',color:'#8b90a8'}}>{fp(t.entry_price)}</span>
                    <span style={{fontFamily:MN,fontSize:'11px',color:'#ef4444'}}>{fp(t.sl_price)}</span>
                    <span style={{fontFamily:MN,fontSize:'11px',color:'#22c55e'}}>{fp(t.tp1_price)}</span>
                    <span style={{fontFamily:MN,fontSize:'11px',color:'#60a5fa'}}>{fp(t.tp2_price)}</span>
                    <div>
                      {t.error && <div style={{fontSize:'10px',color:'#f59e0b'}}>⚠ {t.error}</div>}
                      {t.breakeven_set && <div style={{fontSize:'10px',color:'#22c55e'}}>✓ BE set</div>}
                      <div style={{fontSize:'10px',color:'#555870'}}>{t.recovery_attempts>0?`${t.recovery_attempts} recovery attempts`:''}</div>
                    </div>
                    <div style={{fontSize:'11px',color:'#555870',textAlign:'right'}}>
                      ${parseFloat(t.size_usdt||0).toFixed(0)} · {t.leverage}x
                      <div style={{fontSize:'10px'}}>{t.signal_rank} rank</div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div style={{padding:'0 16px 16px',borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px',marginTop:'12px'}}>

                        {/* Order IDs */}
                        <div style={{background:'#0d1018',borderRadius:'8px',padding:'12px'}}>
                          <div style={{fontSize:'10px',color:'#555870',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Order IDs</div>
                          {[
                            ['Entry', t.order_id,    true],
                            ['SL',    t.sl_order_id, t.has_sl],
                            ['TP1',   t.tp1_order_id,t.has_tp1],
                            ['TP2',   t.tp2_order_id,t.has_tp2],
                            ['TP3',   t.tp3_order_id,t.has_tp3],
                          ].map(([l,id,ok]) => (
                            <div key={l as string} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'}}>
                              <span style={{fontSize:'11px',color:'#555870'}}>{l as string}</span>
                              <span style={{fontFamily:MN,fontSize:'10px',color:ok?'#60a5fa':'#ef4444'}}>
                                {id ? '#'+(id as string).slice(-10) : '✗ missing'}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Price levels */}
                        <div style={{background:'#0d1018',borderRadius:'8px',padding:'12px'}}>
                          <div style={{fontSize:'10px',color:'#555870',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Levels</div>
                          {[
                            ['Entry',      t.entry_price,  '#8b90a8'],
                            ['Filled @',   t.filled_price, '#60a5fa'],
                            ['Stop Loss',  t.sl_price,     '#ef4444'],
                            ['TP1',        t.tp1_price,    '#22c55e'],
                            ['TP2',        t.tp2_price,    '#22c55e'],
                            ['TP3',        t.tp3_price,    '#22c55e'],
                          ].filter(([,v])=>v).map(([l,v,c])=>(
                            <div key={l as string} style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                              <span style={{fontSize:'11px',color:'#555870'}}>{l as string}</span>
                              <span style={{fontFamily:MN,fontSize:'11px',color:c as string}}>{fp(v)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Event timeline */}
                        <div style={{background:'#0d1018',borderRadius:'8px',padding:'12px',maxHeight:'200px',overflowY:'auto'}}>
                          <div style={{fontSize:'10px',color:'#555870',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Events ({tradeEvents.length})</div>
                          {tradeEvents.map(e=>(
                            <div key={e.id} style={{marginBottom:'6px',paddingBottom:'6px',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <span style={{fontSize:'10px',fontWeight:'600',color:EV_STATUS[e.status]||'#8b90a8'}}>
                                  {e.event_type?.replace(/_/g,' ')}
                                </span>
                                <span style={{fontSize:'9px',color:'#555870'}}>{ago(e.created_at)}</span>
                              </div>
                            </div>
                          ))}
                          {tradeEvents.length===0 && <div style={{fontSize:'11px',color:'#555870'}}>No events yet</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── SIGNAL PIPELINE ───────────────────────────────────────── */}
        {tab==='pipeline' && (
          <div>
            <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'140px 60px 60px 80px 100px 1fr 100px',
                gap:'8px',padding:'8px 16px',fontSize:'10px',color:'#555870',
                textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                <span>Signal</span><span>Dir</span><span>Rank</span><span>Fired?</span><span>Skip Reason</span><span>Detail</span><span>Time</span>
              </div>
              {sigLog.map(s=>{
                const sig = s.signals
                const detail = s.detail || {}
                return (
                  <div key={s.id} style={{
                    display:'grid',gridTemplateColumns:'140px 60px 60px 80px 100px 1fr 100px',
                    gap:'8px',padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',
                    alignItems:'center',
                    background:s.triggered?'transparent':'rgba(239,68,68,0.02)',
                  }}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:'600',color:'#e8eaf2'}}>{sig?.symbol?.replace('USDT','')||'—'}<span style={{color:'#555870',fontSize:'10px'}}>/USDT</span></div>
                      <div style={{fontSize:'10px',color:'#555870'}}>S{sig?.scenario_id}</div>
                    </div>
                    <span style={{padding:'2px 5px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',
                      background:sig?.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
                      color:sig?.direction==='long'?'#22c55e':'#ef4444'}}>
                      {sig?.direction?.toUpperCase()||'—'}
                    </span>
                    <span style={{fontSize:'12px',fontWeight:'700',color:'#f59e0b'}}>{sig?.signal_rank||'—'}</span>
                    <span style={{fontSize:'12px',fontWeight:'700',
                      color:s.triggered?'#22c55e':'#ef4444'}}>
                      {s.triggered ? '✓ Yes' : '✗ No'}
                    </span>
                    <span style={{fontSize:'10px',color:'#f59e0b',
                      padding:s.skip_reason?'2px 6px':'0',borderRadius:'4px',
                      background:s.skip_reason?'rgba(245,158,11,0.1)':'transparent'}}>
                      {s.skip_reason?.replace(/_/g,' ')||'—'}
                    </span>
                    <div style={{fontSize:'10px',color:'#555870',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {detail.balance!=null && `bal:$${parseFloat(detail.balance).toFixed(1)} `}
                      {detail.diff_pct!=null && `diff:${parseFloat(detail.diff_pct).toFixed(1)}% `}
                      {detail.open_trades!=null && `open:${detail.open_trades} `}
                      {detail.leverage!=null && `lev:${detail.leverage}x `}
                    </div>
                    <span style={{fontSize:'10px',color:'#555870'}}>{ago(s.created_at)}</span>
                  </div>
                )
              })}
              {sigLog.length===0&&<div style={{padding:'40px',textAlign:'center',color:'#555870',fontSize:'13px'}}>No pipeline data yet</div>}
            </div>
          </div>
        )}

        {/* ── TRADE HISTORY ─────────────────────────────────────────── */}
        {tab==='history' && (
          <div>
            {/* P&L summary */}
            {resolved.length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'16px'}}>
                {[
                  {l:'Trades',    v:resolved.length,         c:'#e8eaf2'},
                  {l:'Win Rate',  v:resolved.length?Math.round(wins.filter(w=>resolved.includes(w)).length/resolved.length*100)+'%':'—', c:'#22c55e'},
                  {l:'Total P&L', v:pct(totalPnl),           c:totalPnl>=0?'#22c55e':'#ef4444'},
                  {l:'Avg P&L',   v:pct(totalPnl/Math.max(resolved.length,1)), c:totalPnl/Math.max(resolved.length,1)>=0?'#22c55e':'#ef4444'},
                ].map(s=>(
                  <div key={s.l} style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'14px 16px'}}>
                    <div style={{fontSize:'10px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'6px'}}>{s.l}</div>
                    <div style={{fontSize:'20px',fontWeight:'800',color:s.c}}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{display:'grid',gridTemplateColumns:'130px 60px 80px 80px 80px 80px 70px 80px 1fr',
                gap:'8px',padding:'8px 16px',fontSize:'10px',color:'#555870',
                textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                <span>Symbol</span><span>Dir</span><span>Status</span><span>Entry</span>
                <span>Exit ~</span><span>P&L</span><span>Lev</span><span>Size</span><span>Closed</span>
              </div>
              {trades.filter(t=>!['placed','pending'].includes(t.status)).map(t=>(
                <div key={t.id} style={{
                  display:'grid',gridTemplateColumns:'130px 60px 80px 80px 80px 80px 70px 80px 1fr',
                  gap:'8px',padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',
                  alignItems:'center',
                }}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'600',color:'#e8eaf2'}}>{t.symbol?.replace('USDT','')}<span style={{color:'#555870',fontSize:'10px'}}>/USDT</span></div>
                    <div style={{fontSize:'10px',color:'#555870'}}>{t.signal_rank} · S{t.scenario_id||'?'}</div>
                  </div>
                  <span style={{padding:'2px 5px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',
                    background:t.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
                    color:t.direction==='long'?'#22c55e':'#ef4444'}}>
                    {t.direction?.toUpperCase()}
                  </span>
                  <Badge status={t.status}/>
                  <span style={{fontFamily:MN,fontSize:'11px',color:'#8b90a8'}}>{fp(t.filled_price||t.entry_price)}</span>
                  <span style={{fontFamily:MN,fontSize:'11px',color:'#8b90a8'}}>
                    {t.status==='sl_hit'?fp(t.sl_price):t.status==='tp1_hit'?fp(t.tp1_price):t.status==='tp2_hit'?fp(t.tp2_price):t.status==='tp3_hit'?fp(t.tp3_price):'—'}
                  </span>
                  <span style={{fontSize:'13px',fontWeight:'700',color:parseFloat(t.pnl_pct||0)>=0?'#22c55e':'#ef4444'}}>
                    {t.pnl_pct!=null?pct(t.pnl_pct):'—'}
                  </span>
                  <span style={{fontSize:'11px',color:'#8b90a8'}}>{t.leverage}x</span>
                  <span style={{fontSize:'11px',color:'#8b90a8'}}>${parseFloat(t.size_usdt||0).toFixed(0)}</span>
                  <span style={{fontSize:'10px',color:'#555870'}}>{ago(t.closed_at||t.created_at)}</span>
                </div>
              ))}
              {resolved.length===0&&<div style={{padding:'40px',textAlign:'center',color:'#555870',fontSize:'13px'}}>No completed trades yet</div>}
            </div>
          </div>
        )}

        {/* ── EVENT LOG ─────────────────────────────────────────────── */}
        {tab==='events' && (
          <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'140px 100px 120px 1fr 100px',
              gap:'8px',padding:'8px 16px',fontSize:'10px',color:'#555870',
              textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <span>Event</span><span>Status</span><span>Trade</span><span>Detail</span><span>Time</span>
            </div>
            {events.map(e=>{
              const trade = trades.find(t=>t.id===e.trade_id)
              const detail = e.detail || {}
              return (
                <div key={e.id} style={{
                  display:'grid',gridTemplateColumns:'140px 100px 120px 1fr 100px',
                  gap:'8px',padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',
                  alignItems:'center',
                  background:e.status==='critical'?'rgba(220,38,38,0.05)':e.status==='error'?'rgba(239,68,68,0.03)':'transparent',
                }}>
                  <span style={{fontSize:'11px',fontWeight:'600',color:EV_STATUS[e.status]||'#8b90a8'}}>
                    {e.status==='critical'&&'🚨 '}{e.status==='error'&&'⚠ '}
                    {e.event_type?.replace(/_/g,' ')}
                  </span>
                  <span style={{padding:'1px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:'600',
                    background:`${EV_STATUS[e.status]||'#8b90a8'}18`,color:EV_STATUS[e.status]||'#8b90a8'}}>
                    {e.status}
                  </span>
                  <span style={{fontSize:'11px',color:'#555870',fontFamily:MN}}>
                    {trade?.symbol?.replace('USDT','')||'—'}
                  </span>
                  <div style={{fontSize:'10px',color:'#555870',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {detail.order_id&&`#${String(detail.order_id).slice(-8)} `}
                    {detail.price&&`@ ${fp(detail.price)} `}
                    {detail.pnl_pct!=null&&`P&L:${pct(detail.pnl_pct)} `}
                    {detail.reason&&`reason:${detail.reason} `}
                    {detail.message&&`${detail.message}`}
                    {detail.orders_cancelled!=null&&`cancelled ${detail.orders_cancelled} orders`}
                    {detail.action&&`action:${detail.action}`}
                  </div>
                  <span style={{fontSize:'10px',color:'#555870'}}>{ago(e.created_at)}</span>
                </div>
              )
            })}
            {events.length===0&&<div style={{padding:'40px',textAlign:'center',color:'#555870',fontSize:'13px'}}>No events yet</div>}
          </div>
        )}

      </div>
    </div>
  )
}
