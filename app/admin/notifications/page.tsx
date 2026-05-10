'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'

export default function AdminNotifications() {
  const [users, setUsers] = useState<any[]>([])
  const [notifs, setNotifs] = useState<any[]>([])
  const [myRole, setMyRole] = useState('')
  const [msg, setMsg] = useState('')
  const [target, setTarget] = useState('all')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: u } = await supabase.from('Users').select('role').eq('id', session?.user.id).single()
      setMyRole(u?.role || '')
      const [{ data: us }, { data: ns }] = await Promise.all([
        supabase.from('Users').select('*').order('full_name'),
        supabase.from('Notifications').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      setUsers(us || [])
      setNotifs(ns || [])
    }
    load()
  }, [])

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    const targets = target === 'all' ? users : users.filter((u: any) => u.id === target)
    for (const u of targets) {
      await supabase.from('Notifications').insert({ user_id: u.id, message: message.trim(), is_read: false })
    }
    setMsg(`Sent to ${targets.length} user${targets.length !== 1 ? 's' : ''}!`)
    setMessage('')
    const { data } = await supabase.from('Notifications').select('*').order('created_at', { ascending: false }).limit(50)
    setNotifs(data || [])
    setSending(false)
    setTimeout(() => setMsg(''), 3000)
  }

  if (myRole && myRole !== 'Admin') return <AppShell title="Notifications Mgmt"><div style={{ color: '#e05555', padding: 20 }}>Admin only.</div></AppShell>

  return (
    <AppShell title="Notifications Management">
      {msg && <div style={{ background: '#052e16', color: '#4ade80', padding: '9px 14px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{msg}</div>}
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#5a5a55', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Send Notification</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#5a5a55', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Send To</label>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ width: '100%', padding: '7px 10px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e8e6e0', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
            <option value="all">All Users ({users.length})</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#5a5a55', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your notification..." style={{ width: '100%', padding: '7px 10px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e8e6e0', fontSize: 13, fontFamily: 'inherit', outline: 'none', minHeight: 80, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={send} disabled={sending || !message.trim()} style={{ background: '#6ab33e', color: '#0f1f08', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{sending ? 'Sending...' : 'Send'}</button>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e6e0', marginBottom: 10 }}>Recent ({notifs.length})</div>
      <div style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        {notifs.length === 0 && <div style={{ padding: 16, fontSize: 13, color: '#5a5a55' }}>No notifications yet.</div>}
        {notifs.map((n: any, i: number) => {
          const user = users.find((u: any) => u.id === n.user_id)
          return (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: i < notifs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? '#252525' : '#4d8ef0', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#5a5a55', marginBottom: 2 }}>{user?.full_name || user?.email || 'Unknown'} · {n.created_at?.slice(0, 10)}</div>
                <div style={{ fontSize: 13, color: '#e8e6e0' }}>{n.message}</div>
              </div>
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
