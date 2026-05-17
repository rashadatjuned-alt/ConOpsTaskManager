'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, Save, Link as LinkIcon, X } from 'lucide-react'
import { notifyTaskAssigned, notifySubtaskAssigned, notifyTaskCreated } from '@/lib/notifications'
import type { Resource } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const TYPES    = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

const STATUS_SEL_CLS: Record<string, string> = {
  'Not Started': 'sel-ns',
  'In Progress':  'sel-ip',
  'On-Hold':      'sel-oh',
  'Completed':    'sel-c',
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface SubtaskDraft {
  id: string
  topic: string
  description: string
  assignees: string[]
  start_date: string
  end_date: string
  status: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : (name || '?')[0].toUpperCase()
}

// ── Inline status select ──────────────────────────────────────────────────────
function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`status-sel ${STATUS_SEL_CLS[value] || 'sel-ns'}`}
    >
      {STATUSES.map(s => <option key={s}>{s}</option>)}
    </select>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreateTask() {
  const router   = useRouter()
  const today    = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  // ── Server state ──────────────────────────────────────────────────────────
  const [allProjects, setAllProjects] = useState<any[]>([])
  const [allUsers,    setAllUsers]    = useState<any[]>([])
  const [projectTeam, setProjectTeam] = useState<any[]>([])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  // ── Form state ────────────────────────────────────────────────────────────
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

  // ── Submit (Claude's updated version with notifications) ─────────────────
  const handleSubmit = async () => {
    setError(''); setSuccess(''); setSaving(true)
    if (!projectId) { setError('Please select a project.'); setSaving(false); return }
    if (!topic.trim()) { setError('Task title is required.'); setSaving(false); return }
    if (endDate < startDate) { setError('End date cannot be before start date.'); setSaving(false); return }
    const selectedProject = allProjects.find((p: any) => p.id === Number(projectId))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const triggeredBy = session?.user.id
      const { data: taskData, error: taskErr } = await supabase.from('Tasks').insert({
        project_id: Number(projectId),
        project_name: selectedProject?.name || '',
        topic: topic.trim(),
        description: desc.trim(),
        type, start_date: startDate, end_date: endDate, status,
        tags: [], resources,
      }).select().single()
      if (taskErr) throw taskErr
      // Insert task assignees
      if (assignees.length > 0) {
        await supabase.from('task_assignees').insert(
          assignees.map(uid => ({ task_id: taskData.id, user_id: uid }))
        )
      }
      // Insert subtasks + subtask assignees
      const createdSubs: { subId: string; assignees: string[]; topic: string }[] = []
      for (const s of subtasks) {
        const { data: subData, error: subErr } = await supabase.from('Subtasks').insert({
          parent_task_id: taskData.id,
          topic: s.topic.trim(),
          description: s.description.trim(),
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.status,
        }).select().single()
        if (!subErr && s.assignees.length > 0) {
          await supabase.from('subtask_assignees').insert(
            s.assignees.map(uid => ({ subtask_id: subData.id, user_id: uid }))
          )
          createdSubs.push({ subId: subData.id, assignees: s.assignees, topic: s.topic.trim() })
        }
      }
      // ── Notifications ──────────────────────────────────────────────────────
      // 1. Notify managers a new task was created
      await notifyTaskCreated(
        String(taskData.id),
        topic.trim(),
        selectedProject?.name || '',
        triggeredBy,
        String(projectId),
      )
      // 2. Notify task assignees
      if (assignees.length > 0) {
        await notifyTaskAssigned(
          String(taskData.id),
          topic.trim(),
          selectedProject?.name || '',
          assignees,
          triggeredBy,
          String(projectId),
        )
      }
      // 3. Notify subtask assignees
      for (const sub of createdSubs) {
        await notifySubtaskAssigned(
          String(taskData.id),
          sub.subId,
          sub.topic,
          topic.trim(),
          sub.assignees,
          triggeredBy,
          String(projectId),
        )
      }
      setSuccess('✅ Task created successfully!')
      setTimeout(() => router.push('/my-tasks'), 1000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedProject = allProjects.find((p: any) => p.id === Number(projectId))
  const isRecurring     = type !== 'One-time'

  return (
    <AppShell title="Create Task">

      {/* Page-scoped styles — mirrors task detail exactly */}
      <style>{`
        .status-sel {
          appearance: none;
          -webkit-appearance: none;
          border-radius: 7px;
          border: 0.5px solid var(--brd2);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          outline: none;
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C%2Fsvg%3E");
          padding: 5px 28px 5px 10px;
          transition: border-color 0.15s;
        }
        .status-sel.sel-ns { background-color: #F1EFE8; color: #5F5E5A; border-color: #D3D1C7; }
        .status-sel.sel-ip { background-color: #E6F1FB; color: #185FA5; border-color: #B5D4F4; }
        .status-sel.sel-oh { background-color: #FAEEDA; color: #854F0B; border-color: #FAC775; }
        .status-sel.sel-c  { background-color: #EAF3DE; color: #3B6D11; border-color: #C0DD97; }
        .dark .status-sel.sel-ns { background-color: #2a2a2a; color: #aaa; border-color: #444; }
        .dark .status-sel.sel-ip { background-color: #1a2a3a; color: #6aadff; border-color: #2a4a6a; }
        .dark .status-sel.sel-oh { background-color: #2a2010; color: #d4a055; border-color: #4a3010; }
        .dark .status-sel.sel-c  { background-color: #1a2a10; color: #7acc44; border-color: #2a4a10; }

        .member-tile {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px;
          background: var(--bg2);
          border: 0.5px solid var(--brd);
          border-radius: 8px;
          margin-bottom: 6px;
        }
        .member-tile:last-child { margin-bottom: 0; }

        .meta-row-task {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0;
          border-bottom: 0.5px solid var(--brd);
          font-size: 12px;
        }
        .meta-row-task:last-child { border-bottom: none; }
        .meta-lbl-task {
          font-size: 10px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--txt3);
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <button className="btn btn-sm" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
          <Save size={13} />
          {saving
            ? 'Creating...'
            : `Create Task${subtasks.length > 0 ? ` + ${subtasks.length} Subtask${subtasks.length > 1 ? 's' : ''}` : ''}`
          }
        </button>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

      {/* ── Two-column layout — mirrors task detail ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div>
          {/* Task details card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Task details
              </span>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>
                Task title *
              </label>
              <input
                className="form-input"
                placeholder="Short, clear title..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>
                Description
              </label>
              <textarea
                className="form-textarea"
                placeholder="Context, acceptance criteria, notes..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>
          </div>

          {/* Subtasks card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '0.5px solid var(--brd)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt)' }}>Subtasks</span>
                <span style={{ fontSize: 12, color: 'var(--txt3)' }}>({subtasks.length})</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addSubtask}>
                <Plus size={12} /> Add
              </button>
            </div>

            {subtasks.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--txt3)', background: 'var(--bg2)' }}>
                No subtasks yet. Click "Add" to create one.
              </div>
            ) : (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subtasks.map((s, i) => (
                  <div key={s.id} style={{ background: 'var(--bg2)', border: '0.5px solid var(--brd)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--bg)', border: '0.5px solid var(--brd2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: 'var(--txt3)', flexShrink: 0,
                        }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt2)' }}>
                          {s.topic || 'New subtask'}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSub(s.id)}
                        style={{ background: 'none', border: 'none', color: '#cc3333', cursor: 'pointer', display: 'flex', padding: 2 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Title *</label>
                        <input
                          className="form-input"
                          placeholder="Subtask title..."
                          value={s.topic}
                          onChange={e => updateSub(s.id, 'topic', e.target.value)}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Description</label>
                        <textarea
                          className="form-textarea"
                          style={{ minHeight: 52, fontSize: 13 }}
                          placeholder="Optional notes..."
                          value={s.description}
                          onChange={e => updateSub(s.id, 'description', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Start date</label>
                        <input type="date" className="form-input" value={s.start_date} onChange={e => updateSub(s.id, 'start_date', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>End date</label>
                        <input type="date" className="form-input" value={s.end_date} onChange={e => updateSub(s.id, 'end_date', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Status</label>
                        <StatusSelect
                          value={s.status}
                          onChange={v => updateSub(s.id, 'status', v)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Assign to</label>
                        {assignees.length === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Assign main task first</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                            {assignees.map(uid => {
                              const u = projectTeam.find((u: any) => u.id === uid)
                              const sel = s.assignees.includes(uid)
                              return (
                                <button
                                  key={uid} type="button"
                                  onClick={() => toggleSubAssignee(s.id, uid)}
                                  className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                                  style={{ fontSize: 11, padding: '2px 10px' }}
                                >
                                  {sel ? '✓ ' : ''}{u ? (u.full_name || u.email).split(' ')[0] : 'Member'}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resources card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Resources{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({resources.length})</span>
              </span>
              <button className="btn btn-sm" onClick={addResource}>
                <Plus size={12} /> Add
              </button>
            </div>
            {resources.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No resources added yet.</div>
            ) : (
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
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Task info card */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Task info
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 6 }}>
                  Status
                </div>
                <StatusSelect value={status} onChange={setStatus} />
              </div>
              {subtasks.length > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 3 }}>
                    Subtasks
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--txt)', lineHeight: 1, marginTop: 3 }}>
                    {subtasks.length}
                  </div>
                </div>
              )}
            </div>

            {/* Meta rows (rest of the form remains exactly as before) */}
            <div className="meta-row-task">
              <span className="meta-lbl-task">Project</span>
              <div>
                {projectId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{selectedProject?.name}</span>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    style={{ fontSize: 12, padding: '4px 8px', width: 160 }}
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                  >
                    <option value="">Select project...</option>
                    {allProjects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {projectId && (
              <div className="meta-row-task" style={{ alignItems: 'flex-start', paddingTop: 6, paddingBottom: 6 }}>
                <span className="meta-lbl-task" style={{ paddingTop: 6 }}>Change</span>
                <select
                  className="form-select"
                  style={{ fontSize: 12, padding: '4px 8px', width: 160 }}
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                >
                  <option value="">— clear —</option>
                  {allProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="meta-row-task" style={{ alignItems: 'flex-start', paddingTop: 6, paddingBottom: 6 }}>
              <span className="meta-lbl-task" style={{ paddingTop: 6 }}>Type</span>
              <select
                className="form-select"
                style={{ fontSize: 12, padding: '4px 8px', width: 160 }}
                value={type}
                onChange={e => setType(e.target.value)}
              >
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="meta-row-task" style={{ alignItems: 'flex-start', paddingTop: 6, paddingBottom: 6 }}>
              <span className="meta-lbl-task" style={{ paddingTop: 6 }}>Start</span>
              <input
                type="date"
                className="form-input"
                style={{ width: 160, fontSize: 12, padding: '4px 8px' }}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="meta-row-task" style={{ alignItems: 'flex-start', paddingTop: 6, paddingBottom: 6 }}>
              <span className="meta-lbl-task" style={{ paddingTop: 6 }}>End</span>
              <input
                type="date"
                className="form-input"
                style={{ width: 160, fontSize: 12, padding: '4px 8px' }}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            <div className="meta-row-task">
              <span className="meta-lbl-task">Resources</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{resources.length}</span>
            </div>

            {isRecurring && startDate && endDate && (
              <div className="meta-row-task" style={{ borderBottom: 'none' }}>
                <span className="meta-lbl-task">Next instance</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#3B6D11' }}>
                  {(() => {
                    try {
                      const d = new Date(startDate)
                      if (type === 'Weekly')        d.setDate(d.getDate() + 7)
                      else if (type === 'Monthly')  d.setMonth(d.getMonth() + 1)
                      else if (type === 'Quarterly') d.setMonth(d.getMonth() + 3)
                      else if (type === 'Semi-annually') d.setMonth(d.getMonth() + 6)
                      else if (type === 'Annually') d.setFullYear(d.getFullYear() + 1)
                      return d.toISOString().split('T')[0]
                    } catch { return '—' }
                  })()}
                </span>
              </div>
            )}
          </div>

          {/* Assigned to card */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Assigned to
              </span>
            </div>
            {!projectId ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>
                Select a project to see available team members.
              </div>
            ) : projectTeam.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                ⚠️ No team members assigned to this project yet.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: assignees.length > 0 ? 12 : 0 }}>
                  {projectTeam.map((u: any) => {
                    const sel = assignees.includes(u.id)
                    return (
                      <button
                        key={u.id} type="button"
                        onClick={() => toggleAssignee(u.id)}
                        className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                      >
                        {sel ? '✓ ' : ''}{u.full_name || u.email}
                      </button>
                    )
                  })}
                </div>
                {assignees.length > 0 && (
                  <div>
                    {assignees.map((uid, idx) => {
                      const u = projectTeam.find((u: any) => u.id === uid)
                      if (!u) return null
                      return (
                        <div key={uid} className="member-tile">
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6],
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, flexShrink: 0,
                          }}>
                            {ini(u.full_name || u.email)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.full_name || u.email}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                              {u.role}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}