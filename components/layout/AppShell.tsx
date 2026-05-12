'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  LayoutDashboard, CheckSquare, Briefcase, BarChart3, 
  LogOut, Layers, Lock, Sun, Moon 
} from 'lucide-react'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // 1. Sync theme with LocalStorage and HTML attribute on mount
    const savedTheme = (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)

    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      const { data } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...data, email: session.user.email })
      setLoading(false)
    }
    getProfile()
  }, [router])

  // 2. Toggle logic that actually updates the CSS variables
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

  const isManagerial = me?.role === 'Manager' || me?.role === 'Admin'
  const isActive = (path: string) => pathname === path

  if (loading) return <div style={{ background: 'var(--bg3)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>Loading Secure Session...</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg3)' }}>
      
      {/* Sidebar - Shapes preserved, Colors mapped to variables */}
      <aside style={{ width: '260px', background: 'var(--bg)', borderRight: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '32px 24px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #378ADD, #1B5299)', borderRadius: '10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:18 }}>C</div>
            <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' }}>ConOps <span style={{ color: '#378ADD' }}>Tasker</span></div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="nav-label" style={{ padding: '10px 12px', fontSize: '10px', fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>General</div>
          <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}><LayoutDashboard size={18} /> Dashboard</Link>
          <Link href="/my-tasks" className={`nav-link ${isActive('/my-tasks') ? 'active' : ''}`}><CheckSquare size={18} /> My Tasks</Link>
          <Link href="/my-projects" className={`nav-link ${isActive('/my-projects') ? 'active' : ''}`}><Briefcase size={18} /> My Projects</Link>

          {isManagerial && (
            <>
              <div className="nav-label" style={{ padding: '10px 12px', fontSize: '10px', fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '28px' }}>Oversight</div>
              <Link href="/all-projects" className={`nav-link ${isActive('/all-projects') ? 'active' : ''}`}><Layers size={18} /> All Projects</Link>
              <Link href="/all-tasks" className={`nav-link ${isActive('/all-tasks') ? 'active' : ''}`}><CheckSquare size={18} /> Global Tasks</Link>
              <Link href="/workload" className={`nav-link ${isActive('/workload') ? 'active' : ''}`}><BarChart3 size={18} /> Workload Oversight</Link>
            </>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '20px', background: 'var(--bg3)', borderTop: '1px solid var(--brd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '0 4px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--bg2)', border: '1px solid var(--brd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#378ADD', fontWeight: 800 }}>{me?.full_name?.slice(0,2).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me?.full_name}</div>
              <div style={{ fontSize: 10, color: 'var(--txt2)', fontWeight: 800, textTransform: 'uppercase' }}>{me?.role}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {/* Theme Toggle Button */}
            <button onClick={toggleTheme} className="util-btn" style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', color: 'var(--txt2)', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => router.push('/settings/password')} className="util-btn" style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', color: 'var(--txt2)', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}><Lock size={16} /></button>
            <button onClick={handleLogout} className="util-btn logout-hover" style={{ flex: 1, gap: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--brd)', color: 'var(--txt2)', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
              <LogOut size={16} /> <span>SIGN OUT</span>
            </button>
          </div>
        </div>
      </aside>

      <main style={{ marginLeft: '260px', flex: 1, padding: '40px 50px', background: 'var(--bg3)' }}>
        <header style={{ marginBottom: '32px' }}><h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--txt)' }}>{title}</h1></header>
        {children}
      </main>

      <style jsx>{`
        .nav-link { display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: var(--txt2); text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px; transition: 0.2s; margin-bottom: 4px; }
        .nav-link:hover { color: var(--txt); background: var(--bg2); }
        
        /* Fixed: Using the Nav Active variables from your CSS */
        .nav-link.active { 
           color: var(--nav-active-txt); 
           background: var(--nav-active-bg); 
           box-shadow: inset 0 0 0 1px var(--brd2); 
        }
        
        .util-btn:hover { background: var(--bg) !important; color: var(--txt) !important; border-color: var(--txt3) !important; }
        .logout-hover:hover { color: #ef4444 !important; background: rgba(239, 68, 68, 0.05) !important; border-color: rgba(239, 68, 68, 0.2) !important; }
      `}</style>
    </div>
  )
}
