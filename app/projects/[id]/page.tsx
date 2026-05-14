'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, use } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ChevronRight, Edit3, Trash, ArrowLeft, Link as LinkIcon, Plus, X, Save } from 'lucide-react'
import Link from 'next/link'
import type { Resource } from '@/types'

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

interface ProjectDetailProps {
  params: Promise<{ id: string }>
}

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '?')[0].toUpperCase()
}

const getPillClass = (status: string) => {
  if (status === 'In Progress') return 'pill-ip'
  if (status === 'On-Hold') return 'pill-oh'
  if (status === 'Completed') return 'pill-c'
  return 'pill-ns'
}

const getStatusColor = (status: string) => {
  if (status === 'In Progress') return '#378ADD'
  if (status === 'On-Hold') return '#EF9F27'
  if (status === 'Completed') return '#639922'
  return '#aaaaaa'
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
  const [deleting, setDeleting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null) // <-- RESTORED

  // ── Edit States ──
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editProject, setEditProject] = useState<any>(null)
  const [editMembers, setEditMembers] = useState<string[]>([])
  const [resources, setResources] = useState<Resource[]>([])

  const loadProjectData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: proj, error: projErr } = await supabase.from('Projects').select('*').eq('id', id).single()
      if (projErr || !proj) {
        alert("Could not load project metadata.")
        router.push('/all-projects')
        return
      }

      let { data: fetchedTasks, error: taskErr } = await supabase.from('Tasks').select('*').eq('project_id', id)
      if (taskErr || !fetchedTasks || fetchedTasks.length === 0) {
        const { data: fallbackTasks } = await supabase.from('Tasks').select('*').eq('project_name', proj.name)
        fetchedTasks = fallbackTasks || []
      }

      const [usersRes, pmRes, taRes] = await Promise.all([
        supabase.from('Users').select('id, full_name, email, role'),
        supabase.from('project_members').select('*').eq('project_id', id),
        supabase.from('task_assignees').select('*')
      ])

      const fetchedUsers = usersRes.data || []
      const pmRows = pmRes.data || []
      const taRows = taRes.data || []

      const currentUser = fetchedUsers.find(u => String(u.id) === String(session.user.id))
      setMyRole(currentUser?.role || 'Team Member')

      const currentRosterIds = pmRows.map(row => String(row.user_id))
      const projectTeam = fetchedUsers.filter(u => currentRosterIds.includes(String(u.id)))

      const projectTasks = (fetchedTasks || []).map(task => ({
        ...task,
        task_assignees: taRows.filter(ta => String(ta.task_id) === String(task.id))
      }))

      projectTasks.sort((a, b) => Number(b.id) - Number(a.id))

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

  useEffect(() => { loadProjectData() }, [id])

  // ── Action Handlers ──
  const startEdit = () => {
    setEditProject({ ...project })
    setEditMembers(members.map(m => String(m.id)))
    setResources(Array.isArray(project.resources) ? project.resources : [])
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditProject(null)
    setEditMembers([])
    setResources([])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Update core project
      await supabase.from('Projects').update({
        name: editProject.name,
        description: editProject.description,
        status: editProject.status,
        resources: resources
      }).eq('id', id)

      // Sync members list
      await supabase.from('project_members').delete().eq('project_id', id)
      if (editMembers.length > 0) {
        await supabase.from('project_members').insert(
          editMembers.map(uid => ({ project_id: id, user_id: uid }))
        )
      }
      
      await loadProjectData()
      setEditing(false)
    } catch(e) {
      console.error(e)
      alert("Failed to save changes.")
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${project?.name}?`)) return
    setDeleting(true)
    await supabase.from('Projects').delete().eq('id', id)
    router.push('/all-projects')
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the project?")) return
    setRemovingId(memberId) // <-- RESTORED logic
    await supabase.from('project_members').delete().eq('project_id', id).eq('user_id', memberId)
    await loadProjectData()
    setRemovingId(null) // <-- RESTORED logic
  }

  // ── Inline Resource Handlers ──
  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) => setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) => setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  const completedTasksCount = tasks.filter(t => t.status === 'Completed').length
  const progressPercentage = tasks.length ? Math.round((completedTasksCount / tasks.length) * 100) : 0
  const isManagerOrAdmin = myRole === 'Admin' || myRole === 'Manager'

  if (loading) return <AppShell title="Project View"><div style={{ padding: 40, textAlign: 'center' }}>Loading...</div></AppShell>

  return (
    <AppShell title={project?.name || "Project View"}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .fm-wrapper {
          --r: 6px; 
          --rl: 10px;
          color: var(--txt);
        }
        .card { background: var(--bg); border: 1px solid var(--brd); border-radius: var(--rl); padding: 18px 20px; margin-bottom: 14px; box-shadow: var(--shd); }
        .sec { font-size: 10px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; color: var(--txt3); padding-bottom: 10px; border-bottom: 1px solid var(--brd); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
        .sec-lbl { font-size: 10px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; color: var(--txt3); }
        
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--r); border: 1px solid var(--brd2); background: var(--bg); color: var(--txt2); font-size: 13px; font-weight: 600; cursor: pointer; transition: .15s; text-decoration: none; }
        .btn:hover { background: var(--bg2); }
        .btn-primary { background: var(--txt2); color: var(--bg); border-color: var(--txt2); }
        .btn-sm { padding: 4px 10px; font-size: 12px; }
        .btn-delete { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 4px 10px; background: var(--del-bg); color: var(--del-txt); border: 1px solid var(--del-brd); border-radius: var(--r); cursor: pointer; font-size: 11px; font-weight: 700; transition: .15s; }
        .btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .pill { font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
        .pill-ns { background: var(--pill-ns-bg); color: var(--pill-ns-txt); }
        .pill-ip { background: var(--pill-ip-bg); color: var(--pill-ip-txt); }
        .pill-oh { background: var(--pill-oh-bg); color: var(--pill-oh-txt); }
        .pill-c { background: var(--pill-c-bg); color: var(--pill-c-txt); }
        
        /* Form Classes */
        .fl { font-size: 10px; font-weight: 800; color: var(--txt3); text-transform: uppercase; letter-spacing: .12em; display: block; margin-bottom: 5px; }
        .fi { width: 100%; padding: 7px 10px; border: 1px solid var(--brd2); border-radius: var(--r); background: var(--bg); color: var(--txt); font-size: 13px; font-weight: 500; outline: none; }
        .fta { width: 100%; padding: 7px 10px; border: 1px solid var(--brd2); border-radius: var(--r); background: var(--bg); color: var(--txt); font-size: 13px; font-weight: 500; outline: none; min-height: 60px; resize: vertical; }
        .fg { margin-bottom: 12px; }
        
        /* Status toggle row */
        .status-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .sopt { padding: 4px 12px; border-radius: 20px; border: 1px solid var(--brd2); cursor: pointer; font-size: 11px; font-weight: 700; background: transparent; color: var(--txt2); transition: .15s; }
        .sopt.sel-ns { background: var(--pill-ns-bg); color: var(--pill-ns-txt); border-color: var(--pill-ns-txt); }
        .sopt.sel-ip { background: var(--pill-ip-bg); color: var(--pill-ip-txt); border-color: var(--pill-ip-txt); }
        .sopt.sel-oh { background: var(--pill-oh-bg); color: var(--pill-oh-txt); border-color: var(--pill-oh-txt); }
        .sopt.sel-c { background: var(--pill-c-bg); color: var(--pill-c-txt); border-color: var(--pill-c-txt); }
        
        /* Toggle member chips */
        .tgl { padding: 3px 11px; font-size: 12px; font-weight: 600; border-radius: 20px; border: 1px solid var(--brd2); cursor: pointer; background: transparent; color: var(--txt2); transition: .15s; white-space: nowrap; }
        .tgl.on { background: var(--txt2); color: var(--bg); border-color: var(--txt2); }

        .two-col { display: grid; grid-template-columns: 1fr 300px; gap: 14px; align-items: start; }
        @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
        
        .task-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg2); border: 1px solid var(--brd); border-radius: var(--r); margin-bottom: 8px; cursor: pointer; transition: border-color .15s; }
        .task-row:hover { border-color: var(--brd2); }
        .tdot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .av { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; border: 2px solid var(--bg); flex-shrink: 0; }
        .prog-bar { height: 6px; background: var(--bg2); border-radius: 10px; overflow: hidden; }
        .prog-fill { height: 100%; border-radius: 10px; transition: width 0.4s ease-out; }
        .member-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg2); border: 1px solid var(--brd); border-radius: var(--r); margin-bottom: 8px; }
        .res-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--bg2); border: 1px solid var(--brd); border-radius: var(--r); margin-bottom: 8px; }
        .block-draft { background: var(--bg3); border: 1px solid var(--brd); border-radius: var(--r); padding: 14px; margin-bottom: 10px; }
        .block-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .block-lbl { font-size: 10px; font-weight: 800; color: var(--txt3); text-transform: uppercase; letter-spacing: .12em; }
      `}} />

      <div className="fm-wrapper">
        
        {/* ── TOOLBAR ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:10 }}>
          <button className="btn" onClick={() => router.push('/all-projects')}>
            <ArrowLeft size={16} /> Back
          </button>
          
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {!editing ? (
              <>
                <span className={`pill ${getPillClass(project?.status || 'Active')}`} style={{ fontSize: 11, padding: '4px 12px' }}>
                  {project?.status || 'Active'}
                </span>
                {isManagerOrAdmin && <button className="btn btn-sm" onClick={startEdit}><Edit3 size={14} /> Edit Project</button>}
                {isManagerOrAdmin && <button className="btn-delete btn-sm" onClick={handleDelete} disabled={deleting}><Trash size={14} /> Delete</button>}
              </>
            ) : (
              <>
                <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}><Save size={14} /> Save</button>
                <button className="btn btn-sm" onClick={cancelEdit}>Cancel</button>
              </>
            )}
          </div>
        </div>

        {/* ── TWO COLUMN LAYOUT ── */}
        <div className="two-col">
          
          {/* LEFT COLUMN */}
          <div>
            {/* Overview */}
            <div className="card">
              <div className="sec"><span className="sec-lbl">Overview</span></div>
              
              {editing && (
                <div className="fg">
                  <label className="fl">Project Name *</label>
                  <input className="fi" value={editProject?.name || ''} onChange={e => setEditProject((p: any) => ({ ...p, name: e.target.value }))} />
                </div>
              )}

              {editing && (
                <div className="fg" style={{ marginBottom: 16 }}>
                  <label className="fl">Status</label>
                  <div className="status-row">
                    {['Not Started', 'In Progress', 'On-Hold', 'Completed'].map(s => {
                      const isSel = editProject?.status === s
                      let selClass = ''
                      if (isSel) {
                        if (s === 'Not Started') selClass = 'sel-ns'
                        if (s === 'In Progress') selClass = 'sel-ip'
                        if (s === 'On-Hold') selClass = 'sel-oh'
                        if (s === 'Completed') selClass = 'sel-c'
                      }
                      return <button key={s} className={`sopt ${selClass}`} onClick={() => setEditProject((p: any) => ({ ...p, status: s }))}>{s}</button>
                    })}
                  </div>
                </div>
              )}

              <div className="fg" style={{ marginBottom: 0 }}>
                {editing && <label className="fl">Description</label>}
                {!editing ? (
                  <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {project?.description || "No description provided."}
                  </p>
                ) : (
                  <textarea className="fta" value={editProject?.description || ''} onChange={e => setEditProject((p: any) => ({ ...p, description: e.target.value }))} />
                )}
              </div>
            </div>

            {/* Tasks List (Hidden when editing) */}
            {!editing && (
              <div className="card">
                <div className="sec">
                  <span className="sec-lbl">Tasks ({tasks.length})</span>
                  <Link href={`/tasks/create?project_id=${id}`} className="btn btn-primary btn-sm">
                    <Plus size={14} /> Add Task
                  </Link>
                </div>

                {tasks.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No tasks created yet.</div>
                ) : (
                  tasks.map(task => {
                    const assignees = (task.task_assignees || []).map((ta: any) => allUsers.find(u => String(u.id) === String(ta.user_id))).filter(Boolean)
                    
                    return (
                      <div key={task.id} className="task-row" onClick={() => router.push(`/tasks/${task.id}`)} style={{ opacity: task.status === 'Completed' ? 0.65 : 1 }}>
                        <div className="tdot" style={{ background: getStatusColor(task.status) }}></div>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{task.topic}</div>
                          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>Due {task.end_date || '—'}</div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: 2 }}>
                          {assignees.slice(0, 3).map((u: any, i: number) => (
                            <div key={u.id} className="av" style={{ background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6] }} title={u.full_name}>
                              {ini(u.full_name)}
                            </div>
                          ))}
                        </div>
                        
                        <span className={`pill ${getPillClass(task.status)}`}>{task.status}</span>
                        <ChevronRight size={14} color="var(--txt3)" />
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div>
            
            {/* Progress Card (Hidden when editing) */}
            {!editing && (
              <div className="card">
                <div className="sec"><span className="sec-lbl">Progress</span></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-.02em', marginBottom: 8 }}>
                  {progressPercentage}%
                </div>
                <div className="prog-bar" style={{ marginBottom: 8 }}>
                  <div className="prog-fill" style={{ width: `${progressPercentage}%`, background: project?.color_code || 'var(--txt2)' }}></div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                  {completedTasksCount} of {tasks.length} tasks completed
                </div>
              </div>
            )}

            {/* Team Members */}
            <div className="card">
              <div className="sec"><span className="sec-lbl">Team Members ({editing ? editMembers.length : members.length})</span></div>
              
              {editing ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {allUsers.map((u: any) => {
                    const sel = editMembers.includes(String(u.id))
                    return (
                      <button key={u.id} type="button" onClick={() => setEditMembers(prev => prev.includes(String(u.id)) ? prev.filter(id => id !== String(u.id)) : [...prev, String(u.id)])} className={`tgl ${sel ? 'on' : ''}`}>
                        {sel ? '✓ ' : ''}{u.full_name}
                      </button>
                    )
                  })}
                </div>
              ) : (
                members.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No members added.</div>
                ) : (
                  members.map((member, i) => {
                    const isRemoving = removingId === member.id
                    return (
                      <div className="member-row" key={member.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="av" style={{ width: 30, height: 30, fontSize: 11, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6] }}>
                            {ini(member.full_name)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{member.full_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', fontWeight: 700 }}>
                              {member.role || 'Team Member'}
                            </div>
                          </div>
                        </div>
                        
                        {isManagerOrAdmin && (
                          <button 
                            className="btn-delete" 
                            style={{ padding: '3px 8px', fontSize: 10 }}
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={isRemoving}
                          >
                            {isRemoving ? '...' : <X size={12} />}
                          </button>
                        )}
                      </div>
                    )
                  })
                )
              )}
            </div>

            {/* Resources */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="sec-lbl">Resources ({editing ? resources.length : (project?.resources?.length || 0)})</div>
                {editing && <button className="btn btn-primary btn-sm" onClick={addResource}><Plus size={14} /> Add</button>}
              </div>
              
              {editing ? (
                resources.map((r, i) => (
                  <div key={i} className="block-draft">
                    <div className="block-hdr">
                      <span className="block-lbl">Resource {i + 1}</span>
                      <button className="btn-delete" onClick={() => removeResource(i)}><Trash size={14} /> Remove</button>
                    </div>
                    <div className="fg"><label className="fl">Title *</label><input className="fi" value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} /></div>
                    <div className="fg" style={{ marginBottom: 0 }}>
                      <label className="fl">Link</label>
                      <div style={{ position: 'relative' }}>
                        <LinkIcon size={13} color="var(--txt3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                        <input className="fi" style={{ paddingLeft: 30 }} value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} placeholder="https://" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                (!project?.resources || project.resources.length === 0) ? (
                  <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No resources attached.</div>
                ) : (
                  (project.resources as Resource[]).map((res, i) => (
                    <div className="res-row" key={i}>
                      <LinkIcon size={14} color="var(--txt3)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 3 }}>
                          {res.title || 'Reference Document'}
                        </div>
                        <a href={res.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--pill-ip-txt, #185FA5)', textDecoration: 'underline', wordBreak: 'break-all' }}>
                          {res.link}
                        </a>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}