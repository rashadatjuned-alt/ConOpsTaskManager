'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Plus, Info, X, Users, Calendar, Clock } from 'lucide-react'
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

  return (
    <AppShell title="All Projects">
      {/* Info modal */}
      {infoProj && (
        <ProjectInfoModal
          proj={infoProj} tasks={tasks} allUsers={allUsers}
          onClose={() => setInfoProj(null)}
        />
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:12, color:'var(--txt3)' }}>{projects.length} project{projects.length!==1?'s':''}</div>
        <Link href="/projects/create" className="btn btn-primary btn-sm"><Plus size={13}/> New Project</Link>
      </div>

      {projects.length === 0 && (
        <div className="empty-state"><div style={{ fontSize:32 }}>📁</div><div style={{ marginTop:8 }}>No projects yet.</div></div>
      )}

      {projects.map(proj => {
        const ptasks = tasks.filter(t => t.project_name === proj.name)
        const done   = ptasks.filter(t => t.status === 'Completed').length
        const pct    = ptasks.length ? Math.round(done / ptasks.length * 100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} className="proj-card">
            {/* Project header row */}
            <div className="proj-header">
              <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor:'pointer' }}
                onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
                <ChevronRight size={14} color="var(--txt3)"
                  style={{ transform: isOpen?'rotate(90deg)':'', transition:'transform 0.2s', flexShrink:0 }}/>
                <div className="proj-dot" style={{ background: proj.color_code||'#378ADD' }}/>
                <div className="proj-name">{proj.name}</div>
                <div className="proj-meta">{ptasks.length} task{ptasks.length!==1?'s':''}</div>
                <div style={{ fontSize:12, color:'var(--txt3)' }}>{pct}%</div>
                <div className="prog-bar" style={{ width:60, marginTop:0 }}>
                  <div className="prog-fill" style={{ width:`${pct}%`, background: proj.color_code||'#378ADD' }}/>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                {/* Info button */}
                <button
                  onClick={e => { e.stopPropagation(); setInfoProj(proj) }}
                  title="Project info"
                  style={{ background:'none', border:'0.5px solid var(--brd2)', borderRadius:'var(--r)',
                    cursor:'pointer', color:'var(--txt3)', display:'flex', alignItems:'center',
                    justifyContent:'center', width:28, height:28, transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--txt)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--txt3)' }}>
                  <Info size={13}/>
                </button>
                <Link href="/tasks/create" className="btn btn-sm" title="Add task">
                  <Plus size={12}/>
                </Link>
                {canDelete && (
                  <button onClick={() => deleteProject(proj)} title="Delete project"
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:'#cc3333', display:'flex', padding:4 }}>
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>

            {/* Task list */}
            {isOpen && (
              <div style={{ paddingLeft:22, paddingRight:16, paddingBottom:10 }}>
                <div style={{ borderTop:'0.5px solid var(--brd)', marginBottom:8 }}/>
                {ptasks.length === 0
                  ? <div style={{ fontSize:13, color:'var(--txt3)', padding:'4px 0' }}>No tasks yet.</div>
                  : ptasks.map(t => {
                      const subs    = subtasks.filter(s => s.parent_task_id === t.id)
                      const taskOpen = !collTask[t.id]
                      return (
                        <div key={t.id}>
                          <div className="task-row" style={{ marginBottom: subs.length&&taskOpen ? 3 : 6 }}>
                            {subs.length > 0 && (
                              <ChevronRight size={12} color="var(--txt3)"
                                style={{ transform: taskOpen?'rotate(90deg)':'', transition:'transform 0.2s',
                                  cursor:'pointer', flexShrink:0 }}
                                onClick={e => { e.stopPropagation(); setCollTask(c => ({ ...c, [t.id]: !c[t.id] })) }}/>
                            )}
                            {subs.length === 0 && <div style={{ width:12, flexShrink:0 }}/>}
                            <StatusDot status={t.status}/>
                            <div className="task-name" style={{ flex:1, cursor:'pointer' }}
                              onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                            <div className="task-meta">
                              <span>{t.owner}</span>
                              <span>{t.end_date}</span>
                            </div>
                            {(t.tags||[]).map((tag:string) =>
                              <span key={tag} className="pill pill-tag" style={{ fontSize:10 }}>{tag}</span>
                            )}
                            <StatusPill status={t.status}/>
                            <button onClick={() => router.push(`/tasks/${t.id}`)} className="btn btn-sm"
                              style={{ padding:'2px 6px', fontSize:11 }}>Edit</button>
                            {canDelete && (
                              <button onClick={() => deleteTask(t.id, t.topic)}
                                style={{ background:'none', border:'none', cursor:'pointer',
                                  color:'#cc3333', display:'flex', padding:4 }}>
                                <Trash2 size={13}/>
                              </button>
                            )}
                          </div>

                          {subs.length > 0 && taskOpen && (
                            <div style={{ paddingLeft:28, marginBottom:6 }}>
                              {subs.map(s => (
                                <div key={s.id} className="sub-row"
                                  style={{ border:'0.5px solid var(--brd)', borderRadius:'var(--r)', marginBottom:3 }}>
                                  <span style={{ color:'var(--txt3)', fontSize:12 }}>↳</span>
                                  <span style={{ flex:1 }}>{s.topic}</span>
                                  <span style={{ fontSize:11, color:'var(--txt3)' }}>{s.start_date} → {s.end_date}</span>
                                  <StatusPill status={s.status}/>
                                  {canDelete && (
                                    <button onClick={() => deleteSubtask(s.id, s.topic)}
                                      style={{ background:'none', border:'none', cursor:'pointer',
                                        color:'#cc3333', display:'flex', padding:2 }}>
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
