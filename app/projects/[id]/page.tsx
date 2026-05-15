'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, use } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ListTodo, ChevronRight, Edit3, ArrowLeft,
  Link as LinkIcon, Plus, Trash2, Check, X, AlertTriangle, Save
} from 'lucide-react'
import Link from 'next/link'
import { StatusDot } from '@/components/ui/StatusPill'
import type { Resource } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']
const PROJECT_COLORS = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#84CC16', '#EF4444',
  '#4D7C0F', '#B45309', '#0284C7', '#2DD4BF', '#EC4899',
]

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '?')[0].toUpperCase()
}

interface ProjectDetailProps {
  params: Promise<{ id: string }>
}

// ── CLEANUP HELPER ───────────────────────────────────────────────────────────
async function unassignUserFromProject(projectId: string, projectName: string, userId: string) {
  const [byIdRes, byNameRes] = await Promise.all([
    supabase.from('Tasks').select('id').eq('project_id', projectId),
    supabase.from('Tasks').select('id').eq('project_name', projectName)
  ])
  const allTaskIds = [
    ...(byIdRes.data || []).map((t: any) => String(t.id)),
    ...(byNameRes.data || []).map((t: any) => String(t.id))
  ]
  const taskIds = [...new Set(allTaskIds)]
  if (taskIds.length === 0) return
  await supabase.from('task_assignees').delete().in('task_id', taskIds).eq('user_id', userId)
  const { data: subsData } = await supabase.from('Subtasks').select('id').in('parent_task_id', taskIds)
  const subIds = (subsData || []).map((s: any) => String(s.id))
  if (subIds.length > 0) {
    await supabase.from('subtask_assignees').delete().in('subtask_id', subIds).eq('user_id', userId)
  }
}

// ── STATUS HELPERS ────────────────────────────────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  'Not Started': 'pill-ns',
  'In Progress': 'pill-ip',
  'On-Hold':     'pill-oh',
  'Completed':   'pill-c',
}

const STATUS_COLOR: Record<string, string> = {
  'Not Started': '#aaaaaa',
  'In Progress': '#378ADD',
  'On-Hold':     '#EF9F27',
  'Completed':   '#639922',
}

const STATUS_BG: Record<string, string> = {
  'Not Started': '#F1EFE8',
  'In Progress': '#E6F1FB',
  'On-Hold':     '#FAEEDA',
  'Completed':   '#EAF3DE',
}

const STATUS_TXT: Record<string, string> = {
  'Not Started': '#5F5E5A',
  'In Progress': '#185FA5',
  'On-Hold':     '#854F0B',
  'Completed':   '#3B6D11',
}

// ── AVATAR STACK ──────────────────────────────────────────────────────────────
function AvatarStack({ assignees, size = 22 }: { assignees: any[]; size?: number }) {
  const fontSize = size <= 18 ? 8 : 9
  const border = size <= 18 ? '-4px' : '-6px'
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {assignees.slice(0, 5).map((u: any, i: number) => (
        <div
          key={u.id}
          title={u.full_name}
          style={{
            width: size, height: size, borderRadius: '50%',
            background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize, fontWeight: 900,
            border: '2px solid var(--bg)',
            marginLeft: i > 0 ? border : 0,
            zIndex: 5 - i,
            position: 'relative',
          }}
        >
          {ini(u.full_name)}
        </div>
      ))}
      {assignees.length > 5 && (
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: '#f1f1f1', color: '#666',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize, fontWeight: 900,
          border: '2px solid var(--bg)',
          marginLeft: border,
        }}>
          +{assignees.length - 5}
        </div>
      )}
    </div>
  )
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ProjectDetail({ params }: ProjectDetailProps) {
  const router = useRouter()
  const { id } = use(params)

  const [project, setProject] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('')

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteStage, setDeleteStage] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editMembers, setEditMembers] = useState<string[]>([])
  const [resources, setResources] = useState<Resource[]>([])

  // Subtask expansion
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})

  // ── LOAD DATA ───────────────────────────────────────────────────────────────
  const loadProjectData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [projRes, usersRes, pmRes] = await Promise.all([
        supabase.from('Projects').select('*').eq('id', id).single(),
        supabase.from('Users').select('id, full_name, email, role'),
        supabase.from('project_members').select('*').eq('project_id', id),
      ])

      if (projRes.error || !projRes.data) {
        router.push('/all-projects')
        return
      }

      const proj = projRes.data
      const fetchedUsers = usersRes.data || []
      const pmRows = pmRes.data || []

      const [tasksByIdRes, tasksByNameRes] = await Promise.all([
        supabase.from('Tasks').select('*').eq('project_id', id),
        supabase.from('Tasks').select('*').eq('project_name', proj.name)
      ])

      const allFetchedTasks = [
        ...(tasksByIdRes.data || []),
        ...(tasksByNameRes.data || []),
      ]

      const seen = new Set()
      const dedupedTasks = allFetchedTasks.filter(t => {
        const key = String(t.id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const taskIds = dedupedTasks.map(t => String(t.id))
      const taRows: any[] = taskIds.length > 0
        ? (await supabase.from('task_assignees').select('*').in('task_id', taskIds)).data || []
        : []

      const subRes = taskIds.length > 0
        ? await supabase.from('Subtasks').select('*').in('parent_task_id', taskIds)
        : { data: [] }

      const saRes = await supabase.from('subtask_assignees').select('*')

      const currentUser = fetchedUsers.find((u: any) => String(u.id) === String(session.user.id))
      setMyRole(currentUser?.role || 'Team Member')

      const rosterIds = pmRows.map((row: any) => String(row.user_id))
      const projectTeam = fetchedUsers.filter((u: any) => rosterIds.includes(String(u.id)))

      const projectTasks = dedupedTasks.map((task: any) => ({
        ...task,
        task_assignees: taRows.filter((ta: any) => String(ta.task_id) === String(task.id)),
        subtasks: (subRes.data || [])
          .filter((s: any) => String(s.parent_task_id) === String(task.id))
          .map((sub: any) => ({
            ...sub,
            subtask_assignees: (saRes.data || []).filter((sa: any) => String(sa.subtask_id) === String(sub.id))
          }))
      }))

      setProject(proj)
      setMembers(projectTeam)
      setTasks(projectTasks)
      setAllUsers(fetchedUsers.filter((u: any) => u.role !== 'Admin'))

      setEditName(proj.name)
      setEditDesc(proj.description || '')
      setEditColor(proj.color_code || PROJECT_COLORS[0])
      setEditMembers(rosterIds)
      setResources(Array.isArray(proj.resources) ? proj.resources : [])
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjectData() }, [id])

  const startEdit = () => {
    if (!project) return
    setEditName(project.name)
    setEditDesc(project.description || '')
    setEditColor(project.color_code || PROJECT_COLORS[0])
    setEditMembers(members.map(m => String(m.id)))
    setResources(Array.isArray(project.resources) ? project.resources : [])
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('Projects').update({
        name: editName.trim(),
        description: editDesc.trim(),
        color_code: editColor,
        resources,
      }).eq('id', id)

      if (editName.trim() !== project.name) {
        await supabase.from('Tasks').update({ project_name: editName.trim() }).eq('project_id', id)
      }

      const currentMemberIds = members.map((m: any) => String(m.id))
      const removedIds = currentMemberIds.filter(uid => !editMembers.includes(uid))
      const addedIds = editMembers.filter(uid => !currentMemberIds.includes(uid))

      for (const uid of removedIds) {
        await supabase.from('project_members').delete().eq('project_id', id).eq('user_id', uid)
        await unassignUserFromProject(id, project.name, uid)
      }

      if (addedIds.length > 0) {
        await supabase.from('project_members').insert(addedIds.map(uid => ({ project_id: id, user_id: uid })))
      }

      setEditing(false)
      setDeleteStage(0)
      await loadProjectData()
    } catch (err: any) {
      alert(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data: tasksById } = await supabase.from('Tasks').select('id').eq('project_id', id)
      const { data: tasksByName } = await supabase.from('Tasks').select('id').eq('project_name', project.name)
      const uniqueTaskIds = [...new Set([
        ...(tasksById || []).map((t: any) => t.id),
        ...(tasksByName || []).map((t: any) => t.id),
      ])]

      if (uniqueTaskIds.length > 0) {
        const { data: subsData } = await supabase.from('Subtasks').select('id').in('parent_task_id', uniqueTaskIds)
        const subIds = (subsData || []).map((s: any) => s.id)
        if (subIds.length > 0) {
          await supabase.from('subtask_assignees').delete().in('subtask_id', subIds)
          await supabase.from('Subtasks').delete().in('parent_task_id', uniqueTaskIds)
        }
        await supabase.from('task_assignees').delete().in('task_id', uniqueTaskIds)
        await supabase.from('Tasks').delete().in('id', uniqueTaskIds)
      }

      await supabase.from('project_members').delete().eq('project_id', id)
      await supabase.from('Projects').delete().eq('id', id)
      router.push('/all-projects')
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  const completedCount = tasks.filter(t => t.status === 'Completed').length
  const progressPercentage = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0
  const isManagerOrAdmin = myRole === 'Admin' || myRole === 'Manager'
  const color = project?.color_code || PROJECT_COLORS[0]

  // ── Project Status ────────────────────────────────────────────────────────────
  const getProjectStatus = () => {
    if (tasks.length === 0) return 'Not Started'
    const statuses = tasks.map(t => t.status)
    if (statuses.every(s => s === 'Not Started')) return 'Not Started'
    if (statuses.every(s => s === 'On-Hold')) return 'On-Hold'
    if (statuses.every(s => s === 'Completed')) return 'Completed'
    return 'In Progress'
  }
  const projectStatus = getProjectStatus()

  // Task breakdown counts
  const countByStatus = (s: string) => tasks.filter(t => t.status === s).length

  // Auto-calculated project dates
  const projectStartDate = tasks.length
    ? tasks.map(t => t.start_date).filter(Boolean).sort()[0] || '—'
    : '—'
  const projectEndDate = tasks.length
    ? tasks.map(t => t.end_date).filter(Boolean).sort().reverse()[0] || '—'
    : '—'

  if (loading) return (
    <AppShell title="Project">
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading project...</div>
    </AppShell>
  )

  if (!project) return (
    <AppShell title="Project">
      <div className="alert alert-error">Project not found.</div>
    </AppShell>
  )

  return (
    <AppShell title={project.name}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {isManagerOrAdmin && !editing && (
            <button className="btn btn-sm" onClick={startEdit}>
              <Edit3 size={13} /> Edit Project
            </button>
          )}
          {editing && (
            <>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <Save size={13} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-sm" onClick={() => { setEditing(false); setDeleteStage(0) }}>
                Cancel
              </button>
            </>
          )}
          {isManagerOrAdmin && (
            deleteStage === 0
              ? (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setDeleteStage(1)}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )
              : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} color="#ef4444" />
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>Sure?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {deleting ? '...' : 'Yes, delete'}
                  </button>
                  <button onClick={() => setDeleteStage(0)} className="btn btn-sm">No</button>
                </div>
              )
          )}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT ── */}
        <div>

          {/* Overview card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: editing ? editColor : color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Overview
              </span>
            </div>
            {editing ? (
              <>
                <div className="form-group">
                  <label className="form-label">Project Name</label>
                  <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Accent Colour</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {PROJECT_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', background: c,
                          border: 'none', cursor: 'pointer', flexShrink: 0,
                          outline: editColor === c ? `3px solid ${c}` : 'none',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, margin: 0 }}>
                {project.description || 'No description provided.'}
              </p>
            )}
          </div>

          {/* ── Tasks card ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px 12px',
              borderBottom: '0.5px solid var(--brd)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <ListTodo size={15} color="var(--txt3)" />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt)' }}>Tasks</span>
                <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 400 }}>({tasks.length})</span>
              </div>
              <Link href={`/tasks/create?project_id=${id}`} className="btn btn-primary btn-sm">
                <Plus size={12} /> Add Task
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--txt3)', background: 'var(--bg2)' }}>
                No tasks yet. Create one above!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    <th style={thStyle('left', 'auto')}>Task</th>
                    <th style={thStyle('left', 88)}>Start</th>
                    <th style={thStyle('left', 88)}>End</th>
                    <th style={thStyle('center', 100)}>Assignees</th>
                    <th style={thStyle('right', 100)}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task: any) => {
                    const assignees = (task.task_assignees || [])
                      .map((ta: any) => allUsers.find((u: any) => String(u.id) === String(ta.user_id)))
                      .filter(Boolean)
                    const isExpanded = expandedTasks[task.id] || false
                    const hasSubs = task.subtasks && task.subtasks.length > 0

                    return (
                      <>
                        {/* Task row */}
                        <tr
                          key={task.id}
                          style={{ cursor: 'pointer', borderTop: '0.5px solid var(--brd)' }}
                          onClick={() => router.push(`/tasks/${task.id}`)}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={{ ...tdStyle(), paddingLeft: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              {hasSubs ? (
                                <ChevronRight
                                  size={13}
                                  color="var(--txt3)"
                                  style={{
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.18s',
                                    flexShrink: 0,
                                  }}
                                  onClick={e => {
                                    e.stopPropagation()
                                    setExpandedTasks(prev => ({ ...prev, [task.id]: !prev[task.id] }))
                                  }}
                                />
                              ) : (
                                <div style={{ width: 13, flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>
                                {task.topic}
                              </span>
                            </div>
                          </td>
                          <td style={{ ...tdStyle(), fontSize: 12, color: 'var(--txt3)' }}>
                            {task.start_date || '—'}
                          </td>
                          <td style={{ ...tdStyle(), fontSize: 12, color: 'var(--txt3)' }}>
                            {task.end_date || '—'}
                          </td>
                          <td style={{ ...tdStyle(), textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <AvatarStack assignees={assignees} size={22} />
                            </div>
                          </td>
                          <td style={{ ...tdStyle(), textAlign: 'right', paddingRight: 16 }}>
                            <span className={`pill ${STATUS_PILL[task.status] || 'pill-ns'}`} style={{ fontSize: 10 }}>
                              {task.status}
                            </span>
                          </td>
                        </tr>

                        {/* Subtask rows */}
                        {hasSubs && isExpanded && task.subtasks.map((sub: any) => {
                          const subAssignees = (sub.subtask_assignees || [])
                            .map((sa: any) => allUsers.find((u: any) => String(u.id) === String(sa.user_id)))
                            .filter(Boolean)
                          return (
                            <tr
                              key={sub.id}
                              style={{ background: 'var(--bg2)', borderTop: '0.5px solid var(--brd)', cursor: 'pointer' }}
                              onClick={() => router.push(`/tasks/${task.id}`)}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
                            >
                              <td style={{ ...tdStyle(), paddingLeft: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  {/* indent spacer = chevron width */}
                                  <div style={{ width: 13, flexShrink: 0 }} />
                                  <span style={{ color: 'var(--txt3)', fontSize: 12, flexShrink: 0 }}>↳</span>
                                  <span style={{ fontSize: 12, color: 'var(--txt2)' }}>{sub.topic}</span>
                                </div>
                              </td>
                              <td style={{ ...tdStyle(), fontSize: 11, color: 'var(--txt3)' }}>
                                {sub.start_date || '—'}
                              </td>
                              <td style={{ ...tdStyle(), fontSize: 11, color: 'var(--txt3)' }}>
                                {sub.end_date || '—'}
                              </td>
                              <td style={{ ...tdStyle(), textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <AvatarStack assignees={subAssignees} size={18} />
                                </div>
                              </td>
                              <td style={{ ...tdStyle(), textAlign: 'right', paddingRight: 16 }}>
                                <span className={`pill ${STATUS_PILL[sub.status] || 'pill-ns'}`} style={{ fontSize: 9 }}>
                                  {sub.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div>

          {/* ── Progress card ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Progress
              </span>
            </div>

            {/* Status badge + completion % */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 5 }}>
                  Status
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: STATUS_BG[projectStatus] || '#F1EFE8',
                  color: STATUS_TXT[projectStatus] || '#5F5E5A',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[projectStatus] || '#aaa', flexShrink: 0 }} />
                  {projectStatus}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 3 }}>
                  Completion
                </div>
                <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--txt)', lineHeight: 1 }}>
                  {progressPercentage}%
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="prog-bar" style={{ height: 6, marginBottom: 12 }}>
              <div className="prog-fill" style={{ width: `${progressPercentage}%`, background: color, transition: 'width 0.4s' }} />
            </div>

            {/* Breakdown pills */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                ['Completed', 'pill-c'],
                ['In Progress', 'pill-ip'],
                ['On-Hold', 'pill-oh'],
                ['Not Started', 'pill-ns'],
              ].map(([s, cls]) => {
                const n = countByStatus(s)
                if (!n) return null
                return (
                  <span key={s} className={`pill ${cls}`} style={{ fontSize: 10 }}>
                    {n} {s.toLowerCase()}
                  </span>
                )
              })}
            </div>

            {/* Start / End date tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Start', value: projectStartDate },
                { label: 'End', value: projectEndDate },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--bg2)',
                    border: '0.5px solid var(--brd)',
                    borderRadius: 8,
                    padding: '9px 12px',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Team Members card ── */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Team Members{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                  ({editing ? editMembers.length : members.length})
                </span>
              </span>
            </div>

            {editing ? (
              /* Edit mode: toggle list */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allUsers.map((u: any, i: number) => {
                  const active = editMembers.includes(String(u.id))
                  return (
                    <div
                      key={u.id}
                      onClick={() => setEditMembers(prev =>
                        prev.includes(String(u.id))
                          ? prev.filter(x => x !== String(u.id))
                          : [...prev, String(u.id)]
                      )}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 'var(--r)', cursor: 'pointer',
                        background: active ? 'var(--bg2)' : 'transparent',
                        border: active ? '0.5px solid var(--brd2)' : '0.5px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, flexShrink: 0,
                      }}>
                        {ini(u.full_name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{u.full_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{u.role}</div>
                      </div>
                      {active
                        ? <Check size={14} color="#3B6D11" />
                        : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--brd2)' }} />
                      }
                    </div>
                  )
                })}
              </div>
            ) : (
              /* View mode: clean list, no remove button */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.map((member: any, idx: number) => {
                  const taskCount = tasks.filter(t =>
                    Array.isArray(t.task_assignees) &&
                    t.task_assignees.some((ta: any) => String(ta.user_id) === String(member.id))
                  ).length
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px',
                        background: 'var(--bg2)',
                        border: '0.5px solid var(--brd)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, flexShrink: 0,
                      }}>
                        {ini(member.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.full_name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          {member.role} · {taskCount} task{taskCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {members.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '8px 0' }}>
                    No members assigned.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Resources card ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Resources{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  ({resources.length})
                </span>
              </span>
              {editing && (
                <button className="btn btn-sm" onClick={addResource}>
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {resources.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>
                No resources attached.
              </div>
            ) : editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resources.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={r.title}
                      onChange={e => updateResource(i, 'title', e.target.value)}
                      placeholder="Label..."
                      className="form-input"
                      style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                    />
                    <input
                      value={r.link}
                      onChange={e => updateResource(i, 'link', e.target.value)}
                      placeholder="https://..."
                      className="form-input"
                      style={{ flex: 2, padding: '5px 8px', fontSize: 12 }}
                    />
                    <button
                      onClick={() => removeResource(i)}
                      style={{ background: 'none', border: 'none', color: '#cc3333', cursor: 'pointer', padding: 4, display: 'flex' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resources.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px',
                      background: 'var(--bg2)',
                      border: '0.5px solid var(--brd)',
                      borderRadius: 8,
                    }}
                  >
                    <LinkIcon size={13} color="var(--txt3)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', marginBottom: 2 }}>
                        {r.title || 'Link'}
                      </div>
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11, color, textDecoration: 'underline', wordBreak: 'break-all' }}
                      >
                        {r.link}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function thStyle(align: 'left' | 'center' | 'right', width: number | 'auto'): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--txt3)',
    padding: '8px 8px 8px',
    textAlign: align,
    width: width === 'auto' ? undefined : width,
    whiteSpace: 'nowrap',
    borderBottom: '0.5px solid var(--brd)',
    ...(align === 'left' && width === 'auto' ? { paddingLeft: 16 } : {}),
  }
}

function tdStyle(): React.CSSProperties {
  return {
    padding: '9px 8px',
    verticalAlign: 'middle',
  }
}