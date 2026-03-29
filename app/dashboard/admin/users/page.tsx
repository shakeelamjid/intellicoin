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
  { value:'S', label:'S', color:'#22c55e', bg:'rgba(34,197,94,0.15)'  },
  { value:'A', label:'A', color:'#60a5fa', bg:'rgba(59,130,246,0.15)' },
  { value:'B', label:'B', color:'#f59e0b', bg:'rgba(245,158,11,0.15)' },
  { value:'C', label:'C', color:'#8b90a8', bg:'rgba(139,144,168,0.1)' },
]

const DIR_COLOR: Record<string, string> = { long:'#22c55e', short:'#ef4444', watch:'#f59e0b' }

function getRanksFromUser(user) {
  if (user.allowed_ranks && Array.isArray(user.allowed_ranks) && user.allowed_ranks.length > 0) return user.allowed_ranks
  const m = user.min_rank_access || 'ALL'
  if (m === 'S')   return ['S']
  if (m === 'SA')  return ['S','A']
  if (m === 'SAB') return ['S','A','B']
  return ['S','A','B','C']
}

function timeAgo(iso) {
  if (!iso) return 'Never'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Online now'
  if (m < 60) return m + 'm ago'
  if (m < 1440) return Math.floor(m/60) + 'h ago'
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={onChange} style={{ width:'40px', height:'22px', borderRadius:'11px', border:'none', background: value ? '#3b82f6' : '#1e2235', position:'relative', transition:'background 0.2s', cursor:'pointer', flexShrink:0 }}>
      <span style={{ position:'absolute', top:'2px', width:'18px', height:'18px', borderRadius:'50%', background:'white', left: value ? '20px' : '2px', transition:'left 0.2s' }} />
    </button>
  )
}

function InviteModal({ onClose, onDone }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function invite() {
    if (!email) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.admin.inviteUserByEmail(email)
    if (err) { setError(err.message); setLoading(false); return }
    onDone(); onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'420px', fontFamily:F }}>
        <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#e8eaf2', marginBottom:'20px' }}>Invite user</h2>
        {error && <div style={{ padding:'10px', background:'rgba(239,68,68,0.12)', borderRadius:'8px', color:'#fca5a5', fontSize:'13px', marginBottom:'14px' }}>{error}</div>}
        <div style={{ marginBottom:'20px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
            style={{ width:'100%', padding:'9px 12px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 18px', background:'#1e2235', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'8px', color:'#8b90a8', fontSize:'13px', cursor:'pointer' }}>Cancel</button>
          <button onClick={invite} disabled={loading} style={{ padding:'8px 20px', background:'#3b82f6', border:'none', borderRadius:'8px', color:'white', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
            {loading ? 'Sending...' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers]         = useState([])
  const [editing, setEditing]     = useState(null)
  const [editRanks, setEditRanks] = useState([])
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const supabase = createClient()

  function load() {
    supabase.from('users').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setUsers(data || []))
  }

  useEffect(() => { load() }, [])

  function openEdit(u) {
    setEditing({ ...u })
    setEditRanks(getRanksFromUser(u))
    setSaved(false)
  }

  function toggleRank(rank) {
    setEditRanks(prev => prev.includes(rank) ? prev.filter(r => r !== rank) : [...prev, rank])
  }

  function toggleScenario(id) {
    if (!editing) return
    const has = editing.allowed_scenarios?.includes(id)
    setEditing({
      ...editing,
      allowed_scenarios: has
        ? editing.allowed_scenarios.filter(s => s !== id)
        : [...(editing.allowed_scenarios || []), id].sort((a,b) => a-b)
    })
  }

  async function saveUser() {
    if (!editing) return
    setSaving(true)
    const rankOrder = ['S','A','B','C']
    const sortedRanks = rankOrder.filter(r => editRanks.includes(r))
    const minRank = sortedRanks.length === 4 ? 'ALL' : sortedRanks.length === 0 ? 'S' : sortedRanks.join('')

    await supabase.from('users').update({
      full_name:            editing.full_name,
      is_active:            editing.is_active,
      min_rank_access:      minRank,
      allowed_ranks:        sortedRanks,
      allowed_scenarios:    editing.allowed_scenarios,
      max_signals_per_day:  editing.max_signals_per_day,
      max_signals_per_hour: editing.max_signals_per_hour,
      manual_scans_per_day: editing.manual_scans_per_day,
      notify_email:         editing.notify_email,
      notify_telegram:      editing.notify_telegram,
      telegram_chat_id:     editing.telegram_chat_id,
      quiet_hours_start:    editing.quiet_hours_start,
      quiet_hours_end:      editing.quiet_hours_end,
      weekend_signals:      editing.weekend_signals,
    }).eq('id', editing.id)

    setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...editing, allowed_ranks: sortedRanks, min_rank_access: minRank } : u))
    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); setEditing(null) }, 1200)
  }

  const inp: React.CSSProperties = { width:'100%', padding:'8px 10px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'7px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }
  const lbl: React.CSSProperties = { display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.05em' }
  const sec: React.CSSProperties = { marginBottom:'18px' }
  const smallBtn: React.CSSProperties = { fontSize:'10px', color:'#555870', background:'none', border:'none', cursor:'pointer', padding:'0', textDecoration:'underline' }

  return (
    <div style={{ padding:'28px', fontFamily:F }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'4px' }}>Users</h1>
          <p style={{ fontSize:'12px', color:'#555870' }}>{users.length} registered members</p>
        </div>
        <button onClick={() => setShowInvite(true)} style={{ padding:'9px 20px', background:'#3b82f6', border:'none', borderRadius:'9px', color:'white', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
          + Invite user
        </button>
      </div>

      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 80px 80px 100px 80px 70px', gap:'8px', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:'10px', fontWeight:'600', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <span>User</span><span>Ranks</span><span>Signals/day</span><span>Manual runs</span><span>Last seen</span><span>Status</span><span></span>
        </div>

        {users.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#555870', fontSize:'13px' }}>No users yet</div>
        ) : users.map(u => {
          const initials = (u.full_name || u.email || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
          const ranks = getRanksFromUser(u)
          return (
            <div key={u.id} style={{ display:'grid', gridTemplateColumns:'1fr 120px 80px 80px 100px 80px 70px', gap:'8px', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
                <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'rgba(59,130,246,0.2)', color:'#93c5fd', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', flexShrink:0 }}>{initials}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#e8eaf2', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.full_name || u.email?.split('@')[0]}</div>
                  <div style={{ fontSize:'11px', color:'#555870', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
                {ranks.map(r => {
                  const rk = RANKS.find(x => x.value === r)
                  return rk ? <span key={r} style={{ padding:'2px 6px', borderRadius:'4px', fontSize:'10px', fontWeight:'700', background:rk.bg, color:rk.color }}>{r}</span> : null
                })}
              </div>
              <span style={{ fontSize:'12px', color:'#8b90a8' }}>{u.max_signals_per_day === 999 ? '∞' : u.max_signals_per_day}</span>
              <span style={{ fontSize:'12px', color:'#8b90a8' }}>{u.manual_scans_per_day === 999 ? '∞' : (u.manual_scans_per_day || 0)}/day</span>
              <span style={{ fontSize:'12px', color:'#555870' }}>{timeAgo(u.last_seen)}</span>
              <span style={{ padding:'3px 9px', borderRadius:'5px', fontSize:'11px', fontWeight:'600', background: u.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: u.is_active ? '#22c55e' : '#ef4444' }}>
                {u.is_active ? 'Active' : 'Suspended'}
              </span>
              <button onClick={() => openEdit(u)} style={{ padding:'5px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'7px', color:'#e8eaf2', fontSize:'12px', cursor:'pointer' }}>Edit</button>
            </div>
          )
        })}
      </div>

      {editing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'20px' }}>
          <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'18px', width:'100%', maxWidth:'580px', maxHeight:'90vh', overflowY:'auto', fontFamily:F }}>

            <div style={{ padding:'22px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#e8eaf2', marginBottom:'3px' }}>Edit user</h2>
                <p style={{ fontSize:'12px', color:'#555870' }}>{editing.email}</p>
              </div>
              <button onClick={() => setEditing(null)} style={{ background:'none', border:'none', color:'#555870', fontSize:'22px', cursor:'pointer' }}>x</button>
            </div>

            <div style={{ padding:'0 24px 24px' }}>

              {/* Full name */}
              <div style={sec}>
                <label style={lbl}>Full name</label>
                <input value={editing.full_name || ''} onChange={e => setEditing({ ...editing, full_name: e.target.value })} style={inp} />
              </div>

              {/* Rank checkboxes */}
              <div style={sec}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <label style={lbl}>Signal rank access</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => setEditRanks(['S','A','B','C'])} style={smallBtn}>All</button>
                    <button onClick={() => setEditRanks([])} style={smallBtn}>None</button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {RANKS.map(r => {
                    const on = editRanks.includes(r.value)
                    return (
                      <button key={r.value} onClick={() => toggleRank(r.value)} style={{
                        flex:1, padding:'12px 8px', borderRadius:'10px', cursor:'pointer',
                        border: on ? '1px solid ' + r.color + '50' : '1px solid rgba(255,255,255,0.08)',
                        background: on ? r.bg : 'rgba(255,255,255,0.03)',
                        color: on ? r.color : '#555870',
                        fontSize:'18px', fontWeight:'800', transition:'all 0.15s',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                      }}>
                        <span>{r.label}</span>
                        <span style={{ fontSize:'9px', fontWeight:'500', opacity:0.8 }}>{on ? 'on' : 'off'}</span>
                      </button>
                    )
                  })}
                </div>
                <p style={{ fontSize:'11px', color:'#555870', marginTop:'7px' }}>
                  Allowed: {editRanks.length === 0 ? 'None (user sees nothing)' : editRanks.join(', ')}
                </p>
              </div>

              {/* Scenario checkboxes */}
              <div style={sec}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <label style={lbl}>Visible scenarios</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => setEditing({ ...editing, allowed_scenarios:[1,2,3,4,5,6,7,8,9] })} style={smallBtn}>All</button>
                    <button onClick={() => setEditing({ ...editing, allowed_scenarios:[] })} style={smallBtn}>None</button>
                  </div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {SCENARIOS.map(sc => {
                    const on = editing.allowed_scenarios?.includes(sc.id)
                    const dc = DIR_COLOR[sc.dir]
                    return (
                      <button key={sc.id} onClick={() => toggleScenario(sc.id)} style={{
                        padding:'5px 11px', borderRadius:'6px', fontSize:'11px', fontWeight:'500', cursor:'pointer',
                        border: on ? '1px solid ' + dc + '50' : '1px solid rgba(255,255,255,0.08)',
                        background: on ? dc + '22' : 'rgba(255,255,255,0.03)',
                        color: on ? dc : '#555870',
                        transition:'all 0.15s',
                      }}>{sc.label}</button>
                    )
                  })}
                </div>
                <p style={{ fontSize:'11px', color:'#555870', marginTop:'6px' }}>
                  {editing.allowed_scenarios?.length ?? 0} of {SCENARIOS.length} enabled
                </p>
              </div>

              {/* Limits */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'18px' }}>
                {[
                  { label:'Max signals/day',  key:'max_signals_per_day'  },
                  { label:'Max signals/hour', key:'max_signals_per_hour' },
                  { label:'Manual scans/day', key:'manual_scans_per_day' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={lbl}>{f.label}</label>
                    <input type="number" value={editing[f.key] || 0} onChange={e => setEditing({ ...editing, [f.key]: Number(e.target.value) })} style={inp} />
                  </div>
                ))}
              </div>

              {/* Toggles */}
              <div style={sec}>
                <label style={lbl}>Notifications</label>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {[
                    { label:'Email notifications', sub:'Send signal alerts by email',        key:'notify_email'    },
                    { label:'Telegram DM',          sub:'Send alerts to personal Telegram',   key:'notify_telegram' },
                    { label:'Weekend signals',       sub:'Receive signals on weekends',        key:'weekend_signals' },
                    { label:'Account active',        sub:'Disable to suspend this user',       key:'is_active'       },
                  ].map(f => (
                    <div key={f.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <div style={{ fontSize:'13px', color:'#e8eaf2' }}>{f.label}</div>
                        <div style={{ fontSize:'11px', color:'#555870', marginTop:'2px' }}>{f.sub}</div>
                      </div>
                      <Toggle value={!!editing[f.key]} onChange={() => setEditing({ ...editing, [f.key]: !editing[f.key] })} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Telegram Chat ID */}
              {editing.notify_telegram && (
                <div style={sec}>
                  <label style={lbl}>Telegram Chat ID</label>
                  <input value={editing.telegram_chat_id || ''} onChange={e => setEditing({ ...editing, telegram_chat_id: e.target.value })}
                    placeholder="e.g. 123456789" style={inp} />
                  <p style={{ fontSize:'11px', color:'#555870', marginTop:'5px' }}>Message @userinfobot on Telegram to find your chat ID</p>
                </div>
              )}

              {/* Quiet hours */}
              <div style={sec}>
                <label style={lbl}>Quiet hours (UTC)</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { label:'No alerts from', key:'quiet_hours_start' },
                    { label:'Resume at',       key:'quiet_hours_end'   },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display:'block', fontSize:'11px', color:'#555870', marginBottom:'4px' }}>{f.label}</label>
                      <select value={editing[f.key] ?? 0} onChange={e => setEditing({ ...editing, [f.key]: Number(e.target.value) })}
                        style={{ ...inp, cursor:'pointer' }}>
                        {Array.from({ length:24 }, (_,i) => (
                          <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button onClick={() => setEditing(null)} style={{ padding:'9px 20px', background:'#1e2235', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', color:'#8b90a8', fontSize:'13px', cursor:'pointer' }}>
                  Cancel
                </button>
                <button onClick={saveUser} disabled={saving} style={{ padding:'9px 24px', background: saved ? 'rgba(34,197,94,0.15)' : '#3b82f6', border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius:'9px', color: saved ? '#22c55e' : 'white', fontSize:'13px', fontWeight:'600', cursor:'pointer', transition:'all 0.2s' }}>
                  {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save changes'}
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
