'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIOS = [
  { id:1, label:'S1 Bull trend' }, { id:2, label:'S2 Bear trend' },
  { id:3, label:'S3 Weak rally' }, { id:4, label:'S4 Weak selloff' },
  { id:5, label:'S5 Bull trap' },  { id:6, label:'S6 Bear trap' },
  { id:7, label:'S7 Long squeeze' },{ id:8, label:'S8 Short squeeze' },
  { id:9, label:'S9 Coil' },
]

const RANK_ACCESS = [
  { value: 'S',   label: 'S only' },
  { value: 'SA',  label: 'S + A' },
  { value: 'SAB', label: 'S + A + B' },
  { value: 'ALL', label: 'All ranks' },
]

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Online now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width:'40px', height:'22px', borderRadius:'11px', border:'none', background: value ? '#3b82f6' : '#1e2235', position:'relative', transition:'background 0.2s', cursor:'pointer', flexShrink:0 }}>
      <span style={{ position:'absolute', top:'2px', width:'18px', height:'18px', borderRadius:'50%', background:'white', left: value ? '20px' : '2px', transition:'left 0.2s' }} />
    </button>
  )
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function invite() {
    if (!email) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: invErr } = await supabase.auth.admin?.inviteUserByEmail
      ? await (supabase as any).auth.admin.inviteUserByEmail(email)
      : { error: null }
    if (invErr) { setError(invErr.message); setLoading(false); return }
    onDone()
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'420px', fontFamily:F }}>
        <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#e8eaf2', marginBottom:'20px' }}>Invite user</h2>
        {error && <div style={{ padding:'10px', background:'rgba(239,68,68,0.12)', borderRadius:'8px', color:'#fca5a5', fontSize:'13px', marginBottom:'14px' }}>{error}</div>}
        <div style={{ marginBottom:'14px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
            style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:'20px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Full name (optional)</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
            style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 18px', background:'#1e2235', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#8b90a8', fontSize:'13px' }}>Cancel</button>
          <button onClick={invite} disabled={loading} style={{ padding:'8px 20px', background:'#3b82f6', border:'none', borderRadius:'8px', color:'white', fontSize:'13px', fontWeight:'600' }}>
            {loading ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const supabase = createClient()

  function load() {
    supabase.from('users').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setUsers(data || []))
  }

  useEffect(() => { load() }, [])

  async function saveUser() {
    if (!editing) return
    setSaving(true)
    await supabase.from('users').update({
      full_name:              editing.full_name,
      is_active:              editing.is_active,
      min_rank_access:        editing.min_rank_access,
      allowed_scenarios:      editing.allowed_scenarios,
      max_signals_per_day:    editing.max_signals_per_day,
      max_signals_per_hour:   editing.max_signals_per_hour,
      manual_scans_per_day:   editing.manual_scans_per_day,
      notify_email:           editing.notify_email,
      notify_telegram:        editing.notify_telegram,
      telegram_chat_id:       editing.telegram_chat_id,
      quiet_hours_start:      editing.quiet_hours_start,
      quiet_hours_end:        editing.quiet_hours_end,
      weekend_signals:        editing.weekend_signals,
    }).eq('id', editing.id)
    setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...editing } : u))
    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); setEditing(null) }, 1000)
  }

  function toggleScenario(id: number) {
    if (!editing) return
    const has = editing.allowed_scenarios?.includes(id)
    setEditing({
      ...editing,
      allowed_scenarios: has
        ? editing.allowed_scenarios.filter((s: number) => s !== id)
        : [...(editing.allowed_scenarios || []), id].sort()
    })
  }

  return (
    <div style={{ padding: '28px', fontFamily: F }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px' }}>Users</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>{users.length} registered members</p>
        </div>
        <button onClick={() => setShowInvite(true)} style={{ padding:'9px 20px', background:'#3b82f6', border:'none', borderRadius:'9px', color:'white', fontSize:'13px', fontWeight:'600' }}>
          + Invite user
        </button>
      </div>

      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden' }}>
        {/* Table header */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 80px 100px 80px 70px', gap:'8px', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:'10px', fontWeight:'600', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <span>User</span><span>Rank access</span><span>Signals/day</span><span>Manual runs</span><span>Last seen</span><span>Status</span><span></span>
        </div>

        {users.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#555870', fontSize:'13px' }}>No users yet — invite someone</div>
        ) : users.map(u => {
          const initials = (u.full_name || u.email || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2)
          return (
            <div key={u.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 80px 100px 80px 70px', gap:'8px', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
                <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'rgba(59,130,246,0.2)', color:'#93c5fd', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', flexShrink:0 }}>
                  {initials}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf2', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {u.full_name || u.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize:'11px', color:'#555870', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
                </div>
              </div>
              <span style={{ fontSize:'12px', color:'#8b90a8' }}>{u.min_rank_access || 'SA'}</span>
              <span style={{ fontSize:'12px', color:'#8b90a8' }}>{u.max_signals_per_day === 999 ? '∞' : u.max_signals_per_day}</span>
              <span style={{ fontSize:'12px', color:'#8b90a8' }}>{u.manual_scans_per_day === 999 ? '∞' : (u.manual_scans_per_day || 0)}/day</span>
              <span style={{ fontSize:'12px', color:'#555870' }}>{timeAgo(u.last_seen)}</span>
              <span style={{ padding:'3px 9px', borderRadius:'5px', fontSize:'11px', fontWeight:'600', background: u.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: u.is_active ? '#22c55e' : '#ef4444' }}>
                {u.is_active ? 'Active' : 'Suspended'}
              </span>
              <button onClick={() => setEditing({ ...u })} style={{ padding:'5px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'7px', color:'#e8eaf2', fontSize:'12px' }}>
                Edit
              </button>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'20px' }}>
          <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'18px', width:'100%', maxWidth:'580px', maxHeight:'90vh', overflowY:'auto', fontFamily:F }}>
            <div style={{ padding:'24px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#e8eaf2', marginBottom:'3px' }}>Edit user</h2>
                <p style={{ fontSize:'12px', color:'#555870' }}>{editing.email}</p>
              </div>
              <button onClick={() => setEditing(null)} style={{ background:'none', border:'none', color:'#555870', fontSize:'22px', cursor:'pointer' }}>×</button>
            </div>

            <div style={{ padding:'0 24px 24px' }}>

              {/* Full name */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Full name</label>
                <input value={editing.full_name || ''} onChange={e => setEditing({ ...editing, full_name: e.target.value })}
                  style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
              </div>

              {/* Signal access rank */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Signal rank access</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
                  {RANK_ACCESS.map(r => (
                    <button key={r.value} onClick={() => setEditing({ ...editing, min_rank_access: r.value })} style={{
                      padding:'8px', borderRadius:'8px', border: editing.min_rank_access === r.value ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: editing.min_rank_access === r.value ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                      color: editing.min_rank_access === r.value ? '#60a5fa' : '#8b90a8', fontSize:'11px', fontWeight:'600',
                    }}>{r.label}</button>
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                {[
                  { label:'Max signals/day', key:'max_signals_per_day' },
                  { label:'Max signals/hour', key:'max_signals_per_hour' },
                  { label:'Manual scans/day', key:'manual_scans_per_day' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'5px' }}>{f.label}</label>
                    <input type="number" value={editing[f.key] || 0} onChange={e => setEditing({ ...editing, [f.key]: Number(e.target.value) })}
                      style={{ width:'100%', padding:'8px 10px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'7px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
                  </div>
                ))}
              </div>

              {/* Allowed scenarios */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Visible scenarios</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {SCENARIOS.map(sc => {
                    const on = editing.allowed_scenarios?.includes(sc.id)
                    return (
                      <button key={sc.id} onClick={() => toggleScenario(sc.id)} style={{
                        padding:'5px 11px', borderRadius:'6px', fontSize:'11px', fontWeight:'500',
                        border: on ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        background: on ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                        color: on ? '#60a5fa' : '#555870',
                      }}>{sc.label}</button>
                    )
                  })}
                </div>
              </div>

              {/* Notification channels */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Notifications</label>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {[
                    { label:'Email notifications', key:'notify_email' },
                    { label:'Telegram DM', key:'notify_telegram' },
                    { label:'Weekend signals', key:'weekend_signals' },
                    { label:'Account active', key:'is_active' },
                  ].map(f => (
                    <div key={f.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize:'13px', color:'#e8eaf2' }}>{f.label}</span>
                      <Toggle value={editing[f.key]} onChange={() => setEditing({ ...editing, [f.key]: !editing[f.key] })} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Telegram chat ID */}
              {editing.notify_telegram && (
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px' }}>Telegram Chat ID</label>
                  <input value={editing.telegram_chat_id || ''} onChange={e => setEditing({ ...editing, telegram_chat_id: e.target.value })}
                    placeholder="e.g. 123456789"
                    style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
                </div>
              )}

              {/* Quiet hours */}
              <div style={{ marginBottom:'20px' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Quiet hours (UTC)</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[{ label:'No alerts from', key:'quiet_hours_start' }, { label:'Resume at', key:'quiet_hours_end' }].map(f => (
                    <div key={f.key}>
                      <label style={{ display:'block', fontSize:'11px', color:'#555870', marginBottom:'4px' }}>{f.label}</label>
                      <select value={editing[f.key] || 0} onChange={e => setEditing({ ...editing, [f.key]: Number(e.target.value) })}
                        style={{ width:'100%', padding:'8px 10px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'7px', color:'#e8eaf2', fontSize:'13px', outline:'none' }}>
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button onClick={() => setEditing(null)} style={{ padding:'9px 20px', background:'#1e2235', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', color:'#8b90a8', fontSize:'13px' }}>Cancel</button>
                <button onClick={saveUser} disabled={saving} style={{ padding:'9px 24px', background:'#3b82f6', border:'none', borderRadius:'9px', color:'white', fontSize:'13px', fontWeight:'600' }}>
                  {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onDone={load} />}
    </div>
  )
}
