'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, CheckCircle2, Clock, AlertCircle, ListTodo, X, Users, BarChart3 } from 'lucide-react'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export default function Dashboard() {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [showModal, setShowModal] = useState<string | null>(null) // Status for pop-up filter
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })

      const [t, s] = await Promise.all([
        supabase.from('Tasks').select('*'),
        supabase.from('Subtasks').select('*'),
      ])
      setTasks(t.data || []); setSubtasks(s.data || []); setLoading(false)
    }
    load()
  }, [])

  const isMe = (owner: string, assignees: string[] = []) => {
    const o = (owner || '').toLowerCase(), e = (me?.email || '').toLowerCase(), n = (me?.full_name || '').toLowerCase()
    const isOwner = o.includes(e) || (n.length > 2 && o.includes(n))
    const isAssignee = (assignees || []).some(a => a.toLowerCase().includes(e) || a.toLowerCase().includes(n))
    return isOwner || isAssignee
  }

  // User-Centric Task Set
  const myTasks = useMemo(() => tasks.filter(t => isMe(t.owner, t.assignees)), [tasks, me])

  const stats = {
    total: myTasks.length,
    pending: myTasks.filter(t => t.status !== 'Completed').length,
    completed: myTasks.filter(t => t.status === 'Completed').length,
    inProgress: myTasks.filter(t => t.status === 'In Progress').length,
    onHold: myTasks.filter(t => t.status === 'On-Hold').length,
    notStarted: myTasks.filter(t => t.status === 'Not Started').length,
  }

  if (loading) return <AppShell title="Dashboard">Loading...</AppShell>

  return (
    <AppShell title="My Workspace Dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Hello, {me?.full_name?.split(' ')[0]}</h2>
          <p style={{ color: 'var(--txt3)', fontSize: 13 }}>Here is what's on your plate today.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Workload only for Managers/Admins */}
          {(me?.role === 'Manager' || me?.role === 'Admin') && (
            <button className="tv-btn" onClick={() => router.push('/workload')}><BarChart3 size={14} style={{ marginRight: 6 }}/> Team Workload</button>
          )}
        </div>
      </div>

      {/* METRIC CARDS - Clickable for pop-up filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Not Started', count: stats.notStarted, color: '#aaa', icon: <ListTodo size={20}/> },
          { label: 'In Progress', count: stats.inProgress, color: '#378ADD', icon: <Clock size={20}/> },
          { label: 'On-Hold', count: stats.onHold, color: '#EF9F27', icon: <AlertCircle size={20}/> },
          { label: 'Completed', count: stats.completed, color: '#639922', icon: <CheckCircle2 size={20}/> }
        ].map(card => (
          <div key={card.label} onClick={() => setShowModal(card.label)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: '0.2s', position: 'relative', overflow: 'hidden' }} onMouseEnter={e => e.currentTarget.style.borderColor = card.color} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}>
            <div style={{ color: card.color, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{card.count}</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, textTransform: 'uppercase' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* MY PIPELINE - User Centric Status View */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><LayoutDashboard size={18} /> My Pipeline</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {STATUSES.map(status => (
            <div key={status}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                {status} <span>{myTasks.filter(t => t.status === status).length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myTasks.filter(t => t.status === status).slice(0, 5).map(t => (
                  <div key={t.id} onClick={() => router.push(`/tasks/${t.id}`)} style={{ background: 'var(--bg2)', padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brd)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                    {t.topic}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TEMPORARY FILTER POP-UP */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(null)}>
          <div style={{ width: '90%', maxWidth: 900, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--brd)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Your {showModal} Tasks</div>
              <button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: 11, color: 'var(--txt3)', textTransform: 'uppercase', borderBottom: '1px solid var(--brd)' }}>
                    <th style={{ padding: '12px 8px' }}>Task Title</th>
                    <th>Project</th>
                    <th>Sub-task Progress</th>
                    <th style={{ textAlign: 'right' }}>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {myTasks.filter(t => t.status === showModal).map(t => {
                    const subs = subtasks.filter(s => s.parent_task_id === t.id)
                    const pct = subs.length ? Math.round((subs.filter(s => s.status === 'Completed').length / subs.length) * 100) : (t.status === 'Completed' ? 100 : 0)
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--brd)', fontSize: 13 }}>
                        <td style={{ padding: '16px 8px', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</td>
                        <td style={{ color: 'var(--txt2)' }}>{t.project_name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, maxWidth: 80, height: 4, background: 'var(--brd)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--txt2)' }} /></div>
                            <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {[t.owner, ...(t.assignees || [])].filter(Boolean).map((name, i) => (
                              <div key={i} title={name} style={{ width: 20, height: 20, borderRadius: '50%', fontSize: 8, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--bg)', marginLeft: -6, cursor: 'help' }}>{ini(name)}</div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
