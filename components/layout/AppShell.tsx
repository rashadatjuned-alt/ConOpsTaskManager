'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  LayoutDashboard, Bell, CheckSquare, Briefcase, PlusSquare, 
  Globe, Layers, BarChart3, Users, Settings, Lock, Sun, Moon 
} from 'lucide-react'
import PasswordModal from './PasswordModal'
import NotificationModal from './NotificationModal'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showNotificationModal, setShowNotificationModal] = useState(false)

  useEffect(() => {
    const savedTheme = (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)

    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      const { data } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...data, email: session.user.email })
      setLoading(false)
    }
    getProfile()
  }, [router])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('app-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isActive = (path: string) => pathname === path
  const isManagerial = me?.role === 'Manager' || me?.role === 'Admin'
  const isAdmin = me?.role === 'Admin'

  if (loading) return (
    <div style={{ background: 'var(--bg3)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
      Loading Session...
    </div>
  )

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" />
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <path d="M12 10V2M12 14V22M18.5 8.5L20.5 7M5.5 15.5L3.5 17M18.5 15.5L20.5 17M5.5 8.5L3.5 7" />
            </svg>
          </div>
          <div className="brand-name">ConOps <span>Tasker</span></div>
        </div>

        <nav className="nav-container">
          <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </Link>
          
          <Link href="/my-tasks" className={`nav-item ${isActive('/my-tasks') ? 'active' : ''}`}>
            <CheckSquare size={18} /> <span>My Task</span>
          </Link>
          <Link href="/my-projects" className={`nav-item ${isActive('/my-projects') ? 'active' : ''}`}>
            <Briefcase size={18} /> <span>My Project</span>
          </Link>
          <Link href="/tasks/create" className={`nav-item ${isActive('/tasks/create') ? 'active' : ''}`}>
            <PlusSquare size={18} /> <span>Create Task</span>
          </Link>

          {isManagerial && (
            <>
              <div className="nav-label">Management</div>
              <Link href="/all-projects" className={`nav-item ${isActive('/all-projects') ? 'active' : ''}`}>
                <Globe size={18} /> <span>Global Projects</span>
              </Link>
              <Link href="/all-tasks" className={`nav-item ${isActive('/all-tasks') ? 'active' : ''}`}>
                <Layers size={18} /> <span>Global Task</span>
              </Link>
              <Link href="/workload" className={`nav-item ${isActive('/workload') ? 'active' : ''}`}>
                <BarChart3 size={18} /> <span>Workload Oversight</span>
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <div className="nav-label">Administration</div>
              <Link href="/admin/users" className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`}>
                <Users size={18} /> <span>User Management</span>
              </Link>
              {/* RESTORED: Notification Management Link */}
              <Link href="/admin/notifications" className={`nav-item ${isActive('/admin/notifications') ? 'active' : ''}`}>
                <Settings size={18} /> <span>Notification Management</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="avatar">{me?.full_name?.slice(0,2).toUpperCase()}</div>
            <div className="user-meta">
              <span className="name">{me?.full_name}</span>
              <span className="role">{me?.role}</span>
            </div>
          </div>
          <div className="footer-actions">
            <button onClick={() => setShowNotificationModal(true)} className="icon-btn" title="Notifications">
              <Bell size={16} />
            </button>
            <button onClick={toggleTheme} className="icon-btn" title="Toggle Theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setShowPasswordModal(true)} className="icon-btn" title="Security Settings">
              <Lock size={16} />
            </button>
            <button onClick={handleLogout} className="icon-btn logout"><span>Logout</span></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header"><h1>{title}</h1></header>
        <div className="page-wrapper">{children}</div>
      </main>

      <PasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
      <NotificationModal isOpen={showNotificationModal} onClose={() => setShowNotificationModal(false)} userId={me?.id} />

      <style jsx>{`
        .app-layout { display: flex; min-height: 100vh; background: var(--bg3); }
        .sidebar { width: 260px; background: var(--bg); border-right: 1px solid var(--brd); display: flex; flex-direction: column; position: fixed; height: 100vh; z-index: 100; }
        .sidebar-logo { padding: 32px 24px; display: flex; align-items: center; gap: 12px; }
        .logo-icon { width: 34px; height: 34px; background: var(--nav-active-txt); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 6px; }
        .brand-name { font-size: 19px; font-weight: 900; color: var(--txt); letter-spacing: -0.5px; }
        .brand-name span { color: var(--nav-active-txt); }
        
        .nav-container { flex: 1; padding: 0 16px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
        .nav-label { font-size: 10px; color: var(--txt3); padding: 32px 12px 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
        .nav-item { display: flex; flex-direction: row; align-items: center; gap: 12px; padding: 11px 16px; color: var(--txt2); text-decoration: none; font-size: 13.5px; font-weight: 600; border-radius: 8px; transition: 0.2s; }
        
        .nav-item:hover { background: var(--bg2); color: var(--txt); }
        .nav-item.active { background: var(--nav-active-bg); color: var(--nav-active-txt); }
        .sidebar-footer { padding: 20px; background: var(--bg); border-top: 1px solid var(--brd); }
        .user-pill { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 0 4px; }
        .avatar { width: 36px; height: 36px; border-radius: 10px; background: var(--bg2); border: 1px solid var(--brd2); display: flex; align-items: center; justify-content: center; color: var(--nav-active-txt); font-weight: 800; font-size: 12px; }
        .user-meta { display: flex; flex-direction: column; min-width: 0; }
        .name { font-size: 13px; font-weight: 700; color: var(--txt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .role { font-size: 9px; color: var(--txt3); font-weight: 800; text-transform: uppercase; }
        .footer-actions { display: flex; gap: 8px; }
        .icon-btn { flex: 1; background: var(--bg2); border: 1px solid var(--brd2); color: var(--txt2); padding: 8px; border-radius: 8px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .icon-btn:hover { color: var(--txt); border-color: var(--txt3); }
        .logout { font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .main-content { margin-left: 260px; flex: 1; display: flex; flex-direction: column; }
        .content-header { padding: 32px 48px 0; }
        .content-header h1 { font-size: 24px; font-weight: 800; color: var(--txt); }
        .page-wrapper { padding: 32px 48px; }
      `}</style>
    </div>
  )
}