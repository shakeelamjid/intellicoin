'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIO_NAMES: Record<number, string> = {
  1:'Strong bull trend', 2:'Strong bear trend', 3:'Weak rally',
  4:'Weak sell-off',     5:'Bull trap',         6:'Bear trap',
  7:'Long squeeze',      8:'Short squeeze',     9:'Coil / buildup',
}

function pct(n: number) {
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 20px' }}>
      <div style={{ fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>{label}</div>
      <div style={{ fontSize:'24px', fontWeight:'800', letterSpacing:'-0.5px', color: color || '#e8eaf2' }}>{value}</div>
      {sub && <div style={{ fontSize:'11px', color:'#555870', marginTop:'4px' }}>{sub}</div>}
    </div>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden', marginTop:'6px' }}>
      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:'2px', transition:'width 0.4s' }} />
    </div>
  )
}

export default function PerformancePage() {
  const [outcomes, setOutcomes] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [period,   setPeriod]   = useState<'7d'|'30d'|'all'>('30d')

  useEffect(() => {
    const supabase = createClient()
    const since = period === '7d'
      ? new Date(Date.now() - 7  * 86400000).toISOString()
      : period === '30d'
      ? new Date(Date.now() - 30 * 86400000).toISOString()
      : null

    async function load() {
      // Fetch outcomes
      let q = supabase
        .from('signal_outcomes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (since) q = q.gte('created_at', since)
      const { data: outData } = await q
      if (!outData?.length) { setOutcomes([]); setLoading(false); return }

      // Fetch related signals
      const signalIds = Array.from(new Set(outData.map((o:any) => o.signal_id).filter(Boolean)))
      const { data: sigData } = await supabase
        .from('signals')
        .select('id, symbol, scenario_id, signal_rank, direction')
        .in('id', signalIds)

      // Join manually
      const sigMap: Record<string, any> = {}
      for (const s of sigData || []) sigMap[s.id] = s

      const joined = outData.map((o: any) => ({
        ...o,
        signals: sigMap[o.signal_id] || null
      }))

      setOutcomes(joined)
      setLoading(false)
    }
    load()
  }, [period])

  // ── Compute stats ─────────────────────────────────────────────────────────
  const resolved  = outcomes.filter(o => o.outcome !== 'expired')
  const wins      = resolved.filter(o => o.outcome?.includes('tp'))
  const losses    = resolved.filter(o => o.outcome === 'stop_hit')
  const tp1s      = resolved.filter(o => o.outcome === 'tp1_hit')
  const tp2s      = resolved.filter(o => o.outcome === 'tp2_hit')
  const tp3s      = resolved.filter(o => o.outcome === 'tp3_hit')
  const expired   = outcomes.filter(o => o.outcome === 'expired')

  const winRate   = resolved.length > 0 ? (wins.length / resolved.length * 100) : 0
  const totalPnl  = resolved.reduce((a, o) => a + (o.pnl_pct || 0), 0)
  const avgPnl    = resolved.length > 0 ? totalPnl / resolved.length : 0
  const avgRR     = wins.length > 0 ? wins.reduce((a, o) => a + (o.rr_achieved || 0), 0) / wins.length : 0
  const avgDurMin = resolved.length > 0 ? resolved.reduce((a, o) => a + (o.duration_minutes || 0), 0) / resolved.length : 0

  const bestTrade  = resolved.reduce((b, o) => (!b || (o.pnl_pct||0) > (b.pnl_pct||0)) ? o : b, null as any)
  const worstTrade = resolved.reduce((b, o) => (!b || (o.pnl_pct||0) < (b.pnl_pct||0)) ? o : b, null as any)

  // By rank
  const rankOrder = ['S','A','B','C']
  const byRank: Record<string, { wins:number; total:number; pnl:number }> = {}
  for (const o of resolved) {
    const r = o.signals?.signal_rank || '?'
    if (!byRank[r]) byRank[r] = { wins:0, total:0, pnl:0 }
    byRank[r].total++
    byRank[r].pnl += o.pnl_pct || 0
    if (o.outcome?.includes('tp')) byRank[r].wins++
  }

  // By scenario
  const byScenario: Record<number, { wins:number; total:number; pnl:number }> = {}
  for (const o of resolved) {
    const sc = o.signals?.scenario_id
    if (!sc) continue
    if (!byScenario[sc]) byScenario[sc] = { wins:0, total:0, pnl:0 }
    byScenario[sc].total++
    byScenario[sc].pnl += o.pnl_pct || 0
    if (o.outcome?.includes('tp')) byScenario[sc].wins++
  }

  // By direction
  const byDir: Record<string, { wins:number; total:number; pnl:number }> = {}
  for (const o of resolved) {
    const d = o.signals?.direction || '?'
    if (!byDir[d]) byDir[d] = { wins:0, total:0, pnl:0 }
    byDir[d].total++
    byDir[d].pnl += o.pnl_pct || 0
    if (o.outcome?.includes('tp')) byDir[d].wins++
  }

  const maxScTotal = Math.max(...Object.values(byScenario).map(v => v.total), 1)

  const periodBtns: { value: '7d'|'30d'|'all'; label: string }[] = [
    { value:'7d',  label:'7 days'  },
    { value:'30d', label:'30 days' },
    { value:'all', label:'All time'},
  ]

  if (loading) return (
    <div style={{ padding:'40px', color:'#555870', fontFamily:F }}>Loading performance data…</div>
  )

  return (
    <div style={{ padding:'24px', fontFamily:F }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px' }}>Performance</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>{outcomes.length} outcomes tracked · {resolved.length} resolved trades</p>
        </div>
        <div style={{ display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'9px', padding:'3px' }}>
          {periodBtns.map(b => (
            <button key={b.value} onClick={() => { setLoading(true); setPeriod(b.value) }} style={{
              padding:'5px 14px', borderRadius:'7px', border:'none', fontSize:'12px', fontWeight:'500', cursor:'pointer', fontFamily:F,
              background: period===b.value ? '#1e2235' : 'transparent',
              color:      period===b.value ? '#e8eaf2'  : '#555870',
            }}>{b.label}</button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {resolved.length === 0 && (
        <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'60px', textAlign:'center' }}>
          <div style={{ fontSize:'36px', marginBottom:'12px' }}>📊</div>
          <p style={{ color:'#8b90a8', fontSize:'14px', marginBottom:'6px' }}>No resolved trades yet</p>
          <p style={{ color:'#555870', fontSize:'12px' }}>Signals need to hit TP or SL before performance data appears</p>
        </div>
      )}

      {resolved.length > 0 && (<>

        {/* Key stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
          <StatCard
            label="Win rate"
            value={winRate.toFixed(1) + '%'}
            sub={`${wins.length}W · ${losses.length}L · ${expired.length} expired`}
            color={winRate >= 60 ? '#22c55e' : winRate >= 40 ? '#f59e0b' : '#ef4444'}
          />
          <StatCard
            label="Total P&L"
            value={pct(totalPnl)}
            sub={`Avg ${pct(avgPnl)} per trade`}
            color={totalPnl >= 0 ? '#22c55e' : '#ef4444'}
          />
          <StatCard
            label="Avg R:R on wins"
            value={avgRR > 0 ? avgRR.toFixed(2) + 'x' : '—'}
            sub="Average reward/risk achieved"
            color="#60a5fa"
          />
          <StatCard
            label="Avg hold time"
            value={avgDurMin > 0 ? (avgDurMin >= 60 ? (avgDurMin/60).toFixed(1)+'h' : Math.round(avgDurMin)+'m') : '—'}
            sub="From signal to outcome"
          />
        </div>

        {/* TP breakdown */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
          {[
            { label:'TP1 hits', count:tp1s.length, color:'#22c55e' },
            { label:'TP2 hits', count:tp2s.length, color:'#16a34a' },
            { label:'TP3 hits', count:tp3s.length, color:'#15803d' },
            { label:'SL hits',  count:losses.length, color:'#ef4444' },
          ].map(item => (
            <div key={item.label} style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>{item.label}</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color:item.color }}>{item.count}</div>
              <div style={{ fontSize:'11px', color:'#555870', marginTop:'3px' }}>
                {resolved.length > 0 ? (item.count/resolved.length*100).toFixed(0)+'%' : '—'} of trades
              </div>
            </div>
          ))}
        </div>

        {/* Best / worst trades */}
        {(bestTrade || worstTrade) && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
            {bestTrade && (
              <div style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:'12px', padding:'16px 20px' }}>
                <div style={{ fontSize:'10px', color:'#22c55e', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>🏆 Best trade</div>
                <div style={{ fontSize:'20px', fontWeight:'800', color:'#22c55e', marginBottom:'4px' }}>{pct(bestTrade.pnl_pct)}</div>
                <div style={{ fontSize:'12px', color:'#8b90a8' }}>{bestTrade.signals?.symbol} · {bestTrade.outcome?.replace('_',' ')}</div>
              </div>
            )}
            {worstTrade && (
              <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'12px', padding:'16px 20px' }}>
                <div style={{ fontSize:'10px', color:'#ef4444', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>📉 Worst trade</div>
                <div style={{ fontSize:'20px', fontWeight:'800', color:'#ef4444', marginBottom:'4px' }}>{pct(worstTrade.pnl_pct)}</div>
                <div style={{ fontSize:'12px', color:'#8b90a8' }}>{worstTrade.signals?.symbol} · {worstTrade.outcome?.replace('_',' ')}</div>
              </div>
            )}
          </div>
        )}

        {/* By rank + by direction */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>

          {/* By rank */}
          <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Performance by rank</div>
            {rankOrder.filter(r => byRank[r]).map(r => {
              const d = byRank[r]
              const wr = d.total > 0 ? d.wins/d.total*100 : 0
              const rankColors: Record<string,string> = { S:'#22c55e', A:'#60a5fa', B:'#f59e0b', C:'#8b90a8' }
              return (
                <div key={r} style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'11px', fontWeight:'700', color:rankColors[r], padding:'1px 7px', borderRadius:'4px', background:`${rankColors[r]}18` }}>Rank {r}</span>
                      <span style={{ fontSize:'11px', color:'#555870' }}>{d.wins}W/{d.total-d.wins}L</span>
                    </div>
                    <div style={{ display:'flex', gap:'12px', fontSize:'11px' }}>
                      <span style={{ color: wr >= 60 ? '#22c55e' : wr >= 40 ? '#f59e0b' : '#ef4444', fontWeight:'600' }}>{wr.toFixed(0)}%</span>
                      <span style={{ color: d.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{pct(d.pnl)}</span>
                    </div>
                  </div>
                  <MiniBar value={d.wins} max={d.total} color={rankColors[r]} />
                </div>
              )
            })}
            {Object.keys(byRank).length === 0 && <div style={{ fontSize:'12px', color:'#555870' }}>No data yet</div>}
          </div>

          {/* By direction */}
          <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 20px' }}>
            <div style={{ fontSize:'12px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Performance by direction</div>
            {['long','short','watch'].filter(d => byDir[d]).map(d => {
              const data = byDir[d]
              const wr   = data.total > 0 ? data.wins/data.total*100 : 0
              const dc   = d==='long' ? '#22c55e' : d==='short' ? '#ef4444' : '#f59e0b'
              return (
                <div key={d} style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'11px', fontWeight:'700', color:dc, padding:'1px 7px', borderRadius:'4px', background:`${dc}18` }}>{d.toUpperCase()}</span>
                      <span style={{ fontSize:'11px', color:'#555870' }}>{data.wins}W/{data.total-data.wins}L</span>
                    </div>
                    <div style={{ display:'flex', gap:'12px', fontSize:'11px' }}>
                      <span style={{ color: wr>=60?'#22c55e':wr>=40?'#f59e0b':'#ef4444', fontWeight:'600' }}>{wr.toFixed(0)}%</span>
                      <span style={{ color: data.pnl>=0?'#22c55e':'#ef4444' }}>{pct(data.pnl)}</span>
                    </div>
                  </div>
                  <MiniBar value={data.wins} max={data.total} color={dc} />
                </div>
              )
            })}
            {Object.keys(byDir).length === 0 && <div style={{ fontSize:'12px', color:'#555870' }}>No data yet</div>}
          </div>
        </div>

        {/* By scenario */}
        <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px' }}>
          <div style={{ fontSize:'12px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Performance by scenario</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {Object.entries(byScenario)
              .sort(([,a],[,b]) => b.total - a.total)
              .map(([scId, data]) => {
                const wr  = data.total > 0 ? data.wins/data.total*100 : 0
                const sc  = parseInt(scId)
                return (
                  <div key={scId}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontSize:'10px', fontWeight:'700', color:'#60a5fa', padding:'1px 6px', borderRadius:'3px', background:'rgba(59,130,246,0.12)' }}>S{scId}</span>
                        <span style={{ fontSize:'12px', color:'#8b90a8' }}>{SCENARIO_NAMES[sc] || 'Unknown'}</span>
                      </div>
                      <div style={{ display:'flex', gap:'14px', fontSize:'11px' }}>
                        <span style={{ color:'#555870' }}>{data.wins}W / {data.total-data.wins}L</span>
                        <span style={{ color: wr>=60?'#22c55e':wr>=40?'#f59e0b':'#ef4444', fontWeight:'600' }}>{wr.toFixed(0)}% win</span>
                        <span style={{ color: data.pnl>=0?'#22c55e':'#ef4444', fontWeight:'600' }}>{pct(data.pnl)}</span>
                      </div>
                    </div>
                    <MiniBar value={data.total} max={maxScTotal} color="#3b82f6" />
                  </div>
                )
              })}
            {Object.keys(byScenario).length === 0 && <div style={{ fontSize:'12px', color:'#555870' }}>No data yet</div>}
          </div>
        </div>

        {/* Recent outcomes table */}
        <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:'12px', fontWeight:'600', color:'#e8eaf2' }}>
            Recent outcomes
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 80px 100px', gap:'8px', padding:'8px 20px', fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <span>Signal</span><span>Outcome</span><span>P&L</span><span>R:R</span><span>Hold</span><span>Time</span>
          </div>
          {outcomes.slice(0,20).map(o => {
            const isWin = o.outcome?.includes('tp')
            const outColor = isWin ? '#22c55e' : o.outcome==='stop_hit' ? '#ef4444' : '#555870'
            const dur = o.duration_minutes >= 60
              ? (o.duration_minutes/60).toFixed(1)+'h'
              : (o.duration_minutes||0)+'m'
            return (
              <div key={o.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 80px 100px', gap:'8px', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.03)', alignItems:'center' }}
                onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}
              >
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf2' }}>{o.signals?.symbol?.replace('USDT','')}<span style={{ color:'#555870', fontWeight:'400' }}>/USDT</span></div>
                  <div style={{ fontSize:'11px', color:'#555870' }}>
                    {o.signals?.direction?.toUpperCase()} · Rank {o.signals?.signal_rank} · S{o.signals?.scenario_id}
                  </div>
                </div>
                <span style={{ fontSize:'12px', fontWeight:'600', color:outColor }}>{o.outcome?.replace('_',' ')}</span>
                <span style={{ fontSize:'12px', fontWeight:'600', color: (o.pnl_pct||0)>=0?'#22c55e':'#ef4444' }}>{o.pnl_pct!=null?pct(o.pnl_pct):'—'}</span>
                <span style={{ fontSize:'12px', color:'#8b90a8' }}>{o.rr_achieved!=null?o.rr_achieved.toFixed(1)+'x':'—'}</span>
                <span style={{ fontSize:'12px', color:'#555870' }}>{dur}</span>
                <span style={{ fontSize:'11px', color:'#555870' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</span>
              </div>
            )
          })}
        </div>

      </>)}
    </div>
  )
}
