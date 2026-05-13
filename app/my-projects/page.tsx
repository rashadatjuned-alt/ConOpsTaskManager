'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusPill'
import { 
  Folder, Plus, LayoutGrid, Columns, ChevronRight, MoreVertical, Clock, X, Edit3 
} from 'lucide-react'
import Link from 'next/link'

const PROJECT_STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed']
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']
const PROJECT_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#84CC16', '#EF4444', '#4D7C0F', '#B45309', '#0284C7', '#2DD4BF', '#EC4899']

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '?')[0].toUpperCase()
}

export default function MyProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('user')
  const [view, setView] = useState<'grid' | 'kanban'>('grid')
  const [selectedProject, setSelectedProject] = useState<any | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const myId = session.user.id

      // Pull relational datasets concurrently
      const [pRes, tRes, uRes, pmRes, taRes] = await Promise.all([
        supabase.from('Projects').select('*'),
        supabase.from('Tasks').select('*'),
        supabase.from('Users').select('id,full_name,role'),
        supabase.from('project_members').select('*'),
        supabase.from('task_assignees').select('*')
      ])

      const fetchedUsers = uRes.data || []
      const me = fetchedUsers.find(u => u.id === myId)
      setMyRole(me?.role || 'Team Member')

      const globalTasks = tRes.data || []
      const pmRows = pmRes.data || []
      const taRows = taRes.data || []

      // Filter down to only projects where I am a roster team member
      const assignedProjectIds = pmRows.filter(row => row.user_id === myId).map(row => row.project_id)
      const allowedProjects = (pRes.data || []).filter(p => assignedProjectIds.includes(p.id))

      const myEnrichedProjects = allowedProjects.reduce((acc: any[], proj, idx) => {
        const projTasks = globalTasks.filter(t => t.project_id === proj.id || t.project_name === proj.name)
        const doneTasks = projTasks.filter(t => t.status === 'Completed').length
        const progressPct = projTasks.length ? Math.round((doneTasks / projTasks.length) * 100) : 0

        // Gather full user structures for everyone on this project's roster table
        const rosterUserIds = pmRows.filter(row => row.project_id === proj.id).map(row => row.user_id)
        const activeMembers = fetchedUsers.filter(u => rosterUserIds.includes(u.id))

        acc.push({
          ...proj,
          taskCount: projTasks.length,
          doneCount: doneTasks,
          progress: progressPct,
          activeMembers,
          projectColor: proj.color_code || PROJECT_COLORS[idx % PROJECT_COLORS.length]
        })
        return acc
      }, [])

      // Enrich tasks for the detail modal to show who is assigned via task_assignees
      const enrichedTasks = globalTasks.map(task => ({
        ...task,
        task_assignees: taRows.filter(ta => ta.task_id === task.id)
      }))

      setProjects(myEnrichedProjects)
      setTasks(enrichedTasks)
      setAllUsers(fetchedUsers)
    } catch (error) {
      console.error("Error loading My Projects:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const canEdit = myRole === 'Admin' || myRole === 'Manager'

  return (
    <AppShell title="My Projects">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className={view === 'grid' ? 'btn btn-primary' : 'btn'} onClick={() => setView('grid')} style={{ padding: 8, borderRadius: 10, cursor: 'pointer' }}><LayoutGrid size={16} /></button>
          <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')} style={{ padding: 8, borderRadius: 10, cursor: 'pointer' }}><Columns size={16} /></button>
        </div>
        {canEdit && (
          <Link href="/projects/create" className="btn-primary-action" style={{ textDecoration: 'none', background: 'var(--txt)', color: 'var(--bg)', padding: '8px 16px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}><Plus size={14} /> New Project</Link>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', fontSize: 13, fontWeight: 600 }}>Loading your projects...</div>
      ) : projects.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg2)', border: '1px dashed var(--brd)', borderRadius: 14 }}>
          <Folder size={32} color="var(--txt3)" style={{ margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>No projects found</div>
          <div style={{ fontSize: 12, color: 'var(--txt3)' }}>You haven't been added to any project rosters or relational tasks yet.</div>
        </div>
      ) : (
        <>
          {view === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {projects.map((proj) => (
                <div key={proj.id} onClick={() => setSelectedProject(proj)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} className="hover-lift">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${proj.projectColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Folder size={18} color={proj.projectColor} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2 }}>{proj.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600, marginTop: 4 }}>{proj.status || 'Not Started'}</div>
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
                      <div style={{ width: `${proj.progress}%`, height: '100%', background: proj.projectColor }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600, marginTop: 8 }}>{proj.doneCount} of {proj.taskCount} tasks completed</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--brd)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {proj.activeMembers.slice(0, 4).map((u: any, i: number) => (
                        <div key={u.id} title={u.full_name} style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-8px' : '0', zIndex: 10 - i }}>{ini(u.full_name)}</div>
                      ))}
                      {proj.activeMembers.length > 4 && (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg2)', color: 'var(--txt2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, border: '2px solid var(--bg)', marginLeft: '-8px' }}>+{proj.activeMembers.length - 4}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'kanban' && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PROJECT_STATUSES.length}, 1fr)`, gap: 16 }}>
              {PROJECT_STATUSES.map(status => {
                const colProjs = projects.filter(p => (p.status || 'Not Started') === status)
                return (
                  <div key={status} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 12, minHeight: '80vh', border: '1px solid var(--brd)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--txt)' }}>{status}</div>
                      <span style={{ fontSize: 10, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--txt3)', fontWeight: 700 }}>{colProjs.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {colProjs.map((proj) => (
                        <div key={proj.id} onClick={() => setSelectedProject(proj)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 16, cursor: 'pointer' }} className="hover-lift">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.projectColor }} />
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{proj.name}</div>
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}><span>Progress</span><span>{proj.progress}%</span></div>
                            <div style={{ width: '100%', height: 4, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${proj.progress}%`, height: '100%', background: proj.projectColor }} /></div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {proj.activeMembers.slice(0, 3).map((u: any, i: number) => (
                                <div key={u.id} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-6px' : '0' }}>{ini(u.full_name)}</div>
                              ))}
                            </div>
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

      {/* ── PROJECT OVERVIEW MODAL CONTAINER ── */}
      {selectedProject && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedProject(null)}>
          <div style={{ background: 'var(--bg)', width: '100%', maxWidth: 800, maxHeight: '90vh', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid var(--brd)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--bg2)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedProject.projectColor }} />
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', margin: 0 }}>{selectedProject.name}</h2>
                  <span style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg)', borderRadius: 20, border: '1px solid var(--brd)', fontWeight: 600 }}>{selectedProject.status || 'Not Started'}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt3)', margin: 0, maxWidth: 600 }}>{selectedProject.description || 'No project description provided.'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {canEdit && <button onClick={() => router.push(`/projects/${selectedProject.id}`)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '6px 12px', cursor: 'pointer' }}><Edit3 size={14} /> Edit</button>}
                <button onClick={() => setSelectedProject(null)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--txt2)' }}><X size={18} /></button>
              </div>
            </div>

            <div style={{ padding: 32, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
                <div style={{ border: '1px solid var(--brd)', padding: 16, borderRadius: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 8 }}>Overall Progress</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${selectedProject.progress}%`, height: '100%', background: selectedProject.projectColor }} /></div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{selectedProject.progress}%</span>
                  </div>
                </div>
                <div style={{ border: '1px solid var(--brd)', padding: 16, borderRadius: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 8 }}>Scope Status</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>{selectedProject.doneCount} / {selectedProject.taskCount} Tasks Complete</div>
                </div>
                <div style={{ border: '1px solid var(--brd)', padding: 16, borderRadius: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 8 }}>Project Resources</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{Array.isArray(selectedProject.resources) ? selectedProject.resources.length : 0} Assets Linked</div>
                </div>
              </div>

              {/* ── LIVE SCOPE TASKS ROSTER INDEX ── */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: 'var(--txt3)', letterSpacing: '0.05em', marginBottom: 12 }}>Active Task Scope</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.filter(t => t.project_id === selectedProject.id || t.project_name === selectedProject.name).map(task => {
                    const assignees = (task.task_assignees || []).map((ta: any) => allUsers.find((u: any) => u.id === ta.user_id)).filter(Boolean)
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--brd)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <StatusDot status={task.status} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{task.topic}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {assignees.map((u: any, idx: number) => (
                            <div key={u.id} style={{ width: 20, height: 20, borderRadius: '50%', background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, border: '1px solid var(--brd)' }}>{ini(u.full_name)}</div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}