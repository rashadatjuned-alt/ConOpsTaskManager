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
  User, 
  Layers 
} from 'lucide-react'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
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
    router.push('/login')
  }

  const isManagerial = me?.role === 'Manager' || me?.role === 'Admin'

  // Helper for active link styling
  const isActive = (path: string) => pathname === path

  if (loading) return <div style={{ background: 'var(--bg)', height: '100vh' }} />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      
      {/* ─── SIDEBAR ─── */}
      <aside style={{ 
        width: '260px', 
        background: 'var(--bg)', 
        borderRight: '1px solid var(--brd)', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 100
      }}>
        <div style={{ padding: '24px 20px', fontSize: '18px', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
          ConOps Tasker
        </div>

        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          
          {/* SECTION: GENERAL */}
          <div style={{ padding: '20px 12px 8px', fontSize: '10px', fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            General
          </div>
          <Link href="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/my-tasks" className={`nav-link ${isActive('/my-tasks') ? 'active' : ''}`}>
            <CheckSquare size={18} /> My Tasks
          </Link>
          <Link href="/my-projects" className={`nav-link ${isActive('/my-projects') ? 'active' : ''}`}>
            <Briefcase size={18} /> My Projects
          </Link>

          {/* SECTION: MANAGEMENT (Role Protected) */}
          {isManagerial && (
            <>
              <div style={{ padding: '24px 12px 8px', fontSize: '10px', fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Management
              </div>
              <Link href="/all-projects" className={`nav-link ${isActive('/all-projects') ? 'active' : ''}`}>
                <Layers size={18} /> All Projects
              </Link>
              <Link href="/all-tasks" className={`nav-link ${isActive('/all-tasks') ? 'active' : ''}`}>
                <CheckSquare size={18} /> All Tasks Oversight
              </Link>
              <Link href="/workload" className={`nav-link ${isActive('/workload') ? 'active' : ''}`}>
                <BarChart3 size={18} /> Workload Dashboard
              </Link>
            </>
          )}
        </nav>

        {/* USER FOOTER */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--brd)', background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              {me?.full_name?.slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{me?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <main style={{ marginLeft: '260px', flex: 1, padding: '32px 40px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px', color: 'var(--txt)' }}>{title}</h1>
        {children}
      </main>

      <style jsx>{`
        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          color: var(--txt2);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          border-radius: 8px;
          transition: 0.2s;
        }
        .nav-link:hover {
          background: var(--bg2);
          color: var(--txt);
        }
        .nav-link.active {
          background: rgba(55, 138, 221, 0.1);
          color: var(--accent);
          font-weight: 700;
        }
        .btn-logout {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: transparent;
          border: 1px solid var(--brd);
          color: var(--txt3);
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-logout:hover {
          border-color: #ef4444;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
        }
      `}</style>
    </div>
  )
}
