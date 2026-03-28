'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIOS = [
  { id:1, label:'S1 Strong bull trend' }, { id:2, label:'S2 Strong bear trend' },
  { id:3, label:'S3 Weak rally' },        { id:4, label:'S4 Weak sell-off' },
  { id:5, label:'S5 Bull trap' },         { id:6, label:'S6 Bear trap' },
  { id:7, label:'S7 Long squeeze' },      { id:8, label:'S8 Short squeeze' },
  { id:9, label:'S9 Coil / buildup' },
]

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width:'40px', height:'22px', borderRadius:'11px', border:'none', background: value ? '#3b82f6' : '#1e2235', position:'relative', transition:'background 0.2s', cursor:'pointer', flexShrink:0 }}>
      <span style={{ position:'absolute', top:'2px', width:'18px', height:'18px', borderRadius:'50%', background:'white', left: value ? '20px' : '2px', transition:'left 0.2s' }} />
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px', marginBottom:'14px' }}>
      <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf2', marginBottom:'16px' }}>{title}</h2>
      {children}
    </div>
  )
}

export default function NotificationsPage() {
  const [user, setUser]     = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single()
      setUser(profile)
    })
  }, [])

  async function save() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('users').update({
      notify_email:       user.notify_email,
      notify_telegram:    user.notify_telegram,
      telegram_chat_id:   user.telegram_chat_id,
      quiet_hours_start:  user.quiet_hours_start,
      quiet_hours_end:    user.quiet_hours_end,
      weekend_signals:    user.weekend_signals,
    }).eq('id', user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!user) return <div style={{ padding:'40px', color:'#555870', fontFamily:F }}>Loading…</div>

  return (
    <div style={{ padding:'28px', fontFamily:F, maxWidth:'640px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px' }}>Notifications</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>Control how and when you receive signals</p>
        </div>
        <button onClick={save} disabled={saving} style={{ padding:'9px 20px', background:'#3b82f6', border:'none', borderRadius:'9px', color:'white', fontSize:'13px', fontWeight:'600' }}>
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <Section title="Notification channels">
        {/* Email */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:'14px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:'14px' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e8eaf2', marginBottom:'2px' }}>Email notifications</div>
            <div style={{ fontSize:'11px', color:'#555870' }}>{user.email}</div>
          </div>
          <Toggle value={user.notify_email} onChange={() => setUser({ ...user, notify_email: !user.notify_email })} />
        </div>

        {/* Telegram */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: user.notify_telegram ? '12px' : '0' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'500', color:'#e8eaf2', marginBottom:'2px' }}>Telegram DM</div>
              <div style={{ fontSize:'11px', color:'#555870' }}>Receive signals directly in Telegram</div>
            </div>
            <Toggle value={user.notify_telegram} onChange={() => setUser({ ...user, notify_telegram: !user.notify_telegram })} />
          </div>
          {user.notify_telegram && (
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'5px' }}>Your Telegram Chat ID</label>
              <input
                value={user.telegram_chat_id || ''}
                onChange={e => setUser({ ...user, telegram_chat_id: e.target.value })}
                placeholder="e.g. 123456789"
                style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }}
              />
              <p style={{ fontSize:'11px', color:'#555870', marginTop:'5px' }}>Get your ID by messaging @userinfobot on Telegram</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Allowed scenarios">
        <p style={{ fontSize:'12px', color:'#8b90a8', marginBottom:'12px' }}>
          These are set by your administrator. You can see which scenarios you have access to below.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {SCENARIOS.map(sc => {
            const has = user.allowed_scenarios?.includes(sc.id)
            return (
              <span key={sc.id} style={{
                padding:'4px 12px', borderRadius:'6px', fontSize:'11px', fontWeight:'500',
                background: has ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${has ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
                color: has ? '#60a5fa' : '#555870',
                opacity: has ? 1 : 0.5,
              }}>
                {sc.label}
              </span>
            )
          })}
        </div>
      </Section>

      <Section title="Quiet hours (UTC)">
        <p style={{ fontSize:'12px', color:'#8b90a8', marginBottom:'14px' }}>No notifications will be sent during these hours</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
          {[{ label:'No alerts from', key:'quiet_hours_start' }, { label:'Resume at', key:'quiet_hours_end' }].map(f => (
            <div key={f.key}>
              <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'5px' }}>{f.label}</label>
              <select value={user[f.key] || 0} onChange={e => setUser({ ...user, [f.key]: Number(e.target.value) })}
                style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none' }}>
                {Array.from({ length:24 }, (_,i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e8eaf2', marginBottom:'2px' }}>Weekend signals</div>
            <div style={{ fontSize:'11px', color:'#555870' }}>Receive signals on Saturdays and Sundays</div>
          </div>
          <Toggle value={user.weekend_signals} onChange={() => setUser({ ...user, weekend_signals: !user.weekend_signals })} />
        </div>
      </Section>
    </div>
  )
}
