'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIOS = [
  { id: 1, name: 'Strong bull trend', dir: 'LONG' },
  { id: 2, name: 'Strong bear trend', dir: 'SHORT' },
  { id: 3, name: 'Weak rally',        dir: 'SHORT' },
  { id: 4, name: 'Weak sell-off',     dir: 'LONG'  },
  { id: 5, name: 'Bull trap',         dir: 'SHORT' },
  { id: 6, name: 'Bear trap',         dir: 'LONG'  },
  { id: 7, name: 'Long squeeze',      dir: 'SHORT' },
  { id: 8, name: 'Short squeeze',     dir: 'LONG'  },
  { id: 9, name: 'Coil / buildup',    dir: 'WATCH' },
  { id: 10, name: 'Disinterest',      dir: 'SKIP'  },
]

const RANK_OPTIONS = [
  { value: 'S',   label: 'Rank S only — elite signals' },
  { value: 'SA',  label: 'Rank S + A' },
  { value: 'SAB', label: 'Rank S + A + B' },
  { value: 'ALL', label: 'All ranks including C (watchlist)' },
]

export default function ScannerConfigPage() {
  const [config, setConfig]   = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [runLog, setRunLog]   = useState<string[]>([])
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [blacklistInput, setBlacklistInput] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('scanner_config').select('*').single()
      .then(({ data }) => { if (data) setConfig(data) })
  }, [])

  async function save() {
    if (!config) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('scanner_config').update({
      scanner_enabled:        config.scanner_enabled,
      enabled_scenarios:      config.enabled_scenarios,
      min_rank_to_broadcast:  config.min_rank_to_broadcast,
      blacklisted_symbols:    config.blacklisted_symbols,
    }).eq('id', config.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function triggerScan() {
    setRunning(true)
    setRunLog(['Triggering scanner via GitHub Actions…'])
    try {
      const res = await fetch('/api/trigger-scan', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setRunLog(prev => [...prev, '✓ Scanner workflow triggered successfully', 'Check GitHub Actions tab for live logs', 'Signals will appear in the feed within 2–3 minutes'])
      } else {
        setRunLog(prev => [...prev, `✗ Error: ${json.error || 'Unknown error'}`])
      }
    } catch (e: any) {
      setRunLog(prev => [...prev, `✗ Failed: ${e.message}`])
    }
    setRunning(false)
  }

  function toggleScenario(id: number) {
    if (!config) return
    const has = config.enabled_scenarios?.includes(id)
    setConfig({
      ...config,
      enabled_scenarios: has
        ? config.enabled_scenarios.filter((s: number) => s !== id)
        : [...(config.enabled_scenarios || []), id].sort()
    })
  }

  function addBlacklist() {
    const sym = blacklistInput.trim().toUpperCase().replace('USDT','') + 'USDT'
    if (!sym || config.blacklisted_symbols?.includes(sym)) return
    setConfig({ ...config, blacklisted_symbols: [...(config.blacklisted_symbols || []), sym] })
    setBlacklistInput('')
  }

  function removeBlacklist(sym: string) {
    setConfig({ ...config, blacklisted_symbols: config.blacklisted_symbols.filter((s: string) => s !== sym) })
  }

  if (!config) return <div style={{ padding: '40px', color: '#555870', fontFamily: F }}>Loading…</div>

  return (
    <div style={{ padding: '28px', fontFamily: F, maxWidth: '800px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#e8eaf2', letterSpacing: '-0.4px', marginBottom: '5px' }}>Scanner config</h1>
          <p style={{ fontSize: '12px', color: '#555870' }}>
            Last scan: {config.last_scan_at ? new Date(config.last_scan_at).toLocaleString() : 'Never'} · Status: {config.last_scan_status || '—'}
          </p>
        </div>
        <button onClick={save} disabled={saving} style={{
          padding: '9px 20px', background: saving ? '#1e2235' : '#3b82f6', color: 'white',
          border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600',
        }}>
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Manual scan trigger */}
      <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf2', marginBottom: '6px' }}>Manual scan trigger</h2>
        <p style={{ fontSize: '12px', color: '#8b90a8', marginBottom: '16px' }}>
          Trigger the scanner immediately outside the hourly schedule. Only admins can do this — unlimited runs.
        </p>
        <button onClick={triggerScan} disabled={running} style={{
          padding: '10px 24px', background: running ? '#1e2235' : 'rgba(239,68,68,0.15)',
          color: running ? '#555870' : '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '9px', fontSize: '13px', fontWeight: '600',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {running ? (
            <>
              <span style={{ width: '14px', height: '14px', border: '2px solid #555870', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
              Running…
            </>
          ) : '⚡ Run scan now'}
        </button>
        {runLog.length > 0 && (
          <div style={{ marginTop: '14px', background: '#0b0d14', borderRadius: '8px', padding: '12px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#8b90a8', lineHeight: '1.8' }}>
            {runLog.map((line, i) => (
              <div key={i} style={{ color: line.startsWith('✓') ? '#22c55e' : line.startsWith('✗') ? '#ef4444' : '#8b90a8' }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scanner on/off */}
      <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf2', marginBottom: '3px' }}>Scheduled scanner</h2>
            <p style={{ fontSize: '12px', color: '#8b90a8' }}>Runs automatically every hour at :05 past via GitHub Actions</p>
          </div>
          <button onClick={() => setConfig({ ...config, scanner_enabled: !config.scanner_enabled })} style={{
            width: '44px', height: '24px', borderRadius: '12px', border: 'none',
            background: config.scanner_enabled ? '#22c55e' : '#1e2235',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', top: '2px', width: '20px', height: '20px',
              borderRadius: '50%', background: 'white',
              left: config.scanner_enabled ? '22px' : '2px', transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      {/* Min rank to broadcast */}
      <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf2', marginBottom: '6px' }}>Minimum rank to broadcast</h2>
        <p style={{ fontSize: '12px', color: '#8b90a8', marginBottom: '14px' }}>Only signals at or above this rank will be sent to users and the admin Telegram group</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {RANK_OPTIONS.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 14px', borderRadius: '9px', background: config.min_rank_to_broadcast === opt.value ? 'rgba(59,130,246,0.12)' : 'transparent', border: `1px solid ${config.min_rank_to_broadcast === opt.value ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.1s' }}>
              <input type="radio" checked={config.min_rank_to_broadcast === opt.value} onChange={() => setConfig({ ...config, min_rank_to_broadcast: opt.value })}
                style={{ accentColor: '#3b82f6', width: '15px', height: '15px' }} />
              <span style={{ fontSize: '13px', color: '#e8eaf2' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Enabled scenarios */}
      <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf2', marginBottom: '6px' }}>Enabled scenarios</h2>
        <p style={{ fontSize: '12px', color: '#8b90a8', marginBottom: '14px' }}>Disabled scenarios will never generate signals</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
          {SCENARIOS.map(sc => {
            const on = config.enabled_scenarios?.includes(sc.id)
            const dirColor = sc.dir === 'LONG' ? '#22c55e' : sc.dir === 'SHORT' ? '#ef4444' : sc.dir === 'WATCH' ? '#f59e0b' : '#555870'
            return (
              <div key={sc.id} onClick={() => toggleScenario(sc.id)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '9px', cursor: 'pointer',
                background: on ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${on ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                opacity: on ? 1 : 0.5, transition: 'all 0.1s',
              }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: on ? 'rgba(59,130,246,0.2)' : '#1e2235', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: on ? '#60a5fa' : '#555870', flexShrink: 0 }}>
                  {sc.id}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#e8eaf2' }}>{sc.name}</div>
                </div>
                <span style={{ fontSize: '9px', fontWeight: '700', color: dirColor, padding: '1px 6px', borderRadius: '3px', background: `${dirColor}15` }}>
                  {sc.dir}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Blacklist */}
      <div style={{ background: '#111420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#e8eaf2', marginBottom: '6px' }}>Coin blacklist</h2>
        <p style={{ fontSize: '12px', color: '#8b90a8', marginBottom: '14px' }}>These coins will never generate signals regardless of scenario</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            value={blacklistInput} onChange={e => setBlacklistInput(e.target.value)}
            placeholder="e.g. BTC or BTCUSDT"
            onKeyDown={e => e.key === 'Enter' && addBlacklist()}
            style={{ flex: 1, padding: '8px 12px', background: '#181c2e', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', color: '#e8eaf2', fontSize: '13px', outline: 'none' }}
          />
          <button onClick={addBlacklist} style={{ padding: '8px 16px', background: '#1e2235', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', color: '#e8eaf2', fontSize: '13px' }}>
            Add
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(config.blacklisted_symbols || []).map((sym: string) => (
            <span key={sym} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '12px', color: '#fca5a5' }}>
              {sym}
              <button onClick={() => removeBlacklist(sym)} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '0 0 0 2px', fontSize: '14px', lineHeight: 1 }}>×</button>
            </span>
          ))}
          {(!config.blacklisted_symbols || config.blacklisted_symbols.length === 0) && (
            <span style={{ fontSize: '12px', color: '#555870' }}>No coins blacklisted</span>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
