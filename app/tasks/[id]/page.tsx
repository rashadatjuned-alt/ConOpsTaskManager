'use client'

export const dynamic = 'force-dynamic'
import React, { useEffect, useState, useCallback, use } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, Trash2, Copy, Link as LinkIcon, X, ChevronRight } from 'lucide-react'
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : (name || '?')[0].toUpperCase()
}

function nextRecurrence(start: string, end: string, type: string) {
  const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 864e5)
  const d = new Date(start)
  if (type === 'Weekly')             d.setDate(d.getDate() + 7)
  else if (type === 'Monthly')       d.setMonth(d.getMonth() + 1)
  else if (type === 'Quarterly')     d.setMonth(d.getMonth() + 3)
  else if (type === 'Semi-annually') d.setMonth(d.getMonth() + 6)
  else if (type === 'Annually')      d.setFullYear(d.getFullYear() + 1)
  const newStart = d.toISOString().split('T')[0]
  const newEnd   = new Date(d.getTime() + duration * 864e5).toISOString().split('T')[0]
  return { start: newStart, end: newEnd }
}

// ── Avatar chip ───────────────────────────────────────────────────────────────
function Avatar({ name, idx, size = 22 }: { name: string; idx: number; size?: number }) {
  return (
    <div
      title={name}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size <= 20 ? 8 : 9, fontWeight: 900,
        border: '2px solid var(--bg)',
        flexShrink: 0,
      }}
    >
      {ini(name)}
    </div>
  )
}

// ── Inline status select ──────────────────────────────────────────────────────
function StatusSelect({
  value,
  onChange,
  small = false,
}: {
  value: string
  onChange: (v: string) => void
  small?: boolean
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`status-sel ${STATUS_SEL_CLS[value] || 'sel-ns'}`}
      style={{ fontSize: small ? 10 : 12, padding: small ? '2px 24px 2px 8px' : '5px 28px 5px 10px' }}
    >
      {STATUSES.map(s => <option key={s}>{s}</option>)}
    </select>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface TaskDetailProps {
  params: Promise<{ id: string }>
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TaskDetail({ params }: TaskDetailProps) {
  const router = useRouter()
  const { id }  = use(params)

  const [task,        setTask]        = useState<any>(null)
  const [subtasks,    setSubtasks]    = useState<any[]>([])
  const [projectTeam, setProjectTeam] = useState<any[]>([])
  const [allUsers,    setAllUsers]    = useState<any[]>([])
  const [myRole,      setMyRole]      = useState('')
  const [loading,     setLoading]     = useState(true)

  // Edit state
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [cloning,      setCloning]      = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')

  const [editTask,     setEditTask]     = useState<any>(null)
  const [editSubtasks, setEditSubtasks] = useState<any[]>([])
  const [resources,    setResources]    = useState<Resource[]>([])

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadTask = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: me } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
    setMyRole(me?.role || 'Team Member')

    const { data: usersData } = await supabase.from('Users').select('id,full_name,role')
    const filteredUsers = (usersData || []).filter((u: any) => u.role !== 'Admin')
    setAllUsers(filteredUsers)

    const [taskRes, taRes, subsRes, saRes] = await Promise.all([
      supabase.from('Tasks').select('*').eq('id', id).single(),
      supabase.from('task_assignees').select('user_id').eq('task_id', id),
      supabase.from('Subtasks').select('*').eq('parent_task_id', id).order('id'),
      supabase.from('subtask_assignees').select('subtask_id,user_id'),
    ])

    if (!taskRes.data) { setLoading(false); return }

    const hydratedTask = {
      ...taskRes.data,
      assignees: (taRes.data || []).map((ta: any) => ta.user_id),
    }
    const hydratedSubs = (subsRes.data || []).map((s: any) => ({
      ...s,
      assignees: (saRes.data || []).filter((sa: any) => sa.subtask_id === s.id).map((sa: any) => sa.user_id),
    }))

    setTask(hydratedTask)
    setSubtasks(hydratedSubs)
    setResources(Array.isArray(hydratedTask.resources) ? hydratedTask.resources : [])

    if (hydratedTask.project_id) {
      const { data: pm } = await supabase
        .from('project_members').select('user_id').eq('project_id', hydratedTask.project_id)
      const memberIds = (pm || []).map((m: any) => m.user_id)
      setProjectTeam(
        memberIds.length > 0
          ? filteredUsers.filter((u: any) => memberIds.includes(u.id))
          : filteredUsers
      )
    } else {
      setProjectTeam(filteredUsers)
    }

    setLoading(false)
  }, [id])

  useEffect(() => { loadTask() }, [loadTask])

  // ── Inline status updates (no edit mode needed) ────────────────────────────
  const handleTaskStatus = async (newStatus: string) => {
    if (newStatus === 'Completed' && subtasks.some(s => s.status !== 'Completed')) {
      setError('All subtasks must be Completed first.')
      return
    }
    setError('')
    setTask((prev: any) => ({ ...prev, status: newStatus }))
    await supabase.from('Tasks').update({ status: newStatus }).eq('id', id)

    // Auto-create next recurrence when marked Completed
    if (newStatus === 'Completed' && task.type !== 'One-time') {
      const { start, end } = nextRecurrence(task.start_date, task.end_date, task.type)

      const { data: newTask } = await supabase.from('Tasks').insert({
        project_id:   task.project_id,
        project_name: task.project_name,
        topic:        task.topic,
        description:  task.description,
        type:         task.type,
        start_date:   start,
        end_date:     end,
        status:       'Not Started',  // always reset
        resources:    task.resources || [],
        tags:         task.tags || [],
      }).select().single()

      if (newTask) {
        // Copy task assignees
        if (task.assignees?.length) {
          await supabase.from('task_assignees').insert(
            task.assignees.map((uid: string) => ({ task_id: newTask.id, user_id: uid }))
          )
        }

        // Copy subtasks — always reset to Not Started, shift dates to new period
        // Use Number(newTask.id) to match the integer parent_task_id column type
        for (const sub of subtasks) {
          const { data: newSub, error: subErr } = await supabase.from('Subtasks').insert({
            parent_task_id: Number(newTask.id),
            topic:          sub.topic,
            description:    sub.description || '',
            start_date:     start,         // use new period start
            end_date:       end,           // use new period end
            status:         'Not Started', // always reset, never copy sub.status
          }).select().single()

          if (subErr) {
            console.error('Subtask insert error:', subErr)
            continue
          }

          if (newSub && sub.assignees?.length) {
            await supabase.from('subtask_assignees').insert(
              sub.assignees.map((uid: string) => ({ subtask_id: newSub.id, user_id: uid }))
            )
          }
        }

        setSuccess(`✅ Next ${task.type} instance created (${start}).`)
        setTimeout(() => setSuccess(''), 4000)
      }
    }
  }

  const handleSubStatus = async (subId: string, newStatus: string) => {
    setSubtasks(prev => prev.map(s => s.id === subId ? { ...s, status: newStatus } : s))
    await supabase.from('Subtasks').update({ status: newStatus }).eq('id', subId)
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const startEdit = () => {
    setEditTask({ ...task, assignees: [...(task.assignees || [])] })
    setEditSubtasks(subtasks.map(s => ({ ...s, assignees: [...(s.assignees || [])] })))
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

  const handleSave = async () => {
    setError(''); setSaving(true)
    if (!editTask.topic?.trim()) { setError('Task title is required.'); setSaving(false); return }
    if (editTask.status === 'Completed' && editSubtasks.some(s => s.status !== 'Completed')) {
      setError('All subtasks must be Completed before marking task as Completed.')
      setSaving(false); return
    }
    for (const s of editSubtasks) {
      if (!s.topic?.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
      if (s.start_date < editTask.start_date || s.end_date > editTask.end_date) {
        setError(`Subtask "${s.topic}" dates must be within parent task dates.`)
        setSaving(false); return
      }
    }

    try {
      await supabase.from('Tasks').update({
        topic:       editTask.topic.trim(),
        description: editTask.description?.trim() || '',
        type:        editTask.type,
        start_date:  editTask.start_date,
        end_date:    editTask.end_date,
        status:      editTask.status,
        resources,
      }).eq('id', id)

      await supabase.from('task_assignees').delete().eq('task_id', id)
      if (editTask.assignees?.length) {
        await supabase.from('task_assignees').insert(
          editTask.assignees.map((uid: string) => ({ task_id: id, user_id: uid }))
        )
      }

      for (const s of editSubtasks) {
        const payload = {
          topic:       s.topic.trim(),
          description: s.description?.trim() || '',
          start_date:  s.start_date,
          end_date:    s.end_date,
          status:      s.status,
        }
        let targetId = s.id
        if (s.isNew) {
          const { data: newSub } = await supabase.from('Subtasks')
            .insert({ ...payload, parent_task_id: Number(id) }).select().single()
          targetId = newSub.id
        } else {
          await supabase.from('Subtasks').update(payload).eq('id', s.id)
          await supabase.from('subtask_assignees').delete().eq('subtask_id', s.id)
        }
        if (s.assignees?.length) {
          await supabase.from('subtask_assignees').insert(
            s.assignees.map((uid: string) => ({ subtask_id: targetId, user_id: uid }))
          )
        }
      }

      await loadTask()
      setEditing(false)
      setSuccess('✅ Changes saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  // ── Clone / Delete ─────────────────────────────────────────────────────────
  const handleClone = async () => {
    setCloning(true)
    const { data: newTask } = await supabase.from('Tasks').insert({
      project_id:   task.project_id,
      project_name: task.project_name,
      topic:        `${task.topic} (Copy)`,
      description:  task.description,
      type:         task.type,
      start_date:   task.start_date,
      end_date:     task.end_date,
      status:       'Not Started', // always reset
      resources:    task.resources || [],
    }).select().single()

    if (newTask) {
      if (task.assignees?.length) {
        await supabase.from('task_assignees').insert(
          task.assignees.map((uid: string) => ({ task_id: newTask.id, user_id: uid }))
        )
      }
      for (const sub of subtasks) {
        const { data: newSub } = await supabase.from('Subtasks').insert({
          parent_task_id: newTask.id,
          topic:          sub.topic,
          description:    sub.description,
          start_date:     sub.start_date,
          end_date:       sub.end_date,
          status:         'Not Started', // always reset
        }).select().single()
        if (newSub && sub.assignees?.length) {
          await supabase.from('subtask_assignees').insert(
            sub.assignees.map((uid: string) => ({ subtask_id: newSub.id, user_id: uid }))
          )
        }
      }
      router.push(`/tasks/${newTask.id}`)
    }
    setCloning(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${task.topic}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      // 1. Delete subtask_assignees for all subtasks of this task
      const subIds = subtasks.map(s => s.id)
      if (subIds.length > 0) {
        await supabase.from('subtask_assignees').delete().in('subtask_id', subIds)
      }

      // 2. Delete subtasks
      await supabase.from('Subtasks').delete().eq('parent_task_id', Number(id))

      // 3. Delete task_assignees
      await supabase.from('task_assignees').delete().eq('task_id', id)

      // 4. Now safe to delete the task
      const { error: delErr } = await supabase.from('Tasks').delete().eq('id', id)
      if (delErr) {
        setError(`Delete failed: ${delErr.message}`)
        setDeleting(false)
        return
      }

      router.back()
    } catch (e: any) {
      setError(`Delete failed: ${e.message}`)
      setDeleting(false)
    }
  }

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const toggleAssignee = (userId: string) => {
    setEditTask((prev: any) => {
      const cur: string[] = prev.assignees || []
      const next = cur.includes(userId) ? cur.filter((x: string) => x !== userId) : [...cur, userId]
      if (cur.includes(userId)) {
        setEditSubtasks(subs => subs.map(s => ({
          ...s, assignees: (s.assignees || []).filter((x: string) => x !== userId)
        })))
      }
      return { ...prev, assignees: next }
    })
  }

  const toggleSubAssignee = (subId: string, userId: string) => {
    setEditSubtasks(prev => prev.map(s => {
      if (String(s.id) !== String(subId)) return s
      const cur: string[] = s.assignees || []
      return { ...s, assignees: cur.includes(userId) ? cur.filter((x: string) => x !== userId) : [...cur, userId] }
    }))
  }

  const addSubtask = () => setEditSubtasks(p => [...p, {
    id: `new-${Date.now()}`, topic: '', description: '', assignees: [],
    start_date: editTask?.start_date || '', end_date: editTask?.end_date || '',
    status: 'Not Started', isNew: true,
  }])

  const updateSub = (sid: string, field: string, val: string) =>
    setEditSubtasks(p => p.map(s => String(s.id) === sid ? { ...s, [field]: val } : s))

  const removeSub = async (s: any) => {
    if (!s.isNew) {
      if (!confirm('Delete this subtask?')) return
      await supabase.from('Subtasks').delete().eq('id', s.id)
    }
    setEditSubtasks(p => p.filter(x => String(x.id) !== String(s.id)))
  }

  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  // ── Derived ────────────────────────────────────────────────────────────────
  const canManage   = myRole === 'Admin' || myRole === 'Manager'
  const isRecurring = task?.type && task.type !== 'One-time'
  const doneSubs    = subtasks.filter(s => s.status === 'Completed').length
  const nextDate    = isRecurring && task.start_date && task.end_date
    ? nextRecurrence(task.start_date, task.end_date, task.type).start
    : null

  const displaySubs = editing ? editSubtasks : subtasks

  const resolveUser = (uid: string) =>
    projectTeam.find(u => u.id === uid) || allUsers.find(u => u.id === uid)

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) return (
    <AppShell title="Task Detail">
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading...</div>
    </AppShell>
  )
  if (!task) return (
    <AppShell title="Task Detail">
      <div className="alert alert-error">Task not found.</div>
    </AppShell>
  )

  const taskAssignees: string[] = editing ? (editTask?.assignees || []) : (task.assignees || [])

  return (
    <AppShell title={task.topic || 'Task Detail'}>

      {/* Global styles for this page */}
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
        .td-task-page { padding: 9px 8px; vertical-align: middle; }

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
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!editing ? (
            <>
              <button className="btn btn-sm" onClick={startEdit}>✎ Edit</button>
              <button className="btn btn-sm" onClick={handleClone} disabled={cloning}>
                <Copy size={13} /> {cloning ? 'Cloning...' : 'Clone'}
              </button>
              {canManage && (
                <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                  <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <Save size={13} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-sm" onClick={cancelEdit}>Cancel</button>
            </>
          )}
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}
      {isRecurring && (
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          🔄 <strong>{task.type} recurring task</strong> — When marked Completed, the next instance will be auto-created with dates shifted forward.
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

        {/* ════ LEFT COLUMN ════ */}
        <div>

          {/* Task Details — title + description only */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Task details
              </span>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>
                Task title {editing && '*'}
              </label>
              {editing ? (
                <input
                  className="form-input"
                  value={editTask.topic || ''}
                  onChange={e => setEditTask((p: any) => ({ ...p, topic: e.target.value }))}
                />
              ) : (
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--txt)', lineHeight: 1.4 }}>
                  {task.topic}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>
                Description
              </label>
              {editing ? (
                <textarea
                  className="form-textarea"
                  value={editTask.description || ''}
                  onChange={e => setEditTask((p: any) => ({ ...p, description: e.target.value }))}
                />
              ) : (
                <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {task.description || <span style={{ color: 'var(--txt3)', fontStyle: 'italic' }}>No description provided.</span>}
                </div>
              )}
            </div>
          </div>

          {/* ── Subtasks table ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '0.5px solid var(--brd)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt)' }}>Subtasks</span>
                <span style={{ fontSize: 12, color: 'var(--txt3)' }}>({displaySubs.length})</span>
                {subtasks.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--txt3)', background: 'var(--bg2)', padding: '1px 7px', borderRadius: 10, border: '0.5px solid var(--brd)' }}>
                    {doneSubs} of {subtasks.length} done
                  </span>
                )}
              </div>
              {editing && (
                <button className="btn btn-primary btn-sm" onClick={addSubtask}>
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {displaySubs.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--txt3)', background: 'var(--bg2)' }}>
                No subtasks yet.{editing && ' Click "Add" to create one.'}
              </div>
            ) : editing ? (
              /* Edit mode: card-style subtask drafts */
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {editSubtasks.map((s, i) => (
                  <div key={s.id} style={{ background: 'var(--bg2)', border: '0.5px solid var(--brd)', borderRadius: 8, padding: '12px 14px' }}>
                    {/* Header: number badge + remove */}
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
                        onClick={() => removeSub(s)}
                        style={{ background: 'none', border: 'none', color: '#cc3333', cursor: 'pointer', display: 'flex', padding: 2 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {/* Title — full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Title *</label>
                        <input className="form-input" value={s.topic} onChange={e => updateSub(String(s.id), 'topic', e.target.value)} placeholder="Subtask title" />
                      </div>

                      {/* Description — full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Description</label>
                        <textarea
                          className="form-textarea"
                          style={{ minHeight: 52, fontSize: 13 }}
                          value={s.description || ''}
                          onChange={e => updateSub(String(s.id), 'description', e.target.value)}
                          placeholder="Optional details..."
                        />
                      </div>

                      {/* Dates */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Start date</label>
                        <input type="date" className="form-input" value={s.start_date || ''} onChange={e => updateSub(String(s.id), 'start_date', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>End date</label>
                        <input type="date" className="form-input" value={s.end_date || ''} onChange={e => updateSub(String(s.id), 'end_date', e.target.value)} />
                      </div>

                      {/* Status */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Status</label>
                        <StatusSelect value={s.status} onChange={v => updateSub(String(s.id), 'status', v)} />
                      </div>

                      {/* Assign to */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Assign to</label>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                          {taskAssignees.length === 0 ? (
                            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Assign main task first</span>
                          ) : taskAssignees.map(uid => {
                            const u = resolveUser(uid)
                            const sel = (s.assignees || []).includes(uid)
                            return (
                              <button
                                key={uid} type="button"
                                onClick={() => toggleSubAssignee(String(s.id), uid)}
                                className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                                style={{ fontSize: 11, padding: '2px 10px' }}
                              >
                                {sel ? '✓ ' : ''}{u ? u.full_name.split(' ')[0] : 'User'}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* View mode: aligned table */
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    <th style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--txt3)', padding: '7px 8px 7px 16px', textAlign: 'left', borderBottom: '0.5px solid var(--brd)' }}>
                      Subtask
                    </th>
                    <th style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--txt3)', padding: '7px 8px', textAlign: 'left', borderBottom: '0.5px solid var(--brd)', width: 88 }}>
                      Start
                    </th>
                    <th style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--txt3)', padding: '7px 8px', textAlign: 'left', borderBottom: '0.5px solid var(--brd)', width: 88 }}>
                      End
                    </th>
                    <th style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--txt3)', padding: '7px 8px', textAlign: 'center', borderBottom: '0.5px solid var(--brd)', width: 80 }}>
                      Assigned
                    </th>
                    <th style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--txt3)', padding: '7px 16px 7px 8px', textAlign: 'right', borderBottom: '0.5px solid var(--brd)', width: 136 }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subtasks.map((s, i) => {
                    const subAssignees = (s.assignees || [])
                      .map((uid: string) => resolveUser(uid))
                      .filter(Boolean)
                    return (
                      <React.Fragment key={s.id}>
                        <tr style={{ borderTop: '0.5px solid var(--brd)', cursor: 'default' }}>
                          <td className="td-task-page" style={{ paddingLeft: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              {/* Number badge */}
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: 'var(--bg2)', border: '0.5px solid var(--brd2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 700, color: 'var(--txt3)',
                                flexShrink: 0, marginTop: 1,
                              }}>
                                {i + 1}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 500 }}>{s.topic}</div>
                              </div>
                            </div>
                          </td>
                          <td className="td-task-page" style={{ fontSize: 11, color: 'var(--txt3)' }}>
                            {s.start_date || '—'}
                          </td>
                          <td className="td-task-page" style={{ fontSize: 11, color: 'var(--txt3)' }}>
                            {s.end_date || '—'}
                          </td>
                          <td className="td-task-page" style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              {subAssignees.slice(0, 4).map((u: any, idx: number) => (
                                <div key={u.id} style={{ marginLeft: idx > 0 ? -6 : 0, zIndex: 4 - idx, position: 'relative' }}>
                                  <Avatar name={u.full_name} idx={idx} size={20} />
                                </div>
                              ))}
                              {subAssignees.length === 0 && <span style={{ fontSize: 11, color: 'var(--txt3)' }}>—</span>}
                            </div>
                          </td>
                          <td className="td-task-page" style={{ textAlign: 'right', paddingRight: 16 }}>
                            <StatusSelect
                              value={s.status}
                              onChange={v => handleSubStatus(s.id, v)}
                              small
                            />
                          </td>
                        </tr>
                        {/* Description sub-row */}
                        {s.description && (
                          <tr key={`${s.id}-desc`} style={{ background: 'var(--bg2)' }}>
                            <td colSpan={5} style={{ padding: '4px 16px 8px 42px', fontSize: 12, color: 'var(--txt3)', lineHeight: 1.5, borderBottom: '0.5px solid var(--brd)' }}>
                              {s.description}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Resources ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Resources{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({resources.length})</span>
              </span>
              {editing && (
                <button className="btn btn-sm" onClick={addResource}>
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {resources.length === 0 && !editing && (
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No resources attached.</div>
            )}

            {editing ? (
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
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--bg2)', border: '0.5px solid var(--brd)', borderRadius: 8 }}>
                    <LinkIcon size={13} color="var(--txt3)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', marginBottom: 2 }}>
                        {r.title || `Resource ${idx + 1}`}
                      </div>
                      <a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#185FA5', textDecoration: 'underline', wordBreak: 'break-all' }}>
                        {r.link}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div>

          {/* Task Info card */}
          <div className="card">
            <div style={{ paddingBottom: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--txt3)' }}>
                Task info
              </span>
            </div>

            {/* Status select + subtask progress */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 6 }}>
                  Status
                </div>
                {editing ? (
                  <StatusSelect
                    value={editTask.status}
                    onChange={v => setEditTask((p: any) => ({ ...p, status: v }))}
                  />
                ) : (
                  <StatusSelect value={task.status} onChange={handleTaskStatus} />
                )}
              </div>
              {subtasks.length > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 3 }}>
                    Subtasks
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--txt)', lineHeight: 1, marginTop: 3 }}>
                    {doneSubs}
                    <span style={{ fontSize: 14, color: 'var(--txt3)', fontWeight: 400 }}>/{subtasks.length}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Subtask progress bar */}
            {subtasks.length > 0 && (
              <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ width: `${Math.round(doneSubs / subtasks.length * 100)}%`, height: '100%', background: '#3B6D11', borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
            )}

            {/* Meta rows */}
            <div className="meta-row-task">
              <span className="meta-lbl-task">Project</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{task.project_name || '—'}</span>
              </div>
            </div>

            <div className="meta-row-task">
              <span className="meta-lbl-task">Type</span>
              {isRecurring
                ? <span className="pill pill-rc" style={{ fontSize: 9 }}>↻ {task.type}</span>
                : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{task.type}</span>
              }
            </div>

            <div className="meta-row-task">
              <span className="meta-lbl-task">Start</span>
              {editing ? (
                <input type="date" className="form-input" style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
                  value={editTask.start_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, start_date: e.target.value }))} />
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{task.start_date || '—'}</span>
              )}
            </div>

            <div className="meta-row-task">
              <span className="meta-lbl-task">End</span>
              {editing ? (
                <input type="date" className="form-input" style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
                  value={editTask.end_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, end_date: e.target.value }))} />
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{task.end_date || '—'}</span>
              )}
            </div>

            {editing && (
              <div className="meta-row-task">
                <span className="meta-lbl-task">Type</span>
                <select
                  className="form-select"
                  style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
                  value={editTask.type}
                  onChange={e => setEditTask((p: any) => ({ ...p, type: e.target.value }))}
                >
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}

            <div className="meta-row-task" style={{ borderBottom: nextDate ? '0.5px solid var(--brd)' : 'none' }}>
              <span className="meta-lbl-task">Resources</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{resources.length}</span>
            </div>

            {nextDate && (
              <div className="meta-row-task" style={{ borderBottom: 'none' }}>
                <span className="meta-lbl-task">Next instance</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#3B6D11' }}>{nextDate}</span>
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

            {editing ? (
              /* Edit mode: toggle chips */
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {projectTeam.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--txt3)' }}>No project members found.</span>
                ) : projectTeam.map(u => {
                  const sel = taskAssignees.includes(u.id)
                  return (
                    <button
                      key={u.id} type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className={`toggle-btn ${sel ? 'sel-owner' : ''}`}
                    >
                      {sel ? '✓ ' : ''}{u.full_name}
                    </button>
                  )
                })}
              </div>
            ) : taskAssignees.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No members assigned.</div>
            ) : (
              /* View mode: member tiles */
              taskAssignees.map((uid, idx) => {
                const u = resolveUser(uid)
                if (!u) return null
                return (
                  <div key={uid} className="member-tile">
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: AVATAR_BG[idx % 6], color: AVATAR_CL[idx % 6],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, flexShrink: 0,
                    }}>
                      {ini(u.full_name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.full_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        {u.role}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>
      </div>
    </AppShell>
  )
}