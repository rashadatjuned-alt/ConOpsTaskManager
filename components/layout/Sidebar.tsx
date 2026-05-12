'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { 
  LogOut, Moon, Sun, LayoutDashboard, Bell, CheckSquare, 
  Briefcase, PlusSquare, Globe, Layers, BarChart3, Users, Settings, PlusCircle 
} from 'lucide-react'

interface SidebarProps {
  user: { email: string; name: string; role: string; initials: string }
  unreadCount?: number
}

export default function Sidebar({ user, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { theme, setTheme } = useTheme()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // THE NAV ITEM: Forced horizontal layout with absolute priority
  const NavItem = ({ href, icon: Icon, label, badge }: { href: string; icon: any; label: string; badge?: number }) => (
    <Link 
      href={href} 
      style={{ 
        display: 'flex !important', 
        flexDirection: 'row !important', 
        alignItems: 'center !important', 
        gap: '12px', 
        padding: '10px 16px',
        textDecoration: 'none',
        borderRadius: '8px',
        marginBottom: '4px',
        background: isActive(href) ? 'var(--nav-active-bg)' : 'transparent',
        color: isActive(href) ? 'var(--nav-active-txt)' : 'var(--txt2)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', flexShrink: 0 }}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <span style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 800 }}>
          {badge}
        </span>
      )}
    </Link>
  )

  return (
    <div style={{ 
      width: '260px', 
      height: '100vh', 
      background: 'var(--bg)', 
      borderRight: '5px solid red', // <--- VISUAL BEACON: If you don't see this, wrong file!
      display: 'flex', 
      flexDirection: 'column', 
      position: 'fixed', 
      left: 0, 
      top: 0,
      zIndex: 9999 
    }}>
      {/* BRANDING */}
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '34px', height: '34px', background: 'var(--nav-active-txt)', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" /><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
        </div>
        <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.5px' }}>
          ConOps <span style={{ color: 'var(--nav-active-txt)' }}>Tasker</span>
        </div>
      </div>

      {/* NAVIGATION */}
      <div style={{ flex: 1, padding: '0 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '10px', color: 'var(--txt3)', padding: '24px 12px 8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Main Menu</div>
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem href="/notifications" icon={Bell} label="Notification" badge={unreadCount} />
        <NavItem href="/my-tasks" icon={CheckSquare} label="My Task" />
        <NavItem href="/my-projects" icon={Briefcase} label="My Project" />

        <div style={{ fontSize: '10px', color: 'var(--txt3)', padding: '32px 12px 8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Management</div>
        <NavItem href="/tasks/create" icon={PlusSquare} label="Create Task" />
        
        {(user.role === 'Manager' || user.role === 'Admin') && (
          <>
            <NavItem href="/all-projects" icon={Globe} label="Global Projects" />
            <NavItem href="/all-tasks" icon={Layers} label="Global Task" />
            <NavItem href="/workload" icon={BarChart3} label="Workload Oversight" />
          </>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--brd)', background: 'var(--bg)' }}>
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'var(--bg2)', border: '1px solid var(--brd2)', borderRadius: '8px', color: 'var(--txt2)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px' }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === 'light' ? 'Dark Appearance' : 'Light Appearance'}</span>
        </button>

        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--nav-active-bg)', color: 'var(--nav-active-txt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
            {user.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontSize: '10px', color: 'var(--txt3)', fontWeight: 800 }}>{user.role}</div>
          </div>
          <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}