'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIO: Record<number, string> = {
  1:'Strong bull trend', 2:'Strong bear trend', 3:'Weak rally',
  4:'Weak sell-off', 5:'Bull trap', 6:'Bear trap',
  7:'Long squeeze', 8:'Short squeeze', 9:'Coil', 10:'Disinterest'
}

const RANK_COLOR: Record<string, { bg: string; text: string }> = {
  S: { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e' },
  A: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  B: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  C: { bg: 'rgba(139,144,168,0.1)', text: '#8b90a8' },
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m/60)}h ago`
}

function fmtPrice(n: number) {
  if (!n) return '—'
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'long'|'short'>('all')
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { setSignals(data || []); setLoading(false) })

    const ch = supabase.channel('signals_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, p => {
        setSignals(prev => [p.new as any, ...prev])
        setNewCount(n => n + 1)
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const filtered = signals.filter(s => filter === 'all' || s.direction === filter)

  return (
    <div style={{ padding: '28px', fontFamily: F }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#e8eaf2', letterSpacing: '-0.4px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Live signals
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }} />
          </h1>
          <p style={{ fontSize: '12px', color: '#555870' }}>Updates in real time · {signals.length} signals loaded</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {newCount > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: '20px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '11px', fontWeight: '600', animation: 'pulse 2s infinite' }}>
              +{newCount} new
            </span>
          )}
          <div style={{ display: 'flex', background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px', padding: '3px' }}>
            {(['all','long','short'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 14px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '500',
                background: filter === f ? '#1e2235' : 'transparent',
                color: filter === f ? '#e8eaf2' : '#555870',
                transition: 'all 0.1s',
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#555870' }}>Loading signals…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📡</div>
          <p style={{ color: '#8b90a8', fontSize: '14px', marginBottom: '6px' }}>No signals yet</p>
          <p style={{ color: '#555870', fontSize: '12px' }}>Go to Scanner Config and run a scan to generate signals</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((s: any) => {
            const rank = s.signal_rank || 'B'
            const rc = RANK_COLOR[rank] || RANK_COLOR.B
            return (
              <div key={s.id} style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px 20px', transition: 'border-color 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', background: s.direction === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: s.direction === 'long' ? '#22c55e' : '#ef4444' }}>
                    {s.direction?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#e8eaf2', letterSpacing: '-0.3px' }}>
                    {s.symbol?.replace('USDT','')}<span style={{ color: '#555870', fontWeight: '400', fontSize: '13px' }}>/USDT</span>
                  </span>
                  <span style={{ padding: '2px 9px', borderRadius: '5px', fontSize: '11px', background: '#1e2235', color: '#8b90a8' }}>
                    S{s.scenario_id} · {SCENARIO[s.scenario_id]}
                  </span>
                  <span style={{ padding: '2px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: '700', background: rc.bg, color: rc.text }}>
                    Rank {rank}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#555870' }}>{timeAgo(s.created_at)}</span>
                </div>

                {/* Trade setup grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { label: 'Entry zone', val: `${fmtPrice(s.entry_low)} – ${fmtPrice(s.entry_high)}`, color: '#e8eaf2' },
                    { label: 'Stop loss',  val: fmtPrice(s.stop_loss),  color: '#ef4444' },
                    { label: 'TP1',        val: `${fmtPrice(s.tp1)} · ${s.rr_ratio ? (s.rr_ratio*0.5).toFixed(1) : '—'}x`, color: '#22c55e' },
                    { label: 'TP2',        val: `${fmtPrice(s.tp2)} · ${s.rr_ratio ? s.rr_ratio.toFixed(1) : '—'}x`,       color: '#22c55e' },
                    { label: 'TP3',        val: `${fmtPrice(s.tp3)} · ${s.rr_ratio ? (s.rr_ratio*1.6).toFixed(1) : '—'}x`, color: '#22c55e' },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#181c2e', borderRadius: '8px', padding: '9px 11px' }}>
                      <div style={{ fontSize: '10px', color: '#555870', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: item.color }}>{item.val}</div>
                    </div>
                  ))}
                </div>

                {/* Market data + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#555870' }}>
                    {s.oi_change_pct != null && <span>OI {s.oi_change_pct > 0 ? '+' : ''}{s.oi_change_pct?.toFixed(1)}%</span>}
                    {s.fr_at_signal != null && <span>FR {(s.fr_at_signal * 100).toFixed(4)}%</span>}
                    {s.adx_value != null && <span>ADX {s.adx_value?.toFixed(1)}</span>}
                    {s.suggested_leverage && <span>Lev {s.suggested_leverage}x</span>}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <a
                      href={`https://www.tradingview.com/chart/?symbol=BINANCE:${s.symbol}.P&interval=60`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ padding: '6px 14px', borderRadius: '7px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: '12px', fontWeight: '600', border: '1px solid rgba(59,130,246,0.25)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      Open chart ↗
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
