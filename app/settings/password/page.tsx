'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/layout/AppShell'

export default function PasswordReset() {
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pass })
    setLoading(false)
    setMsg(error ? 'Error: ' + error.message : 'Password updated successfully!')
  }

  return (
    <AppShell title="Security Settings">
      <div style={{ maxWidth: 400, background: 'var(--bg)', padding: 32, borderRadius: 12, border: '1px solid var(--brd)' }}>
        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' }}>New Password</label>
            <input type="password" required className="avatar-mini" style={{ width: '100%', height: 40, padding: 12, marginTop: 8 }} value={pass} onChange={e => setPass(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn-create-pop" style={{ justifyContent: 'center' }}>{loading ? 'Updating...' : 'Update Password'}</button>
        </form>
        {msg && <div style={{ marginTop: 16, fontSize: 13, color: msg.includes('Error') ? 'red' : 'green' }}>{msg}</div>}
      </div>
    </AppShell>
  )
}
