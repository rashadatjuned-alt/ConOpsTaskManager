'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sun, Moon } from 'lucide-react' 

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab]         = useState<'login'|'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [fullName, setName]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // Load saved theme on initial mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme)
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
      setTheme(prefersLight ? 'light' : 'dark')
    }
  }, [])

  // Apply theme to the document and save to local storage whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleLogin = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/dashboard')
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('Users').insert({
        id: data.user.id, email, full_name: fullName, role: 'Team Member'
      })

      // Notify all Admins and Managers that a new user joined
      const { data: admins } = await supabase
        .from('Users')
        .select('id')
        .in('role', ['Admin', 'Manager'])

      if (admins && admins.length > 0) {
        const notifications = admins.map(a => ({
          user_id: a.id,
          message: `New user joined: ${fullName || email} (${email}) — assign them to a project.`,
          is_read: false,
        }))
        await supabase.from('Notifications').insert(notifications)
      }
    }
    setError('')
    alert('Account created! Please sign in.')
    setTab('login')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg3)', transition: 'background 0.3s ease'
    }}>
      
      {/* Theme Toggle Button */}
      <button 
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        style={{
          position: 'absolute', top: 24, right: 24, background: 'var(--bg2)', 
          border: '1px solid var(--brd)', borderRadius: '50%', width: 40, height: 40, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: 'pointer', color: 'var(--txt)', transition: 'all 0.2s ease'
        }}
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div style={{ width: 380 }}>
        
        {/* --- BRANDING / LOGO SECTION --- */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            
            {/* The Node SVG Logo exactly matching the AppShell sidebar */}
            <div style={{ 
              width: 34, 
              height: 34, 
              background: 'var(--nav-active-txt)', // Fixed: Matching AppShell color
              color: 'white',                      // Fixed: Matching AppShell icon color
              borderRadius: 10, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: 6 
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
                <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" />
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <path d="M12 10V2M12 14V22M18.5 8.5L20.5 7M5.5 15.5L3.5 17M18.5 15.5L20.5 17M5.5 8.5L3.5 7" />
              </svg>
            </div>
            
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--txt)' }}>
              ConOps <span style={{ color: 'var(--nav-active-txt)' }}>Tasker</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 8, fontWeight: 500 }}>
            Team Task & Project Manager
          </div>
        </div>
        {/* --- END BRANDING SECTION --- */}

        <div className="card" style={{ padding: 24, background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, transition: 'all 0.3s ease' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--brd)', marginBottom: 20 }}>
            {(['login','register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                color: tab === t ? 'var(--txt)' : 'var(--txt3)',
                fontWeight: tab === t ? 600 : 500,
                borderBottom: tab === t ? '2px solid var(--txt)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.2s ease'
              }}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#ef444420', color: '#ef4444', fontSize: 13, fontWeight: 500 }}>{error}</div>}

          {tab === 'register' && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>Full Name</label>
              <input className="form-input" placeholder="Jane Smith" value={fullName} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', outline: 'none' }} />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>Email</label>
            <input className="form-input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', outline: 'none' }} />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleRegister())} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', outline: 'none' }} />
          </div>
          <button
            className="btn btn-primary" style={{ width: '100%', padding: '12px', borderRadius: 8, background: 'var(--txt)', color: 'var(--bg)', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }}
            onClick={tab === 'login' ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}