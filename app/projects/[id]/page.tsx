'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, use } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Folder, Users, ListTodo, Calendar, ChevronRight, Edit3, Clock, X, Check, Trash2, ArrowLeft, Link as LinkIcon
} from 'lucide-react'
import Link from 'next/link'

// ── FIXED IMPORTS & CONSTANTS ──
import { StatusDot } from '@/components/ui/StatusPill'
import type { Resource } from '@/types'

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']
// ───────────────────────────────

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

      const currentUser = fetchedUsers.find(u => u.id === session.user.id)
      setMyRole(currentUser?.role || 'Team Member')

      const currentRosterIds = pmRows.map(row => row.user_id)
      const projectTeam = fetchedUsers.filter(u => currentRosterIds.includes(u.id))

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

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this project? This will automatically clear all their individual task allocations under this scope.`)) return
    
    setRemovingId(memberId)
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', id)
        .eq('user_id', memberId)

      if (error) throw error
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
      
      {/* ── VISUAL CSS INJECTION ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .workspace-container { max-width: 1280px; margin: 0 auto; }
        .action-bar { display: flex; justify-content: space-between; align-items: center; background: var(--bg2); padding: 16px 24px; border-radius: 16px; border: 1px solid var(--brd); margin-bottom: 24px; }
        .canvas-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: flex-start; }
        
        .card { background: var(--bg); border: 1px solid var(--brd); border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 24px; }
        .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--brd); padding-bottom: 16px; margin-bottom: 20px; }
        .card-title { font-size: 13px; font-weight: 800; color: var(--txt); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; }
        
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; border: none; text-decoration: none; }
        .btn-ghost { background: transparent; color: var(--txt2); border: 1px solid transparent; }
        .btn-ghost:hover { background: var(--bg); border-color: var(--brd); color: var(--txt); }
        .btn-primary { background: var(--txt); color: var(--bg); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .btn-primary:hover { transform: translateY(-1px); opacity: 0.9; }
        
        .hover-lift { transition: all 0.2s ease; border: 1px solid var(--brd); }
        .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.06); border-color: var(--txt3); background: var(--bg); }
      `}} />

      <div className="workspace-container">
        
        {/* ── TOP UTILITY COMMAND BAR ── */}
        <div className="action-bar">
          <button onClick={() => router.push('/all-projects')} className="btn btn-ghost">
            <ArrowLeft size={16} /> Back to Portfolio
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', background: 'var(--bg)', borderRadius: 20, border: '1px solid var(--brd)' }}>
              Status: {project?.status || 'Active'}
            </span>
            {isManagerOrAdmin && (
              <Link href={`/projects/edit/${id}`} className="btn btn-primary">
                <Edit3 size={14} /> Edit Project Scope
              </Link>
            )}
          </div>
        </div>

        {/* ── MAIN CANVAS CONTENT GRID ── */}
        <div className="canvas-grid">
          
          {/* LEFT COLUMN: CORE PARAMETERS & WORK PACKAGES */}
          <div className="left-compartment">
            
            {/* META DESCRIPTION CARD */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: project?.color_code || '#3B82F6' }} />
                  Overview Summary
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {project?.description || "No customized mission objective details documented for this workspace row."}
              </p>
            </div>

            {/* ACTIVE WORK SCHEDULE INDEX */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><ListTodo size={16} color="var(--txt3)" /> Associated Task Roster ({tasks.length})</div>
                <Link href={`/tasks/create?project_id=${id}`} className="btn btn-ghost" style={{ color: project?.color_code || '#3B82F6', border: `1px solid ${project?.color_code || '#3B82F6'}33` }}>
                  ＋ Add Task
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontStyle: 'italic', fontSize: 13, background: 'var(--bg2)', borderRadius: 12 }}>No tracking nodes allocated to this scope vector yet.</div>
                ) : (
                  tasks.map(task => {
                    const assignees = (task.task_assignees || []).map((ta: any) => allUsers.find(u => u.id === ta.user_id)).filter(Boolean)
                    return (
                      <div key={task.id} onClick={() => router.push(`/tasks/${task.id}`)} className="hover-lift" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg2)', borderRadius: 12, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <StatusDot status={task.status} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>{task.topic}</div>
                            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4, display: 'flex', gap: 12 }}>
                              <span>Deadline: {task.end_date || '—'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ display: 'flex' }}>
                            {assignees.slice(0, 3).map((u: any, i: number) => (
                              <div key={u.id} style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, border: '2px solid var(--bg2)', marginLeft: i > 0 ? '-6px' : 0 }} title={u.full_name}>{ini(u.full_name)}</div>
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
          <div className="right-compartment" style={{ position: 'sticky', top: 24 }}>
            
            {/* PROGRESS METRICS CARD */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: 16 }}>
                <div className="card-title">Execution Delivery Tracker</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--txt)', letterSpacing: '-0.02em' }}>{progressPercentage}%</span>
                <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, textTransform: 'uppercase' }}>Complete</span>
              </div>
              <div style={{ height: 8, width: '100%', background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--brd)' }}>
                <div style={{ width: `${progressPercentage}%`, height: '100%', background: project?.color_code || '#3B82F6', transition: 'width 0.4s ease-out' }} />
              </div>
              <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--txt2)' }}>
                {completedTasksCount} out of {tasks.length} sub-deliverables marked complete
              </div>
            </div>

            {/* TEAM MEMBERS CARD LIST */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Users size={16} color="var(--txt3)" /> Assigned Roster ({members.length})</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {members.map((member, idx) => {
                  const isUserRemoving = removingId === member.id
                  return (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--brd)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                          {ini(member.full_name)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{member.full_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'capitalize', fontWeight: 600 }}>{member.role || 'Member'}</div>
                        </div>
                      </div>

                      {isManagerOrAdmin && (
                        <button 
                          onClick={() => handleRemoveMember(member.id, member.full_name)}
                          disabled={isUserRemoving}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: isUserRemoving ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700, padding: 4, opacity: isUserRemoving ? 0.5 : 1 }}
                          title="Remove member from deployment team list"
                        >
                          {isUserRemoving ? '...' : '✕'}
                        </button>
                      )}
                    </div>
                  )
                })}

                {members.length === 0 && (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--txt3)', fontStyle: 'italic', fontSize: 12 }}>No personnel added to this project array cluster.</div>
                )}
              </div>
            </div>

            {/* PROJECT RESOURCES DOCUMENTATION */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><LinkIcon size={16} color="var(--txt3)"/> Linked Assets</div>
              </div>
              {(!project?.resources || project.resources.length === 0) ? (
                <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No documentation linked to this project root row.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(project.resources as any[]).map((res, index) => (
                    <div key={index} style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg2)', padding: '12px', borderRadius: 10, border: '1px solid var(--brd)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{res.title || 'Reference Link'}</span>
                      <a href={res.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: project?.color_code || '#3B82F6', textDecoration: 'underline', wordBreak: 'break-all' }}>{res.link}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}