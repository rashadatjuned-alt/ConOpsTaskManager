'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusPill'
import {
  ArrowLeft, Settings, Filter, LayoutGrid, Columns,
  AlertTriangle, ChevronRight, X, Plus, Minus
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────
const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
type Status = typeof STATUSES[number]

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

const STATUS_DOT: Record<string, string> = {
  'Not Started': '#aaaaaa',
  'In Progress': '#378ADD',
  'On-Hold':     '#EF9F27',
  'Completed':   '#639922',
}

const LOAD_COLORS = {
  light:    { bg: 'var(--pill-c-bg)',   txt: 'var(--pill-c-txt)',  bar: 'var(--sl-light)' },
  moderate: { bg: 'var(--pill-ip-bg)',  txt: 'var(--pill-ip-txt)', bar: 'var(--sl-mod)'   },
  heavy:    { bg: 'var(--pill-oh-bg)',  txt: 'var(--pill-oh-txt)', bar: 'var(--sl-heavy)' },
  overload: { bg: 'var(--del-bg)',      txt: 'var(--del-txt)',     bar: 'var(--sl-over)'  },
}

const DEFAULT_CAPACITY = 8

interface Thresholds { moderate: number; heavy: number; overload: number }
const DEFAULT_THRESHOLDS: Thresholds = { moderate: 60, heavy: 80, overload: 100 }

type ViewMode = 'cards' | 'kanban'

// ── Helpers ──────────────────────────────────────────────────────────────────
function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function isOverdue(end_date: string | null, status: string) {
  if (!end_date || status === 'Completed') return false
  return new Date(end_date) < new Date(new Date().setHours(0, 0, 0, 0))
}

function daysLate(end_date: string) {
  const diff = Date.now() - new Date(end_date).getTime()
  return Math.floor(diff / 86400000)
}

function getLoad(openTasks: number, capacity: number, thresholds: Thresholds): keyof typeof LOAD_COLORS {
  const pct = capacity > 0 ? (openTasks / capacity) * 100 : 0
  if (pct >= thresholds.overload) return 'overload'
  if (pct >= thresholds.heavy)    return 'heavy'
  if (pct >= thresholds.moderate) return 'moderate'
  return 'light'
}

function formatDate(d: string) {
  const date = new Date(d)
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tmrw'
  if (diff > 0 && diff <= 6) return date.toLocaleDateString('en', { weekday: 'short' })
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

// ── Avatar component ─────────────────────────────────────────────────────────
function Avatar({ name, idx, size = 34 }: { name: string; idx: number; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size <= 24 ? 9 : size <= 32 ? 11 : 13,
      fontWeight: 800, flexShrink: 0,
    }}>
      {ini(name)}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Workload() {
  const router = useRouter()

  // Data
  const [users, setUsers]       = useState<any[]>([])
  const [tasks, setTasks]       = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  // UI state
  const [view, setView]           = useState<ViewMode>('cards')
  const [projFilter, setProjFilter] = useState('All')
  const [kanbanMember, setKanbanMember] = useState<string>('all')
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab]   = useState<'individual' | 'global'>('individual')

  // Capacity & thresholds (localStorage — no DB column needed)
  const [capacities, setCapacities]   = useState<Record<string, number>>({})
  const [draftCaps, setDraftCaps]     = useState<Record<string, number>>({})
  const [thresholds, setThresholds]   = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [draftT, setDraftT]           = useState<Thresholds>(DEFAULT_THRESHOLDS)

  // ── Load persisted settings ────────────────────────────────────────────────
  useEffect(() => {
    const savedCaps = localStorage.getItem('workload-capacities')
    const savedT    = localStorage.getItem('workload-thresholds-v2')
    if (savedCaps) { const p = JSON.parse(savedCaps); setCapacities(p); setDraftCaps(p) }
    if (savedT)    { const p = JSON.parse(savedT);    setThresholds(p); setDraftT(p)    }
  }, [])

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [u, t, s, p, ta, sa] = await Promise.all([
        supabase.from('Users').select('id,full_name,email,role').order('full_name'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Projects').select('*').order('name'),
        supabase.from('task_assignees').select('*'),
        supabase.from('subtask_assignees').select('*'),
      ])

      const taRows = ta.data || []
      const saRows = sa.data || []

      const hydratedTasks = (t.data || []).map(task => ({
        ...task,
        task_assignees: taRows.filter((ta: any) => ta.task_id === task.id),
      }))
      const hydratedSubs = (s.data || []).map(sub => ({
        ...sub,
        subtask_assignees: saRows.filter((sa: any) => sa.subtask_id === sub.id),
      }))

      setUsers(u.data || [])
      setTasks(hydratedTasks)
      setSubtasks(hydratedSubs)
      setProjects(p.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Derived dates (stable) ─────────────────────────────────────────────────
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const nextWeek = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d }, [])

  // ── Helper: get tasks belonging to a user ──────────────────────────────────
  const getUserTasks = useCallback((u: any, taskList: any[]) => {
    const name = u.full_name || u.email
    return taskList.filter(t => {
      const relational = (t.task_assignees || []).some((ta: any) => ta.user_id === u.id)
      const legacyOwner = String(t.owner || '').toLowerCase().includes(name.toLowerCase())
      const legacyAsgn  = String(t.assignees || '').toLowerCase().includes(name.toLowerCase())
      return relational || legacyOwner || legacyAsgn
    })
  }, [])

  // ── Filtered task list (by project) ───────────────────────────────────────
  const filteredTasks = useMemo(() => {
    if (projFilter === 'All') return tasks
    const proj = projects.find(p => p.name === projFilter)
    return tasks.filter(t => t.project_name === projFilter || t.project_id === proj?.id)
  }, [tasks, projFilter, projects])

  // ── Member stats ──────────────────────────────────────────────────────────
  const memberStats = useMemo(() => {
    return users
      .filter(u => u.role !== 'Admin')
      .map((u, idx) => {
        const cap        = capacities[u.id] ?? DEFAULT_CAPACITY
        const allUTasks  = getUserTasks(u, filteredTasks)
        const openTasks  = allUTasks.filter(t => t.status !== 'Completed')
        const overdueTasks = openTasks.filter(t => isOverdue(t.end_date, t.status))
        const dueThisWeek  = openTasks.filter(t => {
          if (!t.end_date || isOverdue(t.end_date, t.status)) return false
          const d = new Date(t.end_date)
          return d >= today && d <= nextWeek
        })

        const counts = STATUSES.reduce((acc, s) => {
          acc[s] = allUTasks.filter(t => t.status === s).length
          return acc
        }, {} as Record<Status, number>)

        // Project count
        const userProjects = new Set(openTasks.map(t => t.project_name).filter(Boolean))

        const load = getLoad(openTasks.length, cap, thresholds)

        return {
          ...u,
          name: u.full_name || u.email,
          idx,
          cap,
          allTasks: allUTasks,
          openTasks,
          overdueTasks,
          dueThisWeek,
          counts,
          projectCount: userProjects.size,
          load,
        }
      })
  }, [users, filteredTasks, capacities, thresholds, today, nextWeek, getUserTasks])

  // ── Global summary metrics ────────────────────────────────────────────────
  const summary = useMemo(() => {
    const open     = filteredTasks.filter(t => t.status !== 'Completed').length
    const overdue  = filteredTasks.filter(t => isOverdue(t.end_date, t.status)).length
    const dueWeek  = filteredTasks.filter(t => {
      if (!t.end_date || t.status === 'Completed' || isOverdue(t.end_date, t.status)) return false
      const d = new Date(t.end_date)
      return d >= today && d <= nextWeek
    }).length

    // Available capacity = sum of (cap - openTasks) for non-overloaded members
    const availCap = memberStats.reduce((sum, m) => {
      const slack = m.cap - m.openTasks.length
      return slack > 0 ? sum + slack : sum
    }, 0)

    const atRisk = memberStats.filter(m => m.load === 'overload' || m.load === 'heavy').length
    const overloaded = memberStats.filter(m => m.load === 'overload')

    return { open, overdue, dueWeek, availCap, atRisk, overloaded }
  }, [filteredTasks, memberStats, today, nextWeek])

  // ── Kanban: tasks filtered by selected member ──────────────────────────────
  const kanbanTasks = useMemo(() => {
    if (kanbanMember === 'all') return filteredTasks
    const member = memberStats.find(m => m.id === kanbanMember)
    return member ? member.allTasks : []
  }, [kanbanMember, filteredTasks, memberStats])

  // ── Save settings ─────────────────────────────────────────────────────────
  const saveSettings = () => {
    setCapacities(draftCaps)
    setThresholds(draftT)
    localStorage.setItem('workload-capacities', JSON.stringify(draftCaps))
    localStorage.setItem('workload-thresholds-v2', JSON.stringify(draftT))
    setShowSettings(false)
  }

  const openSettings = () => {
    setDraftCaps({ ...capacities })
    setDraftT({ ...thresholds })
    setShowSettings(true)
  }

  const adjustCap = (userId: string, delta: number) => {
    setDraftCaps(prev => ({
      ...prev,
      [userId]: Math.max(1, Math.min(30, (prev[userId] ?? DEFAULT_CAPACITY) + delta)),
    }))
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  // ── Render helpers ────────────────────────────────────────────────────────
  const LoadBadge = ({ load }: { load: keyof typeof LOAD_COLORS }) => (
    <div style={{
      fontSize: 10, fontWeight: 800, padding: '3px 8px',
      borderRadius: 999, whiteSpace: 'nowrap', textTransform: 'uppercase',
      background: LOAD_COLORS[load].bg, color: LOAD_COLORS[load].txt,
    }}>
      {load}
    </div>
  )

  const CapacityBar = ({ open, cap, load }: { open: number; cap: number; load: keyof typeof LOAD_COLORS }) => {
    const pct = Math.min((open / Math.max(cap, 1)) * 100, 115)
    const markerPct = 100
    return (
      <div style={{ padding: '6px 16px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--txt3)', marginBottom: 4 }}>
          <span>Capacity</span>
          <span style={{ color: LOAD_COLORS[load].txt, fontWeight: 700 }}>
            {open} / {cap} tasks{open > cap ? ' — overloaded' : open >= cap * (thresholds.heavy / 100) ? ' — heavy load' : open >= cap * (thresholds.moderate / 100) ? ' — moderate' : ' — available'}
          </span>
        </div>
        <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 99, overflow: 'visible', position: 'relative' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: LOAD_COLORS[load].bar, borderRadius: 99 }} />
          {/* Threshold marker at 100% = overload start */}
          <div style={{ position: 'absolute', top: -3, left: `${markerPct}%`, width: 1, height: 11, background: 'var(--brd2)', transform: 'translateX(-1px)' }} />
        </div>
      </div>
    )
  }

  if (loading) return <AppShell title="Workload Oversight">Loading bandwidth data...</AppShell>

  return (
    <AppShell title="Workload Oversight">

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} className="tv-btn" style={{ padding: 8, cursor: 'pointer' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Team Bandwidth</h2>
            <p style={{ color: 'var(--txt3)', fontSize: 13, marginTop: 2 }}>
              {memberStats.length} members · {projFilter === 'All' ? 'All projects' : projFilter}
            </p>
          </div>
        </div>
        <button className="tv-btn" onClick={openSettings} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Settings size={14} /> Capacity Settings
        </button>
      </div>

      {/* ALERT BANNER — only if someone is overloaded */}
      {summary.overloaded.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
          borderRadius: 8, background: 'var(--alert-error-bg)',
          border: '1px solid var(--alert-error-brd)', fontSize: 13,
          color: 'var(--alert-error-txt)', marginBottom: 16,
        }}>
          <AlertTriangle size={14} />
          <span>
            <strong>{summary.overloaded.map(m => m.name).join(', ')}</strong>
            {summary.overloaded.length === 1 ? ' is' : ' are'} overloaded
            {summary.overdue > 0 ? ` · ${summary.overdue} task${summary.overdue > 1 ? 's' : ''} overdue across the team` : ''}
          </span>
        </div>
      )}

      {/* SUMMARY STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Open tasks',        val: summary.open,    cls: '' },
          { label: 'Overdue',           val: summary.overdue, cls: 'red' },
          { label: 'Due this week',     val: summary.dueWeek, cls: 'amber' },
          { label: 'Free capacity',     val: `+${summary.availCap}`, cls: 'blue' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{card.label}</div>
            <div className={`stat-num ${card.cls}`} style={{ fontSize: 22 }}>{card.val}</div>
          </div>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Project filter */}
        <div className="filter-pill">
          <Filter size={13} color="var(--txt3)" />
          <select
            value={projFilter}
            onChange={e => setProjFilter(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--txt)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <option value="All">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        {/* View toggle */}
        <div className="view-toggle" style={{ marginLeft: 'auto' }}>
          <button className={`vb ${view === 'cards' ? 'on' : 'off'}`} onClick={() => setView('cards')}>
            <LayoutGrid size={13} /> Cards
          </button>
          <button className={`vb ${view === 'kanban' ? 'on' : 'off'}`} onClick={() => setView('kanban')}>
            <Columns size={13} /> Kanban
          </button>
        </div>
      </div>

      {/* ── CARDS VIEW ─────────────────────────────────────────────────────── */}
      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {memberStats.map(m => {
            const isOpen = expanded[m.id]
            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--bg)', border: `1px solid ${isOpen ? 'var(--brd2)' : 'var(--brd)'}`,
                  borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s',
                }}
              >
                {/* Card header */}
                <div
                  onClick={() => toggleExpand(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
                >
                  <Avatar name={m.name} idx={m.idx} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{m.role} · {m.projectCount} project{m.projectCount !== 1 ? 's' : ''}</div>
                  </div>
                  <LoadBadge load={m.load} />
                  <ChevronRight size={14} color="var(--txt3)" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
                </div>

                {/* Metric cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--brd)' }}>
                  {[
                    { label: 'Overdue',     val: m.overdueTasks.length,  cls: m.overdueTasks.length > 0 ? 'red' : '' },
                    { label: 'Due this wk', val: m.dueThisWeek.length,   cls: m.dueThisWeek.length > 0 ? 'amber' : '' },
                    { label: `Open / ${m.cap} cap`, val: m.openTasks.length, cls: '' },
                  ].map((cell, i) => (
                    <div key={i} style={{ padding: '8px 10px', textAlign: 'center', borderRight: i < 2 ? '1px solid var(--brd)' : 'none' }}>
                      <div className={`stat-num ${cell.cls}`} style={{ fontSize: 16 }}>{cell.val}</div>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 1 }}>{cell.label}</div>
                    </div>
                  ))}
                </div>

                {/* Capacity bar */}
                <CapacityBar open={m.openTasks.length} cap={m.cap} load={m.load} />

                {/* Expanded task list */}
                {isOpen && (
                  <>
                    {/* Overdue section */}
                    {m.overdueTasks.length > 0 && (
                      <>
                        <div className="section-label overdue" style={{ borderTop: '1px solid var(--brd)' }}>
                          Overdue <span className="section-badge">{m.overdueTasks.length}</span>
                        </div>
                        {m.overdueTasks.map(t => (
                          <div
                            key={t.id}
                            className="task-row overdue-row"
                            style={{ gridTemplateColumns: '8px 1fr auto auto', padding: '8px 14px', gap: 8 }}
                            onClick={() => router.push(`/tasks/${t.id}`)}
                          >
                            <span className="status-dot" style={{ background: STATUS_DOT[t.status] || '#aaa', width: 7, height: 7 }} />
                            <div className="task-name-cell" style={{ fontSize: 12 }}>{t.topic}</div>
                            {t.project_name && (
                              <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: 'var(--pill-ip-bg)', color: 'var(--pill-ip-txt)', whiteSpace: 'nowrap' }}>
                                {t.project_name}
                              </div>
                            )}
                            <div className="date-cell late" style={{ fontSize: 10 }}>
                              {daysLate(t.end_date)}d late
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Due this week section */}
                    {m.dueThisWeek.length > 0 && (
                      <>
                        <div className="section-label" style={{ borderTop: '1px solid var(--brd)', color: 'var(--stat-amber)' }}>
                          Due this week <span className="section-badge">{m.dueThisWeek.length}</span>
                        </div>
                        {m.dueThisWeek.map(t => (
                          <div
                            key={t.id}
                            className="task-row"
                            style={{ gridTemplateColumns: '8px 1fr auto auto', padding: '8px 14px', gap: 8 }}
                            onClick={() => router.push(`/tasks/${t.id}`)}
                          >
                            <span className="status-dot" style={{ background: STATUS_DOT[t.status] || '#aaa', width: 7, height: 7 }} />
                            <div className="task-name-cell" style={{ fontSize: 12 }}>{t.topic}</div>
                            {t.project_name && (
                              <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: 'var(--pill-ip-bg)', color: 'var(--pill-ip-txt)', whiteSpace: 'nowrap' }}>
                                {t.project_name}
                              </div>
                            )}
                            <div className="date-cell" style={{ fontSize: 10 }}>
                              {formatDate(t.end_date)}
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Other open tasks */}
                    {(() => {
                      const others = m.openTasks.filter(t =>
                        !isOverdue(t.end_date, t.status) &&
                        !(t.end_date && new Date(t.end_date) >= today && new Date(t.end_date) <= nextWeek)
                      )
                      return others.length > 0 ? (
                        <>
                          <div className="section-label" style={{ borderTop: '1px solid var(--brd)' }}>
                            Other open <span className="section-badge">{others.length}</span>
                          </div>
                          {others.map(t => (
                            <div
                              key={t.id}
                              className="task-row"
                              style={{ gridTemplateColumns: '8px 1fr auto auto', padding: '8px 14px', gap: 8 }}
                              onClick={() => router.push(`/tasks/${t.id}`)}
                            >
                              <span className="status-dot" style={{ background: STATUS_DOT[t.status] || '#aaa', width: 7, height: 7 }} />
                              <div className="task-name-cell" style={{ fontSize: 12 }}>{t.topic}</div>
                              {t.project_name && (
                                <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: 'var(--pill-ip-bg)', color: 'var(--pill-ip-txt)', whiteSpace: 'nowrap' }}>
                                  {t.project_name}
                                </div>
                              )}
                              {t.end_date && (
                                <div className="date-cell" style={{ fontSize: 10 }}>
                                  {formatDate(t.end_date)}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : null
                    })()}

                    {/* View all link */}
                    <div
                      onClick={() => router.push(`/all-tasks?assignee=${m.id}`)}
                      style={{ textAlign: 'center', fontSize: 11, color: 'var(--stat-blue)', padding: '8px', cursor: 'pointer', borderTop: '1px solid var(--brd)' }}
                    >
                      View all {m.allTasks.length} tasks ↗
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── KANBAN VIEW ────────────────────────────────────────────────────── */}
      {view === 'kanban' && (
        <div>
          {/* Member filter pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700 }}>Member:</span>
            <button
              onClick={() => setKanbanMember('all')}
              style={{
                padding: '4px 12px', borderRadius: 999, border: '1px solid var(--brd2)',
                background: kanbanMember === 'all' ? 'var(--nav-active-bg)' : 'transparent',
                color: kanbanMember === 'all' ? 'var(--nav-active-txt)' : 'var(--txt3)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              All members
            </button>
            {memberStats.map(m => (
              <button
                key={m.id}
                onClick={() => setKanbanMember(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 999, border: '1px solid var(--brd2)',
                  background: kanbanMember === m.id ? 'var(--nav-active-bg)' : 'transparent',
                  color: kanbanMember === m.id ? 'var(--nav-active-txt)' : 'var(--txt3)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: AVATAR_BG[m.idx % 6], color: AVATAR_CL[m.idx % 6],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 800,
                }}>
                  {ini(m.name)}
                </div>
                {m.name.split(' ')[0]}
              </button>
            ))}

            {/* Deep-link to All Tasks filtered to this member */}
            {kanbanMember !== 'all' && (
              <button
                onClick={() => router.push(`/all-tasks?assignee=${kanbanMember}`)}
                style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 999,
                  border: '1px solid var(--brd2)',
                  background: 'transparent', color: 'var(--stat-blue)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Open in All Tasks ↗
              </button>
            )}
          </div>

          {/* Kanban columns */}
          <div className="kanban-grid">
            {STATUSES.map(status => {
              const group = kanbanTasks.filter(t => t.status === status)
              return (
                <div key={status} className="k-col">
                  <div className="k-col-header">
                    <div className="k-col-title">
                      <span className="status-dot" style={{ background: STATUS_DOT[status], width: 8, height: 8 }} />
                      {status}
                    </div>
                    <span className="k-count">{group.length}</span>
                  </div>

                  {group.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '32px 0', opacity: 0.6 }}>
                      No tasks
                    </div>
                  ) : (
                    group.map(t => {
                      const over = isOverdue(t.end_date, t.status)
                      // Get assignees for this task
                      const assignees = (t.task_assignees || [])
                        .map((ta: any) => users.find(u => u.id === ta.user_id))
                        .filter(Boolean)

                      return (
                        <div
                          key={t.id}
                          className={`k-card${over ? ' k-overdue' : ''}`}
                          onClick={() => router.push(`/tasks/${t.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', marginBottom: 8, lineHeight: 1.4 }}>
                            {t.topic}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {t.project_name && (
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: 'var(--pill-ip-bg)', color: 'var(--pill-ip-txt)' }}>
                                {t.project_name}
                              </span>
                            )}
                            {/* Assignee avatars */}
                            <div style={{ display: 'flex', marginLeft: 'auto' }}>
                              {assignees.slice(0, 3).map((u: any, i: number) => (
                                <div
                                  key={u.id}
                                  title={u.full_name}
                                  style={{
                                    width: 18, height: 18, borderRadius: '50%',
                                    background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6],
                                    fontSize: 8, fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '2px solid var(--bg)', marginLeft: i > 0 ? -6 : 0,
                                  }}
                                >
                                  {ini(u.full_name)}
                                </div>
                              ))}
                            </div>
                            {t.end_date && (
                              <div className={`date-cell${over ? ' late' : ''}`} style={{ fontSize: 10, marginLeft: assignees.length > 0 ? 4 : 'auto' }}>
                                {over ? `${daysLate(t.end_date)}d late` : formatDate(t.end_date)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>

          {/* Capacity bars beneath kanban */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
            {memberStats.map(m => (
              <div key={m.id} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--txt3)', marginBottom: 4, fontWeight: 700 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Avatar name={m.name} idx={m.idx} size={16} />
                    {m.name.split(' ')[0]}
                  </span>
                  <span style={{ color: LOAD_COLORS[m.load].txt }}>{m.openTasks.length}/{m.cap}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min((m.openTasks.length / Math.max(m.cap, 1)) * 100, 100)}%`,
                    height: '100%', background: LOAD_COLORS[m.load].bar, borderRadius: 99,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CAPACITY SETTINGS MODAL ─────────────────────────────────────────── */}
      {showSettings && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{ width: 520, background: 'var(--bg)', border: '1px solid var(--brd2)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shd)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--brd)' }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Capacity Settings</div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal tabs */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', padding: 4, margin: '14px 20px 0', borderRadius: 8 }}>
              {(['individual', 'global'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSettingsTab(t)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: settingsTab === t ? 'var(--bg)' : 'transparent',
                    color: settingsTab === t ? 'var(--txt)' : 'var(--txt3)',
                  }}
                >
                  {t === 'individual' ? 'Per member' : 'Global thresholds'}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div style={{ padding: '14px 20px', maxHeight: 420, overflowY: 'auto' }}>

              {settingsTab === 'individual' && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 14 }}>
                    Set the maximum open tasks each member can handle. Their project count is shown for context.
                  </p>
                  {memberStats.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--brd)' }}>
                      <Avatar name={m.name} idx={m.idx} size={30} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{m.role} · {m.projectCount} project{m.projectCount !== 1 ? 's' : ''} assigned</div>
                      </div>
                      {/* Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--brd2)', borderRadius: 8, overflow: 'hidden' }}>
                          <button
                            onClick={() => adjustCap(m.id, -1)}
                            style={{ width: 30, height: 30, border: 'none', background: 'var(--bg2)', color: 'var(--txt)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={12} />
                          </button>
                          <div style={{ width: 36, textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--txt)', borderLeft: '1px solid var(--brd)', borderRight: '1px solid var(--brd)', padding: '4px 0' }}>
                            {draftCaps[m.id] ?? DEFAULT_CAPACITY}
                          </div>
                          <button
                            onClick={() => adjustCap(m.id, 1)}
                            style={{ width: 30, height: 30, border: 'none', background: 'var(--bg2)', color: 'var(--txt)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>tasks</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {settingsTab === 'global' && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 16 }}>
                    Thresholds are percentages of each person's individual capacity. E.g. if someone's cap is 10, moderate starts at {Math.round(draftT.moderate / 10)} tasks.
                  </p>
                  {[
                    { key: 'moderate' as const, label: 'Moderate starts at', color: 'var(--sl-mod)' },
                    { key: 'heavy'    as const, label: 'Heavy starts at',    color: 'var(--sl-heavy)' },
                    { key: 'overload' as const, label: 'Overload starts at', color: 'var(--sl-over)' },
                  ].map(row => (
                    <div key={row.key} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</label>
                        <span style={{ fontSize: 13, fontWeight: 800, color: row.color }}>{draftT[row.key]}%</span>
                      </div>
                      <input
                        type="range" min={10} max={150} step={5}
                        value={draftT[row.key]}
                        style={{ width: '100%', cursor: 'pointer', accentColor: row.color }}
                        onChange={e => setDraftT(prev => ({ ...prev, [row.key]: Number(e.target.value) }))}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--brd)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSettings}>Save settings</button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}