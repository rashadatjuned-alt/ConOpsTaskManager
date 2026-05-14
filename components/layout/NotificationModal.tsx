'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { X, Bell, Check, Trash2, Clock } from 'lucide-react'

export default function NotificationModal({ isOpen, onClose, userId }: { 
  isOpen: boolean, 
  onClose: () => void, 
  userId: string 
}) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('Notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) fetchNotifications()
  }, [isOpen, userId])

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    await supabase.from('Notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  // Mark all as read
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('Notifications').update({ is_read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  // Delete notification
  const deleteNotification = async (id: string) => {
    await supabase.from('Notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // ── CLICK HANDLER - Direct to exact page using ID ──
  const handleClick = (n: any) => {
    // Mark as read
    if (!n.is_read) markAsRead(n.id)
    onClose()

    // 1. Direct Task Detail Page (best)
    if (n.task_id) {
      router.push(`/tasks/${n.task_id}`)
      return
    }

    // 2. Direct Project Detail Page
    if (n.project_id) {
      router.push(`/projects/${n.project_id}`)   // Change only if your project route is different
      return
    }

    // 3. Fallback (keyword based)
    const msg = (n.message || '').toLowerCase()
    if (msg.includes('task') || msg.includes('assigned')) {
      router.push('/my-tasks')
    } else if (msg.includes('project')) {
      router.push('/my-projects')
    } else {
      router.push('/my-tasks')
    }
  }

  if (!isOpen) return null

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          background: 'var(--bg)',
          borderRadius: 16,
          border: '1px solid var(--brd)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid var(--brd)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'var(--bg2)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} color="var(--nav-active-txt)" />
            <span style={{ fontWeight: 800, fontSize: 14, textTransform: 'uppercase' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                background: '#EF4444',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999,
                minWidth: 20,
                textAlign: 'center'
              }}>
                {unreadCount}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--brd)',
                  color: '#639922',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Check size={14} /> Mark all read
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* NOTIFICATION LIST */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>No new alerts.</div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--brd)',
                  background: n.is_read ? 'transparent' : 'rgba(55, 138, 221, 0.05)',
                  display: 'flex',
                  gap: 12,
                  cursor: 'pointer'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 13, 
                    color: 'var(--txt)', 
                    fontWeight: n.is_read ? 400 : 600, 
                    marginBottom: 4 
                  }}>
                    {n.message}
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: 'var(--txt3)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4 
                  }}>
                    <Clock size={10} /> {new Date(n.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {!n.is_read && (
                    <button 
                      onClick={() => markAsRead(n.id)} 
                      style={{ background: 'none', border: 'none', color: '#639922', cursor: 'pointer' }}
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(n.id)} 
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}