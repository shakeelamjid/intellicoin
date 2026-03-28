'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const SCENARIO: Record<number, string> = {
  1:'Strong bull trend', 2:'Strong bear trend', 3:'Weak rally',
  4:'Weak sell-off', 5:'Bull trap', 6:'Bear trap',
  7:'Long squeeze', 8:'Short squeeze', 9:'Coil', 10:'Disinterest'
}

export default function PerformancePage() {
  const [outcomes, setOutcomes] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('signal_outcomes')
      .select('*, signals(scenario_id, symbol, direction, signal_rank)')
      .order('resolved_at', { ascending: false }).limit(200)
      .then(({ data }) => setOutcomes(data || []))
  }, [])

  const total  = outcomes.length
  const wins   = outcomes.filter(o => ['tp1_hit','tp2_hit','tp3_hit'].includes(o.outcome)).length
  const losses = outcomes.filter(o => o.outcome === 'stop_hit').length
  const wr     = total > 0 ? `${Math.round(wins/total*100)}%` : '—'

  const byScenario: Record<number, { wins: number; total: number }> = {}
  outcomes.forEach(o => {
    const sid = o.signals?.scenario_id
    if (!sid) return
    if (!byScenario[sid]) byScenario[sid] = { wins: 0, total: 0 }
    byScenario[sid].total++
    if (['tp1_hit','tp2_hit','tp3_hit'].includes(o.outcome)) byScenario[sid].wins++
  })

  return (
    <div style={{ padding:'28px', fontFamily:F }}>
      <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'24px' }}>Performance</h1>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'28px' }}>
        {[
          { label:'Win rate', value:wr, color:'#22c55e' },
          { label:'Wins (TP hit)', value:wins.toString(), color:'#22c55e' },
          { label:'Losses (SL hit)', value:losses.toString(), color:'#ef4444' },
          { label:'Total resolved', value:total.toString(), color:'#e8eaf2' },
        ].map(m => (
          <div key={m.label} style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'18px 20px' }}>
            <div style={{ fontSize:'11px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>{m.label}</div>
            <div style={{ fontSize:'26px', fontWeight:'700', color:m.color, letterSpacing:'-0.5px' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* By scenario */}
      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden', marginBottom:'16px' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf2' }}>Win rate by scenario</span>
        </div>
        {Object.keys(byScenario).length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#555870', fontSize:'13px' }}>No resolved signals yet</div>
        ) : Object.entries(byScenario).sort(([,a],[,b]) => (b.wins/b.total) - (a.wins/a.total)).map(([sid, stat]) => {
          const rate = Math.round(stat.wins/stat.total*100)
          const color = rate >= 60 ? '#22c55e' : rate >= 45 ? '#f59e0b' : '#ef4444'
          return (
            <div key={sid} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(59,130,246,0.15)', color:'#60a5fa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', flexShrink:0 }}>
                {sid}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', fontWeight:'500', color:'#e8eaf2', marginBottom:'2px' }}>{SCENARIO[Number(sid)]}</div>
                <div style={{ fontSize:'11px', color:'#555870' }}>{stat.total} signals · {stat.wins} wins</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'100px', height:'5px', background:'rgba(255,255,255,0.08)', borderRadius:'3px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${rate}%`, background:color, borderRadius:'3px', transition:'width 0.5s' }} />
                </div>
                <span style={{ fontSize:'13px', fontWeight:'700', color, width:'36px', textAlign:'right' }}>{rate}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent outcomes */}
      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf2' }}>Recent outcomes</span>
        </div>
        {outcomes.slice(0,20).map(o => {
          const isWin = ['tp1_hit','tp2_hit','tp3_hit'].includes(o.outcome)
          return (
            <div key={o.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ padding:'3px 9px', borderRadius:'5px', fontSize:'11px', fontWeight:'700', background: isWin ? 'rgba(34,197,94,0.12)' : o.outcome === 'stop_hit' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)', color: isWin ? '#22c55e' : o.outcome === 'stop_hit' ? '#ef4444' : '#555870' }}>
                {o.outcome === 'tp1_hit' ? 'TP1 ✓' : o.outcome === 'tp2_hit' ? 'TP2 ✓' : o.outcome === 'tp3_hit' ? 'TP3 ✓' : o.outcome === 'stop_hit' ? 'SL ✗' : 'Expired'}
              </span>
              <span style={{ fontSize:'13px', fontWeight:'700', color:'#e8eaf2', width:'80px' }}>
                {o.signals?.symbol?.replace('USDT','')}/USDT
              </span>
              <span style={{ flex:1, fontSize:'11px', color:'#555870' }}>
                S{o.signals?.scenario_id} · {SCENARIO[o.signals?.scenario_id]}
              </span>
              {o.pnl_pct != null && (
                <span style={{ fontSize:'13px', fontWeight:'700', color: o.pnl_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                  {o.pnl_pct >= 0 ? '+' : ''}{o.pnl_pct?.toFixed(2)}%
                </span>
              )}
              {o.rr_achieved != null && <span style={{ fontSize:'11px', color:'#555870' }}>{o.rr_achieved?.toFixed(1)}x R:R</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
