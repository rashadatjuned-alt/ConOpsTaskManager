'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, use } from 'react' // Added use
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation' // Removed useParams
import type { Status, Resource } from '@/types'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const TYPES    = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

interface TaskDetailProps {
  params: Promise<{ id: string }>
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

export default function TaskDetail({ params }: TaskDetailProps) {
  const router   = useRouter()
  
  // Next.js 16: Unwrap the params promise
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const [task,         setTask]         = useState<any>(null)
  const [subtasks,     setSubtasks]     = useState<any[]>([])
  const [projectTeam,  setProjectTeam]  = useState<any[]>([])
  const [myRole,       setMyRole]       = useState('')
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [cloning,      setCloning]      = useState(false)
  const [deleting,      setDeleting]     = useState(false)
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
    setResources(Array.isArray(task.resources) ? task.resources : [])
    setError('')
  }

  const canManage = myRole === 'Admin' || myRole === 'Manager'

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'Completed' && subtasks.some((s: any) => s.status !== 'Completed')) {
      setError('All subtasks must be Completed first.')
      return
    }
    setError('')
    const updated = { ...task, status: newStatus }
    setTask(updated)
    await supabase.from('Tasks').update({ status: newStatus }).eq('id', id)

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

  const handleDelete = async () => {
    if (!confirm(`Delete "${task.topic}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('Subtasks').delete().eq('parent_task_id', id)
    await supabase.from('Tasks').delete().eq('id', id)
    router.back()
  }

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

  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

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

  if (loading) return <AppShell title="Task Detail"><div style={{ padding: 40, textAlign: 'center' }}>Loading...</div></AppShell>
  if (!task)   return <AppShell title="Task Detail"><div style={{ color: 'red', padding: 20 }}>Task not found.</div></AppShell>

  const taskAssignees = assigneesFromRow(task)
  const editAssignees: string[] = editing ? (editTask?.assignees || []) : taskAssignees
  const isRecurring = task.type && task.type !== 'One-time'

  return (
    <AppShell title={task.topic || 'Task Detail'}>
      <style dangerouslySetInnerHTML={{ __html: `
        .tv-wrapper {
          --bg-color: transparent;
          --card-bg: #ffffff;
          --subtask-bg: #f3f4f6;
          --border-color: #e5e7eb;
          --text-main: #111827;
          --text-muted: #6b7280;
          --text-label: #4b5563;
          --pill-blue-bg: #eff6ff;
          --pill-blue-txt: #2563eb;
          --pill-gray-bg: #f3f4f6;
          --pill-gray-txt: #4b5563;
          --btn-bg: #ffffff;
          --btn-hover: #f3f4f6;
          --btn-delete-bg: #fef2f2;
          --btn-delete-txt: #ef4444;
          --btn-delete-hover: #fee2e2;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
          --arrow-blue: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563eb%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
          --arrow-gray: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234b5563%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
        }
        .dark .tv-wrapper, [data-theme="dark"] .tv-wrapper {
          --bg-color: transparent;
          --card-bg: #1e1e1e;
          --subtask-bg: #181818;
          --border-color: #2e2e2e;
          --text-main: #e5e5e5;
          --text-muted: #8b8b8b;
          --text-label: #6b6b6b;
          --pill-blue-bg: rgba(59, 130, 246, 0.15);
          --pill-blue-txt: #60a5fa;
          --pill-gray-bg: rgba(255, 255, 255, 0.05);
          --pill-gray-txt: #a3a3a3;
          --btn-bg: #2a2a2a;
          --btn-hover: #333333;
          --btn-delete-bg: rgba(239, 68, 68, 0.1);
          --btn-delete-txt: #ef4444;
          --btn-delete-hover: rgba(239, 68, 68, 0.2);
          --shadow-sm: none;
        }
        .tv-wrapper { color: var(--text-main); font-size: 14px; display: flex; flex-direction: column; gap: 20px; }
        .tv-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 12px; }
        .tv-back-nav { color: var(--text-muted); text-decoration: none; display: flex; align-items: center; gap: 8px; cursor: pointer; background: none; border: none; font-size: 14px; }
        .tv-actions { display: flex; gap: 10px; align-items: center; }
        .tv-btn { background-color: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm); transition: 0.2s; }
        .tv-btn:hover { background-color: var(--btn-hover); }
        .tv-btn-primary { background-color: var(--text-main); color: var(--card-bg); }
        .tv-btn-danger { background-color: var(--btn-delete-bg); color: var(--btn-delete-txt); border-color: transparent; }
        .tv-status-select { background-color: var(--pill-blue-bg); color: var(--pill-blue-txt); border: 1px solid transparent; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; appearance: none; padding-right: 24px; background-image: var(--arrow-blue); background-repeat: no-repeat; background-position: right 10px top 50%; background-size: 8px auto; }
        .tv-card { background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; box-shadow: var(--shadow-sm); }
        .tv-section-title { font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
        .tv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
        .tv-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .tv-field { display: flex; flex-direction: column; gap: 6px; }
        .tv-label { font-size: 11px; text-transform: uppercase; color: var(--text-label); font-weight: 600; letter-spacing: 0.05em; }
        .tv-val { font-size: 14px; color: var(--text-main); }
        .tv-input { width: 100%; padding: 8px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); font-size: 14px; }
        .tv-textarea { width: 100%; padding: 8px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); min-height: 80px; }
        .tv-table { width: 100%; border-collapse: collapse; text-align: left; }
        .tv-table th { font-size: 11px; text-transform: uppercase; color: var(--text-label); padding: 10px 12px; border-bottom: 1px solid var(--border-color); }
        .tv-table td { font-size: 13px; padding: 12px; border-bottom: 1px solid var(--border-color); }
        .tv-chip-container { display: flex; gap: 8px; flex-wrap: wrap; }
        .tv-chip { background: var(--btn-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 4px 10px; font-size: 12px; }
        .tv-chip.selected { background-color: var(--text-main); color: var(--card-bg); }
        .tv-alert { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
        .tv-alert-error { background-color: var(--btn-delete-bg); color: var(--btn-delete-txt); }
        .tv-alert-success { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .tv-alert-info { background-color: rgba(245, 158, 11, 0.1); color: #f59e0b; }
      `}} />

      <div className="tv-wrapper">
        <div className="tv-top-bar">
          <button className="tv-back-nav" onClick={() => router.back()}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg>
            Back
          </button>
          
          <div className="tv-actions">
            <select 
              className="tv-status-select"
              value={editing ? editTask.status : task.status}
              onChange={e => editing ? setEditTask((p: any) => ({ ...p, status: e.target.value })) : handleStatusChange(e.target.value)}
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>

            <button className="tv-btn" onClick={handleClone} disabled={cloning}>Clone</button>

            {!editing ? (
              <button className="tv-btn" onClick={startEdit}>✎ Edit</button>
            ) : (
              <>
                <button className="tv-btn tv-btn-primary" onClick={handleSave} disabled={saving}>💾 Save</button>
                <button className="tv-btn" onClick={cancelEdit}>Cancel</button>
              </>
            )}

            {canManage && !editing && (
              <button className="tv-btn tv-btn-danger" onClick={handleDelete} disabled={deleting}>🗑 Delete</button>
            )}
          </div>
        </div>

        {error   && <div className="tv-alert tv-alert-error">{error}</div>}
        {success && <div className="tv-alert tv-alert-success">{success}</div>}
        {isRecurring && <div className="tv-alert tv-alert-info">🔄 <strong>{task.type} recurring task</strong></div>}

        <div className="tv-card">
          <div className="tv-section-title">Task Details</div>
          <div className="tv-grid-2">
            <div className="tv-field">
              <span className="tv-label">Task Title</span>
              {editing 
                ? <input className="tv-input" value={editTask.topic || ''} onChange={e => setEditTask((p: any) => ({ ...p, topic: e.target.value }))} />
                : <span className="tv-val">{task.topic}</span>
              }
            </div>
            <div className="tv-field">
              <span className="tv-label">Project</span>
              <span className="tv-val">{task.project_name || '—'}</span>
            </div>
          </div>

          <div className="tv-field" style={{ marginBottom: 20 }}>
            <span className="tv-label">Description</span>
            {editing
              ? <textarea className="tv-textarea" value={editTask.description || ''} onChange={e => setEditTask((p: any) => ({ ...p, description: e.target.value }))} />
              : <span className="tv-val">{task.description || 'No description.'}</span>
            }
          </div>

          <div className="tv-grid-4">
            <div className="tv-field">
              <span className="tv-label">Start Date</span>
              {editing
                ? <input type="date" className="tv-input" value={editTask.start_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, start_date: e.target.value }))} />
                : <span className="tv-val">{task.start_date || '—'}</span>
              }
            </div>
            <div className="tv-field">
              <span className="tv-label">End Date</span>
              {editing
                ? <input type="date" className="tv-input" value={editTask.end_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, end_date: e.target.value }))} />
                : <span className="tv-val">{task.end_date || '—'}</span>
              }
            </div>
            <div className="tv-field">
              <span className="tv-label">Type</span>
              {editing
                ? <select className="tv-input" value={editTask.type || 'One-time'} onChange={e => setEditTask((p: any) => ({ ...p, type: e.target.value }))}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
                : <span className="tv-val">{task.type}</span>
              }
            </div>
          </div>
        </div>

        <div className="tv-card">
          <div className="tv-section-title">Assigned To</div>
          <div className="tv-chip-container">
            {editing ? (
              projectTeam.map((u: any) => {
                const sel = editAssignees.includes(u.full_name)
                return (
                  <button key={u.id} type="button" onClick={() => toggleAssignee(u.full_name)} className={`tv-chip ${sel ? 'selected' : ''}`}>
                    {u.full_name}
                  </button>
                )
              })
            ) : (
              taskAssignees.map(a => <div key={a} className="tv-chip">{a}</div>)
            )}
          </div>
        </div>

        <div className="tv-card">
          <div className="tv-section-title">
            Resources
            {editing && <button className="tv-btn" onClick={addResource}>＋ Add</button>}
          </div>
          <table className="tv-table">
            <thead>
              <tr><th style={{ width: 50 }}>SL</th><th>Description</th><th>Link</th></tr>
            </thead>
            <tbody>
              {resources.map((r, i) => (
                <tr key={i}>
                  <td>{r.sl}</td>
                  <td>{editing ? <input className="tv-input" value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} /> : r.title}</td>
                  <td>{editing ? <input className="tv-input" value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} /> : <a href={r.link} className="tv-link">{r.link}</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="tv-card">
          <div className="tv-section-title">
            Subtasks
            {editing && <button className="tv-btn" onClick={addSubtask}>＋ Add Subtask</button>}
          </div>
          <table className="tv-table">
            <thead>
              <tr><th>Title</th><th>Start</th><th>End</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(editing ? editSubtasks : subtasks).map((s, i) => (
                <tr key={s.id}>
                  <td>{editing ? <input className="tv-input" value={s.topic} onChange={e => updateSub(String(s.id), 'topic', e.target.value)} /> : s.topic}</td>
                  <td>{editing ? <input type="date" className="tv-input" value={s.start_date} onChange={e => updateSub(String(s.id), 'start_date', e.target.value)} /> : s.start_date}</td>
                  <td>{editing ? <input type="date" className="tv-input" value={s.end_date} onChange={e => updateSub(String(s.id), 'end_date', e.target.value)} /> : s.end_date}</td>
                  <td>
                    <select className="tv-status-select" value={s.status} onChange={e => updateSub(String(s.id), 'status', e.target.value)}>
                      {STATUSES.map(st => <option key={st}>{st}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
