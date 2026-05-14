'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  LayoutDashboard, CheckCircle2, Clock, AlertCircle, 
  ListTodo, X, BarChart3, CalendarDays, History, 
  Hourglass, User, Users 
} from 'lucide-react'

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
  const [taskAssignees, setTaskAssignees] = useState<any[]>([])
  const [showModal, setShowModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'me' | 'team'>('me')

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const myId = session.user.id

      // Load user profile
      const { data: u } = await supabase
        .from('Users')
        .select('*')
        .eq('id', myId)
        .single()

      const profile = { ...u, email: session.user.email }
      setMe(profile)

      // Auto-switch managers to team view
      if (profile.role === 'Manager' || profile.role === 'Admin') {
        setViewMode('team')
      }

      // Load all data
      const [tRes, sRes, taRes] = await Promise.all([
        supabase.from('Tasks').select('*'),
        supabase.from('Subtasks').select('*'),
        supabase.from('task_assignees').select('*')
      ])

      setTasks(tRes.data || [])
      setSubtasks(sRes.data || [])
      setTaskAssignees(taRes.data || [])
      setLoading(false)
    }

    loadData()
  }, [])

  // FIXED: Proper "My View" filtering using task_assignees junction table
  const currentTasks = useMemo(() => {
    if (viewMode === 'team') return tasks

    const myTaskIds = taskAssignees
      .filter(ta => ta.user_id === me?.id)
      .map(ta => ta.task_id)

    return tasks.filter(t => myTaskIds.includes(t.id))
  }, [tasks, taskAssignees, me, viewMode])

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const nextWeek = new Date()
  nextWeek.setDate(now.getDate() + 7)
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const metrics = useMemo(() => {
    const mTasks = currentTasks.map(t => ({
      ...t,
      dateObj: t.end_date ? new Date(t.end_date) : null
    }))

    return {
      'Not Started': mTasks.filter(t => t.status === 'Not Started'),
      'In Progress': mTasks.filter(t => t.status === 'In Progress'),
      'On-Hold': mTasks.filter(t => t.status === 'On-Hold'),
      'Completed': mTasks.filter(t => t.status === 'Completed'),
      'Overdue': mTasks.filter(t => t.dateObj && t.dateObj < now && t.status !== 'Completed'),
      'Due This Week': mTasks.filter(t => t.dateObj && t.dateObj >= now && t.dateObj <= nextWeek && t.status !== 'Completed'),
      'Due This Month': mTasks.filter(t => t.dateObj && t.dateObj.getMonth() === thisMonth && t.dateObj.getFullYear() === thisYear && t.status !== 'Completed'),
    }
  }, [currentTasks, now, thisMonth, thisYear])

  if (loading) return <AppShell title="Dashboard">Loading Workspace...</AppShell>

  const isManager = me?.role === 'Manager' || me?.role === 'Admin'

  return (
    <AppShell title={viewMode === 'me' ? "My Personal Workspace" : "Team Performance Oversight"}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Hello, {me?.full_name?.split(' ')[0] || 'User'}
          </h2>
          <p style={{ color: 'var(--txt3)', fontSize: 13, marginTop: 4 }}>
            {viewMode === 'team' 
              ? "You're currently viewing the full team's performance." 
              : "Focusing on your active assignments."}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {isManager && (
            <div style={{ display: 'flex', background: 'var(--bg2)', padding: 4, borderRadius: 10, border: '1px solid var(--brd)' }}>
              <button 
                onClick={() => setViewMode('me')}
                style={{ 
                  padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase',
                  background: viewMode === 'me' ? 'var(--bg)' : 'transparent', 
                  color: viewMode === 'me' ? 'var(--txt)' : 'var(--txt3)',
                  boxShadow: viewMode === 'me' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', transition: '0.2s'
                }}
              >
                <User size={13}/> My View
              </button>
              <button 
                onClick={() => setViewMode('team')}
                style={{ 
                  padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase',
                  background: viewMode === 'team' ? 'var(--bg)' : 'transparent', 
                  color: viewMode === 'team' ? 'var(--txt)' : 'var(--txt3)',
                  boxShadow: viewMode === 'team' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', transition: '0.2s'
                }}
              >
                <Users size={13}/> Team View
              </button>
            </div>
          )}

          {isManager && (
            <button 
              onClick={() => router.push('/workload')}
              style={{
                background: 'linear-gradient(135deg, #378ADD 0%, #1B5299 100%)',
                color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px',
                fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 10, boxShadow: '0 4px 15px rgba(55, 138, 221, 0.25)'
              }}
            >
              <BarChart3 size={16} />
              <span>TEAM WORKLOAD</span>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>MGMT</div>
            </button>
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
            <div 
              key={card.id} 
              onClick={() => count > 0 && setShowModal(card.id)}
              style={{ 
                background: 'var(--bg)', 
                border: '1px solid var(--brd)', 
                borderRadius: 12, 
                padding: 18, 
                cursor: count > 0 ? 'pointer' : 'default',
                opacity: count > 0 ? 1 : 0.6 
              }}
            >
              <div style={{ color: card.color, marginBottom: 10 }}>{card.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{count}</div>
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
            <div 
              key={card.id} 
              onClick={() => count > 0 && setShowModal(card.id)}
              style={{ 
                background: 'var(--bg)', 
                border: '1px solid var(--brd)', 
                borderRadius: 12, 
                padding: 18, 
                cursor: count > 0 ? 'pointer' : 'default',
                borderLeft: count > 0 ? `4px solid ${card.color}` : undefined
              }}
            >
              <div style={{ color: card.color, marginBottom: 10 }}>{card.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase' }}>{card.id}</div>
            </div>
          )
        })}
      </div>

      {/* PIPELINE */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', color: 'var(--txt2)', letterSpacing: '0.02em' }}>
          <LayoutDashboard size={18} /> 
          {viewMode === 'me' ? 'My Pipeline' : 'Team Pipeline'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {STATUSES.map(status => (
            <div key={status}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--brd)', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{STATUS_ICONS[status]} {status}</div>
                <span style={{ fontSize: 11 }}>{metrics[status].length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {metrics[status].slice(0, 6).map((t: any) => (
                  <div 
                    key={t.id} 
                    onClick={() => router.push(`/tasks/${t.id}`)}
                    style={{ 
                      background: 'var(--bg2)', 
                      padding: '12px', 
                      borderRadius: 8, 
                      fontSize: 12, 
                      fontWeight: 500, 
                      cursor: 'pointer' 
                    }}
                  >
                    {t.topic}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.75)', 
            zIndex: 1000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(6px)'
          }} 
          onClick={() => setShowModal(null)}
        >
          <div 
            style={{ 
              width: '90%', 
              maxWidth: 900, 
              background: 'var(--bg)', 
              borderRadius: 16, 
              border: '1px solid var(--brd)', 
              overflow: 'hidden', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {viewMode === 'me' ? 'My' : 'Team'} {showModal} Summary
              </div>
              <button 
                onClick={() => setShowModal(null)} 
                style={{ 
                  background: 'var(--bg2)', 
                  border: '1px solid var(--brd)', 
                  borderRadius: '50%', 
                  width: 32, 
                  height: 32, 
                  color: 'var(--txt3)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <X size={18}/>
              </button>
            </div>

            <div style={{ padding: 0, maxHeight: '65vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', background: 'var(--bg2)', fontWeight: 800 }}>
                    <th style={{ padding: '16px 24px' }}>Task Title</th>
                    <th>Project</th>
                    <th>Sub-task Progress</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics[showModal as keyof typeof metrics].map((t: any) => {
                    const subs = subtasks.filter((s: any) => s.parent_task_id === t.id)
                    const doneSubs = subs.filter((s: any) => s.status === 'Completed').length
                    const pct = subs.length ? Math.round((doneSubs / subs.length) * 100) : (t.status === 'Completed' ? 100 : 0)

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--brd)', fontSize: 13 }}>
                        <td 
                          style={{ padding: '18px 24px', fontWeight: 600, color: 'var(--txt)', cursor: 'pointer' }} 
                          onClick={() => {
                            setShowModal(null)
                            router.push(`/tasks/${t.id}`)
                          }}
                        >
                          {t.topic}
                        </td>
                        <td style={{ color: 'var(--txt2)', padding: '18px 24px' }}>{t.project_name || '—'}</td>
                        <td style={{ padding: '18px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, maxWidth: 120, height: 4, background: 'var(--brd)', borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#378ADD' }} />
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 24 }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {[t.owner, ...(t.assignees || [])].filter(Boolean).map((name: string, i: number) => (
                              <div 
                                key={i} 
                                title={name} 
                                style={{ 
                                  width: 22, 
                                  height: 22, 
                                  borderRadius: '50%', 
                                  fontSize: 8, 
                                  fontWeight: 800, 
                                  background: AVATAR_BG[i % 6], 
                                  color: AVATAR_CL[i % 6], 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  border: '2px solid var(--bg)', 
                                  marginLeft: i > 0 ? -8 : 0 
                                }}
                              >
                                {ini(name)}
                              </div>
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