'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAssignees } from '@/lib/projectUtils'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const

const STATUS_DOT: Record<string, string> = {
  'Not Started': '#9ca3af',
  'In Progress': 'var(--blue)',
  'On-Hold':     'var(--amber)',
  'Completed':   'var(--accent)',
}
const STATUS_PILL_CLASS: Record<string, string> = {
  'Not Started': 'pill-ns',
  'In Progress': 'pill-ip',
  'On-Hold':     'pill-oh',
  'Completed':   'pill-c',
}

function Pill({ status }: { status: string }) {
  return <span className={`pill ${STATUS_PILL_CLASS[status] || 'pill-ns'}`}>{status}</span>
}

export default function Dashboard() {
  const router = useRouter()
  const [me,       setMe]       = useState<any>(null)
  const [tasks,    setTasks]    = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users,    setUsers]    = useState<any[]>([])
  const [notifs,   setNotifs]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      const [{ data: t }, { data: p }, { data: us }, { data: n }] = await Promise.all([
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Users').select('id,full_name,email,role'),
        supabase.from('Notifications').select('*')
          .eq('user_id', session.user.id).eq('is_read', false)
          .order('created_at', { ascending: false }).limit(5),
      ])
      setTasks(t || [])
      setProjects(p || [])
      setUsers(us || [])
      setNotifs(n || [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  const isMyTask = (t: any) => {
    const myName  = (me?.full_name || '').toLowerCase().trim()
    const myEmail = (me?.email || '').toLowerCase().trim()
    return getAssignees(t).some((a: any) => {
      const al = a.toLowerCase().trim()
      return al === myName || al === myEmail
    })
  }

  const total     = tasks.length
  const inProg    = tasks.filter((t: any) => t.status === 'In Progress').length
  const completed = tasks.filter((t: any) => t.status === 'Completed').length
  const overdue   = tasks.filter((t: any) => t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today)
  const myTasks   = tasks.filter(isMyTask)
  const myOverdue = myTasks.filter((t: any) => t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today)
  const myDueSoon = myTasks.filter((t: any) => {
    if (t.status === 'Completed' || !t.end_date) return false
    const e = new Date(t.end_date); e.setHours(0, 0, 0, 0)
    const diff = Math.round((e.getTime() - today.getTime()) / 864e5)
    return diff >= 0 && diff <= 7
  })
  const pct = total ? Math.round(completed / total * 100) : 0

  // Stat card accent colors
  const STATS = [
    { label: 'Total Tasks',   value: total,          color: 'var(--blue)',   accent: '#1a73e8', icon: '📋' },
    { label: 'Overdue',       value: overdue.length,  color: 'var(--red)',    accent: '#c5221f', icon: '⚠️', onClick: overdue.length > 0 ? () => router.push('/all-tasks') : undefined },
    { label: 'In Progress',   value: inProg,          color: 'var(--amber)',  accent: '#b45309', icon: '⏳' },
    { label: 'Completed',     value: completed,       color: 'var(--accent)', accent: '#2e7d32', icon: '✅' },
    { label: 'Team Members',  value: users.length,    color: '#9c27b0',       accent: '#9c27b0', icon: '👥' },
  ]

  const TaskMini = ({ t }: { t: any }) => {
    const over = t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today
    return (
      <div onClick={() => router.push(`/tasks/${t.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: 4, border: '1px solid var(--row-brd)', background: 'var(--row-bg)', transition: 'all 0.12s' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[t.status], flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</div>
          <div style={{ fontSize: 11, color: over ? 'var(--red)' : 'var(--txt3)', marginTop: 1 }}>
            {over ? '⚠ ' : ''}{t.end_date}{t.project_name ? ` · ${t.project_name}` : ''}
          </div>
        </div>
        <Pill status={t.status} />
      </div>
    )
  }

  return (
    <AppShell title="Dashboard">

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
        {STATS.map(s => (
          <div key={s.label} className="stat-card"
            onClick={s.onClick}
            style={{ cursor: s.onClick ? 'pointer' : 'default', borderBottom: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-val" style={{ color: s.color }}>
              {loading ? '—' : s.value}
            </div>
            <div className="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Overall Completion ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Overall Completion</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{pct}%</div>
        </div>
        <div className="prog-bar" style={{ height: 7, marginBottom: 8 }}>
          <div className="prog-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: `${completed} completed`,                                             color: 'var(--accent)' },
            { label: `${inProg} in progress`,                                              color: 'var(--blue)'   },
            { label: `${tasks.filter((t: any) => t.status === 'On-Hold').length} on hold`, color: 'var(--amber)'  },
            { label: `${tasks.filter((t: any) => t.status === 'Not Started').length} not started`, color: 'var(--txt3)' },
          ].map(x => (
            <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--txt3)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: x.color }} />
              {x.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3-column section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>

        {/* Col 1: Overdue + Due Soon */}
        <div className="card" style={{ margin: 0 }}>
          {myOverdue.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                My Overdue
                <span style={{ background: 'var(--red2)', color: 'var(--red)', fontSize: 10, padding: '1px 6px', borderRadius: 10 }}>{myOverdue.length}</span>
              </div>
              {myOverdue.slice(0, 3).map((t: any) => <TaskMini key={t.id} t={t} />)}
            </div>
          )}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            Due This Week
            <span style={{ background: 'var(--bg)', color: 'var(--txt3)', fontSize: 10, padding: '1px 6px', borderRadius: 10, border: '1px solid var(--brd)' }}>{myDueSoon.length}</span>
          </div>
          {myDueSoon.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '6px 0' }}>Nothing due this week 🎉</div>
            : myDueSoon.slice(0, 4).map((t: any) => <TaskMini key={t.id} t={t} />)
          }
        </div>

        {/* Col 2: Projects */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)' }}>Projects</div>
            <Link href="/my-projects" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none', padding: '2px 8px', background: 'var(--blue2)', borderRadius: 5 }}>View all</Link>
          </div>
          {projects.slice(0, 6).map((proj: any) => {
            const pt   = tasks.filter((t: any) => t.project_name === proj.name)
            const done = pt.filter((t: any) => t.status === 'Completed').length
            const pc   = pt.length ? Math.round(done / pt.length * 100) : 0
            const ovr  = pt.filter((t: any) => t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today).length
            return (
              <div key={proj.id} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => router.push('/my-projects')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: proj.color_code || 'var(--blue)', flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--txt)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{done}/{pt.length}</div>
                  {ovr > 0 && <span style={{ background: 'var(--red2)', color: 'var(--red)', fontSize: 9, padding: '1px 5px', borderRadius: 8 }}>{ovr} late</span>}
                  <div style={{ fontSize: 11, fontWeight: 700, color: pc === 100 ? 'var(--accent)' : 'var(--txt3)', fontFamily: 'monospace' }}>{pc}%</div>
                </div>
                <div className="prog-bar">
                  <div className="prog-fill" style={{ width: `${pc}%`, background: proj.color_code || 'var(--blue)' }} />
                </div>
              </div>
            )
          })}
          {projects.length === 0 && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No projects yet.</div>}
        </div>

        {/* Col 3: Notifications */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Unread
              {notifs.length > 0 && <span style={{ background: 'var(--blue2)', color: 'var(--blue)', fontSize: 10, padding: '1px 6px', borderRadius: 10 }}>{notifs.length}</span>}
            </div>
            <Link href="/notifications" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none', padding: '2px 8px', background: 'var(--blue2)', borderRadius: 5 }}>View all</Link>
          </div>
          {notifs.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No unread notifications.</div>
            : notifs.map((n: any) => (
                <div key={n.id} style={{ display: 'flex', gap: 9, padding: '7px 0', borderBottom: '1px solid var(--brd)', alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)', lineHeight: 1.45 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{n.created_at?.slice(0, 10)}</div>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── Pipeline Kanban ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt3)' }}>Pipeline</div>
        <Link href="/tasks/create" style={{ background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 'var(--r)', padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>+ New Task</Link>
      </div>
      <div className="kanban-grid">
        {STATUSES.map(status => {
          const group = tasks.filter((t: any) => t.status === status)
          return (
            <div key={status} className="kanban-col">
              <div className="k-header">
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[status] }} />
                {status}
                <span className="k-count">{group.length}</span>
              </div>
              {group.length === 0
                ? <div className="k-empty">No tasks</div>
                : group.slice(0, 4).map((t: any) => (
                    <div key={t.id} className="k-card" onClick={() => router.push(`/tasks/${t.id}`)}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--txt)', marginBottom: 5 }}>{t.topic}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{t.project_name || '—'}</span>
                        {t.type !== 'One-time' && <span className="pill pill-rc" style={{ fontSize: 9 }}>↻ {t.type}</span>}
                      </div>
                    </div>
                  ))
              }
              {group.length > 4 && (
                <div style={{ fontSize: 11, color: 'var(--txt3)', textAlign: 'center', padding: '4px 0' }}>+{group.length - 4} more</div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
