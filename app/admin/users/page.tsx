'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { notifyUserJoined, notifyPasswordResetSent } from '@/lib/notifications'

const ROLES = ['Admin', 'Manager', 'Team Member'] as const

export default function AdminUsers() {
  const [users,      setUsers]      = useState<any[]>([])
  const [myId,       setMyId]       = useState('')
  const [myRole,     setMyRole]     = useState('')
  const [saving,     setSaving]     = useState<string|null>(null)
  const [resetting,  setResetting]  = useState<string|null>(null)
  const [msg,        setMsg]        = useState('')
  const [msgType,    setMsgType]    = useState<'ok'|'err'>('ok')
  const [showModal,  setShowModal]  = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail,setInviteEmail]= useState('')
  const [inviteRole, setInviteRole] = useState<'Team Member'|'Manager'|'Admin'>('Team Member')
  const [inviting,   setInviting]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setMyId(session?.user.id || '')
      const { data: u } = await supabase.from('Users').select('role').eq('id', session?.user.id).single()
      setMyRole(u?.role || '')
      const { data } = await supabase.from('Users').select('*').order('full_name')
      setUsers(data || [])
    }
    load()
  }, [])

  const showMsg = (text: string, type: 'ok'|'err' = 'ok') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  const updateRole = async (id: string, role: string) => {
    setSaving(id)
    await supabase.from('Users').update({ role }).eq('id', id)
    setUsers(prev => prev.map((u: any) => u.id === id ? { ...u, role } : u))
    setSaving(null)
    showMsg(`Role updated to ${role}.`)
  }

  const deleteUser = async (user: any) => {
    if (user.id === myId) { showMsg("You can't delete yourself.", 'err'); return }
    if (!confirm(`Remove "${user.full_name || user.email}" permanently?`)) return
    await supabase.from('Users').delete().eq('id', user.id)
    setUsers(prev => prev.filter((u: any) => u.id !== user.id))
    showMsg(`"${user.full_name || user.email}" removed.`)
  }

  const sendPasswordReset = async (user: any) => {
    setResetting(user.id)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    })
    if (error) {
      showMsg(`Error: ${error.message}`, 'err')
    } else {
      // Send in-app notification to the user
      await notifyPasswordResetSent(user.id, user.full_name || user.email)
      showMsg(`✅ Password reset sent to ${user.email}`)
    }
    setResetting(null)
  }

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return
    setInviting(true)
    try {
      // Use server-side API route with service role key to send real invite email
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          full_name: inviteName.trim(),
          role: inviteRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Invite failed')

      // Notify managers that new user joined
      await notifyUserJoined(inviteName.trim(), inviteEmail.trim())

      showMsg(`✅ Invite sent to ${inviteEmail}! They will receive an email to set their password.`)
      const { data } = await supabase.from('Users').select('*').order('full_name')
      setUsers(data || [])
      setInviteName(''); setInviteEmail(''); setShowModal(false)
    } catch (e: any) {
      showMsg(e.message, 'err')
    }
    setInviting(false)
  }

  const getRoleBadge = (role: string) => {
    const styles: Record<string, React.CSSProperties> = {
      Admin:        { background: 'var(--accent2)', color: 'var(--accent)' },
      Manager:      { background: 'var(--blue2)', color: 'var(--blue)' },
      'Team Member':{ background: 'var(--bg3)', color: 'var(--txt3)' },
    }
    return (
      <span style={{ ...styles[role], fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
        {role}
      </span>
    )
  }

  if (myRole && myRole !== 'Admin') return (
    <AppShell title="User Management">
      <div style={{ color: 'var(--red)', padding: 20, fontSize: 13 }}>Admin only.</div>
    </AppShell>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: 'var(--bg3)',
    border: '1px solid var(--brd2)', borderRadius: 6, color: 'var(--txt)',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <AppShell title="User Management">
      {msg && (
        <div style={{
          background: msgType === 'ok' ? 'var(--accent2)' : 'var(--red2)',
          color: msgType === 'ok' ? 'var(--accent)' : 'var(--red)',
          border: `1px solid ${msgType === 'ok' ? 'rgba(106,179,62,0.3)' : 'rgba(224,85,85,0.3)'}`,
          borderRadius: 6, padding: '9px 14px', fontSize: 12, marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Users', value: users.length, color: 'var(--blue)' },
          { label: 'Managers', value: users.filter((u: any) => u.role === 'Manager').length, color: 'var(--amber)' },
          { label: 'Team Members', value: users.filter((u: any) => u.role === 'Team Member').length, color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</div>
        <button onClick={() => setShowModal(true)}
          style={{ background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Invite User
        </button>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 10, overflow: 'hidden' }}>
        {users.map((user: any, i: number) => (
          <div key={user.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            borderBottom: i < users.length - 1 ? '1px solid var(--brd)' : 'none',
          }}>
            {/* Avatar */}
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent2)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {(user.full_name || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>

            {/* Name + email */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {user.full_name || 'Unnamed'}
                {user.id === myId && <span style={{ fontSize: 10, color: 'var(--txt3)' }}>(you)</span>}
                {getRoleBadge(user.role)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{user.email}</div>
            </div>

            {/* Role selector */}
            <select
              value={user.role}
              disabled={user.id === myId || saving === user.id}
              onChange={e => updateRole(user.id, e.target.value)}
              style={{ padding: '5px 9px', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: 6, color: 'var(--txt2)', fontSize: 12, fontFamily: 'inherit', cursor: user.id === myId ? 'not-allowed' : 'pointer', width: 140 }}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>

            {/* Password reset */}
            <button
              onClick={() => sendPasswordReset(user)}
              disabled={resetting === user.id}
              title="Send password reset email"
              style={{ background: 'var(--blue2)', color: 'var(--blue)', border: '1px solid rgba(77,142,240,0.2)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              {resetting === user.id ? '...' : '🔑 Reset'}
            </button>

            {/* Delete */}
            {user.id !== myId && (
              <button onClick={() => deleteUser(user)}
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd2)', borderRadius: 12, width: 440, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)', marginBottom: 20 }}>Invite New User</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Full Name</label>
              <input style={inputStyle} value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="John Doe" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Email</label>
              <input type="email" style={inputStyle} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Role</label>
              <select style={inputStyle} value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                <option value="Team Member">Team Member</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 11, color: 'var(--txt3)' }}>
              💡 A password setup email will be sent automatically. Managers will be notified of the new user.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowModal(false); setInviteName(''); setInviteEmail('') }}
                style={{ flex: 1, padding: '8px', background: 'var(--bg3)', border: '1px solid var(--brd2)', color: 'var(--txt2)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={inviteUser} disabled={inviting || !inviteEmail || !inviteName}
                style={{ flex: 1, padding: '8px', background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
