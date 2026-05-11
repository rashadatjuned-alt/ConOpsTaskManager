'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function TacticalGridIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1b4332"/>
          <stop offset="100%" stopColor="#52b788"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#tg1)"/>
      <rect x="16" y="16" width="22" height="22" rx="5" fill="white"/>
      <rect x="44" y="16" width="22" height="22" rx="5" fill="rgba(255,255,255,0.45)"/>
      <rect x="72" y="16" width="12" height="22" rx="5" fill="rgba(255,255,255,0.2)"/>
      <rect x="16" y="44" width="22" height="22" rx="5" fill="white"/>
      <rect x="44" y="44" width="22" height="22" rx="5" fill="white"/>
      <rect x="72" y="44" width="12" height="22" rx="5" fill="rgba(255,255,255,0.45)"/>
      <rect x="16" y="72" width="22" height="12" rx="5" fill="rgba(255,255,255,0.45)"/>
      <rect x="44" y="72" width="22" height="12" rx="5" fill="white"/>
      <rect x="72" y="72" width="12" height="12" rx="5" fill="white"/>
      <path d="M20 27l5 5 9-9" stroke="#1b4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M20 55l5 5 9-9" stroke="#1b4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M48 55l5 5 9-9" stroke="#1b4332" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

export default function AuthPage() {
  const router = useRouter()
  const [tab,      setTab]     = useState<'login' | 'register'>('login')
  const [email,    setEmail]   = useState('')
  const [password, setPass]    = useState('')
  const [fullName, setName]    = useState('')
  const [error,    setError]   = useState('')
  const [loading,  setLoading] = useState(false)
  const [showPass, setShowPass]= useState(false)

  const handleLogin = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/dashboard')
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true); setError('')
    if (!fullName.trim()) { setError('Full name is required.'); setLoading(false); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + '/auth' }
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('Users').insert({
        id: data.user.id, email,
        full_name: fullName.trim(),
        role: 'Team Member'
      })
    }
    alert('Account created! Please sign in.')
    setTab('login')
    setLoading(false)
  }

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); setError('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'var(--bg)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-brd)',
        borderRadius: 20,
        padding: '40px 38px 32px',
        boxShadow: 'var(--shd)',
      }}>

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <TacticalGridIcon size={56} />
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)', letterSpacing: '-0.02em', marginTop: 12 }}>
            ConOps Tasker
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>
            Team Task & Project Manager
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg3)',
          borderRadius: 10,
          padding: 3,
          gap: 2,
          marginBottom: 26,
        }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => switchTab(t)} style={{
              flex: 1, padding: '8px 0',
              background: tab === t ? 'var(--card-bg)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--txt)' : 'var(--txt3)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: tab === t ? 'var(--shd)' : 'none',
              transition: 'all 0.15s',
            }}>
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--red2)',
            color: 'var(--red)',
            border: '1px solid rgba(197,34,31,0.2)',
            borderRadius: 8,
            padding: '9px 13px',
            fontSize: 13,
            marginBottom: 18,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Full name */}
        {tab === 'register' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Full Name</label>
            <input
              style={inputStyle}
              placeholder="Jane Smith"
              value={fullName}
              onChange={e => setName(e.target.value)}
            />
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            style={inputStyle}
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              style={{ ...inputStyle, paddingRight: 42 }}
              placeholder="••••••••"
              value={password}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleRegister())}
            />
            <button
              onClick={() => setShowPass(!showPass)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--txt3)',
                fontSize: 16, padding: 0, lineHeight: 1,
              }}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={tab === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px',
            background: 'var(--accent)',
            color: 'var(--accent2)',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: loading ? 0.75 : 1,
            transition: 'all 0.15s',
            letterSpacing: '0.01em',
          }}>
          {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        {/* Switch tab */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--txt3)' }}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
            style={{
              background: 'none', border: 'none',
              color: 'var(--accent)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, padding: 0,
            }}>
            {tab === 'login' ? 'Register' : 'Sign In'}
          </button>
        </div>

      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--txt3)',
  display: 'block',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-brd)',
  borderRadius: 8,
  color: 'var(--txt)',
  fontSize: 13.5,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'all 0.15s',
}
