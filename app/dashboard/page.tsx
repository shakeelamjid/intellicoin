'use client'
import { useEffect, useState } from 'react'
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

export default function DashboardPage() {
  const [user,      setUser]      = useState<any>(null)
  const [config,    setConfig]    = useState<any>(null)
  const [signals,   setSignals]   = useState<any[]>([])
  const [outcomes,  setOutcomes]  = useState<any[]>([])
  const [userCount, setUserCount] = useState(0)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return

      const [profile, sigs, cfg, outs, users] = await Promise.all([
        supabase.from('users').select('*').eq('id', au.id).single(),
        supabase.from('signals').select('*').eq('status','active').order('created_at',{ascending:false}).limit(10),
        supabase.from('scanner_config').select('*').single(),
        supabase.from('signal_outcomes').select('outcome, pnl_pct, created_at')
          .gte('created_at', new Date(Date.now() - 7*86400000).toISOString()),
        supabase.from('users').select('id', {count:'exact'}),
      ])

      setUser(profile.data)
      setSignals(sigs.data || [])
      setConfig(cfg.data)
      setOutcomes(outs.data || [])
      setUserCount(users.count || 0)
      setLoading(false)
    }
    load()

    const ch = supabase.channel('dash_live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'signals'}, p => {
        setSignals(prev => [p.new as any, ...prev.slice(0,9)])
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const isAdmin = user?.role === 'admin'

  // Stats
  const resolved   = outcomes.filter(o => o.outcome !== 'expired')
  const wins       = resolved.filter(o => o.outcome?.includes('tp'))
  const winRate    = resolved.length > 0 ? Math.round(wins.length/resolved.length*100) : null
  const totalPnl   = resolved.reduce((a,o) => a+(o.pnl_pct||0), 0)
  const rankCounts = {
    S: signals.filter(s=>s.signal_rank==='S').length,
    A: signals.filter(s=>s.signal_rank==='A').length,
    B: signals.filter(s=>s.signal_rank==='B').length,
    C: signals.filter(s=>s.signal_rank==='C').length,
  }

  // Scanner next run estimate
  const scanInterval = config?.scan_interval_minutes || 60
  const lastScanAt   = config?.last_scan_at ? new Date(config.last_scan_at) : null
  const nextScanAt   = lastScanAt ? new Date(lastScanAt.getTime() + scanInterval*60000) : null
  const minsToNext   = nextScanAt ? Math.max(0, Math.round((nextScanAt.getTime()-Date.now())/60000)) : null

  if (loading) return (
    <div style={{padding:'40px', color:'#555870', fontFamily:F}}>Loading…</div>
  )

  return (
    <div style={{padding:'24px', fontFamily:F}}>

      {/* Header */}
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px'}}>
          Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#555870'}}>
          <span style={{width:'6px', height:'6px', borderRadius:'50%', background: config?.scanner_enabled?'#22c55e':'#555870', display:'inline-block', boxShadow:config?.scanner_enabled?'0 0 6px #22c55e':'none', animation:config?.scanner_enabled?'pulse 2s infinite':'none'}}/>
          {config?.scanner_enabled
            ? `Scanner active · last ran ${lastScanAt?timeAgo(lastScanAt.toISOString()):'never'}${minsToNext!==null?` · next in ${minsToNext}min`:''}`
            : 'Scanner inactive'
          }
          {config?.kline_interval && (
            <span style={{marginLeft:'6px', padding:'1px 6px', borderRadius:'4px', background:'rgba(59,130,246,0.1)', color:'#60a5fa', fontSize:'10px', fontWeight:'600'}}>
              {config.kline_interval} candles
            </span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{display:'grid', gridTemplateColumns:`repeat(${isAdmin?5:4},1fr)`, gap:'10px', marginBottom:'20px'}}>

        {/* Active signals */}
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 18px'}}>
          <div style={{fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px'}}>Active signals</div>
          <div style={{fontSize:'26px', fontWeight:'800', color:'#e8eaf2', letterSpacing:'-0.5px', marginBottom:'6px'}}>{signals.length}</div>
          <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
            {(['S','A','B','C'] as const).filter(r=>rankCounts[r]>0).map(r=>(
              <span key={r} style={{padding:'1px 6px', borderRadius:'3px', fontSize:'10px', fontWeight:'700', background:RANK_META[r].bg, color:RANK_META[r].text}}>
                {r}: {rankCounts[r]}
              </span>
            ))}
          </div>
        </div>

        {/* Win rate */}
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 18px'}}>
          <div style={{fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px'}}>Win rate (7d)</div>
          <div style={{fontSize:'26px', fontWeight:'800', letterSpacing:'-0.5px', marginBottom:'4px', color: winRate===null?'#555870':winRate>=60?'#22c55e':winRate>=40?'#f59e0b':'#ef4444'}}>
            {winRate!==null ? winRate+'%' : '—'}
          </div>
          <div style={{fontSize:'11px', color:'#555870'}}>{wins.length}W · {resolved.length-wins.length}L · {resolved.length} total</div>
        </div>

        {/* 7d P&L */}
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 18px'}}>
          <div style={{fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px'}}>Total P&L (7d)</div>
          <div style={{fontSize:'26px', fontWeight:'800', letterSpacing:'-0.5px', marginBottom:'4px', color:totalPnl>=0?'#22c55e':'#ef4444'}}>
            {resolved.length>0 ? (totalPnl>0?'+':'')+totalPnl.toFixed(2)+'%' : '—'}
          </div>
          <div style={{fontSize:'11px', color:'#555870'}}>across {resolved.length} resolved trades</div>
        </div>

        {/* Scanner */}
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 18px'}}>
          <div style={{fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px'}}>Scanner</div>
          <div style={{fontSize:'14px', fontWeight:'700', color:'#e8eaf2', marginBottom:'4px'}}>{config?.kline_interval||'1h'} · every {scanInterval}min</div>
          <div style={{fontSize:'11px', color:'#555870'}}>
            {config?.last_scan_status || 'No scan yet'}
          </div>
        </div>

        {/* Admin: user count */}
        {isAdmin && (
          <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 18px'}}>
            <div style={{fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px'}}>Users</div>
            <div style={{fontSize:'26px', fontWeight:'800', color:'#60a5fa', letterSpacing:'-0.5px', marginBottom:'4px'}}>{userCount}</div>
            <div style={{fontSize:'11px', color:'#555870'}}>registered members</div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:'14px'}}>

        {/* Recent signals */}
        <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', overflow:'hidden'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
              <span style={{fontSize:'13px', fontWeight:'600', color:'#e8eaf2'}}>Active signals</span>
              <span style={{width:'6px', height:'6px', borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 2s infinite'}}/>
            </div>
            <Link href="/dashboard/signals" style={{fontSize:'11px', color:'#3b82f6', textDecoration:'none'}}>View all →</Link>
          </div>

          {signals.length === 0 ? (
            <div style={{padding:'50px 20px', textAlign:'center'}}>
              <div style={{fontSize:'28px', marginBottom:'10px'}}>📡</div>
              <p style={{color:'#555870', fontSize:'13px'}}>No active signals — scanner runs every {scanInterval} minutes</p>
            </div>
          ) : signals.map(s => {
            const rm = RANK_META[s.signal_rank as keyof typeof RANK_META] || RANK_META.B
            return (
              <div key={s.id} style={{
                display:'grid', gridTemplateColumns:'60px 100px 1fr 50px 50px 70px',
                gap:'8px', padding:'10px 18px', borderBottom:'1px solid rgba(255,255,255,0.04)',
                alignItems:'center', cursor:'pointer',
              }}
                onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
              >
                <span style={{padding:'2px 6px', borderRadius:'3px', fontSize:'9px', fontWeight:'700', background:s.direction==='long'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)', color:s.direction==='long'?'#22c55e':'#ef4444', textAlign:'center'}}>
                  {s.direction?.toUpperCase()}
                </span>
                <div>
                  <span style={{fontSize:'13px', fontWeight:'700', color:'#e8eaf2'}}>{s.symbol?.replace('USDT','')}</span>
                  <span style={{fontSize:'11px', color:'#555870'}}>/USDT</span>
                </div>
                <span style={{fontSize:'11px', color:'#555870', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  S{s.scenario_id} · {SCENARIO[s.scenario_id]}
                </span>
                <span style={{padding:'2px 6px', borderRadius:'3px', fontSize:'10px', fontWeight:'700', background:rm.bg, color:rm.text, textAlign:'center'}}>
                  {s.signal_rank}
                </span>
                <span style={{fontSize:'11px', color:'#8b90a8', textAlign:'right'}}>{fp(s.price_at_signal)}</span>
                <span style={{fontSize:'10px', color:'#555870', textAlign:'right'}}>{timeAgo(s.created_at)}</span>
              </div>
            )
          })}
        </div>

        {/* Right column */}
        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>

          {/* Scanner status card */}
          <div style={{background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'14px 16px'}}>
            <div style={{fontSize:'11px', fontWeight:'600', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px'}}>Scanner status</div>
            <div style={{display:'flex', flexDirection:'column', gap:'7px', fontSize:'12px'}}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#555870'}}>Timeframe</span>
                <span style={{color:'#e8eaf2', fontWeight:'600'}}>{config?.kline_interval || '1h'} candles</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#555870'}}>Interval</span>
                <span style={{color:'#e8eaf2', fontWeight:'600'}}>Every {scanInterval}min</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#555870'}}>Last scan</span>
                <span style={{color:'#e8eaf2', fontWeight:'600'}}>{lastScanAt?timeAgo(lastScanAt.toISOString()):'Never'}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#555870'}}>Next scan</span>
                <span style={{color: minsToNext===0?'#22c55e':'#e8eaf2', fontWeight:'600'}}>
                  {minsToNext!==null ? (minsToNext===0?'Running now':`in ${minsToNext}min`) : '—'}
                </span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#555870'}}>Status</span>
                <span style={{color:config?.last_scan_status?.startsWith('ok')?'#22c55e':'#f59e0b', fontWeight:'600', fontSize:'11px'}}>
                  {config?.last_scan_status || '—'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <Link href="/dashboard/admin/scanner" style={{display:'block', marginTop:'12px', padding:'7px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:'7px', color:'#60a5fa', fontSize:'11px', fontWeight:'600', textAlign:'center', textDecoration:'none'}}>
                ⚙️ Configure scanner
              </Link>
            )}
          </div>

        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
