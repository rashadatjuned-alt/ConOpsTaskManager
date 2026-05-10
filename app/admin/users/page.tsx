'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'

const ROLES = ['Admin', 'Manager', 'Team Member'] as const

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([])
  const [myId, setMyId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [saving, setSaving] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'Team Member'|'Manager'|'Admin'>('Team Member')
  const [inviting, setInviting] = useState(false)

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

  const updateRole = async (id: string, role: string) => {
    setSaving(id)
    await supabase.from('Users').update({ role }).eq('id', id)
    setUsers(prev => prev.map((u: any) => u.id === id ? { ...u, role } : u))
    setSaving(null)
  }

  const deleteUser = async (user: any) => {
    if (user.id === myId) { setMsg("You can't delete yourself."); return }
    if (!confirm(`Remove "${user.full_name || user.email}"?`)) return
    await supabase.from('Users').delete().eq('id', user.id)
    setUsers(prev => prev.filter((u: any) => u.id !== user.id))
    setMsg(`"${user.full_name || user.email}" removed.`)
  }

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return
    setInviting(true)
    const newId = crypto.randomUUID()
    await supabase.from('Users').insert({ id: newId, full_name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole })
    await supabase.auth.resetPasswordForEmail(inviteEmail.trim(), { redirectTo: `${window.location.origin}/auth` })
    setMsg(`✅ ${inviteName} invited.`)
    const { data } = await supabase.from('Users').select('*').order('full_name')
    setUsers(data || [])
    setInviteEmail(''); setInviteName(''); setShowModal(false); setInviting(false)
  }

  if (myRole && myRole !== 'Admin') return <AppShell title="User Management"><div style={{ color: '#e05555', padding: 20 }}>Admin only.</div></AppShell>

  const inputStyle = { width: '100%', padding: '7px 10px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e8e6e0', fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none' }

  return (
    <AppShell title="User Management">
      {msg && <div style={{ background: '#052e16', color: '#4ade80', padding: '9px 14px', borderRadius: 6, fontSize: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>{msg}<button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer' }}>×</button></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowModal(true)} style={{ background: '#6ab33e', color: '#0f1f08', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Invite User</button>
      </div>
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        {users.map((user: any, i: number) => (
          <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a2e10', color: '#6ab33e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
              {(user.full_name || '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e6e0' }}>{user.full_name || 'Unnamed'}{user.id === myId && <span style={{ fontSize: 11, color: '#5a5a55', marginLeft: 6 }}>(you)</span>}</div>
              <div style={{ fontSize: 12, color: '#5a5a55' }}>{user.email}</div>
            </div>
            <select value={user.role} disabled={user.id === myId || saving === user.id}
              onChange={e => updateRole(user.id, e.target.value)}
              style={{ padding: '4px 8px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#9ca3af', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', width: 140 }}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            {user.id !== myId && (
              <button onClick={() => deleteUser(user)} style={{ background: 'none', border: 'none', color: '#e05555', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>🗑</button>
            )}
          </div>
        ))}
      </div>
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 420, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e6e0', marginBottom: 20 }}>Invite New User</div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 10, fontWeight: 600, color: '#5a5a55', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Full Name</label><input style={inputStyle} value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="John Doe" /></div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 10, fontWeight: 600, color: '#5a5a55', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Email</label><input type="email" style={inputStyle} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@company.com" /></div>
            <div style={{ marginBottom: 20 }}><label style={{ fontSize: 10, fontWeight: 600, color: '#5a5a55', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Role</label><select style={inputStyle} value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}><option value="Team Member">Team Member</option><option value="Manager">Manager</option><option value="Admin">Admin</option></select></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a09a', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={inviteUser} disabled={inviting} style={{ flex: 1, padding: '8px', background: '#6ab33e', color: '#0f1f08', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{inviting ? 'Sending...' : 'Send Invitation'}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
