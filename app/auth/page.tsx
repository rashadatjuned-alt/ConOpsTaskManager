'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPass] = useState('')
  const [fullName, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      await supabase.from('Users').insert({ id: data.user.id, email, full_name: fullName, role: 'Team Member' })
    }
    alert('Account created! Please sign in.')
    setTab('login')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#141414' }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:700, color:'#e8e6e0' }}>⬛ ConOps Tasker</div>
          <div style={{ fontSize:13, color:'#5a5a55', marginTop:6 }}>Team Task & Project Manager</div>
        </div>
        <div style={{ background:'#1e1e1e', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:24 }}>
          <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:20 }}>
            {(['login','register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex:1, padding:'8px 0', background:'none', border:'none', fontSize:13, cursor:'pointer',
                color: tab===t ? '#e8e6e0' : '#5a5a55', fontWeight: tab===t ? 500 : 400,
                borderBottom: tab===t ? '2px solid #6ab33e' : '2px solid transparent', marginBottom:-1
              }}>{t==='login' ? 'Sign In' : 'Register'}</button>
            ))}
          </div>
          {error && <div style={{ background:'#2a0f0f', color:'#e05555', padding:'9px 12px', borderRadius:6, fontSize:12, marginBottom:12 }}>{error}</div>}
          {tab==='register' && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, fontWeight:600, color:'#5a5a55', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Full Name</label>
              <input style={{ width:'100%', padding:'7px 10px', background:'#111', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e8e6e0', fontSize:13, fontFamily:'Inter,sans-serif', outline:'none' }} placeholder="Jane Smith" value={fullName} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:10, fontWeight:600, color:'#5a5a55', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Email</label>
            <input type="email" style={{ width:'100%', padding:'7px 10px', background:'#111', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e8e6e0', fontSize:13, fontFamily:'Inter,sans-serif', outline:'none' }} placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10, fontWeight:600, color:'#5a5a55', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Password</label>
            <input type="password" style={{ width:'100%', padding:'7px 10px', background:'#111', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e8e6e0', fontSize:13, fontFamily:'Inter,sans-serif', outline:'none' }} placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key==='Enter' && (tab==='login' ? handleLogin() : handleRegister())} />
          </div>
          <button onClick={tab==='login' ? handleLogin : handleRegister} disabled={loading}
            style={{ width:'100%', padding:'8px', background:'#6ab33e', color:'#0f1f08', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            {loading ? 'Please wait...' : tab==='login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
