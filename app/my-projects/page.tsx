'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusPill'
import { 
  Folder, Plus, LayoutGrid, Columns, ChevronRight, MoreVertical, Clock, X, Edit3, CheckCircle2 
} from 'lucide-react'
import Link from 'next/link'

const PROJECT_STATUSES = ['Active', 'On-Hold', 'Completed']
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']
const PROJECT_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#84CC16', '#EF4444', '#4D7C0F', '#B45309', '#0284C7', '#2DD4BF', '#EC4899']

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '??').slice(0, 2).toUpperCase()
}

export default function MyProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('user')
  const [view, setView] = useState<'grid' | 'kanban'>('grid')
  
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})

  const loadData = async () => {
    try {
      setLoading(true)
      
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      // 1. UPDATED QUERY: Using the project_members join table
      const [p, t, us, st] = await Promise.all([
        supabase
          .from('Projects')
          .select(`
            *,
            project_members!inner (user_id)
          `)
          .eq('project_members.user_id', authData.user.id) // Only fetch projects I am in
          .order('name'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Users').select('id, full_name, email, role'),
        supabase.from('Subtasks').select('*').order('end_date')
      ])
      
      const fetchedUsers = us.data || []
      const currentUser = fetchedUsers.find(u => u.id === authData.user?.id)
      setMyRole(currentUser?.role || 'user')

      const allTasks = t.data || []
      const allSubtasks = st.data || []
      const rawProjects = p.data || []

      // 2. REFACTORED MAPPING: Using relational data
      const myEnrichedProjects = rawProjects.map((proj) => {
        // Filter tasks belonging to this project
        const projTasks = allTasks.filter(task => String(task.project_name) === String(proj.name))
        const projTaskIds = projTasks.map(task => task.id)
        
        // Calculate Progress
        const doneTasks = projTasks.filter(task => task.status === 'Completed').length
        const progressPct = projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : 0

        // Determine Active Members using IDs from the join table
        // We select ALL members for these projects to show the avatars correctly
        const activeMembers = fetchedUsers.filter(u => 
          proj.project_members?.some((m: any) => m.user_id === u.id)
        )

        return {
          ...proj,
          taskCount: projTasks.length,
          doneCount: doneTasks,
          progress: progressPct,
          activeMembers,
          projectColor: proj.color_code || PROJECT_COLORS[0]
        }
      })

      setProjects(myEnrichedProjects)
      setTasks(allTasks)
      setSubtasks(allSubtasks)
      setAllUsers(fetchedUsers)

    } catch (error) {
      console.error("Error loading My Projects:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const canEdit = myRole === 'admin' || myRole === 'manager'

  const getTaskMembers = (item: any) => {
    if (!item) return [];
    return allUsers.filter(u => 
      (item.owner && item.owner.includes(u.full_name)) || 
      (item.assignees && item.assignees.includes(u.full_name))
    );
  }

  return (
    <AppShell title="My Projects">
      
      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className={view === 'grid' ? 'btn btn-primary' : 'btn'} onClick={() => setView('grid')} style={{ borderRadius: 10 }}><LayoutGrid size={16} /></button>
          <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')} style={{ borderRadius: 10 }}><Columns size={16} /></button>
        </div>

        {canEdit && (
          <Link href="/projects/create" className="btn-primary-action" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={14} /> New Project
          </Link>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', fontSize: 13, fontWeight: 600 }}>Loading your projects...</div>
      ) : projects.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg2)', border: '1px dashed var(--brd)', borderRadius: 14 }}>
           <Folder size={32} color="var(--txt3)" style={{ margin: '0 auto 12px auto' }} />
           <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>No projects found</div>
           <div style={{ fontSize: 12, color: 'var(--txt3)' }}>You haven't been assigned to any projects or tasks yet.</div>
        </div>
      ) : (
        <>
          {view === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {projects.map((proj) => (
                <div 
                  key={proj.id} 
                  onClick={() => setSelectedProject(proj)} 
                  style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} 
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${proj.projectColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Folder size={18} color={proj.projectColor} />
                      </div>
                      <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2 }}>{proj.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600, marginTop: 4 }}>{proj.status || 'Active'}</div>
                      </div>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}><MoreVertical size={16} /></button>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 8 }}>
                        <span>Progress</span>
                        <span>{proj.progress}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${proj.progress}%`, height: '100%', background: proj.projectColor, transition: 'width 0.5s ease-out' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600, marginTop: 8 }}>
                      {proj.doneCount} of {proj.taskCount} tasks completed
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--brd)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {proj.activeMembers.slice(0, 4).map((u: any, i: number) => (
                        <div key={u.id} title={u.full_name} style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-8px' : '0', zIndex: 10 - i }}>
                          {ini(u.full_name)}
                        </div>
                      ))}
                      {proj.activeMembers.length > 4 && (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg2)', color: 'var(--txt2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, border: '2px solid var(--bg)', marginLeft: '-8px', zIndex: 0 }}>
                            +{proj.activeMembers.length - 4}
                          </div>
                      )}
                    </div>
                    
                    {proj.end_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>
                        <Clock size={12} /> {proj.end_date}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'kanban' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {PROJECT_STATUSES.map(status => {
                const colProjs = projects.filter(p => (p.status || 'Active') === status);
                return (
                  <div key={status} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 12, minHeight: '80vh', border: '1px solid var(--brd)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--txt)' }}>{status}</div>
                      <span style={{ fontSize: 10, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--txt3)', fontWeight: 700 }}>{colProjs.length}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {colProjs.map((proj) => (
                        <div key={proj.id} onClick={() => setSelectedProject(proj)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 16, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} className="hover-lift">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.projectColor }} />
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{proj.name}</div>
                          </div>
                          
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
                                <span>Progress</span>
                                <span>{proj.progress}%</span>
                            </div>
                            <div style={{ width: '100%', height: 4, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ width: `${proj.progress}%`, height: '100%', background: proj.projectColor }} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {proj.activeMembers.slice(0, 3).map((u: any, i: number) => (
                                <div key={u.id} title={u.full_name} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-6px' : '0', zIndex: 10 - i }}>{ini(u.full_name)}</div>
                              ))}
                            </div>
                            {proj.end_date && <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600 }}>{proj.end_date}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* MODAL */}
      {selectedProject && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedProject(null)}>
          <div style={{ background: 'var(--bg)', width: '100%', maxWidth: 800, maxHeight: '90vh', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--bg2)' }}>
               <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedProject.projectColor }} />
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', margin: 0 }}>{selectedProject.name}</h2>
                    <span style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg)', borderRadius: 20, border: '1px solid var(--brd)', fontWeight: 600 }}>{selectedProject.status || 'Active'}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--txt3)', margin: 0, maxWidth: 600 }}>{selectedProject.description || 'No project description provided.'}</p>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 {canEdit && (
                    <button onClick={() => router.push(`/projects/${selectedProject.id}`)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10 }}>
                      <Edit3 size={14} /> Edit Project
                    </button>
                 )}
                 <button onClick={() => setSelectedProject(null)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--txt2)' }}>
                    <X size={18} />
                 </button>
               </div>
            </div>

            <div style={{ padding: 32, overflowY: 'auto', flex: 1 }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
                  <div style={{ border: '1px solid var(--brd)', padding: 16, borderRadius: 14 }}>
                     <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 8 }}>Overall Progress</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                           <div style={{ width: `${selectedProject.progress}%`, height: '100%', background: selectedProject.projectColor }} />
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{selectedProject.progress}%</span>
                     </div>
                  </div>
                  <div style={{ border: '1px solid var(--brd)', padding: 16, borderRadius: 14 }}>
                     <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 8 }}>Timeline</div>
                     <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>
                        {selectedProject.start_date ? `${selectedProject.start_date} to ${selectedProject.end_date}` : 'Not scheduled'}
                     </div>
                  </div>
                  <div style={{ border: '1px solid var(--brd)', padding: 16, borderRadius: 14 }}>
                     <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 12 }}>Team Members</div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 100, overflowY: 'auto', paddingRight: 4 }}>
                        {selectedProject.activeMembers.length > 0 ? selectedProject.activeMembers.map((u: any, i: number) => (
                          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                             <div style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, border: '1px solid var(--bg)', flexShrink: 0 }}>
                               {ini(u.full_name)}
                             </div>
                             <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                               {u.full_name}
                             </span>
                          </div>
                        )) : <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No members found.</div>}
                     </div>
                  </div>
               </div>

               <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', marginBottom: 16, borderBottom: '1px solid var(--brd)', paddingBottom: 12 }}>Project Tasks</h3>
               
               <div style={{ border: '1px solid var(--brd)', borderRadius: 14, overflow: 'hidden' }}>
                  {tasks.filter(t => t.project_name === selectedProject.name).map(t => {
                     const relatedSubs = subtasks.filter(st => String(st.parent_task_id) === String(t.id));
                     const isTaskExpanded = expandedTasks[t.id];
                     const taskMembers = getTaskMembers(t);

                     return (
                        <div key={t.id} style={{ borderBottom: '1px solid var(--brd)', background: 'var(--bg)' }}>
                           <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 100px', alignItems: 'center', padding: '12px 16px' }}>
                              <div style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={() => setExpandedTasks(prev => ({ ...prev, [t.id]: !prev[t.id] }))}>
                                {relatedSubs.length > 0 ? (
                                   <ChevronRight size={14} style={{ transform: isTaskExpanded ? 'rotate(90deg)' : '', transition: '0.2s', color: '#3B82F6' }} />
                                ) : <StatusDot status={t.status} />}
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>
                                <span onClick={() => router.push(`/tasks/${t.id}`)} style={{ cursor: 'pointer' }} className="hover-underline">{t.topic}</span>
                                {relatedSubs.length > 0 && (
                                   <span style={{ fontSize: 10, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 10, marginLeft: 10, color: 'var(--txt3)' }}>
                                     {relatedSubs.filter(st => st.status === 'Completed').length}/{relatedSubs.length} Subtasks
                                   </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 500 }}>{t.end_date}</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {taskMembers.slice(0,3).map((u: any, i: number) => (
                                  <div key={u.id} title={u.full_name} style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-8px' : '0', zIndex: 10-i }}>{ini(u.full_name)}</div>
                                ))}
                              </div>
                           </div>

                           {isTaskExpanded && relatedSubs.map(st => (
                              <div key={st.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 100px', alignItems: 'center', padding: '10px 16px 10px 40px', background: 'var(--bg2)', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                                 <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    {st.status === 'Completed' ? <CheckCircle2 size={12} color="#639922" /> : <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--txt3)' }} />}
                                 </div>
                                 <div style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 500 }}>{st.topic}</div>
                                 <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{st.end_date || '-'}</div>
                                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {getTaskMembers(st).slice(0,3).map((u: any, i: number) => (
                                       <div key={u.id} title={u.full_name} style={{ width: 20, height: 20, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '1px solid var(--bg)', marginLeft: i > 0 ? '-4px' : '0' }}>{ini(u.full_name)}</div>
                                    ))}
                                 </div>
                              </div>
                           ))}
                        </div>
                     )
                  })}
                  {tasks.filter(t => t.project_name === selectedProject.name).length === 0 && (
                     <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No tasks assigned yet.</div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}