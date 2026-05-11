'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Plus, Info, X, Users, Calendar, Clock, Search } from 'lucide-react'
import Link from 'next/link'

// ─── Project Info Modal ───────────────────────────────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose }: {
  proj: any; tasks: any[]; allUsers: any[]; onClose: () => void
}) {
  const projTasks  = tasks.filter(t => t.project_name === proj.name)
  const done       = projTasks.filter(t => t.status === 'Completed').length
  const pct        = projTasks.length ? Math.round(done / projTasks.length * 100) : 0

  const members = (proj.members || [])
    .map((id: string) => allUsers.find((u: any) => u.id === id))
    .filter(Boolean)

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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'var(--bg)', borderRadius:'var(--rl)', width:480,
        maxHeight:'85vh', overflow:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>

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
          <div style={{ height:4, background:'rgba(255,255,255,0.3)', borderRadius:2,
            marginTop:10, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'#fff', borderRadius:2 }}/>
          </div>
        </div>

        <div style={{ padding:'20px 24px' }}>
          {proj.description && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase',
                letterSpacing:'0.06em', color:'var(--txt3)', marginBottom:6 }}>Description</div>
              <div style={{ fontSize:13, color:'var(--txt2)', lineHeight:1.6 }}>{proj.description}</div>
            </div>
          )}

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
  const [allUsers,  setAllUsers]  = useState<any[]>([])
  const [myRole,    setMyRole]    = useState('')
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const [infoProj,  setInfoProj]  = useState<any|null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || '')
      
      // Note: Removed Subtasks fetch to optimize loading since they are not rendered
      const [p, t, us] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Users').select('id,full_name,email,role'),
      ])
      setProjects(p.data || [])
      setTasks(t.data || [])
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
    if (!confirm(`Delete project "${proj.name}"?`)) return
    await supabase.from('Projects').delete().eq('id', proj.id)
    setProjects(prev => prev.filter(p => p.id !== proj.id))
  }

  const deleteTask = async (taskId: string, topic: string) => {
    if (!confirm(`Delete task "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('parent_task_id', taskId) // Clean up DB even if not rendering
    await supabase.from('Tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const filteredProjects = projects.filter(proj => 
    proj.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <AppShell title="All Projects">
      {infoProj && (
        <ProjectInfoModal
          proj={infoProj} tasks={tasks} allUsers={allUsers}
          onClose={() => setInfoProj(null)}
        />
      )}

      {/* Top Controls */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }} />
          <input 
            type="text" 
            placeholder="Search projects..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 'var(--r)', border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)' }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize:13, color:'var(--txt3)' }}>{filteredProjects.length} projects</div>
          <Link href="/projects/create" className="btn btn-primary btn-sm" style={{ padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <Plus size={14}/> New Project
          </Link>
        </div>
      </div>

      {filteredProjects.length === 0 && (
        <div className="empty-state">No projects found.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredProjects.map(proj => {
          const ptasks = tasks.filter(t => t.project_name === proj.name)
          const done   = ptasks.filter(t => t.status === 'Completed').length
          const pct    = ptasks.length ? Math.round(done / ptasks.length * 100) : 0
          const isOpen = !collapsed[proj.id]

          return (
            <div key={proj.id} style={{ border: '1px solid var(--brd)', borderRadius: 'var(--rl)', background: 'var(--bg)', overflow: 'hidden' }}>
              
              {/* Project Header Row */}
              <div 
                style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? 'var(--bg2)' : 'transparent', transition: 'background 0.2s' }}
                onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}
              >
                {/* Left side: Chevron & Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <ChevronRight size={18} color="var(--txt3)" style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: 'transform 0.2s' }}/>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color_code || '#378ADD' }}/>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--txt)' }}>{proj.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--txt3)', marginLeft: 8 }}>{ptasks.length} task{ptasks.length !== 1 ? 's' : ''}</div>
                </div>

                {/* Right side: Progress Bar & Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  {/* Progress Tracker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 140 }}>
                    <span style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 500, minWidth: 32 }}>{pct}%</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--brd)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || '#378ADD', borderRadius: 3, transition: 'width 0.3s ease' }}/>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setInfoProj(proj) }}
                      style={{ background: 'none', border: '1px solid var(--brd)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt2)', cursor: 'pointer' }}
                      title="Project Information"
                    >
                      <Info size={14}/>
                    </button>
                    <Link 
                      href="/tasks/create" 
                      onClick={e => e.stopPropagation()}
                      style={{ background: 'none', border: '1px solid var(--brd)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt2)', cursor: 'pointer' }}
                      title="Add Task"
                    >
                      <Plus size={14}/>
                    </Link>
                    {canDelete && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteProject(proj); }}
                        style={{ background: 'none', border: '1px solid transparent', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}
                        title="Delete Project"
                      >
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Main Tasks List (NO Subtasks) */}
              {isOpen && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--brd)' }}>
                  {ptasks.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--txt3)', padding: '8px 0', textAlign: 'center' }}>No tasks assigned to this project yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ptasks.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--brd)' }}>
                          
                          {/* Task Name & Dot */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <StatusDot status={t.status}/>
                            <div 
                              style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              onClick={() => router.push(`/tasks/${t.id}`)}
                            >
                              {t.topic}
                            </div>
                          </div>

                          {/* Task Dates, Status & Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                            <div style={{ fontSize: 13, color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                               <Calendar size={13} color="var(--txt3)" />
                               <span>{t.start_date || 'TBD'} <span style={{ color: 'var(--txt3)', margin: '0 4px' }}>→</span> {t.end_date || 'TBD'}</span>
                            </div>

                            <div style={{ width: 100, display: 'flex', justifyContent: 'flex-end' }}>
                               <StatusPill status={t.status}/>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid var(--brd)', paddingLeft: 16 }}>
                              <button 
                                onClick={() => router.push(`/tasks/${t.id}`)} 
                                style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 12, color: 'var(--txt)', cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              {canDelete && (
                                <button 
                                  onClick={() => deleteTask(t.id, t.topic)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: 4 }}
                                >
                                  <Trash2 size={14}/>
                                </button>
                              )}
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
