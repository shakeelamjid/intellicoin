'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIOS = [
  { id:1,  name:'Strong bull trend', dir:'LONG'  },
  { id:2,  name:'Strong bear trend', dir:'SHORT' },
  { id:3,  name:'Weak rally',        dir:'SHORT' },
  { id:4,  name:'Weak sell-off',     dir:'LONG'  },
  { id:5,  name:'Bull trap',         dir:'SHORT' },
  { id:6,  name:'Bear trap',         dir:'LONG'  },
  { id:7,  name:'Long squeeze',      dir:'SHORT' },
  { id:8,  name:'Short squeeze',     dir:'LONG'  },
  { id:9,  name:'Coil / buildup',    dir:'WATCH' },
]

const RANK_OPTIONS = [
  { value:'S',   label:'Rank S only — elite signals'       },
  { value:'SA',  label:'Rank S + A'                        },
  { value:'SAB', label:'Rank S + A + B'                    },
  { value:'ALL', label:'All ranks including C (watchlist)' },
]

const TIMEFRAMES = [
  { value:'1m',  label:'1 minute'   },
  { value:'3m',  label:'3 minutes'  },
  { value:'5m',  label:'5 minutes'  },
  { value:'15m', label:'15 minutes' },
  { value:'30m', label:'30 minutes' },
  { value:'1h',  label:'1 hour'     },
  { value:'4h',  label:'4 hours'    },
  { value:'1d',  label:'1 day'      },
]

export default function ScannerConfigPage() {
  const [config,   setConfig]   = useState<any>(null)
  const [origTf,   setOrigTf]   = useState<string>('')
  const [running,  setRunning]  = useState(false)
  const [runLog,   setRunLog]   = useState<string[]>([])
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [blacklistInput, setBlacklistInput] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('scanner_config').select('*').single()
      .then(({ data }) => {
        if (data) {
          setConfig(data)
          setOrigTf(data.kline_interval || '1h')
        }
      })
  }, [])

  async function save() {
    if (!config) return
    setSaving(true)
    const supabase = createClient()

    // If timeframe changed, expire all active signals
    if (origTf && origTf !== config.kline_interval) {
      await supabase.from('signals').update({ status: 'expired' }).eq('status', 'active')
      setRunLog([
        `⚡ Timeframe changed from ${origTf} to ${config.kline_interval}`,
        'All active signals expired — next scan will generate fresh signals',
      ])
      setOrigTf(config.kline_interval)
    }

    await supabase.from('scanner_config').update({
      scanner_enabled:       config.scanner_enabled,
      enabled_scenarios:     (config.enabled_scenarios || []).filter((s: number) => s >= 1 && s <= 9),
      min_rank_to_broadcast: config.min_rank_to_broadcast,
      blacklisted_symbols:   config.blacklisted_symbols,
      kline_interval:        config.kline_interval,
    }).eq('id', config.id)

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function triggerScan() {
    setRunning(true)
    setRunLog(['Triggering scanner…'])
    try {
      const res  = await fetch('/api/trigger-scan', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setRunLog(prev => [...prev, '✓ Scanner triggered successfully'])
      } else {
        setRunLog(prev => [...prev, `✗ Error: ${json.error || 'Unknown'}`])
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
        : [...(config.enabled_scenarios || []), id].sort((a: number, b: number) => a - b)
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

  if (!config) return <div style={{ padding:'40px', color:'#555870', fontFamily:F }}>Loading…</div>

  const card: React.CSSProperties = {
    background:'#111420', border:'1px solid rgba(255,255,255,0.07)',
    borderRadius:'14px', padding:'20px', marginBottom:'16px',
  }
  const sectionTitle: React.CSSProperties = {
    fontSize:'14px', fontWeight:'600', color:'#e8eaf2', marginBottom:'6px',
  }
  const sectionSub: React.CSSProperties = {
    fontSize:'12px', color:'#8b90a8', marginBottom:'14px',
  }

  return (
    <div style={{ padding:'28px', fontFamily:F, maxWidth:'800px' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'5px' }}>Scanner config</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>
            Last scan: {config.last_scan_at ? new Date(config.last_scan_at).toLocaleString() : 'Never'}
            {' · '}
            <span style={{ color: config.last_scan_status?.startsWith('ok') ? '#22c55e' : '#f59e0b' }}>
              {config.last_scan_status || '—'}
            </span>
          </p>
        </div>
        <button onClick={save} disabled={saving} style={{
          padding:'9px 20px',
          background: saved ? 'rgba(34,197,94,0.15)' : '#3b82f6',
          color: saved ? '#22c55e' : 'white',
          border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none',
          borderRadius:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer',
          fontFamily:F, transition:'all 0.2s',
        }}>
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Manual trigger */}
      <div style={card}>
        <h2 style={sectionTitle}>Manual scan trigger</h2>
        <p style={sectionSub}>Trigger the scanner immediately outside the schedule.</p>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button onClick={triggerScan} disabled={running} style={{
            padding:'10px 24px',
            background: running ? '#1e2235' : 'rgba(239,68,68,0.15)',
            color: running ? '#555870' : '#ef4444',
            border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:'9px', fontSize:'13px', fontWeight:'600',
            cursor:'pointer', fontFamily:F,
            display:'flex', alignItems:'center', gap:'8px',
          }}>
            {running ? (
              <>
                <span style={{ width:'14px', height:'14px', border:'2px solid #555870', borderTopColor:'#ef4444', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }}/>
                Running…
              </>
            ) : '⚡ Run scan now'}
          </button>
          <a href="https://intellicoinapp.com/scanner/log_viewer.php" target="_blank" rel="noopener noreferrer"
            style={{ padding:'10px 18px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', fontSize:'13px', color:'#8b90a8', textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
            📋 Live log ↗
          </a>
        </div>
        {runLog.length > 0 && (
          <div style={{ marginTop:'14px', background:'#0b0d14', borderRadius:'8px', padding:'12px 14px', fontFamily:'monospace', fontSize:'11px', color:'#8b90a8', lineHeight:'1.8' }}>
            {runLog.map((line, i) => (
              <div key={i} style={{ color: line.startsWith('✓') ? '#22c55e' : line.startsWith('✗') ? '#ef4444' : line.startsWith('⚡') ? '#f59e0b' : '#8b90a8' }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeframe */}
      <div style={card}>
        <h2 style={sectionTitle}>Candle timeframe</h2>
        <p style={sectionSub}>
          Which candle interval to use for analysis. Cron runs every 15min — set frequency in GoDaddy cPanel.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {TIMEFRAMES.map(tf => (
            <label key={tf.value} style={{
              display:'flex', alignItems:'center', gap:'10px', cursor:'pointer',
              padding:'8px 12px', borderRadius:'8px',
              background: config.kline_interval === tf.value ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${config.kline_interval === tf.value ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
              transition:'all 0.1s',
            }}>
              <input type="radio" checked={config.kline_interval === tf.value}
                onChange={() => setConfig({ ...config, kline_interval: tf.value })}
                style={{ accentColor:'#3b82f6', width:'14px', height:'14px' }} />
              <span style={{ fontSize:'13px', color: config.kline_interval === tf.value ? '#e8eaf2' : '#8b90a8' }}>
                {tf.label}
              </span>
              {config.kline_interval === tf.value && (
                <span style={{ marginLeft:'auto', fontSize:'10px', color:'#3b82f6', fontWeight:'600' }}>ACTIVE</span>
              )}
            </label>
          ))}
        </div>

        {origTf && config.kline_interval !== origTf && (
          <div style={{ marginTop:'12px', padding:'10px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', fontSize:'12px', color:'#fca5a5' }}>
            ⚠️ Changing from <strong>{origTf}</strong> to <strong>{config.kline_interval}</strong> will expire all active signals. Next scan generates fresh ones.
          </div>
        )}
      </div>

      {/* Scanner on/off */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h2 style={sectionTitle}>Scheduled scanner</h2>
            <p style={{ fontSize:'12px', color:'#8b90a8' }}>Runs on GoDaddy cron every 15min</p>
          </div>
          <button onClick={() => setConfig({ ...config, scanner_enabled: !config.scanner_enabled })} style={{
            width:'44px', height:'24px', borderRadius:'12px', border:'none', cursor:'pointer',
            background: config.scanner_enabled ? '#22c55e' : '#1e2235',
            position:'relative', transition:'background 0.2s', flexShrink:0,
          }}>
            <span style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left: config.scanner_enabled ? '22px' : '2px', transition:'left 0.2s' }} />
          </button>
        </div>
      </div>

      {/* Min rank to broadcast */}
      <div style={card}>
        <h2 style={sectionTitle}>Minimum rank to broadcast</h2>
        <p style={sectionSub}>Only signals at or above this rank will be sent to users and Telegram</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {RANK_OPTIONS.map(opt => (
            <label key={opt.value} style={{
              display:'flex', alignItems:'center', gap:'10px', cursor:'pointer',
              padding:'10px 14px', borderRadius:'9px',
              background: config.min_rank_to_broadcast === opt.value ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: `1px solid ${config.min_rank_to_broadcast === opt.value ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
              transition:'all 0.1s',
            }}>
              <input type="radio" checked={config.min_rank_to_broadcast === opt.value}
                onChange={() => setConfig({ ...config, min_rank_to_broadcast: opt.value })}
                style={{ accentColor:'#3b82f6', width:'15px', height:'15px' }} />
              <span style={{ fontSize:'13px', color:'#e8eaf2' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Enabled scenarios */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
          <h2 style={sectionTitle}>Enabled scenarios</h2>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setConfig({ ...config, enabled_scenarios:[1,2,3,4,5,6,7,8,9] })}
              style={{ fontSize:'11px', color:'#555870', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>All</button>
            <button onClick={() => setConfig({ ...config, enabled_scenarios:[] })}
              style={{ fontSize:'11px', color:'#555870', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>None</button>
          </div>
        </div>
        <p style={sectionSub}>Disabled scenarios will never generate signals</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'8px' }}>
          {SCENARIOS.map(sc => {
            const on = config.enabled_scenarios?.includes(sc.id)
            const dc = sc.dir==='LONG'?'#22c55e':sc.dir==='SHORT'?'#ef4444':'#f59e0b'
            return (
              <div key={sc.id} onClick={() => toggleScenario(sc.id)} style={{
                display:'flex', alignItems:'center', gap:'10px',
                padding:'10px 14px', borderRadius:'9px', cursor:'pointer',
                background: on ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${on ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)'}`,
                opacity: on ? 1 : 0.5, transition:'all 0.1s',
              }}>
                <div style={{ width:'22px', height:'22px', borderRadius:'50%', background: on ? 'rgba(59,130,246,0.2)' : '#1e2235', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'700', color: on ? '#60a5fa' : '#555870', flexShrink:0 }}>
                  {sc.id}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', fontWeight:'500', color:'#e8eaf2' }}>{sc.name}</div>
                </div>
                <span style={{ fontSize:'9px', fontWeight:'700', color:dc, padding:'1px 6px', borderRadius:'3px', background:`${dc}15` }}>
                  {sc.dir}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Blacklist */}
      <div style={card}>
        <h2 style={sectionTitle}>Coin blacklist</h2>
        <p style={sectionSub}>These coins will never generate signals</p>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          <input value={blacklistInput} onChange={e => setBlacklistInput(e.target.value)}
            placeholder="e.g. BTC or BTCUSDT" onKeyDown={e => e.key==='Enter' && addBlacklist()}
            style={{ flex:1, padding:'8px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none' }} />
          <button onClick={addBlacklist} style={{ padding:'8px 16px', background:'#1e2235', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', cursor:'pointer', fontFamily:F }}>
            Add
          </button>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {(config.blacklisted_symbols || []).map((sym: string) => (
            <span key={sym} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'6px', fontSize:'12px', color:'#fca5a5' }}>
              {sym}
              <button onClick={() => removeBlacklist(sym)} style={{ background:'none', border:'none', color:'#ef4444', padding:'0 0 0 2px', fontSize:'14px', lineHeight:'1', cursor:'pointer' }}>×</button>
            </span>
          ))}
          {(!config.blacklisted_symbols || config.blacklisted_symbols.length === 0) && (
            <span style={{ fontSize:'12px', color:'#555870' }}>No coins blacklisted</span>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
