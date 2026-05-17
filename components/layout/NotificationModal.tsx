'use client'
/**
 * components/ui/NotificationModal.tsx
 *
 * Reads task_id / subtask_id / project_id from each Notification row
 * and routes the user directly — no search required.
 *
 * Routing priority:
 *   subtask_id → look up parent_task_id → /tasks/{parent_task_id}
 *   task_id    → /tasks/{task_id}
 *   project_id → /my-projects  (swap to /projects/{id} when that page exists)
 *   fallback   → keyword match → dashboard
 *
 * Future comment/chat deep-link:
 *   Add comment_id to Notifications table, then uncomment the branch below.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { X, Bell, Check, Trash2, Clock } from 'lucide-react'

interface Notif {
  id: string
  message: string
  is_read: boolean
  created_at: string
  task_id:    number | null
  subtask_id: number | null
  project_id: string | null
  // comment_id: string | null   ← add when chat feature ships
}

export default function NotificationModal({
  isOpen,
  onClose,
  userId,
}: {
  isOpen: boolean
  onClose: () => void
  userId: string
}) {
  const router = useRouter()
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('Notifications')
      .select('id, message, is_read, created_at, task_id, subtask_id, project_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setNotifs((data as Notif[]) || [])
    setLoading(false)
  }

  useEffect(() => { if (isOpen) fetch_() }, [isOpen, userId])

  const markRead = async (id: string) => {
    await supabase.from('Notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAll = async () => {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (!ids.length) return
    await supabase.from('Notifications').update({ is_read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const del = async (id: string) => {
    await supabase.from('Notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  // ── Deep-link routing ───────────────────────────────────────────────────────
  const go = async (n: Notif) => {
    if (!n.is_read) markRead(n.id)
    onClose()

    // Future: comment deep-link (uncomment when chat feature ships)
    // if (n.comment_id && n.task_id) {
    //   router.push(`/tasks/${n.task_id}?comment=${n.comment_id}`)
    //   return
    // }

    // Subtask → look up parent task
    if (n.subtask_id) {
      const { data: sub } = await supabase
        .from('Subtasks')
        .select('parent_task_id')
        .eq('id', n.subtask_id)
        .single()
      if (sub?.parent_task_id) {
        router.push(`/tasks/${sub.parent_task_id}`)
        return
      }
    }

    // Direct task link
    if (n.task_id) { router.push(`/tasks/${n.task_id}`); return }

    // Project link (swap to /projects/${n.project_id} when that page exists)
    if (n.project_id) { router.push('/my-projects'); return }

    // Keyword fallback
    const m = (n.message || '').toLowerCase()
    if (m.includes('task') || m.includes('assigned') || m.includes('subtask')) router.push('/my-tasks')
    else if (m.includes('project')) router.push('/my-projects')
    else router.push('/dashboard')
  }

  if (!isOpen) return null
  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={onClose}
    >
      <div
        style={{ width:'100%', maxWidth:500, background:'var(--bg)', borderRadius:16, border:'1px solid var(--brd)', boxShadow:'0 20px 40px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column', maxHeight:'80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--brd)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg2)', borderRadius:'16px 16px 0 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Bell size={17} color="#3B6D11" />
            <span style={{ fontWeight:700, fontSize:14, textTransform:'uppercase', letterSpacing:'0.04em' }}>Notifications</span>
            {unread > 0 && (
              <span style={{ background:'#EF4444', color:'#fff', fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:999 }}>
                {unread}
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {unread > 0 && (
              <button onClick={markAll} style={{ background:'var(--bg)', border:'1px solid var(--brd)', color:'#639922', fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <Check size={13}/> Mark all read
              </button>
            )}
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt3)', padding:4 }}>
              <X size={19}/>
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Loading…</div>
          ) : notifs.length === 0 ? (
            <div style={{ padding:48, textAlign:'center', color:'var(--txt3)' }}>
              <Bell size={30} style={{ opacity:.25, marginBottom:10 }}/>
              <div style={{ fontSize:13 }}>No notifications yet.</div>
            </div>
          ) : notifs.map(n => (
            <div
              key={n.id}
              onClick={() => go(n)}
              style={{ padding:'13px 22px', borderBottom:'1px solid var(--brd)', background: n.is_read ? 'transparent' : 'rgba(59,109,17,0.035)', display:'flex', gap:12, cursor:'pointer', transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
              onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(59,109,17,0.035)')}
            >
              {/* Unread dot */}
              <div style={{ paddingTop:5, flexShrink:0 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background: n.is_read ? 'transparent' : '#3B6D11', border: n.is_read ? '1.5px solid var(--brd2)' : 'none' }}/>
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:'var(--txt)', lineHeight:1.5, fontWeight: n.is_read ? 400 : 500, marginBottom:5 }}>
                  {n.message}
                </div>

                {/* Deep-link chips — show user where the click goes */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:5 }}>
                  {n.subtask_id && (
                    <span style={{ fontSize:10, color:'#185FA5', background:'#E6F1FB', padding:'1px 7px', borderRadius:10 }}>
                      ↗ Subtask
                    </span>
                  )}
                  {n.task_id && !n.subtask_id && (
                    <span style={{ fontSize:10, color:'#3B6D11', background:'#EAF3DE', padding:'1px 7px', borderRadius:10 }}>
                      ↗ Task #{n.task_id}
                    </span>
                  )}
                  {n.project_id && !n.task_id && (
                    <span style={{ fontSize:10, color:'#854F0B', background:'#FAEEDA', padding:'1px 7px', borderRadius:10 }}>
                      ↗ Project
                    </span>
                  )}
                </div>

                <div style={{ fontSize:10, color:'var(--txt3)', display:'flex', alignItems:'center', gap:4 }}>
                  <Clock size={10}/>
                  {new Date(n.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} title="Mark read" style={{ background:'none', border:'none', color:'#639922', cursor:'pointer', padding:4 }}>
                    <Check size={14}/>
                  </button>
                )}
                <button onClick={() => del(n.id)} title="Delete" style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:4 }}>
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}