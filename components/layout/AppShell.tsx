'use client'
import { useEffect, useState, ReactNode, memo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import Link from 'next/link'

// ── Change Password Modal ─────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current,  setCurrent]  = useState('')
  const [newPass,  setNewPass]  = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [showCur,  setShowCur]  = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [showCon,  setShowCon]  = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!current.trim())           { setError('Current password is required.'); return }
    if (newPass.length < 6)        { setError('New password must be at least 6 characters.'); return }
    if (newPass !== confirm)       { setError('Passwords do not match.'); return }
    if (newPass === current)       { setError('New password must be different from current.'); return }

    setLoading(true)

    // Re-authenticate with current password first
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email || ''

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email, password: current,
    })

    if (signInErr) {
      setError('Current password is incorrect.')
      setLoading(false)
      return
    }

    // Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass })

    if (updateErr) {
      setError(updateErr.message)
    } else {
      setSuccess(true)
      setTimeout(() => onClose(), 2000)
    }
    setLoading(false)
  }

  const inputWrap: React.CSSProperties = {
    position: 'relative', display: 'flex', alignItems: 'center',
  }
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 38px 8px 11px',
    background: 'var(--input-bg)', border: '1px solid var(--input-brd)',
    borderRadius: 7, color: 'var(--txt)', fontSize: 13,
    fontFamily: 'inherit', outline: 'none',
  }
  const eyeBtn: React.CSSProperties = {
    position: 'absolute', right: 10, background: 'none',
    border: 'none', cursor: 'pointer', color: 'var(--txt3)',
    fontSize: 15, padding: 0, lineHeight: 1,
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: 'var(--txt3)',
    display: 'block', marginBottom: 5,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 14, width: 400, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Change Password</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 3 }}>Minimum 6 characters</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>Password changed!</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 6 }}>Closing...</div>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(197,34,31,0.2)', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Current Password</label>
              <div style={inputWrap}>
                <input type={showCur ? 'text' : 'password'} style={inp} value={current} onChange={e => setCurrent(e.target.value)} placeholder="Enter current password" />
                <button style={eyeBtn} onClick={() => setShowCur(!showCur)}>{showCur ? '🙈' : '👁'}</button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>New Password</label>
              <div style={inputWrap}>
                <input type={showNew ? 'text' : 'password'} style={inp} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Enter new password" />
                <button style={eyeBtn} onClick={() => setShowNew(!showNew)}>{showNew ? '🙈' : '👁'}</button>
              </div>
              {newPass.length > 0 && (
                <div style={{ marginTop: 5, display: 'flex', gap: 4 }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: newPass.length >= [6, 8, 10, 12][i]
                        ? ['var(--red)', 'var(--amber)', 'var(--blue)', 'var(--accent)'][i]
                        : 'var(--bg3)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>Confirm New Password</label>
              <div style={inputWrap}>
                <input type={showCon ? 'text' : 'password'} style={inp} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                <button style={eyeBtn} onClick={() => setShowCon(!showCon)}>{showCon ? '🙈' : '👁'}</button>
              </div>
              {confirm.length > 0 && newPass !== confirm && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Passwords do not match</div>
              )}
              {confirm.length > 0 && newPass === confirm && newPass.length >= 6 && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>✓ Passwords match</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose}
                style={{ flex: 1, padding: '9px', background: 'var(--bg3)', border: '1px solid var(--brd2)', color: 'var(--txt2)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ flex: 1, padding: '9px', background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────
function TacticalGridIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="stg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1b4332"/>
          <stop offset="100%" stopColor="#52b788"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#stg1)"/>
      <rect x="16" y="16" width="22" height="22" rx="5" fill="white"/>
      <rect x="44" y="16" width="22" height="22" rx="5" fill="rgba(255,255,255,0.45)"/>
      <rect x="72" y="16" width="12" height="22" rx="5" fill="rgba(255,255,255,0.2)"/>
      <rect x="16" y="44" width="22" height="22" rx="5" fill="white"/>
      <rect x="44" y="44" width="22" height="22" rx="5" fill="white"/>
      <rect x="72" y="44" width="12" height="22" rx="5" fill="rgba(255,255,255,0.45)"/>
      <rect x="16" y="72" width="22" height="12" rx="5" fill="rgba(255,255,255,0.45)"/>
      <rect x="44" y="72" width="22" height="12" rx="5" fill="white"/>
      <rect x="72" y="72" width="12" height="12" rx="5" fill="white"/>
      <path d="M20 27l5 5 9-9" stroke="#1b4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M20 55l5 5 9-9" stroke="#1b4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M48 55l5 5 9-9" stroke="#1b4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function Sidebar({ user, unreadCount }: { user: any; unreadCount: number }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { theme, toggle } = useTheme()
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [showUserMenu,  setShowUserMenu]  = useState(false)

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isActive = (href: string) =>
    pathname === href || (href.length > 1 && pathname.startsWith(href + '/'))

  const NavItem = ({ href, icon, label, badge }: {
    href: string; icon: string; label: string; badge?: number
  }) => (
    <Link href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`}>
      <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {label}
      {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
    </Link>
  )

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-logo">
          <span style={{ fontSize: 18 }}>⬛</span>
          ConOps Tasker
        </div>

        <div className="nav-label">Main</div>
        <NavItem href="/dashboard"    icon="🏠" label="Dashboard" />
        <NavItem href="/my-tasks"     icon="☑"  label="My Tasks" />
        <NavItem href="/my-projects"  icon="📁" label="My Projects" />
        <NavItem href="/notifications" icon="🔔" label="Notifications" badge={unreadCount} />

        <div className="nav-label">Tasks</div>
        <NavItem href="/tasks/create" icon="＋" label="Create Task" />

        {(user.role === 'Manager' || user.role === 'Admin') && (
          <>
            <div className="nav-label">Management</div>
            <NavItem href="/all-projects"    icon="⊞" label="All Projects" />
            <NavItem href="/all-tasks"       icon="≡" label="All Tasks" />
            <NavItem href="/projects/create" icon="＋" label="New Project" />
          </>
        )}

        {user.role === 'Admin' && (
          <>
            <div className="nav-label">Admin</div>
            <NavItem href="/admin/users"         icon="👥" label="Users" />
            <NavItem href="/admin/notifications" icon="📢" label="Notifications" />
          </>
        )}

        <div className="sidebar-footer">
          {/* Theme toggle */}
          <button onClick={toggle} className="theme-toggle">
            <span>{theme === 'light' ? '🌙' : '☀️'}</span>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>

          {/* User card */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.14s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav-hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{user.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--user-name)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: 'var(--user-role)' }}>{user.role}</div>
              </div>
              <span style={{ color: 'var(--nav-txt)', fontSize: 12 }}>⋯</span>
            </div>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                background: 'var(--card-bg)', border: '1px solid var(--card-brd)',
                borderRadius: 10, overflow: 'hidden', marginBottom: 6,
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              }}>
                <button
                  onClick={() => { setShowChangePwd(true); setShowUserMenu(false) }}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--txt)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  🔑 Change Password
                </button>
                <div style={{ height: 1, background: 'var(--brd)' }} />
                <button
                  onClick={signOut}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--red)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--red2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  ⏻ Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  )
}

const MemoSidebar = memo(Sidebar)

// ── AppShell ──────────────────────────────────────────────
export default function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const router  = useRouter()
  const [user,    setUser]    = useState<any>(null)
  const [unread,  setUnread]  = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      const name = u?.full_name || session.user.email?.split('@')[0] || 'User'
      const parts = name.trim().split(' ')
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase()

      setUser({ id: session.user.id, email: session.user.email, name, initials, role: u?.role || 'Team Member' })

      const { data: n } = await supabase.from('Notifications')
        .select('id').eq('user_id', session.user.id).eq('is_read', false)
      setUnread(n?.length || 0)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--txt3)', fontSize: 13, background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      Loading ConOps Tasker…
    </div>
  )
  if (!user) return null

  return (
    <div className="app">
      <MemoSidebar user={user} unreadCount={unread} />
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{title}</div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
