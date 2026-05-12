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
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      const { data } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...data, email: session.user.email })
      setLoading(false)
    }
    getProfile()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isManagerial = me?.role === 'Manager' || me?.role === 'Admin'
  const isActive = (path: string) => pathname === path

  if (loading) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Loading Secure Session...</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      
      {/* ─── SIDEBAR ─── */}
      <aside className="executive-sidebar">
        
        {/* BRANDING: Logo next to Title */}
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
            <button onClick={() => setIsDark(!isDark)} className="tray-btn" title="Theme">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
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
          background: #080808;
          border-right: 1px solid #1a1a1a;
          display: flex;
          flex-direction: column;
          position: fixed;
          height: 100vh;
          z-index: 100;
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
          background: linear-gradient(135deg, #378ADD, #1B5299);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 900;
          font-size: 16px;
          box-shadow: 0 4px 10px rgba(55, 138, 221, 0.2);
        }

        .brand-text {
          font-size: 18px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.5px;
          white-space: nowrap;
        }

        .brand-text span {
          color: #378ADD;
        }

        .nav-stack {
          flex: 1;
          padding: 0 16px;
        }

        .section-label {
          padding: 10px 12px;
          font-size: 10px;
          font-weight: 800;
          color: #333;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .nav-link-new {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: #666;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          border-radius: 12px;
          transition: all 0.2s ease;
          margin-bottom: 2px;
        }

        .nav-link-new:hover {
          color: #fff;
          background: #111;
        }

        .nav-link-new.active {
          color: #fff;
          background: #141414;
          box-shadow: inset 0 0 0 1px #222;
        }

        .sidebar-footer {
          padding: 20px;
          background: #050505;
          border-top: 1px solid #1a1a1a;
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
          background: #111;
          border: 1px solid #222;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #378ADD;
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
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .role {
          font-size: 9px;
          color: #555;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-tray {
          display: flex;
          gap: 8px;
        }

        .tray-btn {
          background: #111;
          border: 1px solid #222;
          color: #444;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tray-btn:hover {
          background: #1a1a1a;
          color: #fff;
          border-color: #333;
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
          border-color: rgba(239, 68, 68, 0.15);
        }

        .main-viewport {
          marginLeft: 260px;
          flex: 1;
          padding: 40px 50px;
          background: var(--bg);
        }

        .page-header h1 {
          fontSize: 26px;
          fontWeight: 800;
          color: #fff;
          letterSpacing: -0.5px;
          marginBottom: 32px;
        }
      `}</style>
    </div>
  )
}
