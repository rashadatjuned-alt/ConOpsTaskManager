'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot, TypePill } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, LayoutList, Columns, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const DOT_CLR: Record<string,string> = {
  'Not Started':'#aaa','In Progress':'#378ADD','On-Hold':'#EF9F27','Completed':'#639922'
}

export default function AllTasks() {
  const router = useRouter()
  const [tasks,       setTasks]       = useState<any[]>([])
  const [subtasks,    setSubtasks]    = useState<any[]>([])
  const [projects,    setProjects]    = useState<string[]>([])
  const [myRole,      setMyRole]      = useState('')
  const [sf,          setSf]          = useState('All')
  const [pf,          setPf]          = useState('All')
  const [af,          setAf]          = useState('All')
  const [view,        setView]        = useState<'list'|'kanban'>('list')
  const [collTask,    setCollTask]    = useState<Record<string,boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)

  useEffect(()=>{
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role||'')
      const [t, s] = await Promise.all([
        supabase.from('Tasks').select('*').order('project_name').order('end_date'),
        supabase.from('Subtasks').select('*'),
      ])
      setTasks(t.data||[])
      setSubtasks(s.data||[])
      setProjects([...new Set((t.data||[]).map((x:any)=>x.project_name).filter(Boolean))].sort() as string[])
    }
    load()
  },[])

  if (myRole && myRole==='Team Member') return (
    <AppShell title="All Tasks"><div className="alert alert-error">Access denied — Managers and Admins only.</div></AppShell>
  )

  const assignees = [...new Set(
    tasks.flatMap(t => (t.owner||'').split(',').map((o:string) => o.trim()).filter(Boolean))
  )].sort()

  let filtered = tasks
  if (sf!=='All') filtered = filtered.filter(t => t.status===sf)
  if (pf!=='All') filtered = filtered.filter(t => t.project_name===pf)
  if (af!=='All') filtered = filtered.filter(t => (t.owner||'').includes(af))

  // Group by project, sorted A-Z
  const grouped: Record<string,any[]> = {}
  filtered.forEach(t => { const p=t.project_name||'No Project'; grouped[p]=(grouped[p]||[]).concat(t) })
  const groupEntries = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))

  const toggleAll = () => {
    const next = !allExpanded
    setAllExpanded(next)
    const s: Record<string,boolean> = {}
    filtered.forEach(t => { s[t.id] = !next })
    setCollTask(s)
  }

  const today = new Date(); today.setHours(0,0,0,0)

  const KanbanCard = ({ task }: { task: any }) => {
    const subs     = subtasks.filter(s => s.parent_task_id === task.id)
    const doneSubs = subs.filter(s => s.status === 'Completed').length
    const isOver   = task.end_date && new Date(task.end_date) < today && task.status !== 'Completed'
    return (
      <div className={`kanban-card${isOver?' kanban-card-overdue':''}`}
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

  return (
    <AppShell title="All Tasks">
      <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
        {view === 'list' && (
          <select className="form-select" style={{width:150}} value={sf} onChange={e=>setSf(e.target.value)}>
            <option value="All">All Status</option>
            {STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
        )}
        <select className="form-select" style={{width:195}} value={pf} onChange={e=>setPf(e.target.value)}>
          <option value="All">All Projects</option>
          {projects.map(p=><option key={p}>{p}</option>)}
        </select>
        <select className="form-select" style={{width:175}} value={af} onChange={e=>setAf(e.target.value)}>
          <option value="All">All Assignees</option>
          {assignees.map(a=><option key={a}>{a}</option>)}
        </select>

        {view === 'list' && (
          <button className="btn btn-sm" onClick={toggleAll} style={{ display:'flex', alignItems:'center', gap:4 }}>
            {allExpanded ? <ChevronsDownUp size={13}/> : <ChevronsUpDown size={13}/>}
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}

        <div style={{ display:'flex', gap:4 }}>
          <button className={view==='list'?'btn btn-primary btn-sm':'btn btn-sm'} onClick={()=>setView('list')} title="List view"><LayoutList size={15}/></button>
          <button className={view==='kanban'?'btn btn-primary btn-sm':'btn btn-sm'} onClick={()=>setView('kanban')} title="Kanban view"><Columns size={15}/></button>
        </div>
        <div style={{fontSize:12,color:'var(--txt3)'}}>{filtered.length} tasks</div>
        <Link href="/tasks/create" className="btn btn-primary btn-sm" style={{marginLeft:'auto'}}>+ Create Task</Link>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <>
          {groupEntries.map(([projName, ptasks])=>(
            <div key={projName} className="card" style={{padding:0,overflow:'hidden',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'var(--bg2)',borderBottom:'0.5px solid var(--brd)'}}>
                <div className="proj-dot" style={{background:'#378ADD'}}/>
                <div style={{fontSize:14,fontWeight:500,flex:1,color:'var(--txt)'}}>{projName}</div>
                <div style={{fontSize:12,color:'var(--txt3)'}}>{ptasks.length} task{ptasks.length!==1?'s':''}</div>
              </div>
              <div style={{padding:'8px 16px 12px 16px'}}>
                {ptasks.map(t=>{
                  const subs = subtasks.filter(s=>s.parent_task_id===t.id)
                  const taskOpen = !collTask[t.id]
                  return (
                    <div key={t.id}>
                      <div className="task-row">
                        {subs.length>0
                          ? <ChevronRight size={12} color="var(--txt3)"
                              style={{transform:taskOpen?'rotate(90deg)':'',transition:'transform 0.2s',cursor:'pointer',flexShrink:0}}
                              onClick={e=>{e.stopPropagation();setCollTask(c=>({...c,[t.id]:!c[t.id]}))}}/>
                          : <div style={{width:12,flexShrink:0}}/>
                        }
                        <StatusDot status={t.status}/>
                        <div className="task-name" style={{flex:1}} onClick={()=>router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                        <div className="task-meta"><span>{t.owner}</span><span>{t.end_date}</span></div>
                        {(t.tags||[]).map((tag:string)=><span key={tag} className="pill pill-tag" style={{fontSize:10}}>{tag}</span>)}
                        <StatusPill status={t.status}/>
                        <TypePill type={t.type}/>
                      </div>
                      {subs.length>0&&taskOpen&&(
                        <div style={{paddingLeft:28,marginBottom:4}}>
                          {subs.map(s=>(
                            <div key={s.id} className="sub-row">
                              <span style={{color:'var(--txt3)',fontSize:12}}>↳</span>
                              <span style={{flex:1}}>{s.topic}</span>
                              <span style={{fontSize:11,color:'var(--txt3)'}}>{s.start_date} → {s.end_date}</span>
                              <StatusPill status={s.status}/>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {filtered.length===0&&<div className="empty-state"><div style={{fontSize:32}}>📋</div><div style={{marginTop:8}}>No tasks found.</div></div>}
        </>
      )}

      {/* KANBAN VIEW — project + assignee filters apply, status filter hidden */}
      {view === 'kanban' && (
        <div className="kanban-grid">
          {STATUSES.map(status => {
            let kanbanTasks = tasks
            if (pf!=='All') kanbanTasks = kanbanTasks.filter(t=>t.project_name===pf)
            if (af!=='All') kanbanTasks = kanbanTasks.filter(t=>(t.owner||'').includes(af))
            const group = kanbanTasks.filter(t => t.status === status)
            return (
              <div key={status}>
                <div className="col-header">
                  <div style={{ width:8, height:8, borderRadius:'50%', background: DOT_CLR[status] }}/>
                  {status}<span className="col-count">{group.length}</span>
                </div>
                {group.length === 0 ? <div className="col-empty">No tasks</div> : group.map(t => <KanbanCard key={t.id} task={t}/>)}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
