'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  LayoutDashboard, Bell, CheckSquare, Briefcase, PlusSquare, 
  Globe, Layers, BarChart3, Users, Settings, LogOut, Lock, Sun, Moon 
} from 'lucide-react'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)

    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/auth')
      const { data } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe(data)
      setLoading(false)
    }
    getProfile()
  }, [router])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('app-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isManagerial = me?.role === 'Manager' || me?.role === 'Admin'
  const isAdmin = me?.role === 'Admin'
  const isActive = (path: string) => pathname === path

  if (loading) return <div style={{ background: 'var(--bg3)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg3)' }}>
      <aside style={{ width: '260px', background: 'var(--bg)', borderRight: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, background: 'var(--nav-active-txt)', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" /><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' }}>ConOps <span style={{ color: 'var(--nav-active-txt)' }}>Tasker</span></div>
        </div>

        <nav style={{ flex: 1, padding: '0 16px', overflowY: 'auto' }}>
          <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}><LayoutDashboard size={18} /> Dashboard</Link>
          <Link href="/notifications" className={`nav-item ${isActive('/notifications') ? 'active' : ''}`}><Bell size={18} /> Notification</Link>
          <Link href="/my-tasks" className={`nav-item ${isActive('/my-tasks') ? 'active' : ''}`}><CheckSquare size={18} /> My Task</Link>
          <Link href="/my-projects" className={`nav-item ${isActive('/my-projects') ? 'active' : ''}`}><Briefcase size={18} /> My Project</Link>
          <Link href="/tasks/create" className={`nav-item ${isActive('/tasks/create') ? 'active' : ''}`}><PlusSquare size={18} /> Create Task</Link>

          {isManagerial && (
            <>
              <div className="nav-label">Management</div>
              <Link href="/all-projects" className={`nav-item ${isActive('/all-projects') ? 'active' : ''}`}><Globe size={18} /> Global Projects</Link>
              <Link href="/all-tasks" className={`nav-item ${isActive('/all-tasks') ? 'active' : ''}`}><Layers size={18} /> Global Task</Link>
              <Link href="/workload" className={`nav-item ${isActive('/workload') ? 'active' : ''}`}><BarChart3 size={18} /> Workload Oversight</Link>
            </>
          )}

          {isAdmin && (
            <>
              <div className="nav-label">Administration</div>
              <Link href="/admin/users" className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`}><Users size={18} /> User Management</Link>
              <Link href="/admin/notifications" className={`nav-item ${isActive('/admin/notifications') ? 'active' : ''}`}><Settings size={18} /> Notification Management</Link>
            </>
          )}
        </nav>

        <div style={{ padding: '20px', background: 'var(--bg)', borderTop: '1px solid var(--brd)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={toggleTheme} className="icon-btn">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button onClick={() => router.push('/settings/password')} className="icon-btn"><Lock size={16} /></button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth') }} className="icon-btn">Logout</button>
          </div>
        </div>
      </aside>

      <main style={{ marginLeft: '260px', flex: 1, padding: '40px 50px' }}>
        <header style={{ marginBottom: '32px' }}><h1 style={{ fontSize: '26px', fontWeight: 800 }}>{title}</h1></header>
        {children}
      </main>

      <style jsx>{`
        .nav-label { font-size: 10px; color: var(--txt3); padding: 24px 12px 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; color: var(--txt2); text-decoration: none; font-size: 13.5px; font-weight: 600; border-radius: 8px; margin-bottom: 2px; }
        .nav-item:hover { background: var(--bg2); color: var(--txt); }
        .nav-item.active { background: var(--nav-active-bg); color: var(--nav-active-txt); }
        .icon-btn { flex: 1; background: var(--bg2); border: 1px solid var(--brd2); color: var(--txt2); padding: 8px; border-radius: 8px; cursor: pointer; }
      `}</style>
    </div>
  )
}
