'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'

export default function Notifications() {
  const [notifs, setNotifs] = useState<any[]>([])
  const [uid, setUid] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUid(session.user.id)
      const { data } = await supabase.from('Notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
      setNotifs(data || [])
    }
    load()
  }, [])

  const markRead = async (id: string) => {
    await supabase.from('Notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map((n: any) => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAll = async () => {
    await supabase.from('Notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false)
    setNotifs(prev => prev.map((n: any) => ({ ...n, is_read: true })))
  }

  const unread = notifs.filter((n: any) => !n.is_read)
  const read = notifs.filter((n: any) => n.is_read)

  const Section = ({ label, items }: { label: string; items: any[] }) => {
    if (!items.length) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}>
          {label} <span style={{ background: 'var(--bg3)', color: 'var(--txt3)', fontSize: 10, padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>{items.length}</span>
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 10, padding: '4px 14px' }}>
          {items.map((n: any) => (
            <div key={n.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--brd)', alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? 'var(--bg3)' : '#4d8ef0', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, color: 'var(--txt2)', fontWeight: n.is_read ? 400 : 500 }}>{n.message}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{n.created_at?.slice(0, 10)}</div>
              {!n.is_read && <button onClick={() => markRead(n.id)} style={{ background: 'rgba(106,179,62,0.15)', border: 'none', color: '#6ab33e', borderRadius: 5, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>✓</button>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AppShell title="Notifications">
      {unread.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={markAll} style={{ background: 'var(--brd)', border: '1px solid var(--input-brd)', color: 'var(--txt2)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>Mark all read</button>
        </div>
      )}
      {notifs.length === 0 && <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--txt3)' }}><div style={{ fontSize: 32 }}>🔔</div><div style={{ marginTop: 8 }}>No notifications.</div></div>}
      <Section label="Unread" items={unread} />
      <Section label="Earlier" items={read} />
    </AppShell>
  )
}
