'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAssignees } from '@/lib/projectUtils'

const STATUS_DOT: Record<string, string> = {
  'Not Started': '#6b7280', 'In Progress': '#3b82f6',
  'On-Hold': '#f59e0b', 'Completed': '#22c55e',
}
const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  'Not Started': { bg: '#1f2937', color: '#9ca3af' },
  'In Progress': { bg: '#1e3a5f', color: '#60a5fa' },
  'On-Hold':     { bg: '#3d2400', color: '#f59e0b' },
  'Completed':   { bg: '#052e16', color: '#4ade80' },
}
const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const

function Pill({ status }: { status: string }) {
  const s = STATUS_PILL[status] || STATUS_PILL['Not Started']
  return <span style={{ background: s.bg, color: s.color, fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 500, flexShrink: 0 }}>{status}</span>
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

  const StatCard = ({ icon, label, value, accent, onClick }: any) => (
    <div onClick={onClick} style={{
      ...S.statCard,
      borderBottom: `3px solid ${accent}`,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent, fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
        {loading ? '—' : value}
      </div>
      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{label}</div>
    </div>
  )

  const TaskMini = ({ t }: { t: any }) => {
    const over = t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today
    return (
      <div style={S.taskMini} onClick={() => router.push(`/tasks/${t.id}`)}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[t.status], flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</div>
          <div style={{ fontSize: 10, color: over ? '#f87171' : '#4b5563' }}>
            {over ? '⚠ ' : ''}{t.end_date} {t.project_name && `· ${t.project_name}`}
          </div>
        </div>
        <Pill status={t.status} />
      </div>
    )
  }

  return (
    <AppShell title="Dashboard">
      {/* Stats */}
      <div style={S.statsGrid}>
        <StatCard icon="📋" label="Total Tasks"   value={total}        accent="#3b82f6" />
        <StatCard icon="⚠️" label="Overdue"        value={overdue.length} accent="#ef4444"
          onClick={overdue.length > 0 ? () => router.push('/all-tasks') : undefined} />
        <StatCard icon="⏳" label="In Progress"   value={inProg}       accent="#f59e0b" />
        <StatCard icon="✅" label="Completed"      value={completed}    accent="#22c55e" />
        <StatCard icon="👥" label="Team Members"  value={users.length} accent="#8b5cf6" />
      </div>

      {/* Overall progress */}
      <div style={S.progCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>Overall Completion</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>{pct}%</div>
        </div>
        <div style={S.progBar}>
          <div style={{ ...S.progFill, width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          {[
            { label: `${completed} completed`, color: '#22c55e' },
            { label: `${inProg} in progress`, color: '#3b82f6' },
            { label: `${tasks.filter((t: any) => t.status === 'On-Hold').length} on hold`, color: '#f59e0b' },
            { label: `${tasks.filter((t: any) => t.status === 'Not Started').length} not started`, color: '#6b7280' },
          ].map((x: any) => (
            <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#4b5563' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: x.color }} />{x.label}
            </div>
          ))}
        </div>
      </div>

      {/* 3-col */}
      <div style={S.threeCol}>
        {/* Col 1 — overdue + due soon */}
        <div style={S.colCard}>
          {myOverdue.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ ...S.colTitle, color: '#ef4444' }}>
                My Overdue
                <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 9.5, padding: '1px 5px', borderRadius: 8, marginLeft: 5 }}>{myOverdue.length}</span>
              </div>
              {myOverdue.slice(0, 3).map((t: any) => <TaskMini key={t.id} t={t} />)}
            </div>
          )}
          <div style={S.colTitle}>
            Due This Week
            <span style={{ background: '#1f2937', color: '#6b7280', fontSize: 9.5, padding: '1px 5px', borderRadius: 8, marginLeft: 5 }}>{myDueSoon.length}</span>
          </div>
          {myDueSoon.length === 0
            ? <div style={{ fontSize: 11, color: '#374151', padding: '6px 0' }}>Nothing due this week.</div>
            : myDueSoon.slice(0, 4).map((t: any) => <TaskMini key={t.id} t={t} />)
          }
        </div>

        {/* Col 2 — projects */}
        <div style={S.colCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={S.colTitle}>Projects</div>
            <Link href="/my-projects" style={S.viewAll}>View all</Link>
          </div>
          {projects.slice(0, 6).map(proj => {
            const pt   = tasks.filter((t: any) => t.project_name === proj.name)
            const done = pt.filter((t: any) => t.status === 'Completed').length
            const pc   = pt.length ? Math.round(done / pt.length * 100) : 0
            const ovr  = pt.filter((t: any) => t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today).length
            return (
              <div key={proj.id} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => router.push('/my-projects')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: proj.color_code || '#3b82f6', flexShrink: 0 }} />
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#e5e7eb', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</div>
                  <div style={{ fontSize: 10, color: '#4b5563' }}>{done}/{pt.length}</div>
                  {ovr > 0 && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 9, padding: '1px 5px', borderRadius: 8 }}>{ovr} late</span>}
                  <div style={{ fontSize: 10, fontWeight: 700, color: pc === 100 ? '#22c55e' : '#4b5563', fontFamily: 'monospace' }}>{pc}%</div>
                </div>
                <div style={S.progBar}>
                  <div style={{ ...S.progFill, width: `${pc}%`, background: proj.color_code || '#3b82f6' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Col 3 — notifications */}
        <div style={S.colCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={S.colTitle}>
              Unread
              {notifs.length > 0 && (
                <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: 9.5, padding: '1px 5px', borderRadius: 8, marginLeft: 5 }}>{notifs.length}</span>
              )}
            </div>
            <Link href="/notifications" style={S.viewAll}>View all</Link>
          </div>
          {notifs.length === 0
            ? <div style={{ fontSize: 11, color: '#374151' }}>No unread notifications.</div>
            : notifs.map((n: any) => (
                <div key={n.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 11.5, color: '#9ca3af', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: '#374151', whiteSpace: 'nowrap' }}>{n.created_at?.slice(0, 10)}</div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={S.colTitle}>Pipeline</div>
        <Link href="/tasks/create" style={S.newBtn}>+ New Task</Link>
      </div>
      <div style={S.kanban}>
        {STATUSES.map(status => {
          const group = tasks.filter((t: any) => t.status === status)
          return (
            <div key={status} style={S.kCol}>
              <div style={S.kHeader}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[status] }} />
                <span style={{ flex: 1 }}>{status}</span>
                <span style={S.kCount}>{group.length}</span>
              </div>
              {group.length === 0 ? (
                <div style={S.kEmpty}>No tasks</div>
              ) : group.slice(0, 4).map((t: any) => (
                <div key={t.id} style={S.kCard} onClick={() => router.push(`/tasks/${t.id}`)}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#e5e7eb', marginBottom: 4 }}>{t.topic}</div>
                  <div style={{ fontSize: 10, color: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{t.project_name || '—'}</span>
                    {t.type !== 'One-time' && <span style={{ background: '#3d2400', color: '#f59e0b', fontSize: 9, padding: '1px 5px', borderRadius: 8 }}>↻ {t.type}</span>}
                  </div>
                </div>
              ))}
              {group.length > 4 && (
                <div style={{ fontSize: 10, color: '#374151', textAlign: 'center', padding: '4px 0' }}>+{group.length - 4} more</div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}

const S: Record<string, React.CSSProperties> = {
  statsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 },
  statCard:   { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '13px 15px', transition: 'all 0.18s' },
  progCard:   { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '13px 15px', marginBottom: 14 },
  progBar:    { height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  progFill:   { height: '100%', background: '#22c55e', borderRadius: 3, transition: 'width 0.5s ease' },
  threeCol:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 },
  colCard:    { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14 },
  colTitle:   { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151', marginBottom: 9, display: 'flex', alignItems: 'center' },
  taskMini:   { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, transition: 'background 0.12s', border: '1px solid rgba(255,255,255,0.04)' },
  viewAll:    { fontSize: 11, color: '#6b7280', textDecoration: 'none', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.06)' },
  newBtn:     { background: '#15803d', color: '#bbf7d0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  kanban:     { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 },
  kCol:       { background: '#111', borderRadius: 8, padding: 10 },
  kHeader:    { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151', paddingBottom: 7, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 },
  kCount:     { background: '#1a1a1a', color: '#4b5563', fontSize: 9.5, padding: '1px 5px', borderRadius: 7, fontFamily: 'monospace' },
  kEmpty:     { fontSize: 11, color: '#374151', textAlign: 'center', padding: '14px 6px', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 5 },
  kCard:      { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 10px', marginBottom: 5, cursor: 'pointer', transition: 'all 0.12s' },
}
