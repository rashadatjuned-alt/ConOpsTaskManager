'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, Save, Calendar, Link as LinkIcon } from 'lucide-react'
import type { Resource } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────
const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const TYPES    = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

// ── Types ─────────────────────────────────────────────────────────────────
interface SubtaskDraft {
  id: string
  topic: string
  description: string
  assignees: string[]
  start_date: string
  end_date: string
  status: string
}

// ── Status selector ───────────────────────────────────────────────────────
const STATUS_SEL: Record<string, string> = {
  'Not Started': 'sel-ns',
  'In Progress': 'sel-ip',
  'On-Hold':     'sel-oh',
  'Completed':   'sel-c',
}

export default function CreateTask() {
  const router   = useRouter()
  const today    = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  // ── Server state ─────────────────────────────────────────────────────────
  const [allProjects, setAllProjects] = useState<any[]>([])
  const [allUsers,    setAllUsers]    = useState<any[]>([])
  const [projectTeam, setProjectTeam] = useState<any[]>([])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  // ── Task form state ───────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState('')
  const [topic,     setTopic]     = useState('')
  const [type,      setType]      = useState('One-time')
  const [status,    setStatus]    = useState('Not Started')
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState(nextWeek)
  const [desc,      setDesc]      = useState('')
  const [assignees, setAssignees] = useState<string[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [subtasks,  setSubtasks]  = useState<SubtaskDraft[]>([])

  // ── Load projects + users ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const myId = session.user.id

      const { data: me } = await supabase.from('Users').select('role').eq('id', myId).single()
      const myRole = me?.role || 'Team Member'

      const [p, u, pm] = await Promise.all([
        supabase.from('Projects').select('id, name'),
        supabase.from('Users').select('id, full_name, email, role'),
        supabase.from('project_members').select('project_id').eq('user_id', myId),
      ])

      const globalProjects     = p.data || []
      const assignedProjectIds = (pm.data || []).map((m: any) => m.project_id)

      const accessibleProjects = (myRole === 'Admin' || myRole === 'Manager')
        ? globalProjects
        : globalProjects.filter((proj: any) => assignedProjectIds.includes(proj.id))

      setAllProjects(accessibleProjects)
      setAllUsers((u.data || []).filter((usr: any) => usr.role !== 'Admin'))
    }
    load()
  }, [])

  // ── Filter team when project changes ─────────────────────────────────────
  useEffect(() => {
    if (!projectId) { setProjectTeam([]); setAssignees([]); return }
    const fetchTeam = async () => {
      const { data: members } = await supabase
        .from('project_members').select('user_id').eq('project_id', projectId)
      if (members && members.length > 0) {
        const ids = members.map((m: any) => m.user_id)
        setProjectTeam(allUsers.filter((u: any) => ids.includes(u.id)))
      } else {
        setProjectTeam([])
      }
    }
    fetchTeam()
    setAssignees([])
    setSubtasks(prev => prev.map(s => ({ ...s, assignees: [] })))
  }, [projectId, allUsers])

  // ── Assignee toggles ─────────────────────────────────────────────────────
  const toggleAssignee = useCallback((userId: string) => {
    setAssignees(prev => {
      const next = prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      if (prev.includes(userId)) {
        setSubtasks(subs => subs.map(s => ({
          ...s, assignees: s.assignees.filter(a => a !== userId),
        })))
      }
      return next
    })
  }, [])

  const toggleSubAssignee = (subId: string, userId: string) => {
    setSubtasks(prev => prev.map(s => {
      if (s.id !== subId) return s
      return {
        ...s,
        assignees: s.assignees.includes(userId)
          ? s.assignees.filter(a => a !== userId)
          : [...s.assignees, userId],
      }
    }))
  }

  // ── Resource helpers ──────────────────────────────────────────────────────
  const addResource = () =>
    setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  // ── Subtask helpers ───────────────────────────────────────────────────────
  const addSubtask = () => setSubtasks(prev => [...prev, {
    id: `new-${Date.now()}`, topic: '', description: '', assignees: [],
    start_date: startDate, end_date: endDate, status: 'Not Started',
  }])
  const updateSub = (id: string, field: string, val: string) =>
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s))
  const removeSub = (id: string) => setSubtasks(prev => prev.filter(s => s.id !== id))

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(''); setSuccess(''); setSaving(true)
    if (!projectId)    { setError('Please select a project.'); setSaving(false); return }
    if (!topic.trim()) { setError('Task title is required.'); setSaving(false); return }
    if (endDate < startDate) { setError('End date cannot be before start date.'); setSaving(false); return }

    const selectedProject = allProjects.find((p: any) => p.id === Number(projectId))

    try {
      const { data: taskData, error: taskErr } = await supabase.from('Tasks').insert({
        project_id:   Number(projectId),
        project_name: selectedProject?.name || '',
        topic:        topic.trim(),
        description:  desc.trim(),
        type, start_date: startDate, end_date: endDate, status,
        tags: [], resources,
      }).select().single()

      if (taskErr) throw taskErr

      if (assignees.length > 0) {
        await supabase.from('task_assignees').insert(
          assignees.map(uid => ({ task_id: taskData.id, user_id: uid }))
        )
      }

      for (const s of subtasks) {
        const { data: subData, error: subErr } = await supabase.from('Subtasks').insert({
          parent_task_id: taskData.id,
          topic:          s.topic.trim(),
          description:    s.description.trim(),
          start_date:     s.start_date,
          end_date:       s.end_date,
          status:         s.status,
        }).select().single()

        if (!subErr && s.assignees.length > 0) {
          await supabase.from('subtask_assignees').insert(
            s.assignees.map(uid => ({ subtask_id: subData.id, user_id: uid }))
          )
        }
      }

      setSuccess('✅ Task created successfully!')
      setTimeout(() => router.push('/my-tasks'), 1000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedProject = allProjects.find((p: any) => p.id === Number(projectId))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell title="Create Task">

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Cancel
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            <Save size={14} />
            {saving ? 'Creating...' : `Create Task${subtasks.length > 0 ? ` + ${subtasks.length} Subtask${subtasks.length > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="two-col-layout">

        {/* ── LEFT column ── */}
        <div>

          {/* Task details */}
          <div className="card">
            <div className="form-section">Task details</div>

            <div className="form-group">
              <label className="form-label">Task title *</label>
              <input
                className="form-input"
                placeholder="Short, clear title..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Project *</label>
                <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">Select project...</option>
                  {allProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Task type</label>
                <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Start date</label>
                <input
                  className="form-input"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End date</label>
                <input
                  className="form-input"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`status-opt ${status === s ? STATUS_SEL[s] : ''}`}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Context, acceptance criteria, notes..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>
          </div>

          {/* Assign to */}
          <div className="card">
            <div className="form-section">Assign to</div>
            {!projectId ? (
              <p style={{ fontSize: 12, color: 'var(--txt3)' }}>Select a project to see available team members.</p>
            ) : projectTeam.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--txt3)' }}>⚠️ No team members assigned to this project yet.</p>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 12 }}>
                  Showing members from {selectedProject?.name}.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                  {projectTeam.map((u: any) => {
                    const sel = assignees.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                        onClick={() => toggleAssignee(u.id)}
                      >
                        {sel ? '✓ ' : ''}{u.full_name || u.email}
                      </button>
                    )
                  })}
                </div>
                {assignees.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                    {assignees.length} person{assignees.length !== 1 ? 's' : ''} assigned
                  </div>
                )}
              </>
            )}
          </div>

          {/* Subtasks */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="form-section" style={{ margin: 0, padding: 0, border: 'none' }}>
                Subtasks{' '}
                <span style={{ fontWeight: 400, color: 'var(--txt3)' }}>({subtasks.length})</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addSubtask}>
                <Plus size={13} /> Add Subtask
              </button>
            </div>

            {subtasks.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '12px 0' }}>
                No subtasks yet.
              </div>
            ) : subtasks.map((s, i) => (
              <div
                key={s.id}
                className={`block-draft${!s.topic ? ' empty' : ''}`}
              >
                <div className="block-header">
                  <span className="block-label">Subtask {i + 1}</span>
                  <button className="btn-delete" onClick={() => removeSub(s.id)}>
                    <Trash2 size={12} /> Remove
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    className="form-input"
                    placeholder="Subtask title..."
                    value={s.topic}
                    onChange={e => updateSub(s.id, 'topic', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea form-textarea-sm"
                    placeholder="Optional notes for this subtask..."
                    value={s.description}
                    onChange={e => updateSub(s.id, 'description', e.target.value)}
                  />
                </div>

                <div className="form-grid-2" style={{ gap: 8, marginBottom: 10 }}>
                  <div>
                    <label className="form-label">Start date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={s.start_date}
                      onChange={e => updateSub(s.id, 'start_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">End date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={s.end_date}
                      onChange={e => updateSub(s.id, 'end_date', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2" style={{ gap: 8 }}>
                  <div>
                    <label className="form-label">Assign to</label>
                    {assignees.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>Assign main task first</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {assignees.map(uid => {
                          const u = projectTeam.find((u: any) => u.id === uid)
                          const sel = s.assignees.includes(uid)
                          return (
                            <button
                              key={uid}
                              type="button"
                              className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                              style={{ fontSize: 11, padding: '2px 10px' }}
                              onClick={() => toggleSubAssignee(s.id, uid)}
                            >
                              {sel ? '✓ ' : ''}{u ? (u.full_name || u.email).split(' ')[0] : 'Member'}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={s.status}
                      onChange={e => updateSub(s.id, 'status', e.target.value)}
                    >
                      {STATUSES.map(st => <option key={st}>{st}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resources */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="form-section" style={{ margin: 0, padding: 0, border: 'none' }}>
                Resources{' '}
                <span style={{ fontWeight: 400, color: 'var(--txt3)' }}>({resources.length})</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addResource}>
                <Plus size={13} /> Add Resource
              </button>
            </div>

            {resources.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '12px 0' }}>
                No resources added yet.
              </div>
            ) : resources.map((r, i) => (
              <div key={i} className={`block-draft${!r.title ? ' empty' : ''}`}>
                <div className="block-header">
                  <span className="block-label">Resource {i + 1}</span>
                  <button className="btn-delete" onClick={() => removeResource(i)}>
                    <Trash2 size={12} /> Remove
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    className="form-input"
                    placeholder="Resource title..."
                    value={r.title}
                    onChange={e => updateResource(i, 'title', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Link</label>
                  <div style={{ position: 'relative' }}>
                    <LinkIcon
                      size={13}
                      style={{
                        position: 'absolute', left: 10, top: '50%',
                        transform: 'translateY(-50%)', color: 'var(--txt3)',
                      }}
                    />
                    <input
                      className="form-input"
                      style={{ paddingLeft: 30 }}
                      placeholder="https://..."
                      value={r.link}
                      onChange={e => updateResource(i, 'link', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ── RIGHT column — summary ── */}
        <div>
          <div className="card">
            <div className="form-section">Summary</div>
            <div className="summary-row">
              <span className="summary-lbl">Project</span>
              <span className="summary-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {selectedProject
                  ? <><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--proj-1)', flexShrink: 0 }} />{selectedProject.name}</>
                  : '—'
                }
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Type</span>
              <span className="summary-val">{type}</span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Start</span>
              <span className="summary-val">{startDate || '—'}</span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">End</span>
              <span className="summary-val">{endDate || '—'}</span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Status</span>
              <span className={`pill pill-${status === 'Not Started' ? 'ns' : status === 'In Progress' ? 'ip' : status === 'On-Hold' ? 'oh' : 'c'}`}>
                {status}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Assigned</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {assignees.length === 0
                  ? <span className="summary-val">—</span>
                  : assignees.slice(0, 4).map((uid, i) => {
                      const u = projectTeam.find((u: any) => u.id === uid)
                      return (
                        <div
                          key={uid}
                          className={`avatar av-${(i % 6) + 1}`}
                          style={{ width: 22, height: 22, fontSize: 9, fontWeight: 800 }}
                          title={u?.full_name}
                        >
                          {u ? (u.full_name || u.email).slice(0, 2).toUpperCase() : '??'}
                        </div>
                      )
                    })
                }
                {assignees.length > 4 && (
                  <div className="avatar av-1" style={{ width: 22, height: 22, fontSize: 9, fontWeight: 800 }}>
                    +{assignees.length - 4}
                  </div>
                )}
              </div>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Subtasks</span>
              <span className="summary-val">{subtasks.length}</span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Resources</span>
              <span className="summary-val">{resources.length}</span>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  )
}