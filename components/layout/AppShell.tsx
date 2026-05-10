'use client'
import { useEffect, useState, ReactNode, memo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import Link from 'next/link'

function Sidebar({ user, unreadCount }: { user: any; unreadCount: number }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { theme, toggle } = useTheme()

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
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span style={{ fontSize: 18 }}>⬛</span>
        ConOps Tasker
      </div>

      {/* Main nav */}
      <div className="nav-label">Main</div>
      <NavItem href="/dashboard"     icon="🏠" label="Dashboard" />
      <NavItem href="/my-tasks"      icon="☑" label="My Tasks" />
      <NavItem href="/my-projects"   icon="📁" label="My Projects" />
      <NavItem href="/notifications"  icon="🔔" label="Notifications" badge={unreadCount} />

      <div className="nav-label">Tasks</div>
      <NavItem href="/tasks/create"  icon="＋" label="Create Task" />

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
          <NavItem href="/admin/users"          icon="👥" label="Users" />
          <NavItem href="/admin/notifications"  icon="📢" label="Notifications" />
        </>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Theme toggle */}
        <button onClick={toggle} className="theme-toggle">
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>

        {/* User card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
            {user.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 600,
              color: 'var(--user-name)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--user-role)' }}>{user.role}</div>
          </div>
          <button onClick={signOut} title="Sign out" style={{
            background: 'none', border: 'none',
            color: 'var(--nav-txt)', cursor: 'pointer',
            fontSize: 16, padding: '3px 5px', lineHeight: 1,
            borderRadius: 6, transition: 'color 0.14s',
          }}>
            ⏻
          </button>
        </div>
      </div>
    </div>
  )
}

const MemoSidebar = memo(Sidebar)

export default function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const router  = useRouter()
  const [user,    setUser]    = useState<any>(null)
  const [unread,  setUnread]  = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const { data: u } = await supabase
        .from('Users').select('*').eq('id', session.user.id).single()

      const name = u?.full_name || session.user.email?.split('@')[0] || 'User'
      const parts = name.trim().split(' ')
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase()

      setUser({
        id: session.user.id,
        email: session.user.email,
        name, initials,
        role: u?.role || 'Team Member',
      })

      const { data: n } = await supabase
        .from('Notifications')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('is_read', false)
      setUnread(n?.length || 0)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--txt3)', fontSize: 13,
      background: 'var(--bg)', fontFamily: 'Inter, sans-serif',
    }}>
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
