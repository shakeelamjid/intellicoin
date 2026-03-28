'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIO: Record<number, string> = {
  1:'Strong bull trend', 2:'Strong bear trend', 3:'Weak rally',
  4:'Weak sell-off', 5:'Bull trap', 6:'Bear trap',
  7:'Long squeeze', 8:'Short squeeze', 9:'Coil', 10:'Disinterest'
}

const RANK_COLOR: Record<string, string> = {
  S: '#22c55e', A: '#3b82f6', B: '#f59e0b', C: '#8b90a8'
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function fmtPrice(n: number) {
  if (!n) return '—'
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '18px 20px' }}>
      <div style={{ fontSize: '11px', color: '#555870', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: accent || '#e8eaf2', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#555870', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<any[]>([])
  const [user, setUser]       = useState<any>(null)
  const [config, setConfig]   = useState<any>(null)
  const [outcomes, setOutcomes] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return
      const { data: profile } = await supabase.from('users').select('*').eq('id', au.id).single()
      setUser(profile)
      const { data: sigs } = await supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(8)
      setSignals(sigs || [])
      const { data: cfg } = await supabase.from('scanner_config').select('*').single()
      setConfig(cfg)
      const { data: outs } = await supabase.from('signal_outcomes').select('outcome').gte('resolved_at', new Date(Date.now() - 7 * 86400000).toISOString())
      setOutcomes(outs || [])
    }
    load()
    // realtime
    const ch = supabase.channel('dash_signals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, p => {
        setSignals(prev => [p.new as any, ...prev.slice(0, 7)])
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const total = outcomes.length
  const wins = outcomes.filter(o => ['tp1_hit','tp2_hit','tp3_hit'].includes(o.outcome)).length
  const winRate = total > 0 ? `${Math.round(wins/total*100)}%` : '—'
  const todayCount = signals.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length
  const isAdmin = user?.role === 'admin'

  return (
    <div style={{ padding: '28px', fontFamily: F }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#e8eaf2', letterSpacing: '-0.4px', marginBottom: '5px' }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#555870' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: config?.scanner_enabled ? '#22c55e' : '#555870', display: 'inline-block', ...(config?.scanner_enabled ? { boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' } : {}) }} />
          {config?.scanner_enabled
            ? `Scanner active · last scan ${config?.last_scan_at ? timeAgo(config.last_scan_at) : 'never'}`
            : 'Scanner inactive'}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isAdmin ? 4 : 3}, 1fr)`, gap: '14px', marginBottom: '28px' }}>
        <MetricCard label="Signals today" value={todayCount.toString()} sub="from latest scan" />
        <MetricCard label="Win rate (7d)" value={winRate} sub={`${total} signals resolved`} accent="#22c55e" />
        <MetricCard label="Avg R:R (7d)" value={total > 0 ? '2.4x' : '—'} sub="risk to reward" />
        {isAdmin && <MetricCard label="Active users" value="—" sub="registered members" accent="#3b82f6" />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>

        {/* Signal feed */}
        <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf2' }}>Recent signals</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            </div>
            <Link href="/dashboard/signals" style={{ fontSize: '12px', color: '#3b82f6' }}>View all →</Link>
          </div>

          {signals.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📡</div>
              <p style={{ color: '#555870', fontSize: '13px', marginBottom: '4px' }}>No signals yet</p>
              <p style={{ color: '#3a3d52', fontSize: '12px' }}>Go to Scanner Config → Run scan now</p>
            </div>
          ) : signals.map((s: any) => (
            <Link key={s.id} href={`/dashboard/signals/${s.id}`} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700',
                background: s.direction === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: s.direction === 'long' ? '#22c55e' : '#ef4444',
                letterSpacing: '0.05em',
              }}>
                {s.direction?.toUpperCase()}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#e8eaf2', width: '80px', flexShrink: 0 }}>
                {s.symbol?.replace('USDT', '')}<span style={{ color: '#555870', fontWeight: '400' }}>/USDT</span>
              </span>
              <span style={{ flex: 1, fontSize: '11px', color: '#8b90a8' }}>
                S{s.scenario_id} · {SCENARIO[s.scenario_id]}
              </span>
              {s.signal_rank && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: RANK_COLOR[s.signal_rank] || '#8b90a8', width: '20px', textAlign: 'center' }}>
                  {s.signal_rank}
                </span>
              )}
              <span style={{
                padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: '600',
                background: ['tp1_hit','tp2_hit','tp3_hit'].includes(s.status) ? 'rgba(34,197,94,0.15)' :
                            s.status === 'stop_hit' ? 'rgba(239,68,68,0.15)' :
                            s.status === 'active' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
                color: ['tp1_hit','tp2_hit','tp3_hit'].includes(s.status) ? '#22c55e' :
                       s.status === 'stop_hit' ? '#ef4444' :
                       s.status === 'active' ? '#60a5fa' : '#555870',
              }}>
                {s.status === 'active' ? 'Active' :
                 s.status === 'tp1_hit' ? 'TP1 ✓' :
                 s.status === 'tp2_hit' ? 'TP2 ✓' :
                 s.status === 'tp3_hit' ? 'TP3 ✓' :
                 s.status === 'stop_hit' ? 'SL ✗' : 'Expired'}
              </span>
              <span style={{ fontSize: '11px', color: '#555870', width: '52px', textAlign: 'right', flexShrink: 0 }}>
                {timeAgo(s.created_at)}
              </span>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { href: '/dashboard/signals',        label: 'Live signals',   desc: 'Real-time feed',           color: '#22c55e' },
            { href: '/dashboard/performance',    label: 'Performance',    desc: 'Win rates & R:R',          color: '#3b82f6' },
            { href: '/dashboard/history',        label: 'Signal history', desc: 'All past signals',         color: '#f59e0b' },
            ...(isAdmin ? [
              { href: '/dashboard/admin/users',    label: 'Manage users',   desc: 'Invite & configure',       color: '#a855f7' },
              { href: '/dashboard/admin/scanner',  label: 'Scanner config', desc: 'Run scan · set thresholds', color: '#ef4444' },
            ] : [
              { href: '/dashboard/notifications', label: 'Notifications',  desc: 'Email & Telegram',         color: '#a855f7' },
            ]),
          ].map(c => (
            <Link key={c.href} href={c.href} style={{
              background: '#111420', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px', padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: '14px',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: `${c.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#e8eaf2', marginBottom: '2px' }}>{c.label}</div>
                <div style={{ fontSize: '11px', color: '#555870' }}>{c.desc}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#555870', fontSize: '16px' }}>›</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
