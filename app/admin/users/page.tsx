'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { notifyUserJoined } from '@/lib/notifications'

const ROLES = ['Admin', 'Manager', 'Team Member'] as const

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function AdminUsers() {
  const [users,     setUsers]     = useState<any[]>([])
  const [myId,      setMyId]      = useState('')
  const [myRole,    setMyRole]    = useState('')
  const [saving,    setSaving]    = useState<string|null>(null)
  const [msg,       setMsg]       = useState('')
  const [msgType,   setMsgType]   = useState<'ok'|'err'>('ok')
  const [showModal, setShowModal] = useState(false)

  // Invite form
  const [inviteName,  setInviteName]  = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState<'Team Member'|'Manager'|'Admin'>('Team Member')
  const [inviting,    setInviting]    = useState(false)

  // Generated credentials modal
  const [credsModal,  setCredsModal]  = useState(false)
  const [credsData,   setCredsData]   = useState<{ name: string; email: string; password: string } | null>(null)
  const [copied,      setCopied]      = useState(false)

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

  const showMsg = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 5000)
  }

  const updateRole = async (id: string, role: string) => {
    setSaving(id)
    await supabase.from('Users').update({ role }).eq('id', id)
    setUsers(prev => prev.map((u: any) => u.id === id ? { ...u, role } : u))
    setSaving(null)
  }

  const deleteUser = async (user: any) => {
    if (user.id === myId) { showMsg("You can't delete yourself.", 'err'); return }
    if (!confirm(`Remove "${user.full_name || user.email}" permanently?`)) return
    await supabase.from('Users').delete().eq('id', user.id)
    setUsers(prev => prev.filter((u: any) => u.id !== user.id))
    showMsg(`"${user.full_name || user.email}" removed.`)
  }

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return
    setInviting(true)
    try {
      const password = generatePassword()

      // Sign up the user via Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: inviteEmail.trim().toLowerCase(),
        password,
      })

      if (authErr) throw authErr

      const userId = authData?.user?.id || crypto.randomUUID()

      // Insert into Users table
      await supabase.from('Users').upsert({
        id: userId,
        full_name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      }, { onConflict: 'id' })

      // Notify managers
      await notifyUserJoined(inviteName.trim(), inviteEmail.trim())

      // Refresh users list
      const { data } = await supabase.from('Users').select('*').order('full_name')
      setUsers(data || [])

      // Show credentials to admin
      setCredsData({ name: inviteName.trim(), email: inviteEmail.trim(), password })
      setShowModal(false)
      setCredsModal(true)
      setInviteName(''); setInviteEmail('')
    } catch (e: any) {
      showMsg(e.message, 'err')
    }
    setInviting(false)
  }

  const copyCredentials = () => {
    if (!credsData) return
    navigator.clipboard.writeText(
      `ConOps Tasker Login\nEmail: ${credsData.email}\nPassword: ${credsData.password}\n\nPlease change your password after first login.`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getRoleBadge = (role: string) => {
    const map: Record<string, React.CSSProperties> = {
      Admin:         { background: 'var(--accent2)', color: 'var(--accent)' },
      Manager:       { background: 'var(--blue2)',   color: 'var(--blue)'   },
      'Team Member': { background: 'var(--bg3)',     color: 'var(--txt3)'   },
    }
    return <span style={{ ...map[role], fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{role}</span>
  }

  if (myRole && myRole !== 'Admin') return (
    <AppShell title="User Management">
      <div style={{ color: 'var(--red)', padding: 20 }}>Admin only.</div>
    </AppShell>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px',
    background: 'var(--input-bg)', border: '1px solid var(--input-brd)',
    borderRadius: 6, color: 'var(--txt)', fontSize: 13,
    fontFamily: 'inherit', outline: 'none',
  }

  return (
    <AppShell title="User Management">

      {/* Alert */}
      {msg && (
        <div style={{
          background: msgType === 'ok' ? 'var(--accent2)' : 'var(--red2)',
          color: msgType === 'ok' ? 'var(--accent)' : 'var(--red)',
          border: `1px solid ${msgType === 'ok' ? 'rgba(46,125,50,0.25)' : 'rgba(197,34,31,0.25)'}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Users',   value: users.length,                                             color: 'var(--blue)'   },
          { label: 'Managers',      value: users.filter((u: any) => u.role === 'Manager').length,    color: 'var(--amber)'  },
          { label: 'Team Members',  value: users.filter((u: any) => u.role === 'Team Member').length, color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</div>
        <button onClick={() => setShowModal(true)}
          style={{ background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add User
        </button>
      </div>

      {/* Users list */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 12, overflow: 'hidden' }}>
        {users.map((user: any, i: number) => (
          <div key={user.id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            borderBottom: i < users.length - 1 ? '1px solid var(--brd)' : 'none',
          }}>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--accent2)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>
              {(user.full_name || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>

            {/* Name + email */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {user.full_name || 'Unnamed'}
                {user.id === myId && <span style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 400 }}>(you)</span>}
                {getRoleBadge(user.role)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{user.email}</div>
            </div>

            {/* Role selector */}
            <select
              value={user.role}
              disabled={user.id === myId || saving === user.id}
              onChange={e => updateRole(user.id, e.target.value)}
              style={{
                padding: '5px 9px', background: 'var(--input-bg)',
                border: '1px solid var(--input-brd)', borderRadius: 6,
                color: 'var(--txt)', fontSize: 12, fontFamily: 'inherit',
                cursor: user.id === myId ? 'not-allowed' : 'pointer', width: 140,
              }}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>

            {/* Delete */}
            {user.id !== myId && (
              <button onClick={() => deleteUser(user)} title="Remove user"
                style={{ background: 'var(--red2)', border: '1px solid rgba(197,34,31,0.2)', color: 'var(--red)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 13 }}>
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Add User Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 14, width: 440, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>Add New User</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 22 }}>
              A username and password will be generated. Share credentials with the user directly.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Full Name</label>
              <input style={inputStyle} value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="John Doe" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Email</label>
              <input type="email" style={inputStyle} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Role</label>
              <select style={inputStyle} value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                <option value="Team Member">Team Member</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowModal(false); setInviteName(''); setInviteEmail('') }}
                style={{ flex: 1, padding: '9px', background: 'var(--bg3)', border: '1px solid var(--brd2)', color: 'var(--txt2)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={inviteUser} disabled={inviting || !inviteEmail || !inviteName}
                style={{ flex: 1, padding: '9px', background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: (!inviteEmail || !inviteName) ? 0.5 : 1 }}>
                {inviting ? 'Creating...' : 'Create & Get Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {credsModal && credsData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 14, width: 460, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔑</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>User Created!</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>
                Share these credentials with <strong style={{ color: 'var(--txt)' }}>{credsData.name}</strong>
              </div>
            </div>

            {/* Credentials box */}
            <div style={{
              background: 'var(--bg3)', border: '1px solid var(--brd2)',
              borderRadius: 10, padding: '16px 18px', marginBottom: 20,
              fontFamily: 'monospace',
            }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 14, color: 'var(--txt)', fontWeight: 500 }}>{credsData.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Password</div>
                <div style={{ fontSize: 20, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.1em' }}>{credsData.password}</div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--txt3)', background: 'var(--amber2)', border: '1px solid rgba(180,83,9,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 20, lineHeight: 1.6 }}>
              ⚠️ This password will not be shown again. Copy it now and share it with the user securely. Ask them to change it after first login.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={copyCredentials}
                style={{ flex: 1, padding: '9px', background: copied ? 'var(--accent2)' : 'var(--blue2)', color: copied ? 'var(--accent)' : 'var(--blue)', border: `1px solid ${copied ? 'rgba(46,125,50,0.3)' : 'rgba(26,115,232,0.3)'}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
                {copied ? '✅ Copied!' : '📋 Copy Credentials'}
              </button>
              <button onClick={() => { setCredsModal(false); setCredsData(null) }}
                style={{ flex: 1, padding: '9px', background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
