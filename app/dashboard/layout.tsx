'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const NAV_USER = [
  { href: '/dashboard',                  label: 'Dashboard',       icon: 'grid' },
  { href: '/dashboard/signals',          label: 'Live signals',    icon: 'zap'  },
  { href: '/dashboard/history',          label: 'Signal history',  icon: 'clock' },
  { href: '/dashboard/performance',      label: 'Performance',     icon: 'trending' },
  { href: '/dashboard/notifications',    label: 'Notifications',   icon: 'bell' },
  { href: '/dashboard/profile',          label: 'My profile',      icon: 'user' },
]

const NAV_ADMIN = [
  { href: '/dashboard/admin/users',        label: 'Users',           icon: 'users'    },
  { href: '/dashboard/admin/scanner',      label: 'Scanner config',  icon: 'settings' },
  { href: '/dashboard/admin/diagnostics',  label: 'Diagnostics',     icon: 'pulse'    },
  { href: '/dashboard/admin/analytics',    label: 'Analytics',       icon: 'bar'      },
]

function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const s = { width: size, height: size, flexShrink: 0 } as React.CSSProperties
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'grid')     return <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
  if (name === 'zap')      return <svg style={s} viewBox="0 0 24 24" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  if (name === 'clock')    return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  if (name === 'trending') return <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
  if (name === 'bell')     return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  if (name === 'user')     return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  if (name === 'users')    return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  if (name === 'settings') return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  if (name === 'bar')      return <svg style={s} viewBox="0 0 24 24" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  if (name === 'pulse')    return <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  if (name === 'logout')   return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
  return null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase
        .from('users').select('*').eq('id', data.user.id).single()
      if (!profile || !profile.is_active) { router.push('/auth/login'); return }
      setUser(profile)
      setLoading(false)
    })
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0b0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #1e2235', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#555870', fontSize: '13px' }}>Loading IntelliCoin…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const isAdmin = user?.role === 'admin'
  const initials = (user?.full_name || user?.email || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0b0d14', fontFamily: F }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: '232px', flexShrink: 0,
        background: '#0f1117',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px',
              background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59,130,246,0.25)', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                <polyline points="16 7 22 7 22 13"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8eaf2', letterSpacing: '-0.3px' }}>IntelliCoin</div>
              <div style={{ fontSize: '10px', color: '#555870', marginTop: '1px' }}>Signal Intelligence</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#555870', padding: '0 8px', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Overview
          </div>
          {NAV_USER.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px', marginBottom: '2px',
                fontSize: '13px', fontWeight: active ? '600' : '400',
                color: active ? '#e8eaf2' : '#8b90a8',
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#c8cadc' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8b90a8' } }}
              >
                <span style={{ color: active ? '#3b82f6' : '#555870' }}>
                  <Icon name={item.icon} size={14} />
                </span>
                {item.label}
                {item.href === '/dashboard/signals' && (
                  <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                )}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#555870', padding: '12px 8px 5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Admin
              </div>
              {NAV_ADMIN.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px', marginBottom: '2px',
                    fontSize: '13px', fontWeight: active ? '600' : '400',
                    color: active ? '#e8eaf2' : '#8b90a8',
                    background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#c8cadc' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8b90a8' } }}
                  >
                    <span style={{ color: active ? '#3b82f6' : '#555870' }}>
                      <Icon name={item.icon} size={14} />
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'rgba(59,130,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: '700', color: '#93c5fd', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e8eaf2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || user?.email?.split('@')[0]}
              </div>
              <div style={{ fontSize: '10px', color: '#555870', textTransform: 'capitalize' }}>
                {user?.role} {isAdmin ? '· Admin' : ''}
              </div>
            </div>
            <button onClick={signOut} style={{ background: 'none', border: 'none', color: '#555870', padding: '4px', borderRadius: '5px', display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#8b90a8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555870')}
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#0b0d14' }}>
        {children}
      </main>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
