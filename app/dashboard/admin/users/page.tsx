'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const SCENARIOS = [
  { id:1, label:'S1 Bull trend',    dir:'long'  },
  { id:2, label:'S2 Bear trend',    dir:'short' },
  { id:3, label:'S3 Weak rally',    dir:'short' },
  { id:4, label:'S4 Weak selloff',  dir:'long'  },
  { id:5, label:'S5 Bull trap',     dir:'short' },
  { id:6, label:'S6 Bear trap',     dir:'long'  },
  { id:7, label:'S7 Long squeeze',  dir:'short' },
  { id:8, label:'S8 Short squeeze', dir:'long'  },
  { id:9, label:'S9 Coil',          dir:'watch' },
]

const RANKS = [
  { value:'S', label:'S', desc:'Premium',  color:'#22c55e', bg:'rgba(34,197,94,0.15)',  border:'rgba(34,197,94,0.3)'  },
  { value:'A', label:'A', desc:'Strong',   color:'#60a5fa', bg:'rgba(59,130,246,0.15)', border:'rgba(59,130,246,0.3)' },
  { value:'B', label:'B', desc:'Standard', color:'#f59e0b', bg:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.3)' },
  { value:'C', label:'C', desc:'Watch',    color:'#8b90a8', bg:'rgba(139,144,168,0.1)', border:'rgba(139,144,168,0.2)'},
]

const DIR_COLOR: Record<string, string> = { long:'#22c55e', short:'#ef4444', watch:'#f59e0b' }

function getRanksFromUser(user: any): string[] {
  if (user.allowed_ranks && Array.isArray(user.allowed_ranks) && user.allowed_ranks.length > 0)
    return user.allowed_ranks
  const m = user.min_rank_access || 'ALL'
  if (m === 'S')   return ['S']
  if (m === 'SA')  return ['S','A']
  if (m === 'SAB') return ['S','A','B']
  return ['S','A','B','C']
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)    return 'Online now'
  if (m < 60)   return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width:'40px', height:'22px', borderRadius:'11px', border:'none', background: value ? '#3b82f6' : '#2a2d3e', position:'relative', transition:'all 0.2s', cursor:'pointer', flexShrink:0, boxShadow: value ? '0 0 8px rgba(59,130,246,0.4)' : 'none' }}>
      <span style={{ position:'absolute', top:'2px', width:'18px', height:'18px', borderRadius:'50%', background:'white', left: value ? '20px' : '2px', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

function AddUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [role,     setRole]     = useState('user')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function createUser() {
    if (!email || !password) { setError('Email and password are required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: name, role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create user'); setLoading(false); return }
      onDone(); onClose()
    } catch (e: any) { setError(e.message); setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px' }}>
      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'420px', fontFamily:F }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'22px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#e8eaf2' }}>Add new user</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#555870', fontSize:'20px', cursor:'pointer' }}>×</button>
        </div>
        {error && <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.12)', borderRadius:'8px', color:'#fca5a5', fontSize:'13px', marginBottom:'16px' }}>{error}</div>}
        {[
          { label:'Full name', value:name, onChange:setName, placeholder:'John Smith', type:'text' },
          { label:'Email address', value:email, onChange:setEmail, placeholder:'user@example.com', type:'email' },
          { label:'Password', value:password, onChange:setPassword, placeholder:'Min 6 characters', type:'password' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom:'14px' }}>
            <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>{f.label}</label>
            <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
              style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:F }} />
          </div>
        ))}
        <div style={{ marginBottom:'22px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Role</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {['user','admin'].map(r => (
              <button key={r} onClick={() => setRole(r)} style={{ flex:1, padding:'8px', borderRadius:'8px', cursor:'pointer', fontFamily:F, border: role===r?'1px solid rgba(59,130,246,0.5)':'1px solid rgba(255,255,255,0.08)', background: role===r?'rgba(59,130,246,0.15)':'rgba(255,255,255,0.03)', color: role===r?'#60a5fa':'#555870', fontSize:'13px', fontWeight:'600' }}>
                {r.charAt(0).toUpperCase()+r.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'9px', background:'#1e2235', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#8b90a8', fontSize:'13px', cursor:'pointer', fontFamily:F }}>Cancel</button>
          <button onClick={createUser} disabled={loading} style={{ flex:2, padding:'9px', background:'#3b82f6', border:'none', borderRadius:'8px', color:'white', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:F, opacity:loading?0.6:1 }}>
            {loading ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users,      setUsers]      = useState<any[]>([])
  const [editing,    setEditing]    = useState<any>(null)
  const [editRanks,  setEditRanks]  = useState<string[]>([])
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const supabase = createClient()

  function load() {
    supabase.from('users').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setUsers(data || []))
  }
  useEffect(() => { load() }, [])

  function openEdit(u: any) {
    setEditing({
      ...u,
      // Sanitize — remove any invalid scenario IDs (e.g. 10 from old data)
      allowed_scenarios: (u.allowed_scenarios || []).filter((s: number) => s >= 1 && s <= 9),
    })
    setEditRanks(getRanksFromUser(u))
    setSaved(false)
  }

  function toggleRank(rank: string) {
    setEditRanks(prev => prev.includes(rank) ? prev.filter(r => r !== rank) : [...prev, rank])
  }

  function toggleScenario(id: number) {
    if (!editing) return
    const has = editing.allowed_scenarios?.includes(id)
    setEditing({
      ...editing,
      allowed_scenarios: has
        ? editing.allowed_scenarios.filter((s: number) => s !== id)
        : [...(editing.allowed_scenarios || []), id].sort((a: number, b: number) => a - b)
    })
  }

  async function saveUser() {
    if (!editing) return
    setSaving(true)
    const rankOrder = ['S','A','B','C']
    const sortedRanks = rankOrder.filter(r => editRanks.includes(r))
    const minRank = sortedRanks.length === 4 ? 'ALL' : sortedRanks.length === 0 ? 'S' : sortedRanks.join('')

    await supabase.from('users').update({
      full_name:              editing.full_name,
      is_active:              editing.is_active,
      min_rank_access:        minRank,
      allowed_ranks:          sortedRanks,
      allowed_scenarios:      (editing.allowed_scenarios || []).filter((s: number) => s >= 1 && s <= 9),
      max_signals_per_day:    editing.max_signals_per_day,
      max_signals_per_hour:   editing.max_signals_per_hour,
      manual_scans_per_day:   editing.manual_scans_per_day,
      notify_email:           editing.notify_email,
      notify_telegram:        editing.notify_telegram,
      notification_email:     editing.notify_email,
      notification_telegram:  editing.notify_telegram,
      telegram_chat_id:       editing.telegram_chat_id,
      quiet_hours_start:      editing.quiet_hours_start ?? null,
      quiet_hours_end:        editing.quiet_hours_end ?? null,
      weekend_signals:        editing.weekend_signals,
    }).eq('id', editing.id)

    setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...editing, allowed_ranks: sortedRanks, min_rank_access: minRank } : u))
    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); setEditing(null) }, 1200)
  }

  const inp: React.CSSProperties = { width:'100%', padding:'8px 12px', background:'#0f1117', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:F }
  const sec: React.CSSProperties = { marginBottom:'20px' }
  const sectionTitle: React.CSSProperties = { fontSize:'10px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'10px', fontWeight:'600' }
  const smallBtn: React.CSSProperties = { fontSize:'10px', color:'#3b82f6', background:'none', border:'none', cursor:'pointer', padding:'0', fontFamily:F }

  return (
    <div style={{ padding:'28px', fontFamily:F }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px' }}>Users</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>{users.length} registered members</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding:'9px 20px', background:'#3b82f6', border:'none', borderRadius:'9px', color:'white', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:F }}>
          + Add user
        </button>
      </div>

      {/* Table */}
      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 80px 100px 80px 70px', gap:'8px', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:'10px', fontWeight:'600', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <span>User</span><span>Ranks allowed</span><span>Signals/day</span><span>Last seen</span><span>Status</span><span></span>
        </div>
        {users.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#555870', fontSize:'13px' }}>No users yet</div>
        ) : users.map(u => {
          const initials = (u.full_name || u.email || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2)
          const ranks = getRanksFromUser(u)
          return (
            <div key={u.id} style={{ display:'grid', gridTemplateColumns:'1fr 130px 80px 100px 80px 70px', gap:'8px', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(59,130,246,0.1))', color:'#93c5fd', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', flexShrink:0, border:'1px solid rgba(59,130,246,0.2)' }}>{initials}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf2', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'6px' }}>
                    {u.full_name || u.email?.split('@')[0]}
                    {u.role === 'admin' && <span style={{ fontSize:'9px', padding:'1px 5px', borderRadius:'3px', background:'rgba(168,85,247,0.15)', color:'#a855f7', fontWeight:'700', border:'1px solid rgba(168,85,247,0.2)' }}>ADMIN</span>}
                  </div>
                  <div style={{ fontSize:'11px', color:'#555870', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
                {ranks.map(r => {
                  const rk = RANKS.find(x => x.value === r)
                  return rk ? <span key={r} style={{ padding:'2px 6px', borderRadius:'4px', fontSize:'10px', fontWeight:'700', background:rk.bg, color:rk.color, border:`1px solid ${rk.border}` }}>{r}</span> : null
                })}
              </div>
              <span style={{ fontSize:'12px', color:'#8b90a8' }}>{u.max_signals_per_day === 999 ? '∞' : (u.max_signals_per_day || '—')}</span>
              <span style={{ fontSize:'11px', color:'#555870' }}>{timeAgo(u.last_seen)}</span>
              <span style={{ padding:'3px 9px', borderRadius:'5px', fontSize:'11px', fontWeight:'600', background: u.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: u.is_active ? '#22c55e' : '#ef4444' }}>
                {u.is_active ? 'Active' : 'Suspended'}
              </span>
              <button onClick={() => openEdit(u)} style={{ padding:'5px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'7px', color:'#e8eaf2', fontSize:'12px', cursor:'pointer', fontFamily:F }}>Edit</button>
            </div>
          )
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'20px' }}>
          <div style={{ background:'#0f1117', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px', width:'100%', maxWidth:'600px', maxHeight:'92vh', overflowY:'auto', fontFamily:F, boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>

            {/* Modal header */}
            <div style={{ padding:'22px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#0f1117', zIndex:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(59,130,246,0.1))', color:'#93c5fd', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'700', border:'1px solid rgba(59,130,246,0.2)' }}>
                  {(editing.full_name || editing.email || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2)}
                </div>
                <div>
                  <div style={{ fontSize:'15px', fontWeight:'700', color:'#e8eaf2' }}>{editing.full_name || editing.email?.split('@')[0]}</div>
                  <div style={{ fontSize:'11px', color:'#555870' }}>{editing.email}</div>
                </div>
              </div>
              <button onClick={() => setEditing(null)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', color:'#8b90a8', fontSize:'14px', cursor:'pointer', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            <div style={{ padding:'24px' }}>

              {/* Full name */}
              <div style={sec}>
                <label style={sectionTitle}>Full name</label>
                <input value={editing.full_name || ''} onChange={e => setEditing({ ...editing, full_name: e.target.value })} style={inp} placeholder="Enter full name" />
              </div>

              {/* Rank access */}
              <div style={sec}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                  <label style={sectionTitle}>Signal rank access</label>
                  <div style={{ display:'flex', gap:'10px' }}>
                    <button onClick={() => setEditRanks(['S','A','B','C'])} style={smallBtn}>All</button>
                    <button onClick={() => setEditRanks([])} style={{...smallBtn, color:'#ef4444'}}>None</button>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                  {RANKS.map(r => {
                    const on = editRanks.includes(r.value)
                    return (
                      <button key={r.value} onClick={() => toggleRank(r.value)} style={{
                        padding:'14px 8px', borderRadius:'10px', cursor:'pointer', fontFamily:F,
                        border: on ? `1px solid ${r.border}` : '1px solid rgba(255,255,255,0.06)',
                        background: on ? r.bg : 'rgba(255,255,255,0.02)',
                        color: on ? r.color : '#555870',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                        transition:'all 0.15s',
                      }}>
                        <span style={{ fontSize:'20px', fontWeight:'900' }}>{r.label}</span>
                        <span style={{ fontSize:'9px', fontWeight:'600', opacity:0.8 }}>{r.desc}</span>
                        <span style={{ fontSize:'9px', opacity:0.6 }}>{on ? '✓ on' : 'off'}</span>
                      </button>
                    )
                  })}
                </div>
                <p style={{ fontSize:'11px', color:'#555870', marginTop:'8px' }}>
                  Notifications sent for: <span style={{ color:'#e8eaf2' }}>{editRanks.length === 0 ? 'None' : editRanks.join(', ')}</span>
                </p>
              </div>

              {/* Scenarios */}
              <div style={sec}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                  <label style={sectionTitle}>Visible scenarios</label>
                  <div style={{ display:'flex', gap:'10px' }}>
                    <button onClick={() => setEditing({ ...editing, allowed_scenarios:[1,2,3,4,5,6,7,8,9] })} style={smallBtn}>All</button>
                    <button onClick={() => setEditing({ ...editing, allowed_scenarios:[] })} style={{...smallBtn, color:'#ef4444'}}>None</button>
                  </div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {SCENARIOS.map(sc => {
                    const on = editing.allowed_scenarios?.includes(sc.id)
                    const dc = DIR_COLOR[sc.dir]
                    return (
                      <button key={sc.id} onClick={() => toggleScenario(sc.id)} style={{
                        padding:'5px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:'500', cursor:'pointer', fontFamily:F,
                        border: on ? `1px solid ${dc}40` : '1px solid rgba(255,255,255,0.07)',
                        background: on ? `${dc}15` : 'rgba(255,255,255,0.02)',
                        color: on ? dc : '#555870', transition:'all 0.15s',
                      }}>{sc.label}</button>
                    )
                  })}
                </div>
                <p style={{ fontSize:'11px', color:'#555870', marginTop:'8px' }}>
                  {editing.allowed_scenarios?.filter((s: number) => s <= 9).length ?? 0} of {SCENARIOS.length} enabled
                </p>
              </div>

              {/* Limits */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'20px' }}>
                {[
                  { label:'Max signals/day',  key:'max_signals_per_day'  },
                  { label:'Max signals/hour', key:'max_signals_per_hour' },
                  { label:'Manual scans/day', key:'manual_scans_per_day' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={sectionTitle}>{f.label}</label>
                    <input type="number" value={editing[f.key] || 0} onChange={e => setEditing({ ...editing, [f.key]: Number(e.target.value) })} style={inp} />
                  </div>
                ))}
              </div>

              {/* Notification toggles */}
              <div style={sec}>
                <label style={sectionTitle}>Notifications & access</label>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {[
                    { label:'Email notifications', sub:'Send signal alerts by email',        key:'notify_email'    },
                    { label:'Telegram DM',          sub:'Send alerts to personal Telegram',   key:'notify_telegram' },
                    { label:'Weekend signals',       sub:'Receive signals on Sat & Sun',       key:'weekend_signals' },
                    { label:'Account active',        sub:'Disable to suspend this user',       key:'is_active'       },
                  ].map(f => (
                    <div key={f.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontSize:'13px', color:'#e8eaf2', fontWeight:'500' }}>{f.label}</div>
                        <div style={{ fontSize:'11px', color:'#555870', marginTop:'1px' }}>{f.sub}</div>
                      </div>
                      <Toggle value={!!editing[f.key]} onChange={() => setEditing({ ...editing, [f.key]: !editing[f.key] })} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Telegram Chat ID */}
              {editing.notify_telegram && (
                <div style={sec}>
                  <label style={sectionTitle}>Telegram Chat ID</label>
                  <input value={editing.telegram_chat_id || ''} onChange={e => setEditing({ ...editing, telegram_chat_id: e.target.value })}
                    placeholder="e.g. -5175954540 or 123456789" style={inp} />
                  <p style={{ fontSize:'11px', color:'#555870', marginTop:'6px' }}>Use negative ID for groups · Message @userinfobot for personal ID</p>
                </div>
              )}

              {/* Quiet hours */}
              <div style={sec}>
                <label style={sectionTitle}>Quiet hours (UTC) — leave same to disable</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { label:'No alerts from', key:'quiet_hours_start' },
                    { label:'Resume at',       key:'quiet_hours_end'   },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display:'block', fontSize:'11px', color:'#555870', marginBottom:'5px' }}>{f.label}</label>
                      <select value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}
                        style={{ ...inp, cursor:'pointer' }}>
                        <option value=''>Disabled</option>
                        {Array.from({ length:24 }, (_,i) => (
                          <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', paddingTop:'4px' }}>
                <button onClick={() => setEditing(null)} style={{ padding:'10px 22px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', color:'#8b90a8', fontSize:'13px', cursor:'pointer', fontFamily:F }}>
                  Cancel
                </button>
                <button onClick={saveUser} disabled={saving} style={{
                  padding:'10px 28px', borderRadius:'10px', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:F,
                  background: saved ? 'rgba(34,197,94,0.15)' : '#3b82f6',
                  border: saved ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent',
                  color: saved ? '#22c55e' : 'white',
                  transition:'all 0.2s',
                }}>
                  {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onDone={load} />}
    </div>
  )
}
