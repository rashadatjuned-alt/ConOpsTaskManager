'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Filter, LayoutList, Columns, AlertTriangle, Calendar, ChevronRight, CheckSquare, Layers } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Status = 'Not Started' | 'In Progress' | 'On-Hold' | 'Completed'

interface Task {
  id: string
  topic: string
  description?: string
  status: Status
  start_date?: string
  end_date?: string
  project_name?: string
  project_id?: string
  type?: string
  tags?: string[]
}

interface Subtask {
  id: string
  parent_task_id: string
  topic: string
  status: Status
  start_date?: string
  end_date?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  'Not Started': '#aaaaaa',
  'In Progress': '#378ADD',
  'On-Hold':     '#EF9F27',
  'Completed':   '#639922',
}

const PROJECT_COLORS: Record<string, string> = {}

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function projectColor(name?: string, colorMap?: Record<string, string>) {
  if (!name) return '#aaaaaa'
  return (colorMap || {})[name] || '#7E8E5D'
}

function ini(name?: string) {
  if (!name) return '?'
  const p = name.trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase()
}

const getPillClass = (status: string) => {
  if (status === 'In Progress') return 'pill-ip'
  if (status === 'On-Hold')     return 'pill-oh'
  if (status === 'Completed')   return 'pill-c'
  return 'pill-ns'
}

function PillRecurring({ type }: { type?: string }) {
  if (!type || type === 'One-time') return null
  return <span className="pill pill-rc">↻ {type}</span>
}

function isOverdue(dateStr?: string, status?: string) {
  if (!dateStr || status === 'Completed') return false
  const e = new Date(dateStr); e.setHours(0, 0, 0, 0)
  const t = new Date();        t.setHours(0, 0, 0, 0)
  return e < t
}

// ── Component ─────────────────────────────────────────────────────────────────
function AllTasksInner() {
  const router = useRouter()

  const [tasks,            setTasks]            = useState<Task[]>([])
  const [subtasks,         setSubtasks]         = useState<Subtask[]>([])
  const [taskAssignees,    setTaskAssignees]    = useState<any[]>([])
  const [subtaskAssignees, setSubtaskAssignees]  = useState<any[]>([])
  const [allUsers,         setAllUsers]         = useState<any[]>([])
  const [projColorMap,     setProjColorMap]     = useState<Record<string, string>>({})
  const [loading,          setLoading]          = useState(true)

  const [scopeTab,     setScopeTab]     = useState<'Tasks' | 'Subtasks'>('Tasks')
  const [view,         setView]         = useState<'list' | 'kanban'>('list')
  const [statusFilter, setStatusFilter] = useState('All')
  const [projFilter,   setProjFilter]   = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({})
  const searchParams = useSearchParams()

  useEffect(() => {
  const a = searchParams.get('assignee')
  const p = searchParams.get('project')
  if (a) setAssigneeFilter(a)
  if (p) setProjFilter(p)
      }, [searchParams])

  const loadData = useCallback(async () => {
    const [tRes, sRes, taRes, saRes, uRes, pRes] = await Promise.all([
      supabase.from('Tasks').select('*').order('end_date'),
      supabase.from('Subtasks').select('*'),
      supabase.from('task_assignees').select('*'),
      supabase.from('subtask_assignees').select('*'),
      supabase.from('Users').select('id, full_name'),
      supabase.from('Projects').select('name, color_code'),
    ])

    setTasks(tRes.data || [])
    setSubtasks(sRes.data || [])
    setTaskAssignees(taRes.data || [])
    setSubtaskAssignees(saRes.data || [])
    setAllUsers(uRes.data || [])

    // Build project-name → color_code map for dots
    const colorMap: Record<string, string> = {}
    ;(pRes.data || []).forEach((p: any) => { if (p.name && p.color_code) colorMap[p.name] = p.color_code })
    setProjColorMap(colorMap)

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Status handlers ────────────────────────────────────────────────────────
  const handleTaskStatus = async (task: Task, newStatus: string) => {
    if (newStatus === 'Completed') {
      const children = subtasks.filter(s => String(s.parent_task_id) === String(task.id))
      if (children.some(s => s.status !== 'Completed')) {
        alert('All subtasks must be "Completed" before completing the main task.')
        return
      }
    }
    setTasks(prev => prev.map(t => String(t.id) === String(task.id) ? { ...t, status: newStatus as Status } : t))
    await supabase.from('Tasks').update({ status: newStatus }).eq('id', task.id)
  }

  const handleSubStatus = async (subtask: Subtask, newStatus: string) => {
    setSubtasks(prev => prev.map(s => String(s.id) === String(subtask.id) ? { ...s, status: newStatus as Status } : s))
    await supabase.from('Subtasks').update({ status: newStatus }).eq('id', subtask.id)
  }

  // ── Drag & drop (kanban) ───────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, itemId: string, isTask: boolean) => {
    e.dataTransfer.setData('itemId', itemId)
    e.dataTransfer.setData('isTask', isTask.toString())
  }
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = async (e: React.DragEvent, newStatus: Status) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('itemId')
    const isTask = e.dataTransfer.getData('isTask') === 'true'
    if (!itemId) return
    if (isTask) {
      const task = tasks.find(t => String(t.id) === itemId)
      if (task) await handleTaskStatus(task, newStatus)
    } else {
      const sub = subtasks.find(s => String(s.id) === itemId)
      if (sub) await handleSubStatus(sub, newStatus)
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const baseArray: any[] = useMemo(() => {
    let arr: any[] = scopeTab === 'Tasks' ? tasks : subtasks

    if (statusFilter !== 'All') arr = arr.filter(i => i.status === statusFilter)

    if (projFilter !== 'All') {
      arr = arr.filter(i => {
        if (scopeTab === 'Tasks') return i.project_name === projFilter
        const parent = tasks.find(t => String(t.id) === String(i.parent_task_id))
        return parent?.project_name === projFilter
      })
    }

    if (assigneeFilter !== 'All') {
      arr = arr.filter(i => {
        if (scopeTab === 'Tasks') {
          return taskAssignees.some(ta => String(ta.task_id) === String(i.id) && ta.user_id === assigneeFilter)
        }
        return subtaskAssignees.some(sa => String(sa.subtask_id) === String(i.id) && sa.user_id === assigneeFilter)
      })
    }

    return arr
  }, [tasks, subtasks, scopeTab, statusFilter, projFilter, assigneeFilter, taskAssignees, subtaskAssignees])

  const overdueItems   = useMemo(() => baseArray.filter(i => isOverdue(i.end_date, i.status)), [baseArray])
  const activeItems    = useMemo(() => baseArray.filter(i => !isOverdue(i.end_date, i.status) && i.status !== 'Completed'), [baseArray])
  const completedItems = useMemo(() => baseArray.filter(i => i.status === 'Completed'), [baseArray])

  const projectsForFilter = useMemo(() => [...new Set(tasks.map(t => t.project_name).filter(Boolean))] as string[], [tasks])

  // ── Interactive pill ───────────────────────────────────────────────────────
  const InteractivePill = ({ status, onChange }: { status: string; onChange: (v: string) => void }) => (
    <select
      className={`pill ${getPillClass(status)}`}
      style={{
        appearance: 'none', border: 'none', outline: 'none',
        cursor: 'pointer', textAlign: 'center', paddingRight: 14,
        backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '6px',
      }}
      value={status}
      onChange={e => { e.stopPropagation(); onChange(e.target.value) }}
      onClick={e => e.stopPropagation()}
    >
      {['Not Started', 'In Progress', 'On-Hold', 'Completed'].map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )

  // ── Grid columns — identical to My Tasks ──────────────────────────────────
  const COL = scopeTab === 'Tasks'
    ? '18px 24px 1fr 110px 130px 90px 110px 28px'
    : '24px 1fr 1fr 110px 130px 110px'

  // ── Task row ──────────────────────────────────────────────────────────────
  const TaskRow = ({ task, isOver = false, dim = false }: { task: Task; isOver?: boolean; dim?: boolean }) => {
    const subs      = subtasks.filter(s => String(s.parent_task_id) === String(task.id))
    const hasSubs   = subs.length > 0
    const open      = expanded[task.id]
    const doneSubs  = subs.filter(s => s.status === 'Completed').length
    const assignees = taskAssignees.filter(ta => String(ta.task_id) === String(task.id))
      .map(ta => allUsers.find(u => String(u.id) === String(ta.user_id))).filter(Boolean)

    return (
      <>
        <div
          className={`task-row${isOver ? ' overdue-row' : ''}${dim ? ' dim' : ''}`}
          style={{ gridTemplateColumns: COL }}
          onClick={() => router.push(`/tasks/${task.id}`)}
        >
          {hasSubs
            ? <ChevronRight size={13} className={`chev${open ? ' open' : ''}`}
                onClick={e => { e.stopPropagation(); setExpanded(p => ({ ...p, [task.id]: !p[task.id] })) }} />
            : <span style={{ width: 18 }} />
          }
          <span className="status-dot" style={{ background: STATUS_DOT[task.status] || '#aaa', width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
          <div className="task-name-cell">
            {task.topic} {task.type && task.type !== 'One-time' && <PillRecurring type={task.type} />}
          </div>
          <div className={`date-cell${isOver ? ' late' : ''}`}><Calendar size={11} /> {task.end_date || '—'}</div>
          <div className="proj-cell">
            <span className="proj-dot" style={{ background: projectColor(task.project_name, projColorMap) }} />
            {task.project_name || '—'}
          </div>
          <div style={{ display: 'flex' }}>
            {assignees.slice(0, 3).map((u: any, i: number) => (
              <div key={u.id} className="av-sm"
                style={{ fontSize: 9, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], marginLeft: i > 0 ? '-6px' : 0, border: '2px solid var(--bg)' }}
                title={u.full_name}>{ini(u.full_name)}</div>
            ))}
            {assignees.length === 0 && <span style={{ fontSize: 11, color: 'var(--txt3)' }}>—</span>}
          </div>
          <InteractivePill status={task.status} onChange={v => handleTaskStatus(task, v)} />
          {hasSubs ? <span className="sub-count">{doneSubs}/{subs.length}</span> : <span />}
        </div>

        {hasSubs && open && subs.map(s => {
          const subAssignees = subtaskAssignees.filter(sa => String(sa.subtask_id) === String(s.id))
            .map(sa => allUsers.find(u => String(u.id) === String(sa.user_id))).filter(Boolean)
          return (
            <div key={s.id} className="subtask-row" style={{ gridTemplateColumns: COL }}
              onClick={() => router.push(`/tasks/${task.id}`)}>
              <span />
              <span className="status-dot" style={{ background: STATUS_DOT[s.status] || '#aaa', width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
              <div className="sub-name-cell">{s.topic}</div>
              <div className={`date-cell${isOverdue(s.end_date, s.status) ? ' late' : ''}`}>
                {s.end_date ? <><Calendar size={10} /> {s.end_date}</> : '—'}
              </div>
              <div className="proj-cell">
                <span className="proj-dot" style={{ background: projectColor(task.project_name, projColorMap) }} />
                {task.project_name || '—'}
              </div>
              <div style={{ display: 'flex' }}>
                {subAssignees.slice(0, 3).map((u: any, i: number) => (
                  <div key={u.id} className="av-sm"
                    style={{ fontSize: 9, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], marginLeft: i > 0 ? '-6px' : 0, border: '2px solid var(--bg)' }}
                    title={u.full_name}>{ini(u.full_name)}</div>
                ))}
              </div>
              <InteractivePill status={s.status} onChange={v => handleSubStatus(s, v)} />
              <span />
            </div>
          )
        })}
      </>
    )
  }

  // ── Subtask row ───────────────────────────────────────────────────────────
  const SubtaskRow = ({ subtask, isOver = false, dim = false }: { subtask: Subtask; isOver?: boolean; dim?: boolean }) => {
    const parentTask = tasks.find(t => String(t.id) === String(subtask.parent_task_id))
    return (
      <div
        className={`task-row${isOver ? ' overdue-row' : ''}${dim ? ' dim' : ''}`}
        style={{ gridTemplateColumns: COL }}
        onClick={() => parentTask && router.push(`/tasks/${parentTask.id}`)}
      >
        <span className="status-dot" style={{ background: STATUS_DOT[subtask.status] || '#aaa', borderRadius: 2, width: 9, height: 9, display: 'inline-block' }} />
        <div className="task-name-cell" style={{ fontWeight: 600 }}>{subtask.topic}</div>
        <div className="task-name-cell" style={{ color: 'var(--txt3)', fontSize: 12, fontWeight: 500 }}>
          {parentTask ? parentTask.topic : '—'}
        </div>
        <div className={`date-cell${isOver ? ' late' : ''}`}><Calendar size={11} /> {subtask.end_date || '—'}</div>
        <div className="proj-cell">
          <span className="proj-dot" style={{ background: projectColor(parentTask?.project_name, projColorMap) }} />
          {parentTask?.project_name || '—'}
        </div>
        <InteractivePill status={subtask.status} onChange={v => handleSubStatus(subtask, v)} />
      </div>
    )
  }

  // ── Kanban card ───────────────────────────────────────────────────────────
  const KanbanCard = ({ item }: { item: any }) => {
    const isTask     = scopeTab === 'Tasks'
    const parentTask = !isTask ? tasks.find(t => String(t.id) === String(item.parent_task_id)) : null
    const projName   = isTask ? item.project_name : parentTask?.project_name
    const over       = isOverdue(item.end_date, item.status)
    const subs       = isTask ? subtasks.filter(s => String(s.parent_task_id) === String(item.id)) : []
    const doneSubs   = subs.filter(s => s.status === 'Completed').length

    return (
      <div
        className={`k-card${over ? ' k-overdue' : ''}${item.status === 'Completed' ? ' dim' : ''}`}
        draggable
        onDragStart={e => handleDragStart(e, item.id, isTask)}
        onClick={() => router.push(`/tasks/${isTask ? item.id : item.parent_task_id}`)}
      >
        <div className="k-proj">
          <span className="proj-dot" style={{ background: projectColor(projName, projColorMap) }} />
          {projName || '—'}
          {isTask && item.type && item.type !== 'One-time' && <span className="pill pill-rc" style={{ marginLeft: 4 }}>↻ {item.type}</span>}
        </div>
        <div className="k-name">{item.topic}</div>
        {!isTask && <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 8, marginTop: -4 }}>Under: {parentTask?.topic}</div>}
        {isTask && subs.length > 0 && (
          <>
            <div className="prog-bar" style={{ height: 4, marginBottom: 3 }}>
              <div className="prog-fill" style={{ width: `${subs.length ? Math.round((doneSubs / subs.length) * 100) : 0}%`, height: 4, background: projectColor(projName, projColorMap) }} />
            </div>
            <div className="prog-lbl">{doneSubs} / {subs.length} subtasks</div>
          </>
        )}
        <div className="k-meta" style={{ marginTop: 10 }}>
          <span className={`k-date${over ? ' late' : ''}`}>
            {over && <AlertTriangle size={10} style={{ marginRight: 3 }} />}
            {item.end_date || '—'}
          </span>
        </div>
      </div>
    )
  }

  if (loading) return <AppShell title="Global Tasks"><div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading...</div></AppShell>

  return (
    <AppShell title="Global Task">

      {/* ── Toolbar — identical layout to My Tasks ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* Scope toggle */}
        <div className="view-toggle" style={{ background: 'var(--bg2)', padding: 3, borderRadius: 8 }}>
          <button className={`vb ${scopeTab === 'Tasks' ? 'on' : 'off'}`} onClick={() => setScopeTab('Tasks')}>
            <Layers size={14} /> Tasks
          </button>
          <button className={`vb ${scopeTab === 'Subtasks' ? 'on' : 'off'}`} onClick={() => setScopeTab('Subtasks')}>
            <CheckSquare size={14} /> Subtasks
          </button>
        </div>

        {/* View toggle */}
        <div className="view-toggle" style={{ background: 'var(--bg2)', padding: 3, borderRadius: 8 }}>
          <button className={`vb ${view === 'list' ? 'on' : 'off'}`} onClick={() => setView('list')}>
            <LayoutList size={14} /> List
          </button>
          <button className={`vb ${view === 'kanban' ? 'on' : 'off'}`} onClick={() => setView('kanban')}>
            <Columns size={14} /> Kanban
          </button>
        </div>

        {/* Filters — right aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="filter-pill">
            <Filter size={13} color="var(--txt3)" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--txt)' }}>
              <option value="All">All Status</option>
              {['Not Started', 'In Progress', 'On-Hold', 'Completed'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-pill">
            <Filter size={13} color="var(--txt3)" />
            <select value={projFilter} onChange={e => setProjFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--txt)' }}>
              <option value="All">All Projects</option>
              {projectsForFilter.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="filter-pill">
            <Filter size={13} color="var(--txt3)" />
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--txt)' }}>
              <option value="All">All Assignees</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <span className="count-lbl" style={{ fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
            {baseArray.length} {scopeTab === 'Tasks' ? 'task' : 'subtask'}{baseArray.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Empty state ── */}
      {baseArray.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>☑</div>
          <div style={{ marginTop: 8 }}>No {scopeTab.toLowerCase()} match your filters.</div>
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && baseArray.length > 0 && (
        <div className="task-table">
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: COL, alignItems: 'center', gap: 10, padding: '6px 14px 8px', borderBottom: '1px solid var(--brd)' }}>
            {scopeTab === 'Tasks' ? (
              <>
                <div /><div />
                <div className="col-header">Task</div>
                <div className="col-header">Due date</div>
                <div className="col-header">Project</div>
                <div className="col-header">Assigned</div>
                <div className="col-header">Status</div>
                <div />
              </>
            ) : (
              <>
                <div />
                <div className="col-header">Subtask</div>
                <div className="col-header">Parent task</div>
                <div className="col-header">Due date</div>
                <div className="col-header">Project</div>
                <div className="col-header">Status</div>
              </>
            )}
          </div>

          {overdueItems.length > 0 && (
            <>
              <div className="section-label overdue">
                <AlertTriangle size={12} /> Overdue <span className="section-badge">{overdueItems.length}</span>
              </div>
              {overdueItems.map((item: any) =>
                scopeTab === 'Tasks'
                  ? <TaskRow key={item.id} task={item} isOver />
                  : <SubtaskRow key={item.id} subtask={item} isOver />
              )}
            </>
          )}

          {activeItems.length > 0 && (
            <>
              <div className="section-label">Active <span className="section-badge">{activeItems.length}</span></div>
              {activeItems.map((item: any) =>
                scopeTab === 'Tasks'
                  ? <TaskRow key={item.id} task={item} />
                  : <SubtaskRow key={item.id} subtask={item} />
              )}
            </>
          )}

          {completedItems.length > 0 && (
            <>
              <div className="section-label completed">Completed <span className="section-badge">{completedItems.length}</span></div>
              {completedItems.map((item: any) =>
                scopeTab === 'Tasks'
                  ? <TaskRow key={item.id} task={item} dim />
                  : <SubtaskRow key={item.id} subtask={item} dim />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Kanban view ── */}
      {view === 'kanban' && baseArray.length > 0 && (
        <div className="kanban-grid">
          {(['Not Started', 'In Progress', 'On-Hold', 'Completed'] as Status[]).map(status => {
            const group = baseArray.filter(t => t.status === status)
            return (
              <div key={status} className="k-col"
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, status)}>
                <div className="k-col-header">
                  <div className="k-col-title">
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_DOT[status], display: 'inline-block', flexShrink: 0 }} />
                    {status}
                  </div>
                  <span className="k-count">{group.length}</span>
                </div>
                {group.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '40px 0' }}>Drop cards here</div>
                  : group.map(item => <KanbanCard key={item.id} item={item} />)
                }
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

export default function AllTasks() {
  return (
    <Suspense fallback={null}>
      <AllTasksInner />
    </Suspense>
  )
}
