'use client'
import { useEffect, useState, ReactNode, memo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import Link from 'next/link'

function Sidebar({ user, unreadCount }: { user: any; unreadCount: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))

  const NavItem = ({ href, label, badge }: { href: string; label: string; badge?: number }) => (
    <Link href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`}>
      {label}
      {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
    </Link>
  )

  return (
    <div className="sidebar">
      <div className="sidebar-logo">⬛ ConOps Tasker</div>

      <div className="nav-label">Main</div>
      <NavItem href="/dashboard"     label="🏠 Dashboard" />
      <NavItem href="/my-tasks"      label="☑ My Tasks" />
      <NavItem href="/my-projects"   label="📁 My Projects" />
      <NavItem href="/notifications" label="🔔 Notifications" badge={unreadCount} />

      <div className="nav-label">Tasks</div>
      <NavItem href="/tasks/create"  label="+ Create Task" />

      {(user.role === 'Manager' || user.role === 'Admin') && (
        <>
          <div className="nav-label">Management</div>
          <NavItem href="/all-projects"    label="⊞ All Projects" />
          <NavItem href="/all-tasks"       label="≡ All Tasks" />
          <NavItem href="/projects/create" label="+ New Project" />
        </>
      )}

      {user.role === 'Admin' && (
        <>
          <div className="nav-label">Admin</div>
          <NavItem href="/admin/users"         label="👥 Users" />
          <NavItem href="/admin/notifications" label="📢 Notifications" />
        </>
      )}

      <div className="sidebar-footer">
        {/* Theme toggle */}
        <button onClick={toggle} className="theme-toggle" style={{ width: '100%', marginBottom: 10, justifyContent: 'center' }}>
          {theme === 'light' ? '🌙 Dark Mode' : '☀ Light Mode'}
        </button>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{user.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{user.role}</div>
          </div>
          <button onClick={signOut} title="Sign out"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, padding: '2px 4px', lineHeight: 1 }}>
            ⏻
          </button>
        </div>
      </div>
    </div>
  )
}

const MemoSidebar = memo(Sidebar)

export default function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const router = useRouter()
  const [user, setUser]   = useState<any>(null)
  const [unread, setUnread] = useState(0)
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b7280', fontSize: 13, background: 'var(--bg3)' }}>
      Loading ConOps Tasker...
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
