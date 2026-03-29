'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIO: Record<number, { name: string; dir: string }> = {
  1: { name: 'Strong bull trend',  dir: 'long'  },
  2: { name: 'Strong bear trend',  dir: 'short' },
  3: { name: 'Weak rally',         dir: 'short' },
  4: { name: 'Weak sell-off',      dir: 'long'  },
  5: { name: 'Bull trap',          dir: 'short' },
  6: { name: 'Bear trap',          dir: 'long'  },
  7: { name: 'Long squeeze',       dir: 'short' },
  8: { name: 'Short squeeze',      dir: 'long'  },
  9: { name: 'Coil / buildup',     dir: 'watch' },
}

const RANK_META = {
  S: { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e', border: 'rgba(34,197,94,0.3)',   label: 'S — Premium' },
  A: { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)',  label: 'A — Strong'  },
  B: { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b', border: 'rgba(245,158,11,0.3)',  label: 'B — Standard'},
  C: { bg: 'rgba(139,144,168,0.1)',  text: '#8b90a8', border: 'rgba(139,144,168,0.2)', label: 'C — Watchlist'},
}

const DIR_META = {
  long:  { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', label: 'LONG'  },
  short: { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', label: 'SHORT' },
  watch: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', label: 'WATCH' },
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m/60)}h ago`
}

function fp(n: number | null) {
  if (!n) return '—'
  if (n >= 1000) return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1)    return '$' + n.toFixed(4)
  return '$' + n.toFixed(6)
}

function SignalCard({ s, isNew }: { s: any; isNew: boolean }) {
  const rank  = s.signal_rank || 'B'
  const rm    = RANK_META[rank as keyof typeof RANK_META] || RANK_META.B
  const dir   = s.direction || 'long'
  const dm    = DIR_META[dir as keyof typeof DIR_META] || DIR_META.long
  const isPremium = rank === 'S'
  const sym   = s.symbol?.replace('USDT', '')

  return (
    <div style={{
      background: isPremium ? 'linear-gradient(135deg, #111420 0%, #0f1a12 100%)' : '#111420',
      border: `1px solid ${isPremium ? 'rgba(34,197,94,0.2)' : isNew ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '12px',
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = isPremium ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = isPremium ? 'rgba(34,197,94,0.2)' : isNew ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.07)')}
    >
      {/* Premium glow strip */}
      {isPremium && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius:'12px 12px 0 0' }} />
      )}

      {/* Row 1: symbol + badges + time */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'15px', fontWeight:'800', color:'#e8eaf2', letterSpacing:'-0.3px' }}>
          {sym}<span style={{ color:'#555870', fontWeight:'400', fontSize:'12px' }}>/USDT</span>
        </span>
        <span style={{ padding:'2px 8px', borderRadius:'4px', fontSize:'10px', fontWeight:'700', background:dm.bg, color:dm.text }}>
          {dm.label}
        </span>
        <span style={{ padding:'2px 8px', borderRadius:'4px', fontSize:'10px', fontWeight:'700', background:rm.bg, color:rm.text, border:`1px solid ${rm.border}` }}>
          {isPremium ? '⭐ ' : ''}{rank}
        </span>
        <span style={{ padding:'2px 8px', borderRadius:'4px', fontSize:'10px', color:'#8b90a8', background:'rgba(255,255,255,0.04)' }}>
          S{s.scenario_id} · {SCENARIO[s.scenario_id]?.name}
        </span>
        {s.confirmed_bybit && (
          <span style={{ padding:'2px 8px', borderRadius:'4px', fontSize:'10px', color:'#60a5fa', background:'rgba(59,130,246,0.1)' }}>
            Bybit ✓
          </span>
        )}
        {isNew && (
          <span style={{ padding:'2px 8px', borderRadius:'4px', fontSize:'10px', color:'#3b82f6', background:'rgba(59,130,246,0.12)', animation:'pulse 2s infinite' }}>
            NEW
          </span>
        )}
        <span style={{ marginLeft:'auto', fontSize:'11px', color:'#555870', flexShrink:0 }}>{timeAgo(s.created_at)}</span>
      </div>

      {/* Row 2: trade levels (compact inline) */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:'6px', marginBottom:'10px' }}>
        <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'7px', padding:'7px 10px' }}>
          <div style={{ fontSize:'9px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Entry zone</div>
          <div style={{ fontSize:'12px', fontWeight:'600', color:'#e8eaf2' }}>{fp(s.entry_low)} – {fp(s.entry_high)}</div>
        </div>
        <div style={{ background:'rgba(239,68,68,0.06)', borderRadius:'7px', padding:'7px 10px' }}>
          <div style={{ fontSize:'9px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Stop</div>
          <div style={{ fontSize:'12px', fontWeight:'600', color:'#ef4444' }}>{fp(s.stop_loss)}</div>
        </div>
        {[
          { label:'TP1', val:s.tp1, mult:0.5 },
          { label:'TP2', val:s.tp2, mult:1   },
          { label:'TP3', val:s.tp3, mult:1.6 },
        ].map(tp => (
          <div key={tp.label} style={{ background:'rgba(34,197,94,0.05)', borderRadius:'7px', padding:'7px 10px' }}>
            <div style={{ fontSize:'9px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>
              {tp.label} {s.rr_ratio ? `·${(s.rr_ratio * tp.mult).toFixed(1)}x` : ''}
            </div>
            <div style={{ fontSize:'12px', fontWeight:'600', color:'#22c55e' }}>{fp(tp.val)}</div>
          </div>
        ))}
      </div>

      {/* Row 3: indicators + chart link */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'10px', fontSize:'11px', color:'#555870', flexWrap:'wrap' }}>
          {s.oi_change_pct != null && (
            <span style={{ color: s.oi_change_pct > 3 ? '#22c55e' : s.oi_change_pct < -3 ? '#ef4444' : '#555870' }}>
              OI {s.oi_change_pct > 0 ? '+' : ''}{s.oi_change_pct.toFixed(1)}%
            </span>
          )}
          {s.fr_at_signal != null && <span>FR {(s.fr_at_signal * 100).toFixed(4)}%</span>}
          {s.adx_value    != null && (
            <span style={{ color: s.adx_value > 30 ? '#22c55e' : s.adx_value > 22 ? '#f59e0b' : '#555870' }}>
              ADX {s.adx_value.toFixed(0)}
            </span>
          )}
          {s.volume_ratio != null && <span>Vol {s.volume_ratio.toFixed(1)}x</span>}
          {s.suggested_leverage && <span>Lev {s.suggested_leverage}x</span>}
        </div>
        <a href={`https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}.P&interval=60`}
          target="_blank" rel="noopener noreferrer"
          style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:'6px', background:'rgba(59,130,246,0.1)', color:'#60a5fa', fontSize:'11px', fontWeight:'600', border:'1px solid rgba(59,130,246,0.2)', textDecoration:'none', flexShrink:0 }}
          onClick={e => e.stopPropagation()}>
          Chart ↗
        </a>
      </div>
    </div>
  )
}

export default function SignalsPage() {
  const [signals, setSignals]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterDir, setFilterDir]   = useState<string>('all')
  const [filterRank, setFilterRank] = useState<string>('all')
  const [newIds, setNewIds]     = useState<Set<string>>(new Set())
  const [newCount, setNewCount] = useState(0)
  const newTimer = useRef<any>({})

  useEffect(() => {
    const supabase = createClient()

    supabase.from('signals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setSignals(data || []); setLoading(false) })

    const ch = supabase.channel('signals_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, p => {
        const sig = p.new as any
        setSignals(prev => [sig, ...prev])
        setNewCount(n => n + 1)
        setNewIds(prev => new Set([...prev, sig.id]))
        // Remove "new" highlight after 30s
        newTimer.current[sig.id] = setTimeout(() => {
          setNewIds(prev => { const s = new Set(prev); s.delete(sig.id); return s })
        }, 30000)
      }).subscribe()

    return () => {
      supabase.removeChannel(ch)
      Object.values(newTimer.current).forEach(t => clearTimeout(t as any))
    }
  }, [])

  const filtered = signals.filter(s => {
    if (filterDir  !== 'all' && s.direction    !== filterDir)  return false
    if (filterRank !== 'all' && s.signal_rank  !== filterRank) return false
    return true
  })

  // Group by rank then by scenario
  const groups: Record<string, Record<number, any[]>> = {}
  for (const rank of ['S','A','B','C']) {
    const rankSigs = filtered.filter(s => s.signal_rank === rank)
    if (rankSigs.length === 0) continue
    groups[rank] = {}
    for (const s of rankSigs) {
      const sc = s.scenario_id
      if (!groups[rank][sc]) groups[rank][sc] = []
      groups[rank][sc].push(s)
    }
  }

  const totalFiltered = filtered.length
  const counts = { S: filtered.filter(s=>s.signal_rank==='S').length, A: filtered.filter(s=>s.signal_rank==='A').length, B: filtered.filter(s=>s.signal_rank==='B').length, C: filtered.filter(s=>s.signal_rank==='C').length }

  return (
    <div style={{ padding:'24px', fontFamily:F }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px', display:'flex', alignItems:'center', gap:'8px' }}>
            Live signals
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#22c55e', display:'inline-block', boxShadow:'0 0 8px #22c55e', animation:'pulse 2s infinite' }} />
          </h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>
            {totalFiltered} active · realtime updates
            {newCount > 0 && <span style={{ marginLeft:'8px', color:'#22c55e', fontWeight:'600' }}>+{newCount} new this session</span>}
          </p>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {/* Direction filter */}
          <div style={{ display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'9px', padding:'3px' }}>
            {['all','long','short','watch'].map(f => (
              <button key={f} onClick={() => setFilterDir(f)} style={{
                padding:'5px 12px', borderRadius:'7px', border:'none', fontSize:'12px', fontWeight:'500', cursor:'pointer',
                background: filterDir === f ? '#1e2235' : 'transparent',
                color: filterDir === f ? '#e8eaf2' : '#555870',
                fontFamily: F,
              }}>
                {f === 'all' ? 'All dirs' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Rank filter */}
          <div style={{ display:'flex', background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'9px', padding:'3px', gap:'2px' }}>
            <button onClick={() => setFilterRank('all')} style={{ padding:'5px 10px', borderRadius:'7px', border:'none', fontSize:'12px', cursor:'pointer', background: filterRank==='all' ? '#1e2235' : 'transparent', color: filterRank==='all' ? '#e8eaf2' : '#555870', fontFamily:F }}>
              All ranks
            </button>
            {(['S','A','B','C'] as const).map(r => {
              const rm = RANK_META[r]
              return (
                <button key={r} onClick={() => setFilterRank(r)} style={{
                  padding:'5px 10px', borderRadius:'7px', border:'none', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:F,
                  background: filterRank===r ? rm.bg : 'transparent',
                  color: filterRank===r ? rm.text : '#555870',
                }}>
                  {r} {counts[r] > 0 ? `(${counts[r]})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Rank summary pills */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
        {(['S','A','B','C'] as const).filter(r => counts[r] > 0).map(r => {
          const rm = RANK_META[r]
          return (
            <div key={r} style={{ padding:'6px 14px', borderRadius:'8px', background:rm.bg, border:`1px solid ${rm.border}`, display:'flex', alignItems:'center', gap:'6px' }}>
              <span style={{ fontSize:'12px', fontWeight:'700', color:rm.text }}>{r === 'S' ? '⭐ ' : ''}{RANK_META[r].label}</span>
              <span style={{ fontSize:'12px', color:rm.text, fontWeight:'600' }}>{counts[r]}</span>
            </div>
          )
        })}
        {totalFiltered === 0 && !loading && (
          <div style={{ fontSize:'12px', color:'#555870' }}>No signals match current filters</div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:'center', padding:'80px', color:'#555870' }}>Loading signals…</div>
      )}

      {/* Empty */}
      {!loading && signals.length === 0 && (
        <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'60px', textAlign:'center' }}>
          <div style={{ fontSize:'36px', marginBottom:'12px' }}>📡</div>
          <p style={{ color:'#8b90a8', fontSize:'14px', marginBottom:'6px' }}>No signals yet</p>
          <p style={{ color:'#555870', fontSize:'12px' }}>Scanner runs every hour — check back soon</p>
        </div>
      )}

      {/* Grouped signals */}
      {!loading && Object.entries(groups).map(([rank, scenarioMap]) => {
        const rm = RANK_META[rank as keyof typeof RANK_META]
        return (
          <div key={rank} style={{ marginBottom:'28px' }}>
            {/* Rank header */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
              <div style={{ padding:'4px 12px', borderRadius:'6px', background:rm.bg, border:`1px solid ${rm.border}` }}>
                <span style={{ fontSize:'12px', fontWeight:'700', color:rm.text }}>{rank === 'S' ? '⭐ ' : ''}{rm.label}</span>
              </div>
              <div style={{ height:'1px', flex:1, background:'rgba(255,255,255,0.06)' }} />
              <span style={{ fontSize:'11px', color:'#555870' }}>{Object.values(scenarioMap).flat().length} signals</span>
            </div>

            {/* Scenario sub-groups */}
            {Object.entries(scenarioMap).map(([scId, sigs]) => {
              const sc = SCENARIO[parseInt(scId)]
              return (
                <div key={scId} style={{ marginBottom:'16px' }}>
                  {/* Scenario label */}
                  <div style={{ fontSize:'11px', color:'#555870', marginBottom:'8px', paddingLeft:'4px', display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontWeight:'600', color:'#8b90a8' }}>S{scId} · {sc?.name}</span>
                    <span style={{ padding:'1px 6px', borderRadius:'3px', fontSize:'10px', background: sc?.dir === 'long' ? 'rgba(34,197,94,0.1)' : sc?.dir === 'short' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: sc?.dir === 'long' ? '#22c55e' : sc?.dir === 'short' ? '#ef4444' : '#f59e0b' }}>
                      {sc?.dir?.toUpperCase()}
                    </span>
                    <span style={{ color:'#3a3d52' }}>·</span>
                    <span>{sigs.length} signal{sigs.length > 1 ? 's' : ''}</span>
                  </div>

                  {/* Signal cards */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {(sigs as any[]).map(s => (
                      <SignalCard key={s.id} s={s} isNew={newIds.has(s.id)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
