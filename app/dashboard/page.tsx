'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return `${Math.floor(m/1440)}d ago`
}

function fp(n: number | null) {
  if (!n) return '—'
  if (n >= 1000) return '$' + n.toLocaleString(undefined, {maximumFractionDigits:0})
  if (n >= 100)  return '$' + n.toFixed(2)
  if (n >= 1)    return '$' + n.toFixed(3)
  if (n >= 0.01) return '$' + n.toFixed(5)
  return '$' + n.toFixed(7)
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return 'scanning...'
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2,'0')}`
}

export default function DashboardPage() {
  const [user,        setUser]        = useState<any>(null)
  const [config,      setConfig]      = useState<any>(null)
  const [signals,     setSignals]     = useState<any[]>([])
  const [outcomes,    setOutcomes]    = useState<any[]>([])
  const [userCount,   setUserCount]   = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [countdown,   setCountdown]   = useState<number>(0)
  const [notifPerm,   setNotifPerm]   = useState<NotificationPermission>('default')
  const [newSigFlash, setNewSigFlash] = useState(false)

  const prevSignalIds = useRef<Set<string>>(new Set())
  const configRef     = useRef<any>(null)
  const notifRef      = useRef<NotificationPermission>('default')

  // Keep notifRef in sync
  useEffect(() => { notifRef.current = notifPerm }, [notifPerm])

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async (supabase: any, isFirstLoad = false) => {
    const [sigs, cfg, outs] = await Promise.all([
      supabase.from('signals').select('*')
        .eq('status','active').neq('direction','watch')
        .order('created_at',{ascending:false}).limit(10),
      supabase.from('scanner_config').select('*').single(),
      supabase.from('signal_outcomes').select('outcome, pnl_pct, resolved_at')
        .gte('resolved_at', new Date(Date.now() - 7*86400000).toISOString()),
    ])

    const newSignals: any[] = sigs.data || []
    const newConfig = cfg.data

    // Detect brand-new signals for notification
    if (!isFirstLoad && newSignals.length > 0) {
      const newOnes = newSignals.filter((s:any) => !prevSignalIds.current.has(s.id))
      if (newOnes.length > 0) {
        setNewSigFlash(true)
        setTimeout(() => setNewSigFlash(false), 3000)
        if (notifRef.current === 'granted') {
          newOnes.forEach((s: any) => {
            try {
              new Notification(`IntelliCoin · Rank ${s.signal_rank} Signal`, {
                body: `${s.symbol} ${s.direction?.toUpperCase()} · ${SCENARIO[s.scenario_id] || ''} · ${fp(s.price_at_signal)}`,
                icon: '/favicon.ico',
                tag: s.id,
              })
            } catch(e) {}
          })
        }
      }
    }

    prevSignalIds.current = new Set(newSignals.map((s:any) => s.id))
    setSignals(newSignals)
    setOutcomes(outs.data || [])
    setConfig(newConfig)
    configRef.current = newConfig
    setLastRefresh(new Date())
    if (isFirstLoad) setLoading(false)
  }, [])

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return
      const [profile, users] = await Promise.all([
        supabase.from('users').select('*').eq('id', au.id).single(),
        supabase.from('users').select('id', {count:'exact'}),
      ])
      setUser(profile.data)
      setUserCount(users.count || 0)
      await loadData(supabase, true)
    }
    init()

    // Check notification permission
    if (typeof Notification !== 'undefined') {
      setNotifPerm(Notification.permission)
    }

    // Auto-refresh every 60s
    const refreshTimer = setInterval(() => {
      const supabaseInner = createClient()
      loadData(supabaseInner)
    }, 60000)

    return () => clearInterval(refreshTimer)
  }, [loadData])

  // ── Countdown ticker (every second) ────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const cfg = configRef.current
      if (!cfg?.last_scan_at) return
      const interval = (cfg.scan_interval_minutes || 15) * 60000
      const nextScan = new Date(cfg.last_scan_at).getTime() + interval
      setCountdown(Math.max(0, nextScan - Date.now()))
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  // ── Request desktop notification permission ─────────────────────────────────
  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    notifRef.current = perm
  }

  const isAdmin    = user?.role === 'admin'
  const resolved   = outcomes.filter(o => o.outcome !== 'expired')
  const wins       = resolved.filter(o => o.outcome?.includes('tp'))
  const winRate    = resolved.length > 0 ? Math.round(wins.length/resolved.length*100) : null
  const totalPnl   = resolved.reduce((a,o) => a+(parseFloat(o.pnl_pct)||0), 0)
  const rankCounts = {
    S: signals.filter(s=>s.signal_rank==='S').length,
    A: signals.filter(s=>s.signal_rank==='A').length,
    B: signals.filter(s=>s.signal_rank==='B').length,
    C: signals.filter(s=>s.signal_rank==='C').length,
  }
  const scanInterval  = config?.scan_interval_minutes || 15
  const lastScanAt    = config?.last_scan_at ? new Date(config.last_scan_at) : null
  const countdownPct  = scanInterval > 0
    ? Math.min(100, ((scanInterval*60000 - countdown) / (scanInterval*60000)) * 100)
    : 0

  if (loading) return (
    <div style={{padding:'40px', color:'#555870', fontFamily:F}}>Loading…</div>
  )

  return (
    <div style={{padding:'24px', fontFamily:F}}>

      {/* Header */}
      <div style={{marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px'}}>
            Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}{user?.full_name?`, ${user.full_name.split(' ')[0]}`:''}
          </h1>
          <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#555870', flexWrap:'wrap'}}>
            <span style={{width:'6px',height:'6px',borderRadius:'50%',background:config?.scanner_enabled?'#22c55e':'#555870',display:'inline-block',boxShadow:config?.scanner_enabled?'0 0 6px #22c55e':'none',flexShrink:0}}/>
            <span>{config?.scanner_enabled?`Scanner active · last ran ${lastScanAt?timeAgo(lastScanAt.toISOString()):'never'}`:'Scanner inactive'}</span>
            {config?.kline_interval&&<span style={{padding:'1px 6px',borderRadius:'4px',background:'rgba(59,130,246,0.1)',color:'#60a5fa',fontSize:'10px',fontWeight:'600'}}>{config.kline_interval} candles</span>}
            <span style={{color:'#2a2d3e',fontSize:'10px'}}>· refreshed {timeAgo(lastRefresh.toISOString())}</span>
          </div>
        </div>

        {/* Notification toggle */}
        <button onClick={requestNotifPermission} title="Desktop signal notifications" style={{
          background:notifPerm==='granted'?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.04)',
          border:`1px solid ${notifPerm==='granted'?'rgba(34,197,94,0.3)':'rgba(255,255,255,0.08)'}`,
          borderRadius:'8px',padding:'6px 12px',cursor:notifPerm==='denied'?'not-allowed':'pointer',
          color:notifPerm==='granted'?'#22c55e':'#555870',
          fontSize:'11px',fontWeight:'600',display:'flex',alignItems:'center',gap:'6px',fontFamily:F,
        }}>
          <span>{notifPerm==='granted'?'🔔':'🔕'}</span>
          <span>{notifPerm==='granted'?'Alerts on':notifPerm==='denied'?'Blocked':'Enable alerts'}</span>
        </button>
      </div>

      {/* Stat cards */}
      <div style={{display:'grid',gridTemplateColumns:`repeat(${isAdmin?5:4},1fr)`,gap:'10px',marginBottom:'20px'}}>

        {/* Active signals */}
        <div style={{
          background:newSigFlash?'rgba(34,197,94,0.08)':'#111420',
          border:`1px solid ${newSigFlash?'rgba(34,197,94,0.4)':'rgba(255,255,255,0.07)'}`,
          borderRadius:'12px',padding:'16px 18px',transition:'background 0.6s,border-color 0.6s',
        }}>
          <div style={{fontSize:'10px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px'}}>Active signals</div>
          <div style={{fontSize:'26px',fontWeight:'800',color:'#e8eaf2',letterSpacing:'-0.5px',marginBottom:'6px'}}>{signals.length}</div>
          <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
            {(['S','A','B','C'] as const).filter(r=>rankCounts[r]>0).map(r=>(
              <span key={r} style={{padding:'1px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:'700',background:RANK_META[r].bg,color:RANK_META[r].text}}>{r}: {rankCounts[r]}</span>
            ))}
          </div>
        </div>

        {/* Win rate */}
        <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'16px 18px'}}>
          <div style={{fontSize:'10px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px'}}>Win rate (7d)</div>
          <div style={{fontSize:'26px',fontWeight:'800',letterSpacing:'-0.5px',marginBottom:'4px',color:winRate===null?'#555870':winRate>=60?'#22c55e':winRate>=40?'#f59e0b':'#ef4444'}}>
            {winRate!==null?winRate+'%':'—'}
          </div>
          <div style={{fontSize:'11px',color:'#555870'}}>{wins.length}W · {resolved.length-wins.length}L · {resolved.length} total</div>
        </div>

        {/* P&L */}
        <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'16px 18px'}}>
          <div style={{fontSize:'10px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px'}}>Total P&L (7d)</div>
          <div style={{fontSize:'26px',fontWeight:'800',letterSpacing:'-0.5px',marginBottom:'4px',color:totalPnl>=0?'#22c55e':'#ef4444'}}>
            {resolved.length>0?(totalPnl>0?'+':'')+totalPnl.toFixed(2)+'%':'—'}
          </div>
          <div style={{fontSize:'11px',color:'#555870'}}>across {resolved.length} resolved trades</div>
        </div>

        {/* Countdown */}
        <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'16px 18px'}}>
          <div style={{fontSize:'10px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px'}}>Next scan</div>
          <div style={{fontSize:'26px',fontWeight:'800',letterSpacing:'-0.5px',marginBottom:'6px',color:countdown<60000?'#22c55e':'#e8eaf2',fontVariantNumeric:'tabular-nums'}}>
            {fmtCountdown(countdown)}
          </div>
          <div style={{height:'3px',background:'rgba(255,255,255,0.06)',borderRadius:'2px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${countdownPct}%`,background:countdown<60000?'#22c55e':'#3b82f6',borderRadius:'2px',transition:'width 1s linear'}}/>
          </div>
          <div style={{fontSize:'10px',color:'#555870',marginTop:'5px'}}>every {scanInterval}min · {config?.kline_interval||'1h'} TF</div>
        </div>

        {/* Admin users */}
        {isAdmin&&(
          <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'16px 18px'}}>
            <div style={{fontSize:'10px',color:'#555870',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px'}}>Users</div>
            <div style={{fontSize:'26px',fontWeight:'800',color:'#60a5fa',letterSpacing:'-0.5px',marginBottom:'4px'}}>{userCount}</div>
            <div style={{fontSize:'11px',color:'#555870'}}>registered members</div>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:'14px'}}>

        {/* Signals list */}
        <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:'#e8eaf2'}}>Active signals</span>
              <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#22c55e',display:'inline-block',animation:'pulse 2s infinite'}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{fontSize:'10px',color:'#2a2d3e'}}>refreshes every 60s</span>
              <Link href="/dashboard/signals" style={{fontSize:'11px',color:'#3b82f6',textDecoration:'none'}}>View all →</Link>
            </div>
          </div>

          {signals.length===0?(
            <div style={{padding:'50px 20px',textAlign:'center'}}>
              <div style={{fontSize:'28px',marginBottom:'10px'}}>📡</div>
              <p style={{color:'#555870',fontSize:'13px'}}>No active signals — scanner runs every {scanInterval} minutes</p>
            </div>
          ):signals.map(s=>{
            const rm=RANK_META[s.signal_rank as keyof typeof RANK_META]||RANK_META.B
            return(
              <div key={s.id} style={{display:'grid',gridTemplateColumns:'60px 100px 1fr 50px 50px 70px',gap:'8px',padding:'10px 18px',borderBottom:'1px solid rgba(255,255,255,0.04)',alignItems:'center',cursor:'pointer'}}
                onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
              >
                <span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'9px',fontWeight:'700',background:s.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',color:s.direction==='long'?'#22c55e':'#ef4444',textAlign:'center'}}>{s.direction?.toUpperCase()}</span>
                <div>
                  <span style={{fontSize:'13px',fontWeight:'700',color:'#e8eaf2'}}>{s.symbol?.replace('USDT','')}</span>
                  <span style={{fontSize:'11px',color:'#555870'}}>/USDT</span>
                </div>
                <span style={{fontSize:'11px',color:'#555870',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>S{s.scenario_id} · {SCENARIO[s.scenario_id]}</span>
                <span style={{padding:'2px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:'700',background:rm.bg,color:rm.text,textAlign:'center'}}>{s.signal_rank}</span>
                <span style={{fontSize:'11px',color:'#8b90a8',textAlign:'right'}}>{fp(s.price_at_signal)}</span>
                <span style={{fontSize:'10px',color:'#555870',textAlign:'right'}}>{timeAgo(s.created_at)}</span>
              </div>
            )
          })}
        </div>

        {/* Right column */}
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>

          {/* Scanner status */}
          <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'14px 16px'}}>
            <div style={{fontSize:'11px',fontWeight:'600',color:'#555870',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'10px'}}>Scanner status</div>
            <div style={{display:'flex',flexDirection:'column',gap:'7px',fontSize:'12px'}}>
              {[
                ['Timeframe', `${config?.kline_interval||'1h'} candles`],
                ['Interval',  `Every ${scanInterval}min`],
                ['Last scan', lastScanAt?timeAgo(lastScanAt.toISOString()):'Never'],
              ].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{color:'#555870'}}>{l}</span>
                  <span style={{color:'#e8eaf2',fontWeight:'600'}}>{v}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'#555870'}}>Next scan</span>
                <span style={{color:countdown<60000?'#22c55e':'#e8eaf2',fontWeight:'600',fontVariantNumeric:'tabular-nums'}}>{fmtCountdown(countdown)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'#555870'}}>Status</span>
                <span style={{color:config?.last_scan_status?.startsWith('ok')?'#22c55e':'#f59e0b',fontWeight:'600',fontSize:'11px'}}>{config?.last_scan_status||'—'}</span>
              </div>
            </div>
            {isAdmin&&(
              <Link href="/dashboard/admin/scanner" style={{display:'block',marginTop:'12px',padding:'7px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'7px',color:'#60a5fa',fontSize:'11px',fontWeight:'600',textAlign:'center',textDecoration:'none'}}>
                ⚙️ Configure scanner
              </Link>
            )}
          </div>

          {/* Desktop notifications card */}
          <div style={{background:'#111420',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'14px 16px'}}>
            <div style={{fontSize:'11px',fontWeight:'600',color:'#555870',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'10px'}}>Desktop alerts</div>
            {notifPerm==='granted'?(
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'20px'}}>🔔</span>
                <div>
                  <div style={{fontSize:'12px',color:'#22c55e',fontWeight:'600'}}>Enabled</div>
                  <div style={{fontSize:'11px',color:'#555870'}}>You'll be alerted on new signals</div>
                </div>
              </div>
            ):notifPerm==='denied'?(
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'20px'}}>🔕</span>
                <div>
                  <div style={{fontSize:'12px',color:'#ef4444',fontWeight:'600'}}>Blocked by browser</div>
                  <div style={{fontSize:'11px',color:'#555870'}}>Allow in browser site settings</div>
                </div>
              </div>
            ):(
              <div>
                <div style={{fontSize:'11px',color:'#8b90a8',marginBottom:'10px',lineHeight:'1.5'}}>Get instant browser alerts when new signals appear while you have this page open</div>
                <button onClick={requestNotifPermission} style={{width:'100%',padding:'8px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:'7px',color:'#60a5fa',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:F}}>
                  🔔 Enable notifications
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
