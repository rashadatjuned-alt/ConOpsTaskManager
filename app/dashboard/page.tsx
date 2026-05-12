'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, CheckCircle2, Clock, AlertCircle, ListTodo, X, BarChart3, CalendarDays, History, Hourglass, User, Users } from 'lucide-react'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

const STATUS_ICONS: Record<string, React.ReactNode> = {
  'Not Started': <ListTodo size={14} />,
  'In Progress': <Clock size={14} />,
  'On-Hold': <AlertCircle size={14} />,
  'Completed': <CheckCircle2 size={14} />
}

function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export default function Dashboard() {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [showModal, setShowModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // View Toggle State: 'me' or 'team'
  const [viewMode, setViewMode] = useState<'me' | 'team'>('me')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      
      // Managers default to Team View, Members default to My View
      if (u?.role === 'Manager' || u?.role === 'Admin') setViewMode('team')

      const [t, s] = await Promise.all([supabase.from('Tasks').select('*'), supabase.from('Subtasks').select('*')])
      setTasks(t.data || []); setSubtasks(s.data || []); setLoading(false)
    }
    load()
  }, [])

  const isMe = (owner: string, assignees: string[] = []) => {
    const o = (owner || '').toLowerCase(), e = (me?.email || '').toLowerCase(), n = (me?.full_name || '').toLowerCase()
    return o.includes(e) || (n.length > 2 && o.includes(n)) || (assignees || []).some(a => a.toLowerCase().includes(e) || a.toLowerCase().includes(n))
  }

  // ─── TASK FILTERING LOGIC ───
  const currentTasks = useMemo(() => {
    if (viewMode === 'me') return tasks.filter(t => isMe(t.owner, t.assignees))
    return tasks // Team View shows everything
  }, [tasks, me, viewMode])

  const now = new Date(); now.setHours(0,0,0,0)
  const nextWeek = new Date(); nextWeek.setDate(now.getDate() + 7)
  const thisMonth = now.getMonth(); const thisYear = now.getFullYear()

  const metrics = useMemo(() => {
    const mTasks = currentTasks.map(t => ({ ...t, dateObj: t.end_date ? new Date(t.end_date) : null }))
    return {
      'Not Started': mTasks.filter(t => t.status === 'Not Started'),
      'In Progress': mTasks.filter(t => t.status === 'In Progress'),
      'On-Hold': mTasks.filter(t => t.status === 'On-Hold'),
      'Completed': mTasks.filter(t => t.status === 'Completed'),
      'Overdue': mTasks.filter(t => t.dateObj && t.dateObj < now && t.status !== 'Completed'),
      'Due This Week': mTasks.filter(t => t.dateObj && t.dateObj >= now && t.dateObj <= nextWeek && t.status !== 'Completed'),
      'Due This Month': mTasks.filter(t => t.dateObj && t.dateObj.getMonth() === thisMonth && t.dateObj.getFullYear() === thisYear && t.status !== 'Completed'),
    }
  }, [currentTasks, now])

  if (loading) return <AppShell title="Dashboard">Loading...</AppShell>

  const isManager = me?.role === 'Manager' || me?.role === 'Admin'

  return (
    <AppShell title={viewMode === 'me' ? "My Personal Dashboard" : "Team Oversight Dashboard"}>
      
      {/* HEADER ACTIONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Hello, {me?.full_name?.split(' ')[0]}</h2>
          <p style={{ color: 'var(--txt3)', fontSize: 13 }}>Switch between your tasks and the team's progress below.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* VIEW TOGGLE - Only for Managers/Admins */}
          {isManager && (
            <div style={{ display: 'flex', background: 'var(--bg2)', padding: 4, borderRadius: 8, border: '1px solid var(--brd)' }}>
              <button 
                onClick={() => setViewMode('me')}
                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: viewMode === 'me' ? 'var(--bg)' : 'transparent', color: viewMode === 'me' ? 'var(--txt)' : 'var(--txt3)' }}
              >
                <User size={14}/> My View
              </button>
              <button 
                onClick={() => setViewMode('team')}
                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: viewMode === 'team' ? 'var(--bg)' : 'transparent', color: viewMode === 'team' ? 'var(--txt)' : 'var(--txt3)' }}
              >
                <Users size={14}/> Team View
              </button>
            </div>
          )}
          
          {isManager && (
            <button className="tv-btn" onClick={() => router.push('/workload')}><BarChart3 size={14} style={{ marginRight: 6 }}/> Workload</button>
          )}
        </div>
      </div>

      {/* STATUS METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { id: 'Not Started', color: '#aaa', icon: <ListTodo size={18}/> },
          { id: 'In Progress', color: '#378ADD', icon: <Clock size={18}/> },
          { id: 'On-Hold', color: '#EF9F27', icon: <AlertCircle size={18}/> },
          { id: 'Completed', color: '#639922', icon: <CheckCircle2 size={18}/> }
        ].map(card => {
          const count = metrics[card.id as keyof typeof metrics].length
          return (
            <div key={card.id} onClick={() => count > 0 && setShowModal(card.id)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 16, cursor: count > 0 ? 'pointer' : 'default', opacity: count > 0 ? 1 : 0.6, transition: '0.2s' }} onMouseEnter={e => count > 0 && (e.currentTarget.style.borderColor = card.color)} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}>
              <div style={{ color: card.color, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase' }}>{card.id}</div>
            </div>
          )
        })}
      </div>

      {/* TIMELINE METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { id: 'Overdue', color: '#ef4444', icon: <History size={18}/> },
          { id: 'Due This Week', color: '#8b5cf6', icon: <Hourglass size={18}/> },
          { id: 'Due This Month', color: '#ec4899', icon: <CalendarDays size={18}/> }
        ].map(card => {
          const count = metrics[card.id as keyof typeof metrics].length
          return (
            <div key={card.id} onClick={() => count > 0 && setShowModal(card.id)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 16, cursor: count > 0 ? 'pointer' : 'default', opacity: count > 0 ? 1 : 0.6, borderLeft: count > 0 ? `4px solid ${card.color}` : '1px solid var(--brd)' }}>
              <div style={{ color: card.color, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase' }}>{card.id}</div>
            </div>
          )
        })}
      </div>

      {/* PIPELINE SECTION */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={18} /> {viewMode === 'me' ? 'My Pipeline' : 'Team Pipeline'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {STATUSES.map(status => (
            <div key={status}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--brd)', paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{STATUS_ICONS[status]} {status}</div>
                <span>{metrics[status].length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {metrics[status].slice(0, 6).map(t => (
                  <div key={t.id} onClick={() => router.push(`/tasks/${t.id}`)} style={{ background: 'var(--bg2)', padding: 10, borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brd)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                    {t.topic}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FILTER POP-UP MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(null)}>
          <div style={{ width: '90%', maxWidth: 900, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--brd)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{viewMode === 'me' ? 'My' : 'Team'} {showModal} Tasks</div>
              <button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ fontSize: 11, color: 'var(--txt3)', textTransform: 'uppercase', borderBottom: '1px solid var(--brd)' }}>
                    <th style={{ padding: '12px 8px' }}>Task Title</th>
                    <th>Project</th>
                    <th>Sub-task Progress</th>
                    <th style={{ textAlign: 'right' }}>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics[showModal as keyof typeof metrics].map(t => {
                    const subs = subtasks.filter(s => s.parent_task_id === t.id)
                    const pct = subs.length ? Math.round((subs.filter(s => s.status === 'Completed').length / subs.length) * 100) : (t.status === 'Completed' ? 100 : 0)
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--brd)', fontSize: 13 }}>
                        <td style={{ padding: '16px 8px', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</td>
                        <td style={{ color: 'var(--txt2)' }}>{t.project_name}</td>
                        <td>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, maxWidth: 80, height: 4, background: 'var(--brd)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--txt2)' }} /></div>
                              <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{pct}%</span>
                           </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {[t.owner, ...(t.assignees || [])].filter(Boolean).map((name, i) => (
                              <div key={i} title={name} style={{ width: 20, height: 20, borderRadius: '50%', fontSize: 8, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--bg)', marginLeft: -6, cursor: 'default' }}>{ini(name)}</div>
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
