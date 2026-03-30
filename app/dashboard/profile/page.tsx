'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width:'44px', height:'24px', borderRadius:'12px', border:'none', background: value ? '#3b82f6' : '#1e2235', position:'relative', transition:'background 0.2s', cursor:'pointer', flexShrink:0 }}>
      <span style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left: value ? '22px' : '2px', transition:'left 0.2s' }} />
    </button>
  )
}

export default function ProfilePage() {
  const [user,    setUser]    = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ok: boolean; msg: string} | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single()
      if (profile) { setUser(profile); setEditing({ ...profile }) }
    })
  }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('users').update({
      full_name:            editing.full_name,
      notify_email:         editing.notify_email,
      notification_email:   editing.notification_email,
      notify_telegram:      editing.notify_telegram,
      notification_telegram:editing.notification_telegram,
      telegram_chat_id:     editing.telegram_chat_id,
      quiet_hours_start:    editing.quiet_hours_start,
      quiet_hours_end:      editing.quiet_hours_end,
      weekend_signals:      editing.weekend_signals,
      // Auto-trade settings
      auto_trade_active:    editing.auto_trade_active,
      auto_trade_ranks:     editing.auto_trade_ranks,
      auto_trade_size_type: editing.auto_trade_size_type,
      auto_trade_size:      editing.auto_trade_size,
      auto_trade_max_lev:   editing.auto_trade_max_lev,
      binance_api_key:      editing.binance_api_key,
      binance_api_secret:   editing.binance_api_secret,
    }).eq('id', editing.id)
    setUser({ ...editing })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testConnection() {
    if (!editing?.binance_api_key || !editing?.binance_api_secret) {
      setTestResult({ ok: false, msg: 'Enter API key and secret first' })
      return
    }
    setTesting(true); setTestResult(null)
    try {
      const ts  = Date.now()
      const qs  = `timestamp=${ts}`
      const sig = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(editing.binance_api_secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      ).then(k => crypto.subtle.sign('HMAC', k, new TextEncoder().encode(qs)))
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
      const res = await fetch(`https://fapi.binance.com/fapi/v2/balance?${qs}&signature=${hex}`, {
        headers: { 'X-MBX-APIKEY': editing.binance_api_key }
      })
      const data = await res.json()
      if (res.ok) {
        const usdt = data.find((a: any) => a.asset === 'USDT')
        setTestResult({ ok: true, msg: `Connected! USDT balance: $${parseFloat(usdt?.availableBalance || '0').toFixed(2)}` })
      } else {
        setTestResult({ ok: false, msg: data.msg || 'Connection failed' })
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message })
    }
    setTesting(false)
  }

  if (!user || !editing) return <div style={{ padding:'40px', color:'#555870', fontFamily:F }}>Loading…</div>

  const inp: React.CSSProperties = { width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:F }
  const lbl: React.CSSProperties = { display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }
  const card: React.CSSProperties = { background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'20px', marginBottom:'14px' }
  const row: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.06)', marginBottom:'8px' }

  const canAutoTrade = user.auto_trade_enabled === true

  return (
    <div style={{ padding:'24px', fontFamily:F, maxWidth:'600px' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px' }}>My profile</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>{user.email} · {user.role}</p>
        </div>
        <button onClick={save} disabled={saving} style={{
          padding:'9px 20px', fontFamily:F, cursor:'pointer',
          background: saved ? 'rgba(34,197,94,0.15)' : '#3b82f6',
          color: saved ? '#22c55e' : 'white',
          border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none',
          borderRadius:'9px', fontSize:'13px', fontWeight:'600', transition:'all 0.2s',
        }}>
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Profile */}
      <div style={card}>
        <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Profile</div>
        <div style={{ marginBottom:'12px' }}>
          <label style={lbl}>Full name</label>
          <input value={editing.full_name || ''} onChange={e => setEditing({ ...editing, full_name: e.target.value })} style={inp} />
        </div>
        <div>
          <label style={lbl}>Email</label>
          <input value={editing.email || ''} disabled style={{ ...inp, opacity: 0.5, cursor:'not-allowed' }} />
        </div>
      </div>

      {/* Notifications */}
      <div style={card}>
        <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Notifications</div>
        <div style={row}>
          <div>
            <div style={{ fontSize:'13px', color:'#e8eaf2' }}>Telegram DM</div>
            <div style={{ fontSize:'11px', color:'#555870' }}>Send signals to your personal Telegram</div>
          </div>
          <Toggle value={!!editing.notification_telegram} onChange={() => setEditing({ ...editing, notification_telegram: !editing.notification_telegram, notify_telegram: !editing.notification_telegram })} />
        </div>
        {editing.notification_telegram && (
          <div style={{ marginBottom:'8px' }}>
            <label style={lbl}>Telegram Chat ID</label>
            <input value={editing.telegram_chat_id || ''} onChange={e => setEditing({ ...editing, telegram_chat_id: e.target.value })}
              placeholder="Get from @userinfobot on Telegram" style={inp} />
          </div>
        )}
        <div style={row}>
          <div>
            <div style={{ fontSize:'13px', color:'#e8eaf2' }}>Weekend signals</div>
            <div style={{ fontSize:'11px', color:'#555870' }}>Receive signals on Saturday & Sunday</div>
          </div>
          <Toggle value={!!editing.weekend_signals} onChange={() => setEditing({ ...editing, weekend_signals: !editing.weekend_signals })} />
        </div>
        <div style={{ marginTop:'8px' }}>
          <label style={lbl}>Quiet hours (UTC) — no alerts during this window</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {[{ label:'From', key:'quiet_hours_start' }, { label:'Until', key:'quiet_hours_end' }].map(f => (
              <div key={f.key}>
                <label style={{ ...lbl, marginBottom:'4px' }}>{f.label}</label>
                <select value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}
                  style={{ ...inp, cursor:'pointer' }}>
                  <option value="">Off</option>
                  {Array.from({ length:24 }, (_,i) => (
                    <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-trade */}
      {canAutoTrade ? (
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf2' }}>Auto-trade bot</div>
              <div style={{ fontSize:'11px', color:'#555870' }}>Automatically place Binance Futures orders on signals</div>
            </div>
            <Toggle value={!!editing.auto_trade_active} onChange={() => setEditing({ ...editing, auto_trade_active: !editing.auto_trade_active })} />
          </div>

          {editing.auto_trade_active && (<>

            {/* Ranks */}
            <div style={{ marginBottom:'12px' }}>
              <label style={lbl}>Auto-trade on ranks</label>
              <div style={{ display:'flex', gap:'8px' }}>
                {[
                  { v:'S', label:'S', color:'#22c55e', bg:'rgba(34,197,94,0.15)' },
                  { v:'A', label:'A', color:'#60a5fa', bg:'rgba(59,130,246,0.15)' },
                  { v:'B', label:'B', color:'#f59e0b', bg:'rgba(245,158,11,0.15)' },
                ].map(r => {
                  const on = (editing.auto_trade_ranks || ['S']).includes(r.v)
                  return (
                    <button key={r.v} onClick={() => {
                      const cur = editing.auto_trade_ranks || ['S']
                      setEditing({ ...editing, auto_trade_ranks: on ? cur.filter((x: string) => x !== r.v) : [...cur, r.v] })
                    }} style={{
                      flex:1, padding:'10px', borderRadius:'9px', cursor:'pointer', fontFamily:F,
                      border: on ? `1px solid ${r.color}50` : '1px solid rgba(255,255,255,0.08)',
                      background: on ? r.bg : 'rgba(255,255,255,0.03)',
                      color: on ? r.color : '#555870',
                      fontSize:'16px', fontWeight:'800',
                    }}>{r.label}</button>
                  )
                })}
              </div>
            </div>

            {/* Trade size */}
            <div style={{ marginBottom:'12px' }}>
              <label style={lbl}>Trade size</label>
              <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                {[{ v:'fixed', l:'Fixed USDT' }, { v:'percent', l:'% of balance' }].map(t => (
                  <button key={t.v} onClick={() => setEditing({ ...editing, auto_trade_size_type: t.v })} style={{
                    flex:1, padding:'8px', borderRadius:'8px', cursor:'pointer', fontFamily:F, fontSize:'12px', fontWeight:'600',
                    border: editing.auto_trade_size_type === t.v ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    background: editing.auto_trade_size_type === t.v ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                    color: editing.auto_trade_size_type === t.v ? '#60a5fa' : '#8b90a8',
                  }}>{t.l}</button>
                ))}
              </div>
              <input type="number" value={editing.auto_trade_size || ''} onChange={e => setEditing({ ...editing, auto_trade_size: parseFloat(e.target.value) })}
                placeholder={editing.auto_trade_size_type === 'percent' ? '% of balance e.g. 2' : 'USDT amount e.g. 50'}
                style={inp} />
              <p style={{ fontSize:'11px', color:'#555870', marginTop:'5px' }}>
                {editing.auto_trade_size_type === 'percent'
                  ? `${editing.auto_trade_size || 0}% of your available balance per trade`
                  : `$${editing.auto_trade_size || 0} USDT per trade`}
              </p>
            </div>

            {/* Max leverage */}
            <div style={{ marginBottom:'14px' }}>
              <label style={lbl}>Max leverage cap — {editing.auto_trade_max_lev || 10}x</label>
              <input type="range" min="1" max="20" value={editing.auto_trade_max_lev || 10}
                onChange={e => setEditing({ ...editing, auto_trade_max_lev: parseInt(e.target.value) })}
                style={{ width:'100%', accentColor:'#3b82f6' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#555870', marginTop:'3px' }}>
                <span>1x</span><span>10x</span><span>20x</span>
              </div>
            </div>

            {/* API Keys */}
            <div style={{ padding:'14px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'9px', marginBottom:'12px' }}>
              <div style={{ fontSize:'11px', color:'#f59e0b', marginBottom:'8px', fontWeight:'600' }}>Binance Futures API Keys</div>
              <div style={{ fontSize:'11px', color:'#8b90a8', marginBottom:'12px' }}>
                Use a Futures-only API key with trading permissions. Never enable withdrawals.
              </div>
              <div style={{ marginBottom:'10px' }}>
                <label style={lbl}>API Key</label>
                <input value={editing.binance_api_key || ''} onChange={e => setEditing({ ...editing, binance_api_key: e.target.value })}
                  placeholder="Your Binance Futures API key" style={inp} />
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label style={lbl}>API Secret</label>
                <div style={{ position:'relative' }}>
                  <input type={showSecret ? 'text' : 'password'} value={editing.binance_api_secret || ''}
                    onChange={e => setEditing({ ...editing, binance_api_secret: e.target.value })}
                    placeholder="Your Binance Futures API secret" style={{ ...inp, paddingRight:'80px' }} />
                  <button onClick={() => setShowSecret(!showSecret)} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#555870', fontSize:'11px', cursor:'pointer', fontFamily:F }}>
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <button onClick={testConnection} disabled={testing} style={{
                width:'100%', padding:'9px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)',
                borderRadius:'8px', color:'#60a5fa', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:F,
              }}>
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {testResult && (
                <div style={{ marginTop:'8px', padding:'8px 12px', borderRadius:'7px', fontSize:'12px',
                  background: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: testResult.ok ? '#22c55e' : '#ef4444',
                  border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
                </div>
              )}
            </div>
          </>)}

          {!editing.auto_trade_active && (
            <div style={{ fontSize:'12px', color:'#555870', padding:'10px 0' }}>
              Enable auto-trade to configure Binance API keys and trade settings.
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...card, opacity: 0.6 }}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#8b90a8', marginBottom:'6px' }}>Auto-trade bot</div>
          <div style={{ fontSize:'12px', color:'#555870' }}>
            Auto-trading is not enabled for your account. Contact your admin to request access.
          </div>
        </div>
      )}

    </div>
  )
}
