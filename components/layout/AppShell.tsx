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
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      // FIXED: Redirecting to /auth because /login doesn't exist in your build logs
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth') // FIXED here too
  }

  const isManagerial = me?.role === 'Manager' || me?.role === 'Admin'
  const isActive = (path: string) => pathname === path

  if (loading) return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Loading Secure Session...</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Redesigned Sidebar */}
      <aside style={{ width: '260px', background: '#090909', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '32px 24px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #378ADD, #1B5299)', borderRadius: '10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:18 }}>C</div>
            <div style={{ fontSize: '19px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>ConOps <span style={{ color: '#378ADD' }}>Tasker</span></div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="nav-label" style={{ padding: '10px 12px', fontSize: '10px', fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '1.5px' }}>General</div>
          <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}><LayoutDashboard size={18} /> Dashboard</Link>
          <Link href="/my-tasks" className={`nav-link ${isActive('/my-tasks') ? 'active' : ''}`}><CheckSquare size={18} /> My Tasks</Link>
          <Link href="/my-projects" className={`nav-link ${isActive('/my-projects') ? 'active' : ''}`}><Briefcase size={18} /> My Projects</Link>

          {isManagerial && (
            <>
              <div className="nav-label" style={{ padding: '10px 12px', fontSize: '10px', fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '28px' }}>Oversight</div>
              <Link href="/all-projects" className={`nav-link ${isActive('/all-projects') ? 'active' : ''}`}><Layers size={18} /> All Projects</Link>
              <Link href="/all-tasks" className={`nav-link ${isActive('/all-tasks') ? 'active' : ''}`}><CheckSquare size={18} /> Global Tasks</Link>
              <Link href="/workload" className={`nav-link ${isActive('/workload') ? 'active' : ''}`}><BarChart3 size={18} /> Workload Oversight</Link>
            </>
          )}
        </nav>

        <div style={{ padding: '20px', background: '#050505', borderTop: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '0 4px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: '#111', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#378ADD', fontWeight: 800 }}>{me?.full_name?.slice(0,2).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me?.full_name}</div>
              <div style={{ fontSize: 10, color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>{me?.role}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIsDark(!isDark)} className="util-btn" style={{ background: '#111', border: '1px solid #222', color: '#555', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button onClick={() => router.push('/settings/password')} className="util-btn" style={{ background: '#111', border: '1px solid #222', color: '#555', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}><Lock size={16} /></button>
            <button onClick={handleLogout} className="util-btn logout-hover" style={{ flex: 1, gap: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#111', border: '1px solid #222', color: '#555', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
              <LogOut size={16} /> <span>SIGN OUT</span>
            </button>
          </div>
        </div>
      </aside>

      <main style={{ marginLeft: '260px', flex: 1, padding: '40px 50px', background: 'var(--bg)' }}>
        <header style={{ marginBottom: '32px' }}><h1 style={{ fontSize: '26px', fontWeight: 800, color: '#fff' }}>{title}</h1></header>
        {children}
      </main>

      <style jsx>{`
        .nav-link { display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: #777; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px; transition: 0.2s; margin-bottom: 4px; }
        .nav-link:hover { color: #fff; background: #111; }
        .nav-link.active { color: #fff; background: #161616; box-shadow: inset 0 0 0 1px #222; }
        .util-btn:hover { background: #1a1a1a !important; color: #fff !important; border-color: #444 !important; }
        .logout-hover:hover { color: #ef4444 !important; background: rgba(239, 68, 68, 0.05) !important; border-color: rgba(239, 68, 68, 0.2) !important; }
      `}</style>
    </div>
  )
}
