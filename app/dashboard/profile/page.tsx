'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export default function ProfilePage() {
  const [user, setUser]   = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [name, setName]     = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single()
      setUser(profile)
      setName(profile?.full_name || '')
    })
  }, [])

  async function save() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('users').update({ full_name: name }).eq('id', user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!user) return <div style={{ padding:'40px', color:'#555870', fontFamily:F }}>Loading…</div>

  const initials = (name || user.email || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2)

  return (
    <div style={{ padding:'28px', fontFamily:F, maxWidth:'520px' }}>
      <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'24px' }}>My profile</h1>

      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'24px', marginBottom:'14px' }}>
        {/* Avatar */}
        <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'24px', paddingBottom:'20px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'rgba(59,130,246,0.2)', color:'#93c5fd', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'700', flexShrink:0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:'#e8eaf2', marginBottom:'3px' }}>{name || user.email?.split('@')[0]}</div>
            <div style={{ fontSize:'12px', color:'#555870', textTransform:'capitalize' }}>
              {user.role} · {user.min_rank_access || 'SA'} rank access
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ marginBottom:'16px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Full name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            style={{ width:'100%', padding:'10px 13px', background:'#181c2e', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', color:'#e8eaf2', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:'24px' }}>
          <label style={{ display:'block', fontSize:'11px', color:'#8b90a8', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email address</label>
          <input value={user.email} readOnly
            style={{ width:'100%', padding:'10px 13px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'9px', color:'#555870', fontSize:'13px', outline:'none', boxSizing:'border-box', cursor:'not-allowed' }} />
        </div>
        <button onClick={save} disabled={saving} style={{ padding:'10px 24px', background:'#3b82f6', border:'none', borderRadius:'9px', color:'white', fontSize:'13px', fontWeight:'600' }}>
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Account info */}
      <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
        <h2 style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Account info</h2>
        {[
          { label:'Role', value: user.role },
          { label:'Rank access', value: user.min_rank_access || 'SA' },
          { label:'Max signals/day', value: user.max_signals_per_day === 999 ? 'Unlimited' : user.max_signals_per_day },
          { label:'Manual scans/day', value: user.manual_scans_per_day === 999 ? 'Unlimited' : (user.manual_scans_per_day || 0) },
          { label:'Member since', value: new Date(user.created_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) },
        ].map(item => (
          <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize:'12px', color:'#8b90a8' }}>{item.label}</span>
            <span style={{ fontSize:'13px', color:'#e8eaf2', fontWeight:'500', textTransform:'capitalize' }}>{String(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
