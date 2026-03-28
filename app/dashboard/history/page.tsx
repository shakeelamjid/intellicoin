'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const SCENARIO: Record<number, string> = {
  1:'Strong bull trend', 2:'Strong bear trend', 3:'Weak rally',
  4:'Weak sell-off', 5:'Bull trap', 6:'Bear trap',
  7:'Long squeeze', 8:'Short squeeze', 9:'Coil', 10:'Disinterest'
}
const RANK_COLOR: Record<string, string> = { S:'#22c55e', A:'#60a5fa', B:'#f59e0b', C:'#8b90a8' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}
function fmtPrice(n: number) {
  if (!n) return '—'
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits:2 })}`
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

export default function HistoryPage() {
  const [signals, setSignals] = useState<any[]>([])
  const [filter, setFilter]   = useState<'all'|'long'|'short'|'active'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('signals').select('*').order('created_at', { ascending:false }).limit(200)
      .then(({ data }) => { setSignals(data || []); setLoading(false) })
  }, [])

  const filtered = signals.filter(s => {
    if (filter === 'long')   return s.direction === 'long'
    if (filter === 'short')  return s.direction === 'short'
    if (filter === 'active') return s.status === 'active'
    return true
  })

  const total    = signals.length
  const resolved = signals.filter(s => s.status !== 'active').length
  const wins     = signals.filter(s => ['tp1_hit','tp2_hit','tp3_hit'].includes(s.status)).length
  const wr       = resolved > 0 ? `${Math.round(wins/resolved*100)}%` : '—'

  return (
    <div style={{ padding:'28px', fontFamily:F }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px' }}>Signal history</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>{total} total · {wr} win rate on resolved</p>
        </div>
        <div style={{ display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'9px', padding:'3px' }}>
          {(['all','long','short','active'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'5px 12px', borderRadius:'7px', border:'none', fontSize:'12px', fontWeight:'500',
              background: filter === f ? '#1e2235' : 'transparent',
              color: filter === f ? '#e8eaf2' : '#555870',
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 70px 100px 90px 130px', gap:'8px', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:'10px', fontWeight:'600', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <span>Dir</span><span>Symbol</span><span>Scenario</span><span>Rank</span><span>Entry</span><span>Status</span><span>Time</span>
        </div>

        {loading ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#555870' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#555870', fontSize:'13px' }}>No signals yet</div>
        ) : filtered.map(s => (
          <a key={s.id}
            href={`https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}.P&interval=60`}
            target="_blank" rel="noopener noreferrer"
            style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 70px 100px 90px 130px', gap:'8px', alignItems:'center', padding:'11px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.1s', textDecoration:'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ padding:'3px 8px', borderRadius:'5px', fontSize:'10px', fontWeight:'700', letterSpacing:'0.05em', background: s.direction === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: s.direction === 'long' ? '#22c55e' : '#ef4444' }}>
              {s.direction?.toUpperCase()}
            </span>
            <span style={{ fontSize:'13px', fontWeight:'700', color:'#e8eaf2' }}>
              {s.symbol?.replace('USDT','')}<span style={{ color:'#555870', fontWeight:'400' }}>/USDT</span>
            </span>
            <span style={{ fontSize:'11px', color:'#8b90a8' }}>S{s.scenario_id} · {SCENARIO[s.scenario_id]}</span>
            <span style={{ fontSize:'12px', fontWeight:'700', color: RANK_COLOR[s.signal_rank] || '#555870' }}>
              {s.signal_rank || '—'}
            </span>
            <span style={{ fontSize:'12px', color:'#8b90a8' }}>{fmtPrice(s.entry_low)}</span>
            <span style={{ padding:'3px 8px', borderRadius:'5px', fontSize:'10px', fontWeight:'600',
              background: ['tp1_hit','tp2_hit','tp3_hit'].includes(s.status) ? 'rgba(34,197,94,0.12)' :
                          s.status === 'stop_hit' ? 'rgba(239,68,68,0.12)' :
                          s.status === 'active' ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.05)',
              color: ['tp1_hit','tp2_hit','tp3_hit'].includes(s.status) ? '#22c55e' :
                     s.status === 'stop_hit' ? '#ef4444' :
                     s.status === 'active' ? '#60a5fa' : '#555870' }}>
              {s.status === 'active' ? 'Active' :
               s.status === 'tp1_hit' ? 'TP1 ✓' :
               s.status === 'tp2_hit' ? 'TP2 ✓' :
               s.status === 'tp3_hit' ? 'TP3 ✓' :
               s.status === 'stop_hit' ? 'SL ✗' : 'Expired'}
            </span>
            <span style={{ fontSize:'11px', color:'#555870' }}>{fmtDate(s.created_at)}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
