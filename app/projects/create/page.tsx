'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, Save, Link as LinkIcon, X } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
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

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : (name || '?')[0].toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────
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
  const projectUsers   = users.filter(u => members.includes(u.id))
  const selectedColor  = COLORS.find(c => c.hex === color)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell title="New Project">

      {/* Page-scoped styles — mirrors project detail */}
      <style>{`
        .member-tile {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px;
          background: var(--bg2);
          border: 0.5px solid var(--brd);
          border-radius: 8px;
          margin-bottom: 6px;
        }
        .member-tile:last-child { margin-bottom: 0; }
        .meta-row-proj {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0;
          border-bottom: 0.5px solid var(--brd);
          font-size: 12px;
        }
        .meta-row-proj:last-child { border-bottom: none; }
        .meta-lbl-proj {
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
            : `Create Project${tasks.length > 0 ? ` + ${tasks.length} Task${tasks.length > 1 ? 's' : ''}` : ''}`
          }
        </button>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

      {/* ── Two-column layout — mirrors project detail ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

        {/* ════ LEFT COLUMN ════ */}
        <div>

          {/* Overview card — mirrors project detail overview */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Overview
              </span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>
                Project name *
              </label>
              <input
                className="form-input"
                placeholder="e.g. Q4 Campaign"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>
                Description
              </label>
              <textarea
                className="form-textarea"
                placeholder="What is this project about?"
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 8 }}>
                Accent colour
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.hex)}
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: c.hex, border: 'none', cursor: 'pointer', flexShrink: 0,
                      outline: color === c.hex ? `3px solid ${c.hex}` : 'none',
                      outlineOffset: 2, transition: 'outline .15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {color === c.hex && (
                      <svg width="11" height="11" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Tasks card — mirrors project detail tasks table ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '0.5px solid var(--brd)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt)' }}>Tasks</span>
                <span style={{ fontSize: 12, color: 'var(--txt3)' }}>({tasks.length})</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addTask}>
                <Plus size={12} /> Add Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--txt3)', background: 'var(--bg2)' }}>
                No tasks yet. You can add them now or create them later.
              </div>
            ) : (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tasks.map((t, i) => (
                  <div key={t.id} style={{ background: 'var(--bg2)', border: '0.5px solid var(--brd)', borderRadius: 8, padding: '12px 14px' }}>

                    {/* Header: number badge + title preview + remove */}
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
                          {t.topic || 'New task'}
                        </span>
                      </div>
                      <button
                        onClick={() => removeTask(t.id)}
                        style={{ background: 'none', border: 'none', color: '#cc3333', cursor: 'pointer', display: 'flex', padding: 2 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {/* Title — full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Title *</label>
                        <input
                          className="form-input"
                          placeholder="Task title..."
                          value={t.topic}
                          onChange={e => updateTask(t.id, 'topic', e.target.value)}
                        />
                      </div>

                      {/* Description — full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Description</label>
                        <textarea
                          className="form-textarea"
                          style={{ minHeight: 52, fontSize: 13 }}
                          placeholder="Optional context..."
                          value={t.description}
                          onChange={e => updateTask(t.id, 'description', e.target.value)}
                        />
                      </div>

                      {/* Dates */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Start date</label>
                        <input type="date" className="form-input" value={t.start_date} onChange={e => updateTask(t.id, 'start_date', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>End date</label>
                        <input type="date" className="form-input" value={t.end_date} onChange={e => updateTask(t.id, 'end_date', e.target.value)} />
                      </div>

                      {/* Task type */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Type</label>
                        <select
                          className="form-select"
                          value={t.type}
                          onChange={e => updateTask(t.id, 'type', e.target.value)}
                        >
                          {TYPES.map(tp => <option key={tp}>{tp}</option>)}
                        </select>
                      </div>

                      {/* Assign to */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Assign to</label>
                        {projectUsers.length === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Add members first</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                            {projectUsers.map((u: any) => {
                              const sel = t.assignees.includes(u.id)
                              return (
                                <button
                                  key={u.id} type="button"
                                  onClick={() => toggleTaskAssignee(t.id, u.id)}
                                  className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                                  style={{ fontSize: 11, padding: '2px 10px' }}
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
            )}
          </div>

          {/* ── Resources card ── */}
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
                  <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={r.title}
                      onChange={e => updateResource(r.id, 'title', e.target.value)}
                      placeholder="Label..."
                      className="form-input"
                      style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                    />
                    <input
                      value={r.link}
                      onChange={e => updateResource(r.id, 'link', e.target.value)}
                      placeholder="https://..."
                      className="form-input"
                      style={{ flex: 2, padding: '5px 8px', fontSize: 12 }}
                    />
                    <button
                      onClick={() => removeResource(r.id)}
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

        {/* ════ RIGHT COLUMN ════ */}
        <div>

          {/* Progress card — mirrors project detail right column */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Progress
              </span>
            </div>

            {/* Status + task count side by side */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 5 }}>
                  Status
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: '#F1EFE8', color: '#5F5E5A',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#aaa', flexShrink: 0 }} />
                  Not Started
                </span>
              </div>
              {tasks.length > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 3 }}>
                    Tasks
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--txt)', lineHeight: 1, marginTop: 3 }}>
                    {tasks.length}
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar — empty on create */}
            <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: '0%', height: '100%', background: color, borderRadius: 3 }} />
            </div>

            {/* Start / End date tiles — shown once dates exist from tasks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                {
                  label: 'Start',
                  value: tasks.length
                    ? tasks.map(t => t.start_date).filter(Boolean).sort()[0] || '—'
                    : '—',
                },
                {
                  label: 'End',
                  value: tasks.length
                    ? tasks.map(t => t.end_date).filter(Boolean).sort().reverse()[0] || '—'
                    : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--brd)', borderRadius: 8, padding: '9px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: value === '—' ? 'var(--txt3)' : 'var(--txt)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Members card — mirrors project detail view mode (no remove button) */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Team Members{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                  ({members.length})
                </span>
              </span>
            </div>

            {/* Toggle chips to add/remove */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: members.length > 0 ? 12 : 0 }}>
              {users.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--txt3)' }}>No users available.</span>
              ) : users.map((u: any) => {
                const sel = members.includes(u.id)
                return (
                  <button
                    key={u.id} type="button"
                    onClick={() => toggleMember(u.id)}
                    className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                  >
                    {sel ? '✓ ' : ''}{u.full_name || u.email}
                  </button>
                )
              })}
            </div>

            {/* Selected members as tiles — same style as project detail view */}
            {members.length > 0 && (
              <div>
                {members.map((uid, idx) => {
                  const u = users.find((u: any) => u.id === uid)
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
          </div>

          {/* Resources preview card */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Resources{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({resources.length})</span>
              </span>
            </div>

            {resources.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No resources attached.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resources.map((r, idx) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--bg2)', border: '0.5px solid var(--brd)', borderRadius: 8 }}>
                    <LinkIcon size={13} color="var(--txt3)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', marginBottom: 2 }}>
                        {r.title || `Resource ${idx + 1}`}
                      </div>
                      {r.link && (
                        <div style={{ fontSize: 11, color: '#185FA5', wordBreak: 'break-all' }}>{r.link}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips card */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Tips
              </span>
            </div>
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
                    fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    border: '0.5px solid var(--brd)',
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