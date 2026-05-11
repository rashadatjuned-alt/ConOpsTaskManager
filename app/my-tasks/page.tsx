'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot, TypePill } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { LayoutList, Columns, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const DOT_CLR: Record<string,string> = {
  'Not Started':'#aaa','In Progress':'#378ADD','On-Hold':'#EF9F27','Completed':'#639922'
}

export default function MyTasks() {
  const router = useRouter()
  const [tasks,       setTasks]       = useState<any[]>([])
  const [subtasks,    setSubtasks]    = useState<any[]>([])
  const [me,          setMe]          = useState<any>(null)
  const [sf,          setSf]          = useState('All')
  const [pf,          setPf]          = useState('All')
  const [view,        setView]        = useState<'list'|'kanban'>('list')
  const [dragging,    setDragging]    = useState<string|null>(null)
  const [expanded,    setExpanded]    = useState<Record<string,boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      const [t, s] = await Promise.all([
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
      ])
      setTasks(t.data || [])
      setSubtasks(s.data || [])
    }
    load()
  }, [])

  const isMyTask = (t: any) => {
    const o = (t.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e) || (n.length > 2 && o.includes(n))
  }
  const isMySubtask = (s: any) => {
    const o = (s.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e) || (n.length > 2 && o.includes(n))
  }

  const myTaskIds = new Set(tasks.filter(isMyTask).map(t => t.id))
  const taskIdsWithMySubtasks = new Set(subtasks.filter(isMySubtask).map(s => s.parent_task_id))
  const allMyTaskIds = new Set([...myTaskIds, ...taskIdsWithMySubtasks])
  const mine = tasks.filter(t => allMyTaskIds.has(t.id))

  let filtered = mine
  if (sf !== 'All') filtered = filtered.filter(t => t.status === sf)
  if (pf !== 'All') filtered = filtered.filter(t => t.project_name === pf)
  const projects = [...new Set(mine.map(t => t.project_name).filter(Boolean))].sort() as string[]

  // Group by project, sorted A-Z
  const grouped: Record<string, any[]> = {}
  filtered.forEach(t => {
    const p = t.project_name || 'No Project'
    grouped[p] = (grouped[p] || []).concat(t)
  })
  const groupEntries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))

  const today = new Date(); today.setHours(0,0,0,0)

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleAll = () => {
    const next = !allExpanded
    setAllExpanded(next)
    const s: Record<string,boolean> = {}
    filtered.forEach(t => { s[t.id] = next })
    setExpanded(s)
  }

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('taskId', id); setDragging(id)
  }, [])
  const handleDragEnd  = useCallback(() => setDragging(null), [])
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('taskId')
    const task = tasks.find(t => t.id === id)
    if (!task || task.status === newStatus) { setDragging(null); return }
    if (newStatus === 'Completed') {
      const subs = subtasks.filter(s => s.parent_task_id === id)
      if (subs.some(s => s.status !== 'Completed')) {
        alert('All subtasks must be completed first.'); setDragging(null); return
      }
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    await supabase.from('Tasks').update({ status: newStatus }).eq('id', id)
    setDragging(null)
  }, [tasks, subtasks])

  const KanbanCard = ({ task }: { task: any }) => {
    const subs     = subtasks.filter(s => s.parent_task_id === task.id)
    const doneSubs = subs.filter(s => s.status === 'Completed').length
    const isOver   = task.end_date && new Date(task.end_date) < today && task.status !== 'Completed'
    return (
      <div
        className={`kanban-card${isOver?' kanban-card-overdue':''}${dragging===task.id?' dragging':''}`}
        draggable onDragStart={e => handleDragStart(e, task.id)} onDragEnd={handleDragEnd}
        onClick={() => router.push(`/tasks/${task.id}`)}>
        <div className="kc-title">{task.topic}</div>
        <div className="kc-chips">
          {task.project_name && <span className="kc-chip kc-chip-project">{task.project_name}</span>}
          {task.type && task.type !== 'One-time' && <span className="kc-chip kc-chip-type">↻ {task.type}</span>}
          {subs.length > 0 && <span className="kc-chip kc-chip-sub">{doneSubs}/{subs.length} done</span>}
        </div>
        {task.owner && <div className="kc-owner">{task.owner}</div>}
      </div>
    )
  }

  const TaskRow = ({ task }: { task: any }) => {
    const isOver   = task.end_date && new Date(task.end_date) < today && task.status !== 'Completed'
    const subs     = subtasks.filter(s => s.parent_task_id === task.id)
    const isOpen   = expanded[task.id] ?? true
    const doneSubs = subs.filter(s => s.status === 'Completed').length
    return (
      <div style={{ marginBottom:6 }}>
        <div className={`task-row ${isOver?'overdue':''} ${dragging===task.id?'dragging':''}`}
          style={{ cursor:'grab', marginBottom: subs.length&&isOpen ? 2 : 0 }}
          draggable onDragStart={e => handleDragStart(e, task.id)} onDragEnd={handleDragEnd}>
          {subs.length > 0
            ? <ChevronRight size={13} color="var(--txt3)"
                style={{ transform:isOpen?'rotate(90deg)':'', transition:'transform 0.2s', cursor:'pointer', flexShrink:0 }}
                onClick={e => { e.stopPropagation(); toggleExpand(task.id) }}/>
            : <div style={{ width:13, flexShrink:0 }}/>
          }
          <StatusDot status={task.status}/>
          <div style={{ flex:1 }} onClick={() => router.push(`/tasks/${task.id}`)}>
            <div className="task-name">{task.topic}</div>
            <div className="task-meta">
              {task.end_date && <span>{isOver?'⚠ ':''}{task.end_date}</span>}
              {task.project_name && <span>{task.project_name}</span>}
              {task.owner && <span>{task.owner}</span>}
            </div>
          </div>
          {subs.length > 0 && <span style={{ fontSize:10, color:'var(--txt3)', whiteSpace:'nowrap' }}>{doneSubs}/{subs.length}</span>}
          <StatusPill status={task.status}/>
          <TypePill type={task.type}/>
        </div>
        {subs.length > 0 && isOpen && (
          <div style={{ paddingLeft:28, marginBottom:4 }}>
            {subs.map(s => (
              <div key={s.id} className="sub-row"
                style={{ border:'0.5px solid var(--brd)', borderRadius:'var(--r)', marginBottom:3, background:'var(--bg)', cursor:'pointer' }}
                onClick={() => router.push(`/tasks/${task.id}`)}>
                <span style={{ color:'var(--txt3)', fontSize:12 }}>↳</span>
                <span style={{ flex:1, fontSize:13, color:'var(--txt)' }}>{s.topic}</span>
                {s.owner && <span style={{ fontSize:11, color:'var(--txt3)' }}>{s.owner}</span>}
                <span style={{ fontSize:11, color:'var(--txt3)' }}>{s.end_date}</span>
                <StatusPill status={s.status}/>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell title="My Tasks">
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <select className="form-select" style={{ width:150 }} value={sf} onChange={e => setSf(e.target.value)}>
          <option value="All">All Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{ width:180 }} value={pf} onChange={e => setPf(e.target.value)}>
          <option value="All">All Projects</option>
          {projects.map(p => <option key={p}>{p}</option>)}
        </select>
        {view === 'list' && (
          <button className="btn btn-sm" onClick={toggleAll} style={{ display:'flex', alignItems:'center', gap:4 }}>
            {allExpanded ? <ChevronsDownUp size={13}/> : <ChevronsUpDown size={13}/>}
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          <button className={view==='list'?'btn btn-primary btn-sm':'btn btn-sm'} onClick={() => setView('list')} title="List view"><LayoutList size={15}/></button>
          <button className={view==='kanban'?'btn btn-primary btn-sm':'btn btn-sm'} onClick={() => setView('kanban')} title="Kanban view"><Columns size={15}/></button>
        </div>
        <div style={{ fontSize:12, color:'var(--txt3)' }}>{filtered.length} task{filtered.length!==1?'s':''}</div>
      </div>

      {filtered.length === 0 && <div className="empty-state"><div style={{ fontSize:32 }}>☑</div><div style={{ marginTop:8 }}>No tasks assigned to you.</div></div>}

      {view === 'list' && filtered.length > 0 && groupEntries.map(([projName, ptasks]) => (
        <div key={projName} className="card" style={{ padding:0, overflow:'hidden', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--bg2)', borderBottom:'0.5px solid var(--brd)' }}>
            <div className="proj-dot" style={{ background:'#378ADD' }}/>
            <div style={{ fontSize:14, fontWeight:500, flex:1, color:'var(--txt)' }}>{projName}</div>
            <div style={{ fontSize:12, color:'var(--txt3)' }}>{ptasks.length} task{ptasks.length!==1?'s':''}</div>
          </div>
          <div style={{ padding:'8px 16px 12px 16px' }}>
            {ptasks.map(t => <TaskRow key={t.id} task={t}/>)}
          </div>
        </div>
      ))}

      {view === 'kanban' && (
        <div className="kanban-grid">
          {STATUSES.map(status => {
            const group = filtered.filter(t => t.status === status)
            return (
              <div key={status} className="kanban-col" onDragOver={handleDragOver} onDrop={e => handleDrop(e, status)}>
                <div className="col-header">
                  <div style={{ width:8, height:8, borderRadius:'50%', background: DOT_CLR[status] }}/>
                  {status}<span className="col-count">{group.length}</span>
                </div>
                {group.length === 0 ? <div className="col-empty">Drop tasks here</div> : group.map(t => <KanbanCard key={t.id} task={t}/>)}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
