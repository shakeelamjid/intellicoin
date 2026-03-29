'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

function fmtUTC(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC'
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: ok ? '#22c55e' : '#ef4444',
        boxShadow: ok ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
        flexShrink: 0,
      }}
    />
  )
}

export default function ScannerDiagnosticsPage() {
  const [config, setConfig] = useState<any>(null)
  const [signals, setSignals] = useState<any[]>([])
  const [outcomes, setOutcomes] = useState<any[]>([])
  const [scanLogs, setScanLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState('')
  const [pct, setPct] = useState(0)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [cfg, sigs, outs, logs] = await Promise.all([
        supabase.from('scanner_config').select('*').single(),
        supabase
          .from('signals')
          .select('signal_rank, direction, kline_interval, created_at, status')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('signal_outcomes')
          .select('outcome, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('scanner_logs')
          .select('*')
          .order('scanned_at', { ascending: false })
          .limit(20),
      ])

      setConfig(cfg.data)
      setSignals(sigs.data || [])
      setOutcomes(outs.data || [])
      setScanLogs(logs.data || [])
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Countdown timer — use next_slot_at first, fallback to old logic
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (!config) return

    const intervalMs = (config?.scan_interval_minutes || 15) * 60000

    function tick() {
      const now = Date.now()

      let nextScanMs: number | null = null
      let progress = 0

      if (config?.next_slot_at) {
        nextScanMs = new Date(config.next_slot_at).getTime()

        if (!Number.isNaN(nextScanMs)) {
          const slotStartMs = nextScanMs - intervalMs
          const elapsed = Math.max(0, now - slotStartMs)
          progress = Math.min(100, (elapsed / intervalMs) * 100)
        }
      } else if (config?.last_scan_at && config?.scan_interval_minutes) {
        const lastScanMs = new Date(config.last_scan_at).getTime()

        if (!Number.isNaN(lastScanMs)) {
          nextScanMs = lastScanMs + intervalMs
          const elapsed = Math.max(0, now - lastScanMs)
          progress = Math.min(100, (elapsed / intervalMs) * 100)
        }
      }

      if (!nextScanMs || Number.isNaN(nextScanMs)) {
        setCountdown('--:--')
        setPct(0)
        return
      }

      const remaining = Math.max(0, nextScanMs - now)
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)

      setCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      setPct(progress)
    }

    tick()
    timerRef.current = setInterval(tick, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [config])

  if (loading) {
    return (
      <div style={{ padding: '40px', color: '#555870', fontFamily: F }}>
        Loading diagnostics…
      </div>
    )
  }

  const scanInterval = config?.scan_interval_minutes || 15
  const lastScanAt = config?.last_scan_at
  const nextScanAt = config?.next_slot_at || null
  const isRunning =
    config?.last_scan_status === 'running...' ||
    config?.last_scan_status === 'running_manual...'
  const lastOk =
    config?.last_scan_status?.startsWith('ok') ||
    config?.last_scan_status?.startsWith('manual ok')

  const active = signals.filter(s => s.status === 'active')
  const today = signals.filter(
    s => new Date(s.created_at).toDateString() === new Date().toDateString()
  )

  const rankDist = { S: 0, A: 0, B: 0, C: 0 } as Record<string, number>
  active.forEach(s => {
    if (rankDist[s.signal_rank] !== undefined) rankDist[s.signal_rank]++
  })

  const dirDist = { long: 0, short: 0, watch: 0 } as Record<string, number>
  active.forEach(s => {
    if (dirDist[s.direction] !== undefined) dirDist[s.direction]++
  })

  const resolved = outcomes.filter(o => o.outcome !== 'expired')
  const wins = resolved.filter(o => o.outcome?.includes('tp'))
  const winRate =
    resolved.length > 0 ? Math.round((wins.length / resolved.length) * 100) : null

  const card: React.CSSProperties = {
    background: '#111420',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '16px 18px',
  }

  const lbl: React.CSSProperties = {
    fontSize: '10px',
    color: '#555870',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '8px',
  }

  return (
    <div style={{ padding: '24px', fontFamily: F, maxWidth: '1100px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#e8eaf2',
            letterSpacing: '-0.4px',
            marginBottom: '4px',
          }}
        >
          Scanner diagnostics
        </h1>
        <p style={{ fontSize: '12px', color: '#555870' }}>
          Real-time scanner health · auto-refreshes every 30s
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ ...card, gridColumn: 'span 1' }}>
          <div style={lbl}>Scanner status</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
            }}
          >
            <StatusDot ok={!isRunning && !!lastOk} />
            <span
              style={{
                fontSize: '15px',
                fontWeight: '700',
                color: isRunning ? '#f59e0b' : lastOk ? '#22c55e' : '#ef4444',
              }}
            >
              {isRunning ? 'Running now' : lastOk ? 'Healthy' : 'Check needed'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#555870' }}>
            {config?.last_scan_status || '—'}
          </div>
        </div>

        <div style={card}>
          <div style={lbl}>Last scan</div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: '#e8eaf2',
              marginBottom: '4px',
            }}
          >
            {lastScanAt ? timeAgo(lastScanAt) : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#555870' }}>
            {lastScanAt ? fmtUTC(lastScanAt) : 'No scan yet'}
          </div>
        </div>

        <div
          style={{
            ...card,
            border:
              pct > 90
                ? '1px solid rgba(34,197,94,0.3)'
                : '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div style={lbl}>Next scan in</div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: '900',
              letterSpacing: '-1px',
              color: pct > 90 ? '#22c55e' : pct > 70 ? '#f59e0b' : '#e8eaf2',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isRunning ? '⚡ Now' : countdown || '--:--'}
          </div>

          <div
            style={{
              marginTop: '6px',
              height: '3px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'linear-gradient(90deg,#3b82f6,#60a5fa)',
                borderRadius: '2px',
                transition: 'width 1s linear',
              }}
            />
          </div>

          <div style={{ fontSize: '11px', color: '#555870', marginTop: '8px' }}>
            {nextScanAt ? fmtUTC(nextScanAt) : 'Next slot unknown'}
          </div>
        </div>

        <div style={card}>
          <div style={lbl}>Configuration</div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#e8eaf2',
              marginBottom: '4px',
            }}
          >
            {config?.kline_interval || '1h'} candles · {scanInterval}min
          </div>
          <div style={{ fontSize: '11px', color: '#555870' }}>
            {config?.scanner_enabled ? '✅ Scanner enabled' : '❌ Scanner disabled'}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={card}>
          <div style={lbl}>Active signals — {active.length} total</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#555870',
                  marginBottom: '8px',
                }}
              >
                by rank
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(['S', 'A', 'B', 'C'] as const).map(r => {
                  const cnt = rankDist[r]
                  const maxCnt = Math.max(1, ...Object.values(rankDist))
                  const colors: Record<string, string> = {
                    S: '#22c55e',
                    A: '#3b82f6',
                    B: '#f59e0b',
                    C: '#8b5cf6',
                  }

                  return (
                    <div
                      key={r}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          color: colors[r],
                          width: '14px',
                        }}
                      >
                        {r}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: '4px',
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(cnt / maxCnt) * 100}%`,
                            background: colors[r],
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#555870',
                          width: '20px',
                          textAlign: 'right',
                        }}
                      >
                        {cnt}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#555870',
                  marginBottom: '8px',
                }}
              >
                by direction
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { key: 'long', color: '#22c55e' },
                  { key: 'short', color: '#ef4444' },
                  { key: 'watch', color: '#f59e0b' },
                ].map(item => {
                  const cnt = dirDist[item.key]
                  const maxCnt = Math.max(1, ...Object.values(dirDist))

                  return (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          color: item.color,
                          width: '38px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.key}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: '4px',
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(cnt / maxCnt) * 100}%`,
                            background: item.color,
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#555870',
                          width: '20px',
                          textAlign: 'right',
                        }}
                      >
                        {cnt}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={lbl}>Signals today</div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: '900',
              color: '#e8eaf2',
              letterSpacing: '-1px',
              marginBottom: '4px',
            }}
          >
            {today.length}
          </div>
          <div style={{ fontSize: '11px', color: '#555870' }}>
            created since local midnight
          </div>
        </div>

        <div style={card}>
          <div style={lbl}>Outcome tracker</div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: '900',
              color:
                winRate !== null
                  ? winRate >= 60
                    ? '#22c55e'
                    : winRate >= 40
                    ? '#f59e0b'
                    : '#ef4444'
                  : '#555870',
              letterSpacing: '-1px',
              marginBottom: '4px',
            }}
          >
            {winRate !== null ? winRate + '%' : '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#555870', marginBottom: '10px' }}>
            win rate · {wins.length}W {resolved.length - wins.length}L{' '}
            {outcomes.filter(o => o.outcome === 'expired').length} expired
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
            {[
              { label: 'TP1 hits', cnt: outcomes.filter(o => o.outcome === 'tp1_hit').length, color: '#22c55e' },
              { label: 'TP2 hits', cnt: outcomes.filter(o => o.outcome === 'tp2_hit').length, color: '#16a34a' },
              { label: 'TP3 hits', cnt: outcomes.filter(o => o.outcome === 'tp3_hit').length, color: '#15803d' },
              { label: 'SL hits', cnt: outcomes.filter(o => o.outcome === 'stop_hit').length, color: '#ef4444' },
            ].map(item => (
              <div
                key={item.label}
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <span style={{ color: '#555870' }}>{item.label}</span>
                <span style={{ fontWeight: '600', color: item.color }}>{item.cnt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          <div style={lbl}>Recent scan runs</div>
          <a
            href="https://intellicoinapp.com/scanner/log_viewer.php"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '11px', color: '#3b82f6', textDecoration: 'none' }}
          >
            Live log viewer ↗
          </a>
        </div>

        {scanLogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {scanLogs.map((log: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 80px 70px 70px 70px 1fr',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: '#8b90a8' }}>{fmtUTC(log.scanned_at)}</span>
                <span
                  style={{
                    color: log.status === 'ok' ? '#22c55e' : '#ef4444',
                    fontWeight: '600',
                  }}
                >
                  {log.status}
                </span>
                <span style={{ color: '#e8eaf2' }}>{log.signals_found ?? '—'} signals</span>
                <span style={{ color: '#555870' }}>{log.pairs_scanned ?? '—'} pairs</span>
                <span style={{ color: '#f59e0b' }}>{log.duration_s ?? '—'}s</span>
                <span style={{ color: '#555870', fontSize: '11px' }}>
                  {log.tf || '—'} · {log.notes || ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 80px 1fr',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
                alignItems: 'center',
                fontSize: '12px',
              }}
            >
              <span style={{ color: '#8b90a8' }}>
                {lastScanAt ? fmtUTC(lastScanAt) : '—'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StatusDot ok={!!lastOk} />
                <span
                  style={{
                    color: lastOk ? '#22c55e' : '#f59e0b',
                    fontWeight: '600',
                  }}
                >
                  {lastOk ? 'ok' : 'unknown'}
                </span>
              </div>
              <span style={{ color: '#555870' }}>{config?.last_scan_status || '—'}</span>
            </div>

            <div style={{ fontSize: '11px', color: '#555870', marginTop: '4px' }}>
              💡 Add a <code style={{ color: '#60a5fa', background: 'rgba(59,130,246,0.1)', padding: '1px 5px', borderRadius: '3px' }}>scanner_logs</code> table to track full scan history.
              Run in Supabase SQL:
            </div>

            <pre
              style={{
                fontSize: '10px',
                color: '#8b90a8',
                background: '#0b0d14',
                padding: '10px 12px',
                borderRadius: '8px',
                overflow: 'auto',
                marginTop: '4px',
              }}
            >
{`create table if not exists public.scanner_logs (
  id            uuid default gen_random_uuid() primary key,
  scanned_at    timestamptz default now(),
  status        text,
  signals_found integer,
  pairs_scanned integer,
  duration_s    numeric,
  tf            text,
  notes         text
);`}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
