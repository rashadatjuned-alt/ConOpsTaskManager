'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, Save, Link as LinkIcon } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────
const TYPES = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

const COLORS = [
  { hex: '#378ADD', label: 'Blue'   },
  { hex: '#7F77DD', label: 'Purple' },
  { hex: '#EF9F27', label: 'Amber'  },
  { hex: '#639922', label: 'Olive'  },
  { hex: '#E24B4A', label: 'Red'    },
  { hex: '#3B6D11', label: 'Forest' },
  { hex: '#854F0B', label: 'Brown'  },
  { hex: '#185FA5', label: 'Navy'   },
  { hex: '#14B8A6', label: 'Teal'   },
  { hex: '#EC4899', label: 'Pink'   },
]

// ── Types ─────────────────────────────────────────────────────────────────
interface InlineTask {
  id: string
  topic: string
  description: string
  type: string
  start_date: string
  end_date: string
  assignees: string[]
}

interface InlineResource {
  id: string
  title: string
  link: string
}

// ── Component ─────────────────────────────────────────────────────────────
export default function CreateProject() {
  const router   = useRouter()
  const today    = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  // ── Form state ────────────────────────────────────────────────────────────
  const [name,      setName]      = useState('')
  const [desc,      setDesc]      = useState('')
  const [color,     setColor]     = useState('#378ADD')
  const [members,   setMembers]   = useState<string[]>([])
  const [tasks,     setTasks]     = useState<InlineTask[]>([])
  const [resources, setResources] = useState<InlineResource[]>([])

  // ── Server state ──────────────────────────────────────────────────────────
  const [users,   setUsers]   = useState<any[]>([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  // ── Load users ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('Users').select('id,full_name,email,role').then(({ data }) => {
      setUsers((data || []).filter((u: any) => u.role !== 'Admin'))
    })
  }, [])

  // ── Member toggle — cascades removal to tasks ─────────────────────────────
  const toggleMember = (id: string) => {
    setMembers(prev => {
      const removing = prev.includes(id)
      const next = removing ? prev.filter(m => m !== id) : [...prev, id]
      if (removing) {
        setTasks(t => t.map(task => ({
          ...task,
          assignees: task.assignees.filter(a => a !== id),
        })))
      }
      return next
    })
  }

  // ── Task helpers ──────────────────────────────────────────────────────────
  const addTask = () => setTasks(prev => [...prev, {
    id: `new-${Date.now()}`, topic: '', description: '',
    type: 'One-time', start_date: today, end_date: nextWeek, assignees: [],
  }])
  const updateTask = (id: string, field: string, val: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t))
  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id))
  const toggleTaskAssignee = (taskId: string, userId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      return {
        ...t,
        assignees: t.assignees.includes(userId)
          ? t.assignees.filter(id => id !== userId)
          : [...t.assignees, userId],
      }
    }))
  }

  // ── Resource helpers ──────────────────────────────────────────────────────
  const addResource = () => setResources(prev => [...prev, {
    id: `res-${Date.now()}`, title: '', link: '',
  }])
  const updateResource = (id: string, field: 'title' | 'link', val: string) =>
    setResources(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
  const removeResource = (id: string) =>
    setResources(prev => prev.filter(r => r.id !== id))

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(''); setSuccess(''); setSaving(true)
    if (!name.trim()) { setError('Project name is required.'); setSaving(false); return }
    for (const t of tasks) {
      if (!t.topic.trim()) { setError('All task titles are required.'); setSaving(false); return }
      if (t.end_date < t.start_date) { setError(`Task "${t.topic}" end date is before start date.`); setSaving(false); return }
    }

    try {
      // 1. Create project
      const { data: projData, error: projErr } = await supabase.from('Projects').insert({
        name:        name.trim(),
        description: desc.trim(),
        color_code:  color,
      }).select().single()
      if (projErr) throw new Error(`Project creation failed: ${projErr.message}`)

      // 2. Project members junction
      if (members.length > 0) {
        const { error: memErr } = await supabase.from('project_members').insert(
          members.map(uid => ({ project_id: projData.id, user_id: uid }))
        )
        if (memErr) throw new Error(`Adding members failed: ${memErr.message}`)
      }

      // 3. Inline tasks + assignees
      for (const t of tasks) {
        const { data: taskData, error: taskErr } = await supabase.from('Tasks').insert({
          project_id:   projData.id,
          project_name: name.trim(),
          topic:        t.topic.trim(),
          description:  t.description.trim(),
          type:         t.type,
          start_date:   t.start_date,
          end_date:     t.end_date,
          status:       'Not Started',
          tags:         [],
        }).select().single()
        if (taskErr) throw new Error(`Task "${t.topic}" failed: ${taskErr.message}`)

        if (t.assignees.length > 0) {
          const { error: taErr } = await supabase.from('task_assignees').insert(
            t.assignees.map(uid => ({ task_id: taskData.id, user_id: uid }))
          )
          if (taErr) throw new Error(`Assignments for "${t.topic}" failed: ${taErr.message}`)
        }
      }

      setSuccess(`🎉 Project "${name.trim()}" created successfully!`)
      setTimeout(() => router.push('/all-projects'), 1200)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const projectUsers = users.filter(u => members.includes(u.id))
  const selectedColor = COLORS.find(c => c.hex === color)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell title="New Project">

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          <Save size={14} />
          {saving ? 'Creating...' : `Create Project${tasks.length > 0 ? ` + ${tasks.length} Task${tasks.length > 1 ? 's' : ''}` : ''}`}
        </button>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="two-col-layout">

        {/* ── LEFT column ── */}
        <div>

          {/* Project details */}
          <div className="card">
            <div className="form-section">Project details</div>

            <div className="form-group">
              <label className="form-label">Project name *</label>
              <input
                className="form-input"
                placeholder="e.g. Q4 Campaign"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="What is this project about?"
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Accent color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                {COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.hex)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: c.hex, border: 'none', cursor: 'pointer',
                      outline: color === c.hex ? `3px solid var(--nav-active-txt)` : 'none',
                      outlineOffset: 2, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'outline .15s',
                    }}
                  >
                    {color === c.hex && (
                      <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assign members */}
          <div className="card">
            <div className="form-section">Assign members</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 12 }}>
              These people will be available to assign to tasks within this project.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
              {users.length === 0
                ? <span style={{ fontSize: 13, color: 'var(--txt3)' }}>No users available.</span>
                : users.map((u: any) => {
                    const sel = members.includes(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                        onClick={() => toggleMember(u.id)}
                      >
                        {sel ? '✓ ' : ''}{u.full_name || u.email}
                      </button>
                    )
                  })
              }
            </div>
            {members.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                {members.length} member{members.length !== 1 ? 's' : ''} assigned
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="form-section" style={{ margin: 0, padding: 0, border: 'none' }}>
                Tasks{' '}
                <span style={{ fontWeight: 400, color: 'var(--txt3)' }}>({tasks.length})</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addTask}>
                <Plus size={13} /> Add Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '12px 0' }}>
                No tasks yet. You can add them now or create them later.
              </div>
            ) : tasks.map((t, i) => (
              <div key={t.id} className={`block-draft${!t.topic ? ' empty' : ''}`}>
                <div className="block-header">
                  <span className="block-label">Task {i + 1}</span>
                  <button className="btn-delete" onClick={() => removeTask(t.id)}>
                    <Trash2 size={12} /> Remove
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    className="form-input"
                    placeholder="Task title..."
                    value={t.topic}
                    onChange={e => updateTask(t.id, 'topic', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea form-textarea-sm"
                    placeholder="Optional context..."
                    value={t.description}
                    onChange={e => updateTask(t.id, 'description', e.target.value)}
                  />
                </div>

                <div className="form-grid-2" style={{ gap: 8, marginBottom: 10 }}>
                  <div>
                    <label className="form-label">Start date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={t.start_date}
                      onChange={e => updateTask(t.id, 'start_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">End date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={t.end_date}
                      onChange={e => updateTask(t.id, 'end_date', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2" style={{ gap: 8 }}>
                  <div>
                    <label className="form-label">Task type</label>
                    <select
                      className="form-select"
                      value={t.type}
                      onChange={e => updateTask(t.id, 'type', e.target.value)}
                    >
                      {TYPES.map(tp => <option key={tp}>{tp}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Assign to</label>
                    {projectUsers.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>
                        Add members to the project first
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {projectUsers.map((u: any) => {
                          const sel = t.assignees.includes(u.id)
                          return (
                            <button
                              key={u.id}
                              type="button"
                              className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                              style={{ fontSize: 11, padding: '2px 10px' }}
                              onClick={() => toggleTaskAssignee(t.id, u.id)}
                            >
                              {sel ? '✓ ' : ''}{(u.full_name || u.email).split(' ')[0]}
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
              <div key={r.id} className={`block-draft${!r.title ? ' empty' : ''}`}>
                <div className="block-header">
                  <span className="block-label">Resource {i + 1}</span>
                  <button className="btn-delete" onClick={() => removeResource(r.id)}>
                    <Trash2 size={12} /> Remove
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    className="form-input"
                    placeholder="Resource title..."
                    value={r.title}
                    onChange={e => updateResource(r.id, 'title', e.target.value)}
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
                      onChange={e => updateResource(r.id, 'link', e.target.value)}
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
              <span className="summary-lbl">Name</span>
              <span className="summary-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {name
                  ? <><div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />{name}</>
                  : '—'
                }
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Color</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: color }} />
                <span className="summary-val">{selectedColor?.label || '—'}</span>
              </div>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Members</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {members.length === 0
                  ? <span className="summary-val">—</span>
                  : members.slice(0, 4).map((uid, i) => {
                      const u = users.find((u: any) => u.id === uid)
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
                {members.length > 4 && (
                  <div className="avatar av-1" style={{ width: 22, height: 22, fontSize: 9, fontWeight: 800 }}>
                    +{members.length - 4}
                  </div>
                )}
              </div>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Tasks</span>
              <span className="summary-val">{tasks.length}</span>
            </div>
            <div className="summary-row">
              <span className="summary-lbl">Resources</span>
              <span className="summary-val">{resources.length}</span>
            </div>
          </div>

          <div className="card">
            <div className="form-section">Tips</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Members added here appear in the assignee picker when creating tasks inside this project.',
                'Tasks added here are created immediately when you save. More can be added from the project view later.',
                'Resources are shared links and documents visible to all project members.',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--bg2)', color: 'var(--txt3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1,
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  )
}