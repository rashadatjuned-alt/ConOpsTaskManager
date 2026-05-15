'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusPill'
import {
  Folder, LayoutGrid, Columns, Filter,
  ChevronRight, Edit3, X,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────
const PROJECT_STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const

const STATUS_DOT: Record<string, string> = {
  'Not Started': '#aaaaaa',
  'In Progress': '#378ADD',
  'On-Hold':     '#EF9F27',
  'Completed':   '#639922',
}

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

const PROJECT_COLORS = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#84CC16',
  '#EF4444', '#4D7C0F', '#B45309', '#0284C7', '#2DD4BF', '#EC4899',
]

// ── Helpers ───────────────────────────────────────────────────────────────
function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : (name || '?')[0].toUpperCase()
}

function PillStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Not Started': 'pill-ns',
    'In Progress': 'pill-ip',
    'On-Hold':     'pill-oh',
    'Completed':   'pill-c',
  }
  return <span className={`pill ${map[status] || 'pill-ns'}`}>{status}</span>
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AllProjects() {
  const router = useRouter()

  const [projects,       setProjects]       = useState<any[]>([])
  const [tasks,          setTasks]           = useState<any[]>([])
  const [allUsers,       setAllUsers]        = useState<any[]>([])
  const [loading,        setLoading]         = useState(true)
  const [view,           setView]            = useState<'grid' | 'list'>('grid')
  const [statusFilter,   setStatusFilter]    = useState('All')
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const [expandedProj,   setExpandedProj]   = useState<Record<string, boolean>>({})

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true)

      const [pRes, tRes, uRes, pmRes, taRes] = await Promise.all([
        supabase.from('Projects').select('*'),
        supabase.from('Tasks').select('*'),
        supabase.from('Users').select('id,full_name,role'),
        supabase.from('project_members').select('*'),
        supabase.from('task_assignees').select('*'),
      ])

      const fetchedUsers = uRes.data || []
      const globalTasks = tRes.data || []
      const pmRows      = pmRes.data || []
      const taRows      = taRes.data || []

      // Showing ALL projects without user filtering
      const allProjects = pRes.data || []

      const enriched = allProjects.map((proj: any, idx: number) => {
        const projTasks  = globalTasks.filter(
          (t: any) => t.project_id === proj.id || t.project_name === proj.name
        )
        const doneTasks  = projTasks.filter((t: any) => t.status === 'Completed').length
        const progress   = projTasks.length
          ? Math.round((doneTasks / projTasks.length) * 100)
          : 0

        const startDates = projTasks
          .map((t: any) => t.start_date)
          .filter(Boolean)
          .map(d => new Date(d))

        const endDates = projTasks
          .map((t: any) => t.end_date)
          .filter(Boolean)
          .map(d => new Date(d))

        const earliestStart = startDates.length
          ? new Date(Math.min(...startDates.map(date => date.getTime())))
          : null

        const latestEnd = endDates.length
          ? new Date(Math.max(...endDates.map(date => date.getTime())))
          : null

        const rosterIds     = pmRows.filter((r: any) => r.project_id === proj.id).map((r: any) => r.user_id)
        const activeMembers = fetchedUsers.filter((u: any) => rosterIds.includes(u.id))

        const computedStatus = projTasks.length === 0
          ? 'Not Started'
          : projTasks.every((t: any) => t.status === 'Not Started')
            ? 'Not Started'
            : projTasks.every((t: any) => t.status === 'On-Hold')
              ? 'On-Hold'
              : projTasks.every((t: any) => t.status === 'Completed')
                ? 'Completed'
                : 'In Progress'

        return {
          ...proj,
          taskCount:     projTasks.length,
          doneCount:     doneTasks,
          progress,
          activeMembers,
          projectColor:  proj.color_code || PROJECT_COLORS[idx % PROJECT_COLORS.length],
          startDate:     earliestStart ? earliestStart.toISOString().split('T')[0] : null,
          endDate:       latestEnd     ? latestEnd.toISOString().split('T')[0]     : null,
          status: computedStatus,
        }
      })

      const enrichedTasks = globalTasks.map((task: any) => ({
        ...task,
        task_assignees: taRows.filter((ta: any) => ta.task_id === task.id),
      }))

      setProjects(enriched)
      setTasks(enrichedTasks)
      setAllUsers(fetchedUsers)
    } catch (err) {
      console.error('Error loading All Projects:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Filtered projects ─────────────────────────────────────────────────────
  const filtered = statusFilter === 'All'
    ? projects
    : projects.filter(p => (p.status || 'Not Started') === statusFilter)

  // ── Avatar stack ──────────────────────────────────────────────────────────
  const AvatarStack = ({ members, size = 26 }: { members: any[]; size?: number }) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {members.slice(0, 4).map((u: any, i: number) => (
        <div
          key={u.id}
          title={u.full_name}
          style={{
            width: size, height: size, borderRadius: '50%',
            background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, fontWeight: 900,
            border: '2px solid var(--bg)',
            marginLeft: i > 0 ? -size * 0.3 : 0,
            zIndex: 10 - i, flexShrink: 0,
          }}
        >
          {ini(u.full_name)}
        </div>
      ))}
      {members.length > 4 && (
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: 'var(--bg2)', color: 'var(--txt2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35, fontWeight: 800,
          border: '2px solid var(--bg)', marginLeft: -size * 0.3,
        }}>
          +{members.length - 4}
        </div>
      )}
    </div>
  )

  // ── Grid card ─────────────────────────────────────────────────────────────
  const GridCard = ({ proj }: { proj: any }) => (
    <div
      className="proj-card"
      onClick={() => setSelectedProject(proj)}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          className="proj-color-dot"
          style={{ background: proj.projectColor, width: 12, height: 12, borderRadius: 3 }}
        />
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {proj.name}
        </div>
        <PillStatus status={proj.status || 'Not Started'} />
      </div>

      {proj.description && (
        <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {proj.description}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--txt3)', marginBottom: 12 }}>
        <div>
          <span style={{ fontWeight: 600 }}>Start</span><br />
          {proj.startDate || '—'}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 600 }}>End</span><br />
          {proj.endDate || '—'}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--txt3)', marginBottom: 5 }}>
        <span>{proj.doneCount} / {proj.taskCount} tasks</span>
        <span style={{ fontWeight: 700, color: proj.projectColor }}>{proj.progress}%</span>
      </div>
      <div className="prog-bar" style={{ marginBottom: 12 }}>
        <div className="prog-fill" style={{ width: `${proj.progress}%`, background: proj.projectColor }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AvatarStack members={proj.activeMembers} size={22} />
        {proj.endDate && (
          <span style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            📅 {proj.endDate}
          </span>
        )}
      </div>
    </div>
  )

  // ── List row ──────────────────────────────────────────────────────────────
  const ListRow = ({ proj }: { proj: any }) => {
    const open     = expandedProj[proj.id]
    const projTasks = tasks.filter(
      t => t.project_id === proj.id || t.project_name === proj.name
    )

    return (
      <div className="task-table" style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '20px 14px 1fr 120px 100px 90px 80px',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            cursor: 'pointer',
            background: 'var(--bg2)',
          }}
          onClick={() => setExpandedProj(prev => ({ ...prev, [proj.id]: !prev[proj.id] }))}
        >
          <ChevronRight
            size={14}
            style={{ color: 'var(--txt3)', transform: open ? 'rotate(90deg)' : '', transition: 'transform .2s' }}
          />
          <div
            style={{ width: 10, height: 10, borderRadius: 3, background: proj.projectColor, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{proj.name}</span>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
            {proj.startDate || '—'} – {proj.endDate || '—'}
          </span>
          <div>
            <div className="prog-bar" style={{ marginBottom: 3 }}>
              <div className="prog-fill" style={{ width: `${proj.progress}%`, background: proj.projectColor }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{proj.progress}%</span>
          </div>
          <AvatarStack members={proj.activeMembers} size={20} />
          <PillStatus status={proj.status || 'Not Started'} />
        </div>

        {open && projTasks.map((t: any) => (
          <div
            key={t.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '20px 14px 1fr 120px 100px 90px 80px',
              alignItems: 'center',
              gap: 10,
              padding: '9px 16px',
              borderTop: '1px solid var(--brd)',
              cursor: 'pointer',
              background: 'var(--bg)',
              transition: 'background .15s',
            }}
            onClick={() => router.push(`/tasks/${t.id}`)}
          >
            <span />
            <span
              className="status-dot"
              style={{
                background: STATUS_DOT[t.status] || '#aaa',
                width: 8, height: 8,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.topic}
            </span>
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{t.end_date || '—'}</span>
            <span />
            <div>
              {t.owner
                ? <div className="av-sm av-1" style={{ fontSize: 9, fontWeight: 800 }}>
                    {t.owner.slice(0, 2).toUpperCase()}
                  </div>
                : <span style={{ fontSize: 11, color: 'var(--txt3)' }}>—</span>
              }
            </div>
            <PillStatus status={t.status} />
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <AppShell title="Global Portfolio">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', fontSize: 13, fontWeight: 600 }}>
          Loading organizational projects...
        </div>
      </AppShell>
    )
  }

  const isEmpty = filtered.length === 0

  return (
    <AppShell title="Global Portfolio">

      {/* ── KPI SECTION ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: 16, 
        marginBottom: 28 
      }}>
        {[
          { label: 'Total Projects', count: projects.length, color: 'var(--txt)' },
          { label: 'Not Started', count: projects.filter(p => !p.status || p.status === 'Not Started').length, color: 'var(--txt2)' },
          { label: 'In Progress', count: projects.filter(p => p.status === 'In Progress').length, color: '#378ADD' },
          { label: 'On-Hold', count: projects.filter(p => p.status === 'On-Hold').length, color: '#EF9F27' },
          { label: 'Completed', count: projects.filter(p => p.status === 'Completed').length, color: '#639922' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--bg)', 
            border: '1px solid var(--brd)', 
            borderRadius: 12, 
            padding: '18px 20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 8
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--txt3)' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>
              {kpi.count}
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="view-toggle" style={{ background: 'var(--bg2)', padding: 3, borderRadius: 8 }}>
          <button className={`vb ${view === 'grid' ? 'on' : 'off'}`} onClick={() => setView('grid')}>
            <LayoutGrid size={14} /> Grid
          </button>
          <button className={`vb ${view === 'list' ? 'on' : 'off'}`} onClick={() => setView('list')}>
            <Columns size={14} /> List
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <div className="filter-pill">
            <Filter size={13} color="var(--txt3)" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600 }}>
              <option value="All">All Status</option>
              {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <span style={{ fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isEmpty && (
        <div className="empty-state">
          <Folder size={32} color="var(--txt3)" />
          <div style={{ marginTop: 8, fontWeight: 600 }}>No projects found</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--txt3)' }}>
            There are no projects in the organizational registry yet.
          </div>
        </div>
      )}

      {/* ── GRID VIEW ── (Auto-fits perfectly on big & small screens) */}
      {!isEmpty && view === 'grid' && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
          gap: 20,
          width: '100%' 
        }}>
          {filtered.map(proj => <GridCard key={proj.id} proj={proj} />)}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!isEmpty && view === 'list' && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '20px 14px 1fr 120px 100px 90px 80px',
            gap: 10, padding: '6px 16px 8px',
            marginBottom: 4,
          }}>
            <div /><div />
            <div className="col-header">Project / Task</div>
            <div className="col-header">Timeline</div>
            <div className="col-header">Progress</div>
            <div className="col-header">Members</div>
            <div className="col-header">Status</div>
          </div>
          {filtered.map(proj => <ListRow key={proj.id} proj={proj} />)}
        </>
      )}

      {/* ── PROJECT DETAIL MODAL ── */}
      {selectedProject && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setSelectedProject(null)}
        >
          <div
            style={{
              background: 'var(--bg)',
              width: '100%', maxWidth: 800, maxHeight: '90vh',
              borderRadius: 16, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--brd)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              padding: '24px 28px',
              borderBottom: '1px solid var(--brd)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              background: 'var(--bg2)',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: selectedProject.projectColor }} />
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)', margin: 0 }}>
                    {selectedProject.name}
                  </h2>
                  <PillStatus status={selectedProject.status || 'Not Started'} />
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt3)', margin: 0, maxWidth: 500 }}>
                  {selectedProject.description || 'No description provided.'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => router.push(`/projects/${selectedProject.id}`)}
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--brd)',
                    width: 34, height: 34, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--txt2)',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  {
                    label: 'Overall Progress',
                    value: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="prog-bar" style={{ flex: 1 }}>
                          <div className="prog-fill" style={{ width: `${selectedProject.progress}%`, background: selectedProject.projectColor }} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>
                          {selectedProject.progress}%
                        </span>
                      </div>
                    ),
                  },
                  {
                    label: 'Scope Status',
                    value: <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>{selectedProject.doneCount} / {selectedProject.taskCount} Tasks</span>,
                  },
                  {
                    label: 'Resources',
                    value: <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>{Array.isArray(selectedProject.resources) ? selectedProject.resources.length : 0} Linked</span>,
                  },
                ].map(({ label, value }) => (
                  <div key={label} style={{ border: '1px solid var(--brd)', padding: 14, borderRadius: 10, background: 'var(--bg)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>
                      {label}
                    </div>
                    {value}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>
                  Team Members
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedProject.activeMembers.map((u: any, i: number) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 900,
                      }}>
                        {ini(u.full_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{u.full_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{u.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>
                  Task Scope
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tasks
                    .filter(t => t.project_id === selectedProject.id || t.project_name === selectedProject.name)
                    .map((task: any) => {
                      const assignees = (task.task_assignees || [])
                        .map((ta: any) => allUsers.find((u: any) => u.id === ta.user_id))
                        .filter(Boolean)
                      return (
                        <div
                          key={task.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', background: 'var(--bg2)',
                            borderRadius: 8, border: '1px solid var(--brd)',
                            cursor: 'pointer',
                          }}
                          onClick={() => { setSelectedProject(null); router.push(`/tasks/${task.id}`) }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <StatusDot status={task.status} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{task.topic}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {assignees.map((u: any, idx: number) => (
                                <div
                                  key={u.id}
                                  style={{
                                    width: 20, height: 20, borderRadius: '50%',
                                    background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6],
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 8, fontWeight: 900,
                                  }}
                                >
                                  {ini(u.full_name)}
                                </div>
                              ))}
                            </div>
                            <PillStatus status={task.status} />
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}