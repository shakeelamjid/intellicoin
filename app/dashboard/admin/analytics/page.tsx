'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const SCENARIO: Record<number, string> = {
  1:'Strong bull trend', 2:'Strong bear trend', 3:'Weak rally',
  4:'Weak sell-off', 5:'Bull trap', 6:'Bear trap',
  7:'Long squeeze', 8:'Short squeeze', 9:'Coil', 10:'Disinterest'
}

export default function AnalyticsPage() {
  const [signals, setSignals]   = useState<any[]>([])
  const [outcomes, setOutcomes] = useState<any[]>([])
  const [notifs, setNotifs]     = useState<any[]>([])
  const [users, setUsers]       = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('signals').select('*').order('created_at', { ascending:false }).limit(500),
      supabase.from('signal_outcomes').select('*').limit(500),
      supabase.from('notification_log').select('*').limit(500),
      supabase.from('users').select('*'),
    ]).then(([s, o, n, u]) => {
      setSignals(s.data || [])
      setOutcomes(o.data || [])
      setNotifs(n.data || [])
      setUsers(u.data || [])
    })
  }, [])

  const totalSignals = signals.length
  const activeUsers  = users.filter(u => u.is_active).length
  const totalOutcomes = outcomes.length
  const wins = outcomes.filter(o => ['tp1_hit','tp2_hit','tp3_hit'].includes(o.outcome)).length
  const wr = totalOutcomes > 0 ? `${Math.round(wins/totalOutcomes*100)}%` : '—'

  const sent   = notifs.filter(n => n.status === 'sent').length
  const failed = notifs.filter(n => n.status === 'failed').length
  const filtered = notifs.filter(n => n.status === 'filtered').length

  const byScenario: Record<number, number> = {}
  signals.forEach(s => {
    if (!byScenario[s.scenario_id]) byScenario[s.scenario_id] = 0
    byScenario[s.scenario_id]++
  })

  const byRank: Record<string, number> = { S:0, A:0, B:0, C:0 }
  signals.forEach(s => { if (s.signal_rank && byRank[s.signal_rank] !== undefined) byRank[s.signal_rank]++ })

  return (
    <div style={{ padding:'28px', fontFamily:F }}>
      <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e8eaf2', letterSpacing:'-0.4px', marginBottom:'24px' }}>Analytics</h1>

      {/* Overview metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Total signals', value:totalSignals.toString() },
          { label:'Overall win rate', value:wr, color:'#22c55e' },
          { label:'Active users', value:activeUsers.toString(), color:'#3b82f6' },
          { label:'Notifications sent', value:sent.toString() },
        ].map(m => (
          <div key={m.label} style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'18px 20px' }}>
            <div style={{ fontSize:'11px', color:'#555870', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>{m.label}</div>
            <div style={{ fontSize:'26px', fontWeight:'700', color:m.color || '#e8eaf2', letterSpacing:'-0.5px' }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>

        {/* Signals by scenario */}
        <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:'14px', fontWeight:'600', color:'#e8eaf2' }}>
            Signals by scenario
          </div>
          {Object.entries(byScenario).sort(([,a],[,b]) => b-a).map(([sid, count]) => {
            const pct = totalSignals > 0 ? (count/totalSignals)*100 : 0
            return (
              <div key={sid} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ width:'22px', height:'22px', borderRadius:'50%', background:'rgba(59,130,246,0.15)', color:'#60a5fa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'700', flexShrink:0 }}>
                  {sid}
                </span>
                <span style={{ flex:1, fontSize:'12px', color:'#8b90a8' }}>{SCENARIO[Number(sid)]}</span>
                <div style={{ width:'60px', height:'4px', background:'rgba(255,255,255,0.07)', borderRadius:'2px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'#3b82f6', borderRadius:'2px' }} />
                </div>
                <span style={{ fontSize:'12px', fontWeight:'600', color:'#e8eaf2', width:'24px', textAlign:'right' }}>{count}</span>
              </div>
            )
          })}
          {Object.keys(byScenario).length === 0 && (
            <div style={{ padding:'40px', textAlign:'center', color:'#555870', fontSize:'12px' }}>No data yet</div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* By rank */}
          <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Signals by rank</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {Object.entries(byRank).map(([rank, count]) => {
                const colors: Record<string, string> = { S:'#22c55e', A:'#3b82f6', B:'#f59e0b', C:'#8b90a8' }
                return (
                  <div key={rank} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'14px', textAlign:'center' }}>
                    <div style={{ fontSize:'20px', fontWeight:'800', color:colors[rank], marginBottom:'4px' }}>{rank}</div>
                    <div style={{ fontSize:'18px', fontWeight:'700', color:'#e8eaf2' }}>{count}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notification delivery */}
          <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>Notification delivery</div>
            {[
              { label:'Sent successfully', value:sent, color:'#22c55e' },
              { label:'Filtered (user rules)', value:filtered, color:'#f59e0b' },
              { label:'Failed', value:failed, color:'#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize:'12px', color:'#8b90a8' }}>{item.label}</span>
                <span style={{ fontSize:'14px', fontWeight:'700', color:item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* User activity */}
          <div style={{ background:'#111420', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#e8eaf2', marginBottom:'14px' }}>User overview</div>
            {[
              { label:'Total users', value:users.length },
              { label:'Active accounts', value:activeUsers },
              { label:'Suspended', value:users.filter(u => !u.is_active).length },
            ].map(item => (
              <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize:'12px', color:'#8b90a8' }}>{item.label}</span>
                <span style={{ fontSize:'14px', fontWeight:'700', color:'#e8eaf2' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
