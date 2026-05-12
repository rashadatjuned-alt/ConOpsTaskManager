'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { LayoutDashboard, CheckSquare, Briefcase, PlusSquare, Sun, Moon, LogOut, Lock } from 'lucide-react'

export default function AppShell({ children, title }: { children: React.ReactNode, title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    const saved = (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/auth')
      const { data } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe(data)
    }
    checkUser()
  }, [router])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('app-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">The Node</div>
        <nav style={{ flex: 1 }}>
          <Link href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}><LayoutDashboard size={18}/> Dashboard</Link>
          <Link href="/my-tasks" className={`nav-item ${pathname === '/my-tasks' ? 'active' : ''}`}><CheckSquare size={18}/> My Tasks</Link>
          <Link href="/my-projects" className={`nav-item ${pathname === '/my-projects' ? 'active' : ''}`}><Briefcase size={18}/> My Projects</Link>
          <Link href="/tasks/create" className="nav-item"><PlusSquare size={18}/> Create Task</Link>
        </nav>
        <div className="sidebar-footer">
          <button onClick={toggleTheme} className="btn btn-icon">{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth') }} className="btn btn-danger btn-sm"><LogOut size={14}/> Sign Out</button>
        </div>
      </aside>
      <main className="main"><div className="content"><h1>{title}</h1>{children}</div></main>
    </div>
  )
}
