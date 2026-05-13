'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Bell, Check, Trash2, Clock } from 'lucide-react'

export default function NotificationModal({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase.from('Notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => { if (isOpen) fetchNotifications() }, [isOpen, userId])

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from('Notifications').update({ is_read: true }).eq('id', id)
    if (!error) setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('Notifications').delete().eq('id', id)
    if (!error) setNotifications(prev => prev.filter(n => n.id !== id))
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 500, background: 'var(--bg)', borderRadius: 16, border: '1px solid var(--brd)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} color="var(--nav-active-txt)" />
            <span style={{ fontWeight: 800, fontSize: 14, textTransform: 'uppercase' }}>Notifications</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)' }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading...</div> : 
           notifications.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>No new alerts.</div> :
           notifications.map(n => (
            <div key={n.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--brd)', background: n.is_read ? 'transparent' : 'rgba(55, 138, 221, 0.05)', display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: n.is_read ? 400 : 600, marginBottom: 4 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {new Date(n.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!n.is_read && <button onClick={() => markAsRead(n.id)} style={{ background: 'none', border: 'none', color: '#639922', cursor: 'pointer' }}><Check size={16} /></button>}
                <button onClick={() => deleteNotification(n.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}