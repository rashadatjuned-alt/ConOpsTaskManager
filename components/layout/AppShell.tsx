'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  LayoutDashboard, CheckSquare, Briefcase, BarChart3, 
  LogOut, Layers, Lock, Sun, Moon, PlusSquare, FolderPlus 
} from 'lucide-react'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
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

  if (loading) return <div style={{ background: 'var(--bg)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-muted)', fontWeight: 600 }}>Loading Workspace...</div>

  return (
    <div className="app-wrapper" data-theme={theme}>
      
      <aside className="sidebar">
        <div className="brand-container">
          <div className="logo-sq">C</div>
          <div className="brand-name">ConOps <span>Tasker</span></div>
        </div>

        <nav className="nav-body">
          <div className="nav-label">General</div>
          
          {/* NEW: Create Task - Available to everyone */}
          <Link href="/tasks/create" className={`nav-item ${isActive('/tasks/create') ? 'active' : ''}`}>
            <PlusSquare size={18} /> <span>Create Task</span>
          </Link>
          
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
              
              {/* NEW: Create Project - Managers Only */}
              <Link href="/projects/create" className={`nav-item ${isActive('/projects/create') ? 'active' : ''}`}>
                <FolderPlus size={18} /> <span>Create Project</span>
              </Link>

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

        <div className="sidebar-footer">
          <div className="profile-strip">
            <div className="profile-avatar">{me?.full_name?.slice(0,2).toUpperCase()}</div>
            <div className="profile-text">
              <div className="p-name">{me?.full_name}</div>
              <div className="p-role">{me?.role}</div>
            </div>
          </div>

          <div className="utility-bar">
            <button onClick={toggleTheme} className="u-btn" title="Toggle Theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
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

      <main className="main-viewport">
        <header className="page-header">
            <h1>{title}</h1>
        </header>
        {children}
      </main>

      <style jsx global>{`
        /* Keeping your existing CSS variables and styles intact */
        .app-wrapper { display: flex; min-height: 100vh; background: var(--bg); transition: background 0.3s ease; }
        
        .sidebar {
          width: 260px; background: var(--sidebar-bg); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; position: fixed; height: 100vh; z-index: 100;
          transition: background 0.3s ease, border-color 0.3s ease;
        }

        .brand-container { padding: 32px 24px; display: flex; align-items: center; gap: 12px; }
        .logo-sq {
          width: 34px; height: 34px; background: linear-gradient(135deg, var(--accent), var(--accent-dark));
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 900; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .brand-name { font-size: 19px; font-weight: 900; color: var(--txt-main); letter-spacing: -0.5px; }
        .brand-name span { color: var(--accent); }

        .nav-body { flex: 1; padding: 0 16px; overflow-y: auto; }
        .nav-label { padding: 10px 12px; font-size: 10px; font-weight: 800; color: var(--txt-label); text-transform: uppercase; letter-spacing: 1.5px; }
        .nav-item {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: var(--txt-muted);
          text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px; transition: 0.2s; margin-bottom: 2px;
        }
        .nav-item:hover { color: var(--txt-main); background: var(--nav-hover); }
        .nav-item.active { color: var(--accent); background: var(--nav-active); font-weight: 700; position: relative; }
        .nav-item.active::after { content: ''; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; background: var(--accent); border-radius: 0 4px 4px 0; }

        .sidebar-footer { padding: 20px; background: var(--footer-bg); border-top: 1px solid var(--border); transition: background 0.3s ease; }
        .profile-strip { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 0 4px; }
        .profile-avatar {
          width: 38px; height: 38px; border-radius: 10px; background: var(--util-bg); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; color: var(--accent); font-weight: 800; font-size: 13px;
        }
        .p-name { font-size: 13px; font-weight: 700; color: var(--txt-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .p-role { font-size: 9px; color: var(--txt-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }

        .utility-bar { display: flex; gap: 8px; }
        .u-btn {
          background: var(--util-bg); border: 1px solid var(--border); color: var(--txt-muted);
          padding: 10px; border-radius: 10px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .u-btn:hover { background: var(--util-hover); color: var(--txt-main); }
        .u-btn.logout { flex: 1; gap: 8px; font-size: 10px; font-weight: 800; }
        .u-btn.logout:hover { color: #ef4444; background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2); }

        .main-viewport { margin-left: 260px; flex: 1; padding: 40px 50px; background: var(--bg); transition: background 0.3s ease; min-height: 100vh; }
        .page-header h1 { font-size: 26px; font-weight: 800; color: var(--txt-main); letter-spacing: -0.5px; margin-bottom: 32px; }
      `}</style>
    </div>
  )
}
