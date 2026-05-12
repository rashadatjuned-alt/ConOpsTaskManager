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

  if (loading) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Loading Workspace...</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      
      {/* ─── REDESIGNED SIDEBAR ─── */}
      <aside className="sidebar">
        
        {/* Brand Area */}
        <div className="brand-container">
          <div className="logo-sq">C</div>
          <div className="brand-name">ConOps <span>Tasker</span></div>
        </div>

        {/* Navigation */}
        <nav className="nav-body">
          <div className="nav-label">General</div>
          <Link href="/dashboard" className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </Link>
          <Link href="/my-tasks" className={`nav-item ${isActive('/my-tasks') ? 'active' : ''}`}>
            <CheckSquare size={18} /> <span>My Tasks</span>
          </Link>
          <Link href="/my-projects" className={`nav-item ${isActive('/my-projects') ? 'active' : ''}`}>
            <Briefcase size={18} /> <span>My Projects</span>
          </Link>

          {isManagerial && (
            <>
              <div className="nav-label" style={{ marginTop: '24px' }}>Oversight</div>
              <Link href="/all-projects" className={`nav-item ${isActive('/all-projects') ? 'active' : ''}`}>
                <Layers size={18} /> <span>All Projects</span>
              </Link>
              <Link href="/all-tasks" className={`nav-item ${isActive('/all-tasks') ? 'active' : ''}`}>
                <CheckSquare size={18} /> <span>Global Tasks</span>
              </Link>
              <Link href="/workload" className={`nav-item ${isActive('/workload') ? 'active' : ''}`}>
                <BarChart3 size={18} /> <span>Workload Oversight</span>
              </Link>
            </>
          )}
        </nav>

        {/* Footer Area */}
        <div className="sidebar-footer">
          <div className="profile-strip">
            <div className="profile-avatar">{me?.full_name?.slice(0,2).toUpperCase()}</div>
            <div className="profile-text">
              <div className="p-name">{me?.full_name}</div>
              <div className="p-role">{me?.role}</div>
            </div>
          </div>

          <div className="utility-bar">
            <button onClick={() => setIsDark(!isDark)} className="u-btn" title="Theme">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => router.push('/settings/password')} className="u-btn" title="Password">
              <Lock size={16} />
            </button>
            <button onClick={handleLogout} className="u-btn logout" title="Sign Out">
              <LogOut size={16} /> <span>LOG OUT</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main style={{ marginLeft: '260px', flex: 1, padding: '40px 50px', background: 'var(--bg)' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '32px' }}>{title}</h1>
        {children}
      </main>

      <style jsx>{`
        .sidebar {
          width: 260px;
          background: #080808;
          border-right: 1px solid #1a1a1a;
          display: flex;
          flex-direction: column;
          position: fixed;
          height: 100vh;
          z-index: 100;
        }

        .brand-container {
          padding: 32px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-sq {
          width: 34px;
          height: 34px;
          background: linear-gradient(135deg, #378ADD, #1B5299);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 900;
          font-size: 18px;
        }

        .brand-name {
          font-size: 19px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .brand-name span { color: #378ADD; }

        .nav-body {
          flex: 1;
          padding: 0 16px;
        }

        .nav-label {
          padding: 10px 12px;
          font-size: 10px;
          font-weight: 800;
          color: #333;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: #666;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          border-radius: 12px;
          transition: 0.2s;
          margin-bottom: 2px;
        }

        .nav-item:hover {
          color: #fff;
          background: #111;
        }

        .nav-item.active {
          color: #fff;
          background: #141414;
          box-shadow: inset 0 0 0 1px #222;
          position: relative;
        }

        .nav-item.active::after {
          content: '';
          position: absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 3px;
          background: #378ADD;
          border-radius: 0 4px 4px 0;
        }

        .sidebar-footer {
          padding: 20px;
          background: #050505;
          border-top: 1px solid #1a1a1a;
        }

        .profile-strip {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 0 4px;
        }

        .profile-avatar {
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

        .profile-text { min-width: 0; }
        .p-name { font-size: 13px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .p-role { font-size: 9px; color: #555; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }

        .utility-bar { display: flex; gap: 8px; }

        .u-btn {
          background: #111;
          border: 1px solid #222;
          color: #444;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .u-btn:hover { background: #1a1a1a; color: #fff; border-color: #333; }

        .u-btn.logout {
          flex: 1;
          gap: 8px;
          font-size: 10px;
          font-weight: 800;
        }

        .u-btn.logout:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.15);
        }
      `}</style>
    </div>
  )
}
