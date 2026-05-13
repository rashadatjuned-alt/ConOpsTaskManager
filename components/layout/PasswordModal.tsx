'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Lock } from 'lucide-react'

export default function PasswordModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pass })
    setLoading(false)
    if (error) setMsg({ text: 'Error: ' + error.message, type: 'error' })
    else {
      setMsg({ text: 'Password updated!', type: 'success' })
      setTimeout(onClose, 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 400, background: 'var(--bg)', borderRadius: 16, border: '1px solid var(--brd)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Lock size={18}/><span style={{ fontWeight: 800 }}>SECURITY</span></div>
          <X size={20} cursor="pointer" onClick={onClose} />
        </div>
        <form onSubmit={handleReset} style={{ padding: 24 }}>
          <input type="password" placeholder="New Password" required style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--brd)', color: 'var(--txt)', marginBottom: 16 }} value={pass} onChange={e => setPass(e.target.value)} />
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>{loading ? 'Updating...' : 'Update Password'}</button>
          {msg.text && <div style={{ marginTop: 12, color: msg.type === 'error' ? 'red' : 'green', fontSize: 12 }}>{msg.text}</div>}
        </form>
      </div>
    </div>
  )
}