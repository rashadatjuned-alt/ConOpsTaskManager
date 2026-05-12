'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import type { Status, Resource } from '@/types'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const TYPES    = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

const STATUS_DOT: Record<string, string> = {
  'Not Started': 'var(--txt3)', 'In Progress': '#3b82f6',
  'On-Hold': '#f59e0b', 'Completed': '#22c55e',
}
const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  'Not Started': { bg: 'var(--pill-ns-bg)', color: 'var(--pill-ns-txt)' },
  'In Progress': { bg: 'var(--blue2)', color: 'var(--blue)' },
  'On-Hold':     { bg: 'var(--amber2)', color: 'var(--amber)' },
  'Completed':   { bg: 'var(--accent2)', color: 'var(--accent)' },
}

function Pill({ status }: { status: string }) {
  const s = STATUS_PILL[status] || STATUS_PILL['Not Started']
  return <span style={{ background: s.bg, color: s.color, fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{status}</span>
}

function nextRecurrence(start: string, end: string, type: string) {
  const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 864e5)
  const d = new Date(start)
  if (type === 'Weekly') d.setDate(d.getDate() + 7)
  else if (type === 'Monthly') d.setMonth(d.getMonth() + 1)
  else if (type === 'Quarterly') d.setMonth(d.getMonth() + 3)
  else if (type === 'Semi-annually') d.setMonth(d.getMonth() + 6)
  else if (type === 'Annually') d.setFullYear(d.getFullYear() + 1)
  const newStart = d.toISOString().split('T')[0]
  const newEnd = new Date(d.getTime() + duration * 864e5).toISOString().split('T')[0]
  return { start: newStart, end: newEnd }
}

function assigneesFromRow(row: any): string[] {
  if (Array.isArray(row.assignees) && row.assignees.length > 0) return row.assignees
  if (row.owner) return row.owner.split(',').map((s: string) => s.trim()).filter(Boolean)
  return []
}

export default function TaskDetail() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const [task,         setTask]         = useState<any>(null)
  const [subtasks,     setSubtasks]     = useState<any[]>([])
  const [projectTeam,  setProjectTeam]  = useState<any[]>([])
  const [myRole,       setMyRole]       = useState('')
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [cloning,      setCloning]      = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [loading,      setLoading]      = useState(true)

  // local edit state
  const [editTask,     setEditTask]     = useState<any>(null)
  const [editSubtasks, setEditSubtasks] = useState<any[]>([])
  const [resources,    setResources]    = useState<Resource[]>([])

  const loadTask = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: me } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
    setMyRole(me?.role || 'Team Member')

    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('Tasks').select('*').eq('id', id).single(),
      supabase.from('Subtasks').select('*').eq('parent_task_id', id).order('id'),
    ])

    if (!t) { setLoading(false); return }
    setTask(t)
    setSubtasks(s || [])
    setResources(Array.isArray(t.resources) ? t.resources : [])

    // Load project team
    if (t.project_name) {
      const { data: proj } = await supabase.from('Projects').select('members').eq('name', t.project_name).single()
      if (proj?.members?.length) {
        const { data: users } = await supabase.from('Users').select('id,full_name,role').in('id', proj.members)
        setProjectTeam((users || []).filter((u: any) => u.role !== 'Admin'))
      } else {
        const { data: users } = await supabase.from('Users').select('id,full_name,role')
        setProjectTeam((users || []).filter((u: any) => u.role !== 'Admin'))
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadTask() }, [loadTask])

  const startEdit = () => {
    setEditTask({ ...task })
    setEditSubtasks(subtasks.map((s: any) => ({ ...s })))
    setEditing(true)
    setError('')
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditTask(null)
    setEditSubtasks([])
    setResources(Array.isArray(task.resources) ? task.resources : []) // Fixed resource rollback
    setError('')
  }

  const canManage = myRole === 'Admin' || myRole === 'Manager'

  // ── status change (always allowed) ──────────────────────────────────
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'Completed' && subtasks.some((s: any) => s.status !== 'Completed')) {
      setError('All subtasks must be Completed first.')
      return
    }
    setError('')
    const updated = { ...task, status: newStatus }
    setTask(updated)
    await supabase.from('Tasks').update({ status: newStatus }).eq('id', id)

    // auto-create next recurrence
    if (newStatus === 'Completed' && task.type !== 'One-time') {
      const { start, end } = nextRecurrence(task.start_date, task.end_date, task.type)
      const { data: newTask } = await supabase.from('Tasks').insert({
        project_name: task.project_name,
        topic: task.topic,
        description: task.description,
        assignees: task.assignees,
        type: task.type,
        start_date: start,
        end_date: end,
        status: 'Not Started',
        resources: task.resources || [],
        tags: task.tags || [],
      }).select().single()

      if (newTask) {
        for (const sub of subtasks) {
          await supabase.from('Subtasks').insert({
            parent_task_id: newTask.id,
            topic: sub.topic,
            description: sub.description,
            assignees: assigneesFromRow(sub),
            start_date: start,
            end_date: end,
            status: 'Not Started',
          })
        }
        setSuccess(`✅ Next ${task.type} instance created (${start}).`)
        setTimeout(() => setSuccess(''), 4000)
      }
    }
  }

  // ── save all edits ───────────────────────────────────────────────────
  const handleSave = async () => {
    setError(''); setSaving(true)
    if (!editTask.topic?.trim()) { setError('Task title is required.'); setSaving(false); return }
    if (editTask.status === 'Completed' && editSubtasks.some((s: any) => s.status !== 'Completed')) {
      setError('All subtasks must be Completed before marking task as Completed.')
      setSaving(false); return
    }
    for (const s of editSubtasks) {
      if (!s.topic?.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
    }

    try {
      await supabase.from('Tasks').update({
        topic: editTask.topic.trim(),
        description: editTask.description?.trim() || '',
        assignees: editTask.assignees || [],
        type: editTask.type,
        start_date: editTask.start_date,
        end_date: editTask.end_date,
        status: editTask.status,
        resources: resources,
      }).eq('id', id)

      for (const s of editSubtasks) {
        const payload = {
          topic: s.topic.trim(),
          description: s.description?.trim() || '',
          assignees: s.assignees || [],
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.status,
        }
        if (s.isNew) {
          await supabase.from('Subtasks').insert({ ...payload, parent_task_id: Number(id) })
        } else {
          await supabase.from('Subtasks').update(payload).eq('id', s.id)
        }
      }

      await loadTask()
      setEditing(false)
      setSuccess('✅ Changes saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  // ── clone ────────────────────────────────────────────────────────────
  const handleClone = async () => {
    setCloning(true)
    const { data: newTask } = await supabase.from('Tasks').insert({
      project_name: task.project_name,
      topic: `${task.topic} (Copy)`,
      description: task.description,
      assignees: task.assignees,
      type: task.type,
      start_date: task.start_date,
      end_date: task.end_date,
      status: 'Not Started',
      resources: task.resources || [],
    }).select().single()

    if (newTask) {
      for (const sub of subtasks) {
        await supabase.from('Subtasks').insert({
          parent_task_id: newTask.id,
          topic: sub.topic,
          description: sub.description,
          assignees: assigneesFromRow(sub),
          start_date: sub.start_date,
          end_date: sub.end_date,
          status: 'Not Started',
        })
      }
      router.push(`/tasks/${newTask.id}`)
    }
    setCloning(false)
  }

  // ── delete ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm(`Delete "${task.topic}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('Subtasks').delete().eq('parent_task_id', id)
    await supabase.from('Tasks').delete().eq('id', id)
    router.back()
  }

  // ── assignee toggle ──────────────────────────────────────────────────
  const toggleAssignee = (name: string) => {
    const cur: string[] = editTask.assignees || []
    setEditTask((p: any) => ({
      ...p,
      assignees: cur.includes(name) ? cur.filter(a => a !== name) : [...cur, name],
    }))
  }

  const toggleSubAssignee = (subId: string, name: string) => {
    setEditSubtasks(prev => prev.map((s: any) => {
      if (String(s.id) !== String(subId)) return s
      const cur: string[] = s.assignees || []
      return { ...s, assignees: cur.includes(name) ? cur.filter(a => a !== name) : [...cur, name] }
    }))
  }

  // ── resource helpers ─────────────────────────────────────────────────
  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  // ── subtask helpers ──────────────────────────────────────────────────
  const addSubtask = () => setEditSubtasks(p => [...p, {
    id: `new-${Date.now()}`, topic: '', description: '',
    assignees: [], start_date: editTask?.start_date || '',
    end_date: editTask?.end_date || '', status: 'Not Started', isNew: true,
  }])
  const updateSub = (id: string, field: string, val: string) =>
    setEditSubtasks(p => p.map((s: any) => String(s.id) === id ? { ...s, [field]: val } : s))
  const removeSub = async (s: any) => {
    if (!s.isNew) {
      if (!confirm('Delete this subtask?')) return
      await supabase.from('Subtasks').delete().eq('id', s.id)
    }
    setEditSubtasks(p => p.filter((x: any) => String(x.id) !== String(s.id)))
  }

  if (loading) return <AppShell title="Task Detail"><div style={S.loading}>Loading...</div></AppShell>
  if (!task)   return <AppShell title="Task Detail"><div style={{ color: 'var(--red)', padding: 20 }}>Task not found.</div></AppShell>

  const taskAssignees = assigneesFromRow(task)
  const editAssignees: string[] = editing ? (editTask?.assignees || []) : taskAssignees
  const isRecurring = task.type && task.type !== 'One-time'

  return (
    <AppShell title={task.topic || 'Task Detail'}>
      {/* ── Top bar ── */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => router.back()}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div style={S.topTitle}>{task.topic}</div>
        
        {/* Status — always editable */}
        <select
          value={editing ? editTask.status : task.status}
          onChange={e => editing
            ? setEditTask((p: any) => ({ ...p, status: e.target.value }))
            : handleStatusChange(e.target.value)
          }
          style={S.statusSelect}
        >
          {STATUSES.map((s: any) => <option key={s}>{s}</option>)}
        </select>

        {isRecurring && <span style={S.recurBadge}>↻ {task.type}</span>}

        <button style={S.cloneBtn} onClick={handleClone} disabled={cloning}>
          {cloning ? 'Cloning...' : 'Clone'}
        </button>

        {!editing && (
          <button style={S.editBtn} onClick={startEdit}>
            ✏ Edit
          </button>
        )}
        {editing && (
          <>
            <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save'}
            </button>
            <button style={S.cancelBtn} onClick={cancelEdit}>Cancel</button>
          </>
        )}
        {canManage && !editing && (
          <button style={S.deleteBtn} onClick={handleDelete} disabled={deleting}>
            {deleting ? '…' : '🗑 Delete'}
          </button>
        )}
      </div>

      {isRecurring && (
        <div style={S.recurBanner}>
          🔄 <strong>{task.type} recurring task</strong> — When marked Completed the next instance is auto-created.
        </div>
      )}

      {error   && <div style={S.alertErr}>{error}</div>}
      {success && <div style={S.alertOk}>{success}</div>}

      {/* ── Main Single Column Stack ── */}
      <div style={S.pageStack}>
        
        {/* ── TASK DETAILS SECTION ── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={S.sectionTitle}>Task Details</div>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Task Title</label>
            {editing
              ? <input style={S.input} value={editTask.topic || ''} onChange={e => setEditTask((p: any) => ({ ...p, topic: e.target.value }))} />
              : <div style={S.viewVal}>{task.topic}</div>
            }
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Description</label>
            {editing
              ? <textarea style={S.textarea} value={editTask.description || ''} onChange={e => setEditTask((p: any) => ({ ...p, description: e.target.value }))} />
              : <div style={{ ...S.viewVal, color: task.description ? 'var(--txt2)' : 'var(--txt3)' }}>{task.description || 'No description.'}</div>
            }
          </div>

          <div style={S.multiGrid}>
            <div style={S.fieldGroup}>
              <label style={S.label}>Start Date</label>
              {editing
                ? <input type="date" style={S.input} value={editTask.start_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, start_date: e.target.value }))} />
                : <div style={S.viewVal}>{task.start_date || '—'}</div>
              }
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>End Date</label>
              {editing
                ? <input type="date" style={S.input} value={editTask.end_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, end_date: e.target.value }))} />
                : <div style={S.viewVal}>{task.end_date || '—'}</div>
              }
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Task Type</label>
              {editing
                ? <select style={S.input} value={editTask.type || 'One-time'} onChange={e => setEditTask((p: any) => ({ ...p, type: e.target.value }))}>{TYPES.map((t: any) => <option key={t}>{t}</option>)}</select>
                : <div style={S.viewVal}>{task.type}</div>
              }
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Project</label>
              <div style={S.viewVal}>{task.project_name || '—'}</div>
            </div>
          </div>

          {/* Assigned To */}
          <div style={S.fieldGroup}>
            <label style={S.label}>Assigned To</label>
            {editing ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {projectTeam.map((u: any) => {
                  const sel = editAssignees.includes(u.full_name)
                  return (
                    <button key={u.id} type="button"
                      onClick={() => toggleAssignee(u.full_name)}
                      style={{ ...S.chip, ...(sel ? S.chipSel : {}) }}>
                      {sel ? '✓ ' : ''}{u.full_name}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={S.viewVal}>{taskAssignees.join(', ') || '—'}</div>
            )}
          </div>
        </div>

        {/* ── RESOURCES SECTION ── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={S.sectionTitle}>Resources</div>
            {editing && <button style={S.addBtn} onClick={addResource}>+ Add Resource</button>}
          </div>
          
          {resources.length === 0 ? (
            <div style={S.emptyMsg}>No resources attached.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['SL', 'Title', 'Link', ...(editing ? [''] : [])].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resources.map((r, i) => (
                  <tr key={i}>
                    <td style={S.td}>{r.sl}</td>
                    <td style={S.td}>
                      {editing
                        ? <input style={S.inlineInput} value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} />
                        : r.title
                      }
                    </td>
                    <td style={S.td}>
                      {editing
                        ? <input style={S.inlineInput} value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} placeholder="https://…" />
                        : r.link
                          ? <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontSize: 13, textDecoration: 'underline' }}>{r.link}</a>
                          : '—'
                      }
                    </td>
                    {editing && (
                      <td style={S.td}>
                        <button onClick={() => removeResource(i)} style={S.removeBtn}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── SUBTASKS SECTION ── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={S.sectionTitle}>
              Subtasks
              {subtasks.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--txt3)', marginLeft: 12, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                  {subtasks.filter((s: any) => s.status === 'Completed').length} / {subtasks.length} completed
                </span>
              )}
            </div>
            {editing && <button style={S.addBtn} onClick={addSubtask}>+ Add Subtask</button>}
          </div>

          {(editing ? editSubtasks : subtasks).length === 0 ? (
            <div style={S.emptyMsg}>No subtasks yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(editing ? editSubtasks : subtasks).map((s, i) => {
                const subAssignees = assigneesFromRow(s)
                const taskAssigneeList: string[] = editing
                  ? (editTask?.assignees || [])
                  : taskAssignees

                return (
                  <div key={s.id} style={S.subCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={S.subNum}>#{i + 1}</span>
                      {!editing && <Pill status={s.status} />}
                      {editing && (
                        <button onClick={() => removeSub(s)} style={{ ...S.removeBtn, marginLeft: 'auto' }}>✕ Remove</button>
                      )}
                    </div>

                    <div style={S.multiGrid}>
                      <div style={S.fieldGroup}>
                        <label style={S.label}>Title</label>
                        {editing
                          ? <input style={S.input} value={s.topic} onChange={e => updateSub(String(s.id), 'topic', e.target.value)} />
                          : <div style={S.viewVal}>{s.topic}</div>
                        }
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.label}>Status</label>
                        {editing
                          ? <select style={S.input} value={s.status} onChange={e => updateSub(String(s.id), 'status', e.target.value)}>{STATUSES.map(st => <option key={st}>{st}</option>)}</select>
                          : <div style={S.viewVal}>{s.status}</div>
                        }
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.label}>Start Date</label>
                        {editing
                          ? <input type="date" style={S.input} value={s.start_date} onChange={e => updateSub(String(s.id), 'start_date', e.target.value)} />
                          : <div style={S.viewVal}>{s.start_date || '—'}</div>
                        }
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.label}>End Date</label>
                        {editing
                          ? <input type="date" style={S.input} value={s.end_date} onChange={e => updateSub(String(s.id), 'end_date', e.target.value)} />
                          : <div style={S.viewVal}>{s.end_date || '—'}</div>
                        }
                      </div>
                    </div>

                    <div style={S.fieldGroup}>
                      <label style={S.label}>Description</label>
                      {editing
                        ? <textarea style={S.textarea} value={s.description || ''} onChange={e => updateSub(String(s.id), 'description', e.target.value)} placeholder="Optional…" />
                        : <div style={{ ...S.viewVal, color: s.description ? 'var(--txt2)' : 'var(--txt3)' }}>{s.description || '—'}</div>
                      }
                    </div>

                    <div style={{ marginBottom: 0 }}>
                      <label style={S.label}>Assigned To (from task assignees)</label>
                      {editing ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                          {taskAssigneeList.length === 0
                            ? <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Assign people to the task first.</span>
                            : taskAssigneeList.map(name => {
                                const sel = (s.assignees || []).includes(name)
                                return (
                                  <button key={name} type="button"
                                    onClick={() => toggleSubAssignee(String(s.id), name)}
                                    style={{ ...S.chip, ...(sel ? S.chipSel : {}), fontSize: 11, padding: '2px 8px' }}>
                                    {sel ? '✓ ' : ''}{name}
                                  </button>
                                )
                              })
                          }
                        </div>
                      ) : (
                        <div style={S.viewVal}>{subAssignees.join(', ') || '—'}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

// ── styles ─────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  loading:   { padding: 40, color: 'var(--txt3)', textAlign: 'center' },
  topBar:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  backBtn:   { background: 'none', border: '1px solid var(--input-brd)', borderRadius: 6, padding: '5px 8px', color: 'var(--txt3)', cursor: 'pointer', display: 'flex' },
  topTitle:  { flex: 1, fontSize: 16, fontWeight: 600, color: 'var(--txt)', letterSpacing: '-0.01em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusSelect: { padding: '4px 8px', borderRadius: 6, background: 'var(--input-bg)', border: '1px solid var(--input-brd)', color: 'var(--txt)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  recurBadge: { background: '#3d2400', color: '#f59e0b', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
  editBtn:   { background: 'var(--blue)', color: 'var(--blue2)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  saveBtn:   { background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  cancelBtn: { background: 'var(--brd)', color: 'var(--txt3)', border: '1px solid var(--input-brd)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  cloneBtn:  { background: 'var(--brd)', color: 'var(--txt3)', border: '1px solid var(--input-brd)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  deleteBtn: { background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(197,34,31,0.2)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  recurBanner: { background: 'var(--amber2)', border: '1px solid rgba(180,83,9,0.2)', borderRadius: 8, padding: '9px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: 16 },
  alertErr:  { background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(197,34,31,0.2)', borderRadius: 6, padding: '9px 14px', fontSize: 12, marginBottom: 16 },
  alertOk:   { background: 'var(--accent2)', color: 'var(--accent)', border: '1px solid rgba(46,125,50,0.2)', borderRadius: 6, padding: '9px 14px', fontSize: 12, marginBottom: 16 },
  
  // New Layout Styles
  pageStack: { display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 },
  card:      { background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 10, padding: 24 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, marginBottom: 20, borderBottom: '1px solid var(--card-brd)' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  multiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 },
  
  fieldGroup:{ marginBottom: 16 },
  label:     { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt3)', display: 'block', marginBottom: 6 },
  viewVal:   { fontSize: 14, color: 'var(--txt2)', lineHeight: 1.5 },
  input:     { width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-brd)', borderRadius: 6, color: 'var(--txt)', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  textarea:  { width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-brd)', borderRadius: 6, color: 'var(--txt)', fontSize: 14, fontFamily: 'inherit', outline: 'none', minHeight: 80, resize: 'vertical' },
  chip:      { padding: '4px 12px', fontSize: 13, borderRadius: 20, border: '1px solid var(--input-brd)', cursor: 'pointer', background: 'transparent', color: 'var(--txt3)', fontFamily: 'inherit', transition: 'all 0.12s' },
  chipSel:   { background: 'var(--accent)', color: 'var(--accent2)', borderColor: 'var(--accent)' },
  addBtn:    { background: 'var(--blue)', color: 'var(--blue2)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  th:        { textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt3)', padding: '8px 12px', borderBottom: '1px solid var(--brd)' },
  td:        { fontSize: 13, color: 'var(--txt3)', padding: '12px', borderBottom: '1px solid var(--row-brd)', verticalAlign: 'middle' },
  inlineInput: { background: 'var(--input-bg)', border: '1px solid var(--input-brd)', borderRadius: 4, padding: '6px 10px', color: 'var(--txt)', fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none' },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '4px 8px' },
  subCard:   { background: 'var(--input-bg)', border: '1px solid var(--card-brd)', borderRadius: 8, padding: '16px' },
  subNum:    { fontSize: 12, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase' },
  emptyMsg:  { fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '24px 0' },
}
