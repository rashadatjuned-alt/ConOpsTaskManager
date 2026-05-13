'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, use } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Folder, Users, ListTodo, Calendar, ChevronRight, Edit3, Clock, X, Check, Trash2, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

interface ProjectDetailProps {
  params: Promise<{ id: string }>
}

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '?')[0].toUpperCase()
}

export default function ProjectDetail({ params }: ProjectDetailProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const [project, setProject] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadProjectData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Load all independent datasets on parallel fast-tracks
      const [projRes, tasksRes, usersRes, pmRes, taRes] = await Promise.all([
        supabase.from('Projects').select('*').eq('id', id).single(),
        supabase.from('Tasks').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('Users').select('id, full_name, email, role'),
        supabase.from('project_members').select('*').eq('project_id', id),
        supabase.from('task_assignees').select('*')
      ])

      if (projRes.error || !projRes.data) {
        alert("Could not load project metadata options.")
        router.push('/all-projects')
        return
      }

      const proj = projRes.data
      const fetchedUsers = usersRes.data || []
      const pmRows = pmRes.data || []
      const taRows = taRes.data || []

      // Identify my current operational role
      const currentUser = fetchedUsers.find(u => u.id === session.user.id)
      setMyRole(currentUser?.role || 'Team Member')

      // Stitch matching roster profiles relationally
      const currentRosterIds = pmRows.map(row => row.user_id)
      const projectTeam = fetchedUsers.filter(u => currentRosterIds.includes(u.id))

      // Stitch active task assignees structures relationally inside client memory
      const projectTasks = (tasksRes.data || []).map(task => ({
        ...task,
        task_assignees: taRows.filter(ta => ta.task_id === task.id)
      }))

      setProject(proj)
      setMembers(projectTeam)
      setTasks(projectTasks)
      setAllUsers(fetchedUsers)
    } catch (err: any) {
      console.error("Critical error inside load engine:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjectData()
  }, [id])

  // ── REMOVE MEMBER (Leveraging our real-time database automation triggers) ──
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this project? This will automatically clear all their individual task allocations under this scope.`)) return
    
    setRemovingId(memberId)
    try {
      // Direct delete command targeted at the junction table
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', id)
        .eq('user_id', memberId)

      if (error) throw error

      // Hot reload to capture fresh automated states from the server
      await loadProjectData()
    } catch (err: any) {
      alert(`Failed to remove team member: ${err.message}`)
    } finally {
      setRemovingId(null)
    }
  }

  const completedTasksCount = tasks.filter(t => t.status === 'Completed').length
  const progressPercentage = tasks.length ? Math.round((completedTasksCount / tasks.length) * 100) : 0
  const isManagerOrAdmin = myRole === 'Admin' || myRole === 'Manager'

  if (loading) {
    return (
      <AppShell title="Project Scope Workspace">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading deep project parameters...</div>
      </AppShell>
    )
  }

  return (
    <AppShell title={project?.name || "Project View"}>
      {/* HEADER NAVIGATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => router.push('/all-projects')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--txt2)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to Portfolio
        </button>
        {isManagerOrAdmin && (
          <Link href={`/projects/edit/${id}`} style={{ textDecoration: 'none', background: 'var(--txt)', color: 'var(--card-bg)', padding: '8px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
            <Edit3 size={14} /> Edit Project Scope
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: CORE PARAMETERS & WORK PACKAGES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* META DESCRIPTION CARD */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: project?.color_code || '#3B82F6' }} />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--txt)' }}>Overview Summary</h2>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {project?.description || "No customized mission objective details documented for this workspace row."}
            </p>
          </div>

          {/* ACTIVE WORK SCHEDULE INDEX */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>
                <ListTodo size={18} color="var(--txt3)" /> Associated Task Roster ({tasks.length})
              </div>
              <Link href={`/tasks/create?project_id=${id}`} style={{ fontSize: 12, fontWeight: 700, color: project?.color_code || '#3B82F6', textDecoration: 'none' }}>＋ Add Task</Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontStyle: 'italic', fontSize: 13 }}>No tracking nodes allocated to this scope vector yet.</div>
              ) : (
                tasks.map(task => {
                  const assignees = (task.task_assignees || []).map((ta: any) => allUsers.find(u => u.id === ta.user_id)).filter(Boolean)
                  return (
                    <div key={task.id} onClick={() => router.push(`/tasks/${task.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--brd)', cursor: 'pointer', transition: '0.2s' }} className="hover-lift">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <StatusDot status={task.status} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{task.topic}</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2 }}>Deadline: {task.end_date || '—'}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex' }}>
                          {assignees.slice(0, 3).map((u: any, i: number) => (
                            <div key={u.id} style={{ width: 20, height: 20, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, border: '1px solid var(--bg)', marginLeft: i > 0 ? '-4px' : 0 }} title={u.full_name}>{ini(u.full_name)}</div>
                          ))}
                        </div>
                        <ChevronRight size={16} color="var(--txt3)" />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PROGRESS TRACKERS & TEAM ROSTER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* PROGRESS METRICS CARD */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 12 }}>Execution Delivery Tracker</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--txt)' }}>{progressPercentage}%</span>
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Complete</span>
            </div>
            <div style={{ height: 6, width: '100%', background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--brd)' }}>
              <div style={{ width: `${progressPercentage}%`, height: '100%', background: project?.color_code || '#3B82F6', transition: 'width 0.4s' }} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: 'var(--txt2)' }}>
              {completedTasksCount} out of {tasks.length} sub-deliverables marked complete
            </div>
          </div>

          {/* PROJECT RESOURCES DOCUMENTATION */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 12 }}>Linked Resource Assets</div>
            {(!project?.resources || project.resources.length === 0) ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No documentation linked to this project root row.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(project.resources as Resource[]).map((res, index) => (
                  <div key={index} style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg2)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--brd)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{res.title || 'Reference Link'}</span>
                    <a href={res.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: project?.color_code || '#3B82F6', textDecoration: 'underline', wordBreak: 'break-all' }}>{res.link}</a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TEAM MEMBERS CARD LIST */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--txt)', marginBottom: 16 }}>
              <Users size={16} color="var(--txt3)" /> Assigned Team Roster ({members.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map((member, idx) => {
                const isUserRemoving = removingId === member.id
                return (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--brd)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
                        {ini(member.full_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{member.full_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'capitalize' }}>{member.role || 'Member'}</div>
                      </div>
                    </div>

                    {isManagerOrAdmin && (
                      <button 
                        onClick={() => handleRemoveMember(member.id, member.full_name)}
                        disabled={isUserRemoving}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: isUserRemoving ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700, padding: 4 }}
                        title="Remove member from deployment team list"
                      >
                        {isUserRemoving ? '...' : '✕'}
                      </button>
                    )}
                  </div>
                )
              })}

              {members.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--txt3)', fontStyle: 'italic', fontSize: 12 }}>No personnel added to this project portfolio array cluster.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}