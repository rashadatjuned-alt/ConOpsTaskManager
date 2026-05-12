'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { LayoutDashboard, CheckSquare, Briefcase, BarChart3, LogOut, Layers, Lock, Sun, Moon } from 'lucide-react'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    // Sync UI with initial state
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      const { data } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...data, email: session.user.email })
      setLoading(false)
    }
    getProfile()
  }, [isDark, router])

  const toggleTheme = () => setIsDark(!isDark)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isActive = (path: string) => pathname === path

  if (loading) return <div style={{ background: 'var(--bg3)', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>Loading Session...</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg3)' }}>
      {/* SIDEBAR - All hardcoded colors replaced with var() */}
      <aside style={{ width: '260px', background: 'var(--bg)', borderRight: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '32px 24px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'var(--nav-active-txt)', borderRadius: '10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:18 }}>C</div>
            <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' }}>ConOps <span style={{ color: 'var(--nav-active-txt)' }}>Tasker</span></div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ padding: '10px 12px', fontSize: '10px', fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>General</div>
          <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}><LayoutDashboard size={18} /> Dashboard</Link>
          <Link href="/my-tasks" className={`nav-link ${isActive('/my-tasks') ? 'active' : ''}`}><CheckSquare size={18} /> My Tasks</Link>
          <Link href="/my-projects" className={`nav-link ${isActive('/my-projects') ? 'active' : ''}`}><Briefcase size={18} /> My Projects</Link>
        </nav>

        {/* FOOTER AREA */}
        <div style={{ padding: '20px', background: 'var(--bg)', borderTop: '1px solid var(--brd)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={toggleTheme} className="util-btn" style={{ background: 'var(--bg2)', border: '1px solid var(--brd2)', color: 'var(--txt2)', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={handleLogout} className="util-btn" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--brd2)', color: 'var(--txt2)', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
              <span>LOG OUT</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={{ marginLeft: '260px', flex: 1, padding: '40px 50px', background: 'var(--bg3)' }}>
        <header style={{ marginBottom: '32px' }}><h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--txt)' }}>{title}</h1></header>
        {children}
      </main>

      <style jsx>{`
        .nav-link { display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: var(--txt2); text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px; transition: 0.2s; margin-bottom: 4px; }
        .nav-link:hover { color: var(--txt); background: var(--bg2); }
        .nav-link.active { color: var(--nav-active-txt); background: var(--nav-active-bg); box-shadow: inset 0 0 0 1px var(--brd2); }
        .util-btn:hover { background: var(--bg3) !important; color: var(--txt) !important; }
      `}</style>
    </div>
  )
}
