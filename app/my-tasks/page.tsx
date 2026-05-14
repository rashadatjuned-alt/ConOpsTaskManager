'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Filter, LayoutList, Columns, AlertTriangle, Calendar, ChevronRight, CheckSquare, Layers } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  'Not Started': '#aaaaaa',
  'In Progress': '#378ADD',
  'On-Hold':     '#EF9F27',
  'Completed':   '#639922',
}

const PROJECT_COLORS: Record<string, string> = {
  'Aurora Build':      '#3B82F6',
  'FY26 Audits':       '#8B5CF6',
  'Vendor Compliance': '#F59E0B',
  'Atlas Reporting':   '#0284C7',
}

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function projectColor(name?: string) {
  if (!name) return '#aaaaaa'
  return PROJECT_COLORS[name] || '#7E8E5D'
}

function ini(name?: string) {
  if (!name) return '?'
  const p = name.trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase()
}

const getPillClass = (status: string) => {
  if (status === 'In Progress') return 'pill-ip'
  if (status === 'On-Hold') return 'pill-oh'
  if (status === 'Completed') return 'pill-c'
  return 'pill-ns'
}

function PillRecurring({ type }: { type?: string }) {
  if (!type || type === 'One-time') return null
  return <span className="pill pill-rc">↻ {type}</span>
}

function isOverdue(dateStr?: string, status?: string) {
  if (!dateStr || status === 'Completed') return false
  const e = new Date(dateStr); e.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return e < t
}

function nextRecurrence(start: string, end: string, type: string) {
  const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 864e5)
  const d = new Date(start)
  if (type === 'Weekly') d.setDate(d.getDate() + 7)
  else if (type === 'Monthly') d.setMonth(d.getMonth() + 1)
  else if (type === 'Quarterly') d.setMonth(d.getMonth() + 3)
  else if (type === 'Semi-annually') d.setMonth(d.getMonth() + 6)
  else if (type === 'Annually') d.setFullYear(d.getFullYear() + 1)
  const newStart = d.toISOString().split('T')[0]
  const newEnd = new Date(d.getTime() + duration * 864e5).toISOString().split('T')[0]
  return { start: newStart, end: newEnd }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MyTasks() {
  const router = useRouter()

  const [tasks,            setTasks]            = useState<Task[]>([])
  const [subtasks,         setSubtasks]         = useState<Subtask[]>([])
  const [taskAssignees,    setTaskAssignees]    = useState<any[]>([])
  const [subtaskAssignees, setSubtaskAssignees] = useState<any[]>([])
  const [allUsers,         setAllUsers]         = useState<any[]>([])
  const [me,               setMe]               = useState<any>(null)
  const [loading,          setLoading]          = useState(true)

  const [scopeTab,     setScopeTab]     = useState<'Tasks' | 'Subtasks'>('Tasks')
  const [view,         setView]         = useState<'list' | 'kanban'>('list')
  const [statusFilter, setStatusFilter] = useState('All')
  const [projFilter,   setProjFilter]   = useState('All')
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({})

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
    setMe({ ...u, email: session.user.email })

    const [tRes, sRes, taRes, saRes, uRes] = await Promise.all([
      supabase.from('Tasks').select('*').order('end_date'),
      supabase.from('Subtasks').select('*'),
      supabase.from('task_assignees').select('*'),
      supabase.from('subtask_assignees').select('*'),
      supabase.from('Users').select('id, full_name')
    ])
    
    setTasks(tRes.data || [])
    setSubtasks(sRes.data || [])
    setTaskAssignees(taRes.data || [])
    setSubtaskAssignees(saRes.data || [])
    setAllUsers(uRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Status Handlers
  const handleTaskStatus = async (task: Task, newStatus: string) => {
    if (newStatus === 'Completed') {
      const children = subtasks.filter(s => String(s.parent_task_id) === String(task.id))
      if (children.some(s => s.status !== 'Completed')) {
        alert('Action Blocked: All subtasks must be marked "Completed" before you can complete the main task.')
        return
      }
    }

    setTasks(prev => prev.map(t => String(t.id) === String(task.id) ? { ...t, status: newStatus as Status } : t))
    await supabase.from('Tasks').update({ status: newStatus }).eq('id', task.id)

    if (newStatus === 'Completed' && task.type && task.type !== 'One-time') {
      const { start, end } = nextRecurrence(task.start_date || '', task.end_date || '', task.type)
      const { data: newTask } = await supabase.from('Tasks').insert({
        project_id: task.project_id,
        project_name: task.project_name,
        topic: task.topic,
        description: task.description,
        type: task.type,
        start_date: start,
        end_date: end,
        status: 'Not Started'
      }).select().single()

      if (newTask) {
        const assignees = taskAssignees.filter(ta => String(ta.task_id) === String(task.id))
        if (assignees.length > 0) {
          await supabase.from('task_assignees').insert(assignees.map(ta => ({ task_id: newTask.id, user_id: ta.user_id })))
        }
        alert(`Next recurring instance created for ${start}.`)
        loadData()
      }
    }
  }

  const handleSubStatus = async (subtask: Subtask, newStatus: string) => {
    setSubtasks(prev => prev.map(s => String(s.id) === String(subtask.id) ? { ...s, status: newStatus as Status } : s))
    await supabase.from('Subtasks').update({ status: newStatus }).eq('id', subtask.id)
  }

  // Filtering
  const myTaskIds = new Set(taskAssignees.filter(ta => me && ta.user_id === me.id).map(ta => ta.task_id))
  const mySubtaskIds = new Set(subtaskAssignees.filter(sa => me && sa.user_id === me.id).map(sa => sa.subtask_id))

  let baseArray: any[] = scopeTab === 'Tasks'
    ? tasks.filter(t => myTaskIds.has(t.id))
    : subtasks.filter(s => mySubtaskIds.has(s.id))

  if (statusFilter !== 'All') baseArray = baseArray.filter(item => item.status === statusFilter)
  if (projFilter !== 'All') {
    baseArray = baseArray.filter(item => {
      if (scopeTab === 'Tasks') return item.project_name === projFilter
      const parent = tasks.find(t => String(t.id) === String(item.parent_task_id))
      return parent?.project_name === projFilter
    })
  }

  const projectsForFilter = [...new Set(
    (scopeTab === 'Tasks' ? tasks.filter(t => myTaskIds.has(t.id)) : subtasks.filter(s => mySubtaskIds.has(s.id)).map(s => tasks.find(t => String(t.id) === String(s.parent_task_id))))
    .map(t => t?.project_name).filter(Boolean)
  )] as string[]

  const overdueItems   = baseArray.filter(i => isOverdue(i.end_date, i.status))
  const activeItems    = baseArray.filter(i => !isOverdue(i.end_date, i.status) && i.status !== 'Completed')
  const completedItems = baseArray.filter(i => i.status === 'Completed')

  // Drag & Drop
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
      if (!task) return
      if (newStatus === 'Completed') {
        const children = subtasks.filter(s => String(s.parent_task_id) === String(task.id))
        if (children.some(s => s.status !== 'Completed')) {
          alert('❌ Cannot mark this task as Completed until ALL subtasks are completed.')
          return
        }
      }
      await handleTaskStatus(task, newStatus)
    } else {
      const subtask = subtasks.find(s => String(s.id) === itemId)
      if (subtask) await handleSubStatus(subtask, newStatus)
    }
  }

  // Interactive Pill
  const InteractivePill = ({ status, onChange }: { status: string, onChange: (v: string) => void }) => (
    <select 
      className={`pill ${getPillClass(status)}`} 
      style={{ 
        appearance: 'none', border: 'none', outline: 'none', 
        cursor: 'pointer', textAlign: 'center', paddingRight: 14,
        backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '6px'
      }}
      value={status}
      onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
    >
      {['Not Started', 'In Progress', 'On-Hold', 'Completed'].map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )

  const COL = scopeTab === 'Tasks' 
    ? '18px 24px 1fr 110px 130px 90px 110px 28px'  
    : '24px 1fr 1fr 110px 130px 110px'

  // Row Components
  const TaskRow = ({ task, isOver = false, dim = false }: { task: Task; isOver?: boolean; dim?: boolean }) => {
    const subs = subtasks.filter(s => String(s.parent_task_id) === String(task.id))
    const hasSubs = subs.length > 0
    const open = expanded[task.id]
    const doneSubs = subs.filter(s => s.status === 'Completed').length
    const assignees = taskAssignees.filter(ta => String(ta.task_id) === String(task.id)).map(ta => allUsers.find(u => String(u.id) === String(ta.user_id))).filter(Boolean)

    return (
      <>
        <div className={`task-row${isOver ? ' overdue-row' : ''}${dim ? ' dim' : ''}`} style={{ gridTemplateColumns: COL }} onClick={() => router.push(`/tasks/${task.id}`)}>
          {hasSubs ? <ChevronRight size={13} className={`chev${open ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setExpanded(p => ({...p, [task.id]: !p[task.id]})) }} /> : <span style={{ width: 18 }} />}
          <span className="status-dot" style={{ background: STATUS_DOT[task.status] || '#aaa' }} />
          <div className="task-name-cell">
            {task.topic} {task.type && task.type !== 'One-time' && <PillRecurring type={task.type} />}
          </div>
          <div className={`date-cell${isOver ? ' late' : ''}`}><Calendar size={11} /> {task.end_date || '—'}</div>
          <div className="proj-cell">
            <span className="proj-dot" style={{ background: projectColor(task.project_name) }} /> {task.project_name || '—'}
          </div>
          <div style={{ display: 'flex' }}>
            {assignees.slice(0, 3).map((u: any, i: number) => (
              <div key={u.id} className="av-sm" style={{ fontSize: 9, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], marginLeft: i > 0 ? '-6px' : 0, border: '2px solid var(--bg)' }} title={u.full_name}>{ini(u.full_name)}</div>
            ))}
            {assignees.length === 0 && <span style={{ fontSize: 11, color: 'var(--txt3)' }}>—</span>}
          </div>
          <InteractivePill status={task.status} onChange={(v) => handleTaskStatus(task, v)} />
          {hasSubs ? <span className="sub-count">{doneSubs}/{subs.length}</span> : <span />}
        </div>

        {hasSubs && open && subs.map(s => {
          const subAssignees = subtaskAssignees.filter(sa => String(sa.subtask_id) === String(s.id)).map(sa => allUsers.find(u => String(u.id) === String(sa.user_id))).filter(Boolean)
          return (
            <div key={s.id} className="subtask-row" style={{ gridTemplateColumns: COL }} onClick={() => router.push(`/tasks/${task.id}`)}>
              <span />
              <span className="status-dot" style={{ background: STATUS_DOT[s.status] || '#aaa', width: 7, height: 7 }} />
              <div className="sub-name-cell">{s.topic}</div>
              <div className={`date-cell${isOverdue(s.end_date, s.status) ? ' late' : ''}`}>{s.end_date ? <><Calendar size={10} /> {s.end_date}</> : '—'}</div>
              <div className="proj-cell"><span className="proj-dot" style={{ background: projectColor(task.project_name) }} />{task.project_name || '—'}</div>
              <div style={{ display: 'flex' }}>
                {subAssignees.slice(0, 3).map((u: any, i: number) => (
                  <div key={u.id} className="av-sm" style={{ fontSize: 9, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], marginLeft: i > 0 ? '-6px' : 0, border: '2px solid var(--bg)' }} title={u.full_name}>{ini(u.full_name)}</div>
                ))}
              </div>
              <InteractivePill status={s.status} onChange={(v) => handleSubStatus(s, v)} />
              <span />
            </div>
          )
        })}
      </>
    )
  }

  const SubtaskRow = ({ subtask, isOver = false, dim = false }: { subtask: Subtask; isOver?: boolean; dim?: boolean }) => {
    const parentTask = tasks.find(t => String(t.id) === String(subtask.parent_task_id))
    return (
      <div className={`task-row${isOver ? ' overdue-row' : ''}${dim ? ' dim' : ''}`} style={{ gridTemplateColumns: COL }} onClick={() => parentTask && router.push(`/tasks/${parentTask.id}`)}>
        <span className="status-dot" style={{ background: STATUS_DOT[subtask.status] || '#aaa', borderRadius: 2 }} />
        <div className="task-name-cell" style={{ fontWeight: 600 }}>{subtask.topic}</div>
        <div className="task-name-cell" style={{ color: 'var(--txt3)', fontSize: 12, fontWeight: 500 }}>
          {parentTask ? parentTask.topic : 'Unknown Task'}
        </div>
        <div className={`date-cell${isOver ? ' late' : ''}`}><Calendar size={11} /> {subtask.end_date || '—'}</div>
        <div className="proj-cell">
          <span className="proj-dot" style={{ background: projectColor(parentTask?.project_name) }} /> {parentTask?.project_name || '—'}
        </div>
        <InteractivePill status={subtask.status} onChange={(v) => handleSubStatus(subtask, v)} />
      </div>
    )
  }

  const KanbanCard = ({ item }: { item: any }) => {
    const isTask = scopeTab === 'Tasks'
    const parentTask = !isTask ? tasks.find(t => String(t.id) === String(item.parent_task_id)) : null
    const projName = isTask ? item.project_name : parentTask?.project_name
    const over = isOverdue(item.end_date, item.status)
    const subs = isTask ? subtasks.filter(s => String(s.parent_task_id) === String(item.id)) : []
    const doneSubs = subs.filter(s => s.status === 'Completed').length

    return (
      <div 
        className={`k-card${over ? ' k-overdue' : ''}${item.status === 'Completed' ? ' dim' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id, isTask)}
        onClick={() => router.push(`/tasks/${isTask ? item.id : item.parent_task_id}`)}
      >
        <div className="k-proj">
          <span className="proj-dot" style={{ background: projectColor(projName) }} />
          {projName || '—'}
          {isTask && item.type && item.type !== 'One-time' && <span className="pill pill-rc" style={{ marginLeft: 4 }}>↻ {item.type}</span>}
        </div>
        <div className="k-name">{item.topic}</div>
        {!isTask && <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 8, marginTop: -4 }}>Under: {parentTask?.topic}</div>}
        {isTask && subs.length > 0 && (
          <>
            <div className="prog-bar">
              <div className="prog-fill" style={{ width: `${subs.length ? Math.round((doneSubs / subs.length) * 100) : 0}%`, background: projectColor(projName) }} />
            </div>
            <div className="prog-lbl">{doneSubs} / {subs.length} subtasks</div>
          </>
        )}
        <div className="k-meta" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <span className={`k-date${over ? ' late' : ''}`}>
            {over && <AlertTriangle size={10} style={{ marginRight: 3 }} />}
            {item.end_date || '—'}
          </span>
        </div>
      </div>
    )
  }

  if (loading) {
    return <AppShell title="My Tasks"><div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading your assignments...</div></AppShell>
  }

  return (
    <AppShell title="My Tasks">
      {/* TOOLBAR - BOTH TOGGLES ARE IDENTICAL */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* Task / Subtask Toggle */}
        <div className="view-toggle" style={{ background: 'var(--bg2)', padding: 3, borderRadius: 8 }}>
          <button className={`vb ${scopeTab === 'Tasks' ? 'on' : 'off'}`} onClick={() => setScopeTab('Tasks')}>
            <Layers size={14} /> Tasks
          </button>
          <button className={`vb ${scopeTab === 'Subtasks' ? 'on' : 'off'}`} onClick={() => setScopeTab('Subtasks')}>
            <CheckSquare size={14} /> Subtasks
          </button>
        </div>

        {/* List / Kanban Toggle - identical style */}
        <div className="view-toggle" style={{ background: 'var(--bg2)', padding: 3, borderRadius: 8 }}>
          <button className={`vb ${view === 'list' ? 'on' : 'off'}`} onClick={() => setView('list')}>
            <LayoutList size={14} /> List
          </button>
          <button className={`vb ${view === 'kanban' ? 'on' : 'off'}`} onClick={() => setView('kanban')}>
            <Columns size={14} /> Kanban
          </button>
        </div>

        {/* Filters on the right */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <div className="filter-pill">
            <Filter size={13} color="var(--txt3)" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600 }}>
              <option value="All">All Status</option>
              {(['Not Started', 'In Progress', 'On-Hold', 'Completed'] as Status[]).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="filter-pill">
            <Filter size={13} color="var(--txt3)" />
            <select value={projFilter} onChange={e => setProjFilter(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600 }}>
              <option value="All">All Projects</option>
              {projectsForFilter.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <span className="count-lbl" style={{ fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
          {baseArray.length} {scopeTab === 'Tasks' ? 'task' : 'subtask'}{baseArray.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Rest of the page (empty state, list, kanban) */}
      {baseArray.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>☑</div>
          <div style={{ marginTop: 8 }}>No {scopeTab.toLowerCase()} assigned to you.</div>
        </div>
      )}

      {view === 'list' && baseArray.length > 0 && (
        <div className="task-table">
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
                <div className="col-header">Parent Task</div>
                <div className="col-header">Due date</div>
                <div className="col-header">Project</div>
                <div className="col-header">Status</div>
              </>
            )}
          </div>

          {overdueItems.length > 0 && (
            <>
              <div className="section-label overdue"><AlertTriangle size={12} /> Overdue <span className="section-badge">{overdueItems.length}</span></div>
              {overdueItems.map((item: any) => scopeTab === 'Tasks' ? <TaskRow key={item.id} task={item} isOver /> : <SubtaskRow key={item.id} subtask={item} isOver />)}
            </>
          )}

          {activeItems.length > 0 && (
            <>
              <div className="section-label">Active <span className="section-badge">{activeItems.length}</span></div>
              {activeItems.map((item: any) => scopeTab === 'Tasks' ? <TaskRow key={item.id} task={item} /> : <SubtaskRow key={item.id} subtask={item} />)}
            </>
          )}

          {completedItems.length > 0 && (
            <>
              <div className="section-label completed">Completed <span className="section-badge">{completedItems.length}</span></div>
              {completedItems.map((item: any) => scopeTab === 'Tasks' ? <TaskRow key={item.id} task={item} dim /> : <SubtaskRow key={item.id} subtask={item} dim />)}
            </>
          )}
        </div>
      )}

      {view === 'kanban' && baseArray.length > 0 && (
        <div className="kanban-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {(['Not Started', 'In Progress', 'On-Hold', 'Completed'] as Status[]).map(status => {
            const group = baseArray.filter(t => t.status === status)
            return (
              <div 
                key={status} 
                className="k-col"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="k-col-header">
                  <div className="k-col-title">
                    <span className="status-dot" style={{ background: STATUS_DOT[status] }} /> {status}
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