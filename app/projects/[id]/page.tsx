'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Plus, Info, X, Users, Calendar, Clock, Search, Filter } from 'lucide-react'
import Link from 'next/link'

// ─── Project Info Modal ───────────────────────────────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose }: {
  proj: any; tasks: any[]; allUsers: any[]; onClose: () => void
}) {
  const projTasks  = tasks.filter(t => t.project_name === proj.name)
  const done       = projTasks.filter(t => t.status === 'Completed').length
  const pct        = projTasks.length ? Math.round(done / projTasks.length * 100) : 0

  // Members: resolve from proj.members array of user IDs
  const members = (proj.members || [])
    .map((id: string) => allUsers.find((u: any) => u.id === id))
    .filter(Boolean)

  // Duration
  const startDate = proj.start_date || projTasks.map((t:any)=>t.start_date).filter(Boolean).sort()[0]
  const endDate   = proj.end_date   || projTasks.map((t:any)=>t.end_date).filter(Boolean).sort().reverse()[0]
  let duration = '—'
  if (startDate && endDate) {
    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 864e5)
    if (days < 0)       duration = '—'
    else if (days < 7)  duration = `${days} day${days!==1?'s':''}`
    else if (days < 30) duration = `${Math.round(days/7)} week${Math.round(days/7)!==1?'s':''}`
    else if (days < 365)duration = `${Math.round(days/30)} month${Math.round(days/30)!==1?'s':''}`
    else                duration = `${(days/365).toFixed(1)} years`
  }

  const AVATAR_BG = ['#E6F1FB','#EAF3DE','#EEEDFE','#FAEEDA','#FAECE7','#E1F5EE']
  const AVATAR_CL = ['#0C447C','#27500A','#3C3489','#633806','#712B13','#085041']
  const ini = (name: string) => {
    const p = (name||'?').trim().split(' ')
    return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'var(--bg)', borderRadius:'var(--rl)', width:480,
        maxHeight:'85vh', overflow:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>

        {/* Header strip */}
        <div style={{ background: proj.color_code||'#378ADD', borderRadius:'var(--rl) var(--rl) 0 0',
          padding:'20px 24px 16px', position:'relative' }}>
          <button onClick={onClose}
            style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,0.2)',
              border:'none', borderRadius:'50%', width:28, height:28, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
            <X size={14}/>
          </button>
          <div style={{ fontSize:18, fontWeight:600, color:'#fff', marginBottom:4 }}>{proj.name}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.8)' }}>
            {projTasks.length} task{projTasks.length!==1?'s':''} · {pct}% complete
          </div>
          {/* Mini progress bar */}
          <div style={{ height:4, background:'rgba(255,255,255,0.3)', borderRadius:2,
            marginTop:10, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'#fff', borderRadius:2 }}/>
          </div>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* Description */}
          {proj.description && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase',
                letterSpacing:'0.06em', color:'var(--txt3)', marginBottom:6 }}>Description</div>
              <div style={{ fontSize:13, color:'var(--txt2)', lineHeight:1.6 }}>{proj.description}</div>
            </div>
          )}

          {/* Dates + Duration row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
            {[
              { icon:<Calendar size={14}/>, label:'Start Date', val: startDate||'—' },
              { icon:<Calendar size={14}/>, label:'End Date',   val: endDate||'—' },
              { icon:<Clock size={14}/>,    label:'Duration',   val: duration },
            ].map(({ icon, label, val }) => (
              <div key={label} style={{ background:'var(--bg2)', borderRadius:'var(--r)',
                padding:'10px 12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5,
                  color:'var(--txt3)', fontSize:11, marginBottom:5 }}>
                  {icon}{label}
                </div>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Task status breakdown */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase',
              letterSpacing:'0.06em', color:'var(--txt3)', marginBottom:10 }}>Task Breakdown</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {[
                { label:'Not Started', bg:'#F1EFE8', color:'#5F5E5A' },
                { label:'In Progress', bg:'#E6F1FB', color:'#185FA5' },
                { label:'On-Hold',     bg:'#FAEEDA', color:'#854F0B' },
                { label:'Completed',   bg:'#EAF3DE', color:'#3B6D11' },
              ].map(({ label, bg, color }) => (
                <div key={label} style={{ background:bg, borderRadius:'var(--r)',
                  padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:600, color }}>{projTasks.filter(t=>t.status===label).length}</div>
                  <div style={{ fontSize:10, color, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Team members */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase',
              letterSpacing:'0.06em', color:'var(--txt3)', marginBottom:10,
              display:'flex', alignItems:'center', gap:6 }}>
              <Users size={12}/> Team Members ({members.length})
            </div>
            {members.length === 0
              ? <div style={{ fontSize:12, color:'var(--txt3)' }}>No members assigned to this project.</div>
              : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {members.map((u: any, idx: number) => {
                    const name = u.full_name || u.email
                    const bg   = AVATAR_BG[idx % AVATAR_BG.length]
                    const cl   = AVATAR_CL[idx % AVATAR_CL.length]
                    const memberTasks = projTasks.filter(t =>
                      (t.owner||'').toLowerCase().includes(name.toLowerCase())
                    )
                    return (
                      <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10,
                        padding:'8px 10px', background:'var(--bg2)', borderRadius:'var(--r)' }}>
                        <div style={{ width:32, height:32, borderRadius:'50%',
                          background:bg, color:cl, display:'flex', alignItems:'center',
                          justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>
                          {ini(name)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>{name}</div>
                          <div style={{ fontSize:11, color:'var(--txt3)' }}>{u.role}</div>
                        </div>
                        <div style={{ fontSize:11, color:'var(--txt3)', textAlign:'right' }}>
                          <div style={{ fontWeight:500, color:'var(--txt)' }}>{memberTasks.length}</div>
                          <div>tasks</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AllProjects() {
  const router = useRouter()
  const [projects,  setProjects]  = useState<any[]>([])
  const [tasks,     setTasks]     = useState<any[]>([])
  const [subtasks,  setSubtasks]  = useState<any[]>([])
  const [allUsers,  setAllUsers]  = useState<any[]>([])
  const [myRole,    setMyRole]    = useState('')
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const [collTask,  setCollTask]  = useState<Record<string,boolean>>({})
  const [infoProj,  setInfoProj]  = useState<any|null>(null)
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || '')
      const [p, t, s, us] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Users').select('id,full_name,email,role'),
      ])
      setProjects(p.data || [])
      setTasks(t.data || [])
      setSubtasks(s.data || [])
      setAllUsers(us.data || [])
    }
    load()
  }, [])

  const canDelete = myRole === 'Admin' || myRole === 'Manager'

  if (myRole && myRole === 'Team Member') return (
    <AppShell title="All Projects">
      <div className="alert alert-error">Access denied — Managers and Admins only.</div>
    </AppShell>
  )

  const deleteProject = async (proj: any) => {
    if (!confirm(`Delete project "${proj.name}"? All tasks will remain but lose their project.`)) return
    await supabase.from('Projects').delete().eq('id', proj.id)
    setProjects(prev => prev.filter(p => p.id !== proj.id))
  }

  const deleteTask = async (taskId: string, topic: string) => {
    if (!confirm(`Delete task "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('parent_task_id', taskId)
    await supabase.from('Tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSubtasks(prev => prev.filter(s => s.parent_task_id !== taskId))
  }

  const deleteSubtask = async (subId: string, topic: string) => {
    if (!confirm(`Delete subtask "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('id', subId)
    setSubtasks(prev => prev.filter(s => s.id !== subId))
  }

  // Apply Filters
  const filteredProjects = projects.filter(proj => {
    const matchesSearch = proj.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (proj.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <AppShell title="All Projects">
      {/* Info modal */}
      {infoProj && (
        <ProjectInfoModal
          proj={infoProj} tasks={tasks} allUsers={allUsers}
          onClose={() => setInfoProj(null)}
        />
      )}

      {/* Top Bar: Filters & Actions */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 300 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--txt3)' }} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 'var(--r)', border: '1px solid var(--brd)', background: 'var(--bg)', fontSize: 13 }}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid var(--brd)', background: 'var(--bg)', fontSize: 13, color: 'var(--txt2)' }}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize:12, color:'var(--txt3)' }}>{filteredProjects.length} project{filteredProjects.length!==1?'s':''}</div>
          <Link href="/projects/create" className="btn btn-primary btn-sm"><Plus size={13}/> New Project</Link>
        </div>
      </div>

      {filteredProjects.length === 0 && (
        <div className="empty-state"><div style={{ fontSize:32 }}>📁</div><div style={{ marginTop:8 }}>No projects found.</div></div>
      )}

      {filteredProjects.map(proj => {
        const ptasks = tasks.filter(t => t.project_name === proj.name)
        // Apply status filter to tasks if needed, or keep showing all tasks inside matched project
        const visibleTasks = statusFilter === 'All' ? ptasks : ptasks.filter(t => 
           (statusFilter === 'Completed' && t.status === 'Completed') ||
           (statusFilter === 'Active' && t.status !== 'Completed')
        )

        const done   = ptasks.filter(t => t.status === 'Completed').length
        const pct    = ptasks.length ? Math.round(done / ptasks.length * 100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} className="proj-card" style={{ marginBottom: 16, border: '1px solid var(--brd)', borderRadius: 'var(--rl)', background: 'var(--bg)' }}>
            
            {/* Project Header (Clickable to Expand/Collapse) */}
            <div className="proj-header" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
                <ChevronRight size={16} color="var(--txt3)" style={{ transform: isOpen?'rotate(90deg)':'', transition:'transform 0.2s', flexShrink:0 }}/>
                <div className="proj-dot" style={{ background: proj.color_code||'#378ADD', width: 12, height: 12, borderRadius: '50%' }}/>
                
                <div style={{ flex: 1 }}>
                  <div className="proj-name" style={{ fontSize: 16, fontWeight: 600 }}>{proj.name}</div>
                  {/* Surfaced Description */}
                  {proj.description && (
                     <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                       {proj.description}
                     </div>
                  )}
                </div>

                <div className="proj-meta" style={{ fontSize: 13, color: 'var(--txt2)' }}>{ptasks.length} Tasks</div>
                
                {/* Project Overall Progress Tracker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 100 }}>
                  <div style={{ fontSize:12, color:'var(--txt3)', fontWeight: 500 }}>{pct}%</div>
                  <div className="prog-bar" style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div className="prog-fill" style={{ width:`${pct}%`, height: '100%', background: proj.color_code||'#378ADD', borderRadius: 3 }}/>
                  </div>
                </div>

                {/* Action buttons (Info button acts as Project View trigger) */}
                <div style={{ display:'flex', gap:6, alignItems:'center', marginLeft: 16 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setInfoProj(proj) }}
                    title="Project Details"
                    style={{ background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:'var(--r)', cursor:'pointer', color:'var(--txt)', display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, transition:'all 0.15s' }}>
                    <Info size={16}/>
                  </button>
                  <Link href="/tasks/create" className="btn btn-sm" title="Add task" onClick={e => e.stopPropagation()}>
                    <Plus size={14}/>
                  </Link>
                  {canDelete && (
                    <button onClick={(e) => { e.stopPropagation(); deleteProject(proj); }} title="Delete project"
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#cc3333', display:'flex', padding:6 }}>
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Task list Dropdown */}
            {isOpen && (
              <div style={{ padding: '0 16px 16px 40px' }}>
                <div style={{ borderTop:'1px solid var(--brd)', marginBottom:12 }}/>
                {visibleTasks.length === 0
                  ? <div style={{ fontSize:13, color:'var(--txt3)', padding:'4px 0' }}>No tasks found.</div>
                  : visibleTasks.map(t => {
                      const subs     = subtasks.filter(s => s.parent_task_id === t.id)
                      const taskOpen = !collTask[t.id]
                      
                      // Task Progress Logic (Based on subtasks if they exist, otherwise based on status)
                      const completedSubs = subs.filter(s => s.status === 'Completed').length;
                      const taskProgress = subs.length > 0 
                          ? Math.round((completedSubs / subs.length) * 100) 
                          : (t.status === 'Completed' ? 100 : (t.status === 'In Progress' ? 50 : 0));

                      return (
                        <div key={t.id} style={{ background: 'var(--bg2)', padding: '10px 12px', borderRadius: 'var(--r)', marginBottom: 8 }}>
                          <div className="task-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            
                            {subs.length > 0 ? (
                              <ChevronRight size={14} color="var(--txt3)"
                                style={{ transform: taskOpen?'rotate(90deg)':'', transition:'transform 0.2s', cursor:'pointer', flexShrink:0 }}
                                onClick={e => { e.stopPropagation(); setCollTask(c => ({ ...c, [t.id]: !c[t.id] })) }}/>
                            ) : (
                              <div style={{ width:14, flexShrink:0 }}/>
                            )}

                            <StatusDot status={t.status}/>
                            
                            {/* Task Name */}
                            <div className="task-name" style={{ flex:1, cursor:'pointer', fontSize: 14, fontWeight: 500 }}
                              onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                            
                            {/* Sub-Task Count */}
                            <div style={{ fontSize: 12, color: 'var(--txt3)', minWidth: 80 }}>
                              {subs.length} Sub-task{subs.length !== 1 ? 's' : ''}
                            </div>

                            {/* Start Date | End Date */}
                            <div style={{ fontSize: 12, color: 'var(--txt2)', minWidth: 150, display: 'flex', gap: 6 }}>
                               <Calendar size={12} style={{ marginTop: 2 }}/> 
                               {t.start_date || 'TBD'} <span style={{color: 'var(--txt3)'}}>|</span> {t.end_date || 'TBD'}
                            </div>

                            {/* Task Progress Tracker */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 80 }}>
                              <div style={{ width: '100%', height: 4, background: 'var(--brd)', borderRadius: 2, overflow: 'hidden' }}>
                                 <div style={{ width: `${taskProgress}%`, height: '100%', background: taskProgress === 100 ? '#3B6D11' : 'var(--txt2)' }} />
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{taskProgress}%</span>
                            </div>

                            <StatusPill status={t.status}/>
                            
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => router.push(`/tasks/${t.id}`)} className="btn btn-sm"
                                style={{ padding:'4px 8px', fontSize:11 }}>Edit</button>
                              {canDelete && (
                                <button onClick={() => deleteTask(t.id, t.topic)}
                                  style={{ background:'none', border:'none', cursor:'pointer', color:'#cc3333', padding:4 }}>
                                  <Trash2 size={14}/>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Subtasks Dropdown */}
                          {subs.length > 0 && taskOpen && (
                            <div style={{ paddingLeft:36, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {subs.map(s => (
                                <div key={s.id} className="sub-row"
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft:'2px solid var(--brd)', paddingLeft: 12 }}>
                                  <span style={{ flex:1, fontSize: 13, color: 'var(--txt2)' }}>{s.topic}</span>
                                  <span style={{ fontSize:11, color:'var(--txt3)' }}>{s.start_date || 'TBD'} → {s.end_date || 'TBD'}</span>
                                  <StatusPill status={s.status}/>
                                  {canDelete && (
                                    <button onClick={() => deleteSubtask(s.id, s.topic)}
                                      style={{ background:'none', border:'none', cursor:'pointer', color:'#cc3333', padding:2 }}>
                                      <Trash2 size={12}/>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                }
              </div>
            )}
          </div>
        )
      })}
    </AppShell>
  )
}
