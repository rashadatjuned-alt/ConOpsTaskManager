'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  CheckSquare, 
  Briefcase, 
  BarChart3, 
  LogOut, 
  Layers,
  Lock,
  Sun,
  Moon
} from 'lucide-react'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // Load saved theme
    const savedTheme = localStorage.getItem('app-theme') as 'dark' | 'light'
    if (savedTheme) setTheme(savedTheme)

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
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isManagerial = me?.role === 'Manager' || me?.role === 'Admin'
  const isActive = (path: string) => pathname === path

  if (loading) return <div style={{ background: 'var(--bg)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-muted)' }}>Loading Secure Session...</div>

  return (
    <div className="app-wrapper" data-theme={theme} style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      
      {/* ─── EXACT LAYOUT SIDEBAR ─── */}
      <aside className="executive-sidebar">
        
        {/* BRANDING */}
        <div className="brand-section">
          <div className="brand-wrapper">
            <div className="logo-square">C</div>
            <div className="brand-text">
              ConOps <span>Tasker</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="nav-stack">
          <div className="section-label">General</div>
          <Link href="/dashboard" className={`nav-link-new ${isActive('/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/my-tasks" className={`nav-link-new ${isActive('/my-tasks') ? 'active' : ''}`}>
            <CheckSquare size={18} /> My Tasks
          </Link>
          <Link href="/my-projects" className={`nav-link-new ${isActive('/my-projects') ? 'active' : ''}`}>
            <Briefcase size={18} /> My Projects
          </Link>

          {isManagerial && (
            <>
              <div className="section-label" style={{ marginTop: '28px' }}>Oversight</div>
              <Link href="/all-projects" className={`nav-link-new ${isActive('/all-projects') ? 'active' : ''}`}>
                <Layers size={18} /> All Projects
              </Link>
              <Link href="/all-tasks" className={`nav-link-new ${isActive('/all-tasks') ? 'active' : ''}`}>
                <CheckSquare size={18} /> Global Tasks
              </Link>
              <Link href="/workload" className={`nav-link-new ${isActive('/workload') ? 'active' : ''}`}>
                <BarChart3 size={18} /> Workload Oversight
              </Link>
            </>
          )}
        </nav>

        {/* ─── UTILITY TRAY ─── */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar-squircle">{me?.full_name?.slice(0,2).toUpperCase()}</div>
            <div className="user-meta">
              <span className="name">{me?.full_name}</span>
              <span className="role">{me?.role}</span>
            </div>
          </div>

          <div className="action-tray">
            <button onClick={toggleTheme} className="tray-btn" title="Theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => router.push('/settings/password')} className="tray-btn" title="Security">
              <Lock size={16} />
            </button>
            <button onClick={handleLogout} className="tray-btn logout" title="Sign Out">
              <LogOut size={16} />
              <span>LOG OUT</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="main-viewport">
        <header className="page-header">
          <h1>{title}</h1>
        </header>
        <section className="content-container">
          {children}
        </section>
      </main>

      <style jsx>{`
        .executive-sidebar {
          width: 260px;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: fixed;
          height: 100vh;
          z-index: 100;
          transition: background 0.3s ease, border-color 0.3s ease;
        }

        .brand-section {
          padding: 32px 24px;
        }

        .brand-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-square {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--accent), var(--accent-dark));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 900;
          font-size: 16px;
          box-shadow: 0 4px 10px var(--accent-glow);
        }

        .brand-text {
          font-size: 18px;
          font-weight: 900;
          color: var(--txt-main);
          letter-spacing: -0.5px;
          white-space: nowrap;
        }

        .brand-text span {
          color: var(--accent);
        }

        .nav-stack {
          flex: 1;
          padding: 0 16px;
        }

        .section-label {
          padding: 10px 12px;
          font-size: 10px;
          font-weight: 800;
          color: var(--txt-label);
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .nav-link-new {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: var(--txt-muted);
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          border-radius: 12px;
          transition: all 0.2s ease;
          margin-bottom: 2px;
        }

        .nav-link-new:hover {
          color: var(--txt-main);
          background: var(--nav-hover);
        }

        /* REVERTED TO INSET BOX SHADOW FOR ACTIVE STATE */
        .nav-link-new.active {
          color: var(--txt-main);
          background: var(--nav-active);
          box-shadow: inset 0 0 0 1px var(--border);
        }

        .sidebar-footer {
          padding: 20px;
          background: var(--footer-bg);
          border-top: 1px solid var(--border);
          transition: background 0.3s ease;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 0 4px;
        }

        .avatar-squircle {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--util-bg);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          font-weight: 800;
          font-size: 13px;
        }

        .user-meta {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .name {
          font-size: 13px;
          font-weight: 700;
          color: var(--txt-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .role {
          font-size: 9px;
          color: var(--txt-muted);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-tray {
          display: flex;
          gap: 8px;
        }

        .tray-btn {
          background: var(--util-bg);
          border: 1px solid var(--border);
          color: var(--txt-muted);
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tray-btn:hover {
          background: var(--util-hover);
          color: var(--txt-main);
          border-color: var(--txt-label);
        }

        .logout {
          flex: 1;
          gap: 8px;
          font-size: 10px;
          font-weight: 800;
        }

        .logout:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.2);
        }

        .main-viewport {
          margin-left: 260px;
          flex: 1;
          padding: 40px 50px;
        }

        .page-header h1 {
          font-size: 26px;
          font-weight: 800;
          color: var(--txt-main);
          letter-spacing: -0.5px;
          margin-bottom: 32px;
        }
      `}</style>
    </div>
  )
}
