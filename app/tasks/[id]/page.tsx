'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, use } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Resource } from '@/types'

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

// Helper to get initials for avatars
const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'

// Helper for status pills
const getPillClass = (status: string) => {
  if (status === 'In Progress') return 'pill-ip'
  if (status === 'On-Hold') return 'pill-oh'
  if (status === 'Completed') return 'pill-c'
  return 'pill-ns'
}

export default function TaskDetail({ params }: TaskDetailProps) {
  const router   = useRouter()
  
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const [task,         setTask]         = useState<any>(null)
  const [subtasks,     setSubtasks]     = useState<any[]>([])
  const [projectTeam,  setProjectTeam]  = useState<any[]>([])
  const [allUsers,     setAllUsers]     = useState<any[]>([])
  const [myRole,       setMyRole]       = useState('')
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [cloning,      setCloning]      = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [loading,      setLoading]      = useState(true)

  const [editTask,     setEditTask]     = useState<any>(null)
  const [editSubtasks, setEditSubtasks] = useState<any[]>([])
  const [resources,    setResources]    = useState<Resource[]>([])

  const loadTask = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: me } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
    setMyRole(me?.role || 'Team Member')

    const { data: usersData } = await supabase.from('Users').select('id,full_name,role')
    const filteredUsers = (usersData || []).filter((u: any) => u.role !== 'Admin')
    setAllUsers(filteredUsers)

    const [taskRes, taskAssigneesRes, subtasksRes, subtaskAssigneesRes] = await Promise.all([
      supabase.from('Tasks').select('*').eq('id', id).single(),
      supabase.from('task_assignees').select('user_id').eq('task_id', id),
      supabase.from('Subtasks').select('*').eq('parent_task_id', id).order('id'),
      supabase.from('subtask_assignees').select('subtask_id, user_id')
    ])

    if (!taskRes.data) { setLoading(false); return }

    const activeTaskAssigneeIds = (taskAssigneesRes.data || []).map(ta => ta.user_id)
    
    const hydratedTask = {
      ...taskRes.data,
      assignees: activeTaskAssigneeIds
    }

    const hydratedSubtasks = (subtasksRes.data || []).map(sub => {
      const activeSubAssigneeIds = (subtaskAssigneesRes.data || [])
        .filter(sa => sa.subtask_id === sub.id)
        .map(sa => sa.user_id)
      return {
        ...sub,
        assignees: activeSubAssigneeIds
      }
    })

    setTask(hydratedTask)
    setSubtasks(hydratedSubtasks)
    setResources(Array.isArray(hydratedTask.resources) ? hydratedTask.resources : [])

    if (hydratedTask.project_id) {
      const { data: pm } = await supabase.from('project_members').select('user_id').eq('project_id', hydratedTask.project_id)
      if (pm && pm.length > 0) {
        const memberIds = pm.map(m => m.user_id)
        setProjectTeam(filteredUsers.filter(u => memberIds.includes(u.id)))
      } else {
        setProjectTeam([])
      }
    } else {
      setProjectTeam(filteredUsers)
    }
    
    setLoading(false)
  }, [id])

  useEffect(() => { loadTask() }, [loadTask])

  const startEdit = () => {
    setEditTask({ ...task, assignees: [...(task.assignees || [])] })
    setEditSubtasks(subtasks.map((s: any) => ({ ...s, assignees: [...(s.assignees || [])] })))
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
        project_id: task.project_id,
        project_name: task.project_name,
        topic: task.topic,
        description: task.description,
        type: task.type,
        start_date: start,
        end_date: end,
        status: 'Not Started',
        resources: task.resources || [],
        tags: task.tags || [],
      }).select().single()

      if (newTask) {
        if (task.assignees && task.assignees.length > 0) {
          const newAssigneesPayload = task.assignees.map((userId: string) => ({
            task_id: newTask.id,
            user_id: userId
          }))
          await supabase.from('task_assignees').insert(newAssigneesPayload)
        }

        for (const sub of subtasks) {
          const { data: newSub } = await supabase.from('Subtasks').insert({
            parent_task_id: newTask.id,
            topic: sub.topic,
            description: sub.description,
            start_date: start,
            end_date: end,
            status: 'Not Started',
          }).select().single()

          if (newSub && sub.assignees && sub.assignees.length > 0) {
            const newSubAssigneesPayload = sub.assignees.map((userId: string) => ({
              subtask_id: newSub.id,
              user_id: userId
            }))
            await supabase.from('subtask_assignees').insert(newSubAssigneesPayload)
          }
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
      if (s.start_date < editTask.start_date || s.end_date > editTask.end_date) {
        setError(`Subtask "${s.topic}" dates must be within parent task dates.`)
        setSaving(false); return
      }
    }

    try {
      await supabase.from('Tasks').update({
        topic: editTask.topic.trim(),
        description: editTask.description?.trim() || '',
        type: editTask.type,
        start_date: editTask.start_date,
        end_date: editTask.end_date,
        status: editTask.status,
        resources: resources,
      }).eq('id', id)

      await supabase.from('task_assignees').delete().eq('task_id', id)
      if (editTask.assignees && editTask.assignees.length > 0) {
        const insertPayload = editTask.assignees.map((uid: string) => ({ task_id: id, user_id: uid }))
        await supabase.from('task_assignees').insert(insertPayload)
      }

      for (const s of editSubtasks) {
        const payload = {
          topic: s.topic.trim(),
          description: s.description?.trim() || '',
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.status,
        }

        let targetSubtaskId = s.id

        if (s.isNew) {
          const { data: newSub } = await supabase.from('Subtasks').insert({ ...payload, parent_task_id: Number(id) }).select().single()
          targetSubtaskId = newSub.id
        } else {
          await supabase.from('Subtasks').update(payload).eq('id', s.id)
          await supabase.from('subtask_assignees').delete().eq('subtask_id', s.id)
        }

        if (s.assignees && s.assignees.length > 0) {
          const subAssignInsert = s.assignees.map((uid: string) => ({ subtask_id: targetSubtaskId, user_id: uid }))
          await supabase.from('subtask_assignees').insert(subAssignInsert)
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
      project_id: task.project_id,
      project_name: task.project_name,
      topic: `${task.topic} (Copy)`,
      description: task.description,
      type: task.type,
      start_date: task.start_date,
      end_date: task.end_date,
      status: 'Not Started',
      resources: task.resources || [],
    }).select().single()

    if (newTask) {
      if (task.assignees && task.assignees.length > 0) {
        const cloneAssignPayload = task.assignees.map((uid: string) => ({ task_id: newTask.id, user_id: uid }))
        await supabase.from('task_assignees').insert(cloneAssignPayload)
      }

      for (const sub of subtasks) {
        const { data: newSub } = await supabase.from('Subtasks').insert({
          parent_task_id: newTask.id,
          topic: sub.topic,
          description: sub.description,
          start_date: sub.start_date,
          end_date: sub.end_date,
          status: 'Not Started',
        }).select().single()

        if (newSub && sub.assignees && sub.assignees.length > 0) {
          const cloneSubAssignPayload = sub.assignees.map((uid: string) => ({ subtask_id: newSub.id, user_id: uid }))
          await supabase.from('subtask_assignees').insert(cloneSubAssignPayload)
        }
      }
      router.push(`/tasks/${newTask.id}`)
    }
    setCloning(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${task.topic}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('Tasks').delete().eq('id', id)
    router.back()
  }

  const toggleAssignee = (userId: string) => {
    setEditTask((prev: any) => {
      const cur: string[] = prev.assignees || []
      const next = cur.includes(userId) ? cur.filter(id => id !== userId) : [...cur, userId]
      
      if (cur.includes(userId)) {
        setEditSubtasks(subs => subs.map(s => ({
          ...s, assignees: (s.assignees || []).filter((id: string) => id !== userId)
        })))
      }
      return { ...prev, assignees: next }
    })
  }

  const toggleSubAssignee = (subId: string, userId: string) => {
    setEditSubtasks(prev => prev.map((s: any) => {
      if (String(s.id) !== String(subId)) return s
      const cur: string[] = s.assignees || []
      return { ...s, assignees: cur.includes(userId) ? cur.filter(id => id !== userId) : [...cur, userId] }
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

  const editAssignees: string[] = editing ? (editTask?.assignees || []) : (task?.assignees || [])
  const isRecurring = task.type && task.type !== 'One-time'

  return (
    <AppShell title={task.topic || 'Task Detail'}>
      
      {/* ── STRUCTURAL CSS (No hardcoded colors, inherits from globals.css) ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .fm-wrapper {
          --r: 6px; 
          --rl: 10px;
          color: var(--txt);
        }
        
        /* Cards */
        .card { background: var(--bg); border: 1px solid var(--brd); border-radius: var(--rl); padding: 18px 20px; margin-bottom: 14px; box-shadow: var(--shd); }
        .sec { font-size: 10px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; color: var(--txt3); padding-bottom: 10px; border-bottom: 1px solid var(--brd); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
        .sec-lbl { font-size: 10px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; color: var(--txt3); }
        
        /* Buttons */
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--r); border: 1px solid var(--brd2); background: var(--bg); color: var(--txt2); font-size: 13px; font-weight: 600; cursor: pointer; transition: .15s; text-decoration: none; }
        .btn:hover { background: var(--bg2); }
        .btn-primary { background: var(--txt2); color: var(--bg); border-color: var(--txt2); }
        .btn-sm { padding: 4px 10px; font-size: 12px; }
        .btn-delete { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 4px 10px; background: var(--del-bg); color: var(--del-txt); border: 1px solid var(--del-brd); border-radius: var(--r); cursor: pointer; font-size: 11px; font-weight: 700; transition: .15s; }
        
        /* Pills */
        .pill { font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
        .pill-ns { background: var(--pill-ns-bg); color: var(--pill-ns-txt); }
        .pill-ip { background: var(--pill-ip-bg); color: var(--pill-ip-txt); }
        .pill-oh { background: var(--pill-oh-bg); color: var(--pill-oh-txt); }
        .pill-c { background: var(--pill-c-bg); color: var(--pill-c-txt); }
        
        /* Form */
        .fl { font-size: 10px; font-weight: 800; color: var(--txt3); text-transform: uppercase; letter-spacing: .12em; display: block; margin-bottom: 5px; }
        .fi, .fsel { width: 100%; padding: 7px 10px; border: 1px solid var(--brd2); border-radius: var(--r); background: var(--bg); color: var(--txt); font-size: 13px; font-weight: 500; outline: none; }
        .fta { width: 100%; padding: 7px 10px; border: 1px solid var(--brd2); border-radius: var(--r); background: var(--bg); color: var(--txt); font-size: 13px; font-weight: 500; outline: none; min-height: 60px; resize: vertical; }
        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
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
        
        /* Two col */
        .two-col { display: grid; grid-template-columns: 1fr 300px; gap: 14px; align-items: start; }
        @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
        
        /* Avatar */
        .av { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; border: 2px solid var(--bg); flex-shrink: 0; background: var(--bg2); color: var(--txt); }
        
        /* Block draft (Subtasks/Resources) */
        .block-draft { background: var(--bg3); border: 1px solid var(--brd); border-radius: var(--r); padding: 14px; margin-bottom: 10px; }
        .block-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .block-lbl { font-size: 10px; font-weight: 800; color: var(--txt3); text-transform: uppercase; letter-spacing: .12em; }
        
        /* Summary rows */
        .sum-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--brd); font-size: 12px; }
        .sum-row:last-child { border-bottom: none; }
        .sum-lbl { font-size: 10px; font-weight: 800; color: var(--txt3); text-transform: uppercase; letter-spacing: .1em; }
        .sum-val { font-size: 12px; color: var(--txt2); font-weight: 600; }
        
        /* Resource row */
        .res-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--bg2); border: 1px solid var(--brd); border-radius: var(--r); margin-bottom: 8px; }
        
        /* Alerts */
        .alert-info { padding: 10px 14px; background: var(--pill-oh-bg); color: var(--pill-oh-txt); border-left: 3px solid var(--pill-oh-txt); font-size: 13px; margin-bottom: 14px; }
        .alert-error { padding: 10px 14px; background: var(--del-bg); color: var(--del-txt); border-left: 3px solid var(--del-brd); font-size: 13px; margin-bottom: 14px; }
        .alert-success { padding: 10px 14px; background: var(--pill-c-bg); color: var(--pill-c-txt); border-left: 3px solid var(--pill-c-txt); font-size: 13px; margin-bottom: 14px; }
      `}} />

      <div className="fm-wrapper">
        
        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:10 }}>
          <button className="btn" onClick={() => router.back()}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg> 
            Back
          </button>
          
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {!editing ? (
              <>
                <button className="btn btn-sm" onClick={startEdit}>✎ Edit</button>
                <button className="btn btn-sm" onClick={handleClone} disabled={cloning}>Clone</button>
                {canManage && <button className="btn-delete btn-sm" onClick={handleDelete} disabled={deleting}>🗑 Delete</button>}
              </>
            ) : (
              <>
                <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>💾 Save</button>
                <button className="btn btn-sm" onClick={cancelEdit}>Cancel</button>
              </>
            )}
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}
        {isRecurring && <div className="alert-info">🔄 <strong>{task.type} recurring task</strong> — When marked Completed, the next instance will be auto-created with dates shifted forward.</div>}

        <div className="two-col">
          {/* LEFT COLUMN */}
          <div>
            
            {/* Task Details */}
            <div className="card">
              <div className="sec"><span className="sec-lbl">Task details</span></div>
              
              <div className="fg">
                <label className="fl">Task title *</label>
                {!editing ? (
                  <div className="fi" style={{ color: 'var(--txt)' }}>{task.topic}</div>
                ) : (
                  <input className="fi" value={editTask.topic || ''} onChange={e => setEditTask((p: any) => ({ ...p, topic: e.target.value }))} />
                )}
              </div>

              <div className="g2" style={{ marginBottom: 12 }}>
                <div>
                  <label className="fl">Project</label>
                  <div style={{ fontSize: 13, color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 5, paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--txt2)' }}></div>
                    {task.project_name || '—'}
                  </div>
                </div>
                <div>
                  <label className="fl">Task type</label>
                  {!editing ? (
                    <div style={{ fontSize: 13, color: 'var(--txt2)', paddingTop: 4 }}>{task.type}</div>
                  ) : (
                    <select className="fsel" value={editTask.type || 'One-time'} onChange={e => setEditTask((p: any) => ({ ...p, type: e.target.value }))}>
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="g2" style={{ marginBottom: 12 }}>
                <div>
                  <label className="fl">Start date</label>
                  {!editing ? (
                    <div style={{ fontSize: 13, color: 'var(--txt2)', paddingTop: 4 }}>{task.start_date || '—'}</div>
                  ) : (
                    <input type="date" className="fi" value={editTask.start_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, start_date: e.target.value }))} />
                  )}
                </div>
                <div>
                  <label className="fl">End date</label>
                  {!editing ? (
                    <div style={{ fontSize: 13, color: 'var(--txt2)', paddingTop: 4 }}>{task.end_date || '—'}</div>
                  ) : (
                    <input type="date" className="fi" value={editTask.end_date || ''} onChange={e => setEditTask((p: any) => ({ ...p, end_date: e.target.value }))} />
                  )}
                </div>
              </div>

              <div className="fg" style={{ marginBottom: 12 }}>
                <label className="fl">Status</label>
                {!editing ? (
                  <span className={`pill ${getPillClass(task.status)}`}>{task.status}</span>
                ) : (
                  <div className="status-row">
                    {STATUSES.map(s => {
                      const isSel = editTask.status === s
                      let selClass = ''
                      if (isSel) {
                        if (s === 'Not Started') selClass = 'sel-ns'
                        if (s === 'In Progress') selClass = 'sel-ip'
                        if (s === 'On-Hold') selClass = 'sel-oh'
                        if (s === 'Completed') selClass = 'sel-c'
                      }
                      return (
                        <button key={s} className={`sopt ${selClass}`} onClick={() => setEditTask((p: any) => ({ ...p, status: s }))}>
                          {s}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="fg">
                <label className="fl">Description</label>
                {!editing ? (
                  <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {task.description || 'No description provided.'}
                  </div>
                ) : (
                  <textarea className="fta" value={editTask.description || ''} onChange={e => setEditTask((p: any) => ({ ...p, description: e.target.value }))} />
                )}
              </div>
            </div>

            {/* Assigned to */}
            <div className="card">
              <div className="sec"><span className="sec-lbl">Assigned to</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {editing ? (
                  projectTeam.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--txt3)' }}>No members found.</span>
                  ) : (
                    projectTeam.map((u: any) => {
                      const sel = editAssignees.includes(u.id)
                      return (
                        <button key={u.id} type="button" onClick={() => toggleAssignee(u.id)} className={`tgl ${sel ? 'on' : ''}`}>
                          {sel ? '✓ ' : ''}{u.full_name}
                        </button>
                      )
                    })
                  )
                ) : (
                  (task.assignees || []).length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--txt3)' }}>No members assigned.</span>
                  ) : (
                    task.assignees.map((uid: string) => {
                      const uObj = projectTeam.find(u => u.id === uid) || allUsers.find(u => u.id === uid)
                      return <span key={uid} className="tgl on" style={{ cursor: 'default' }}>{uObj ? uObj.full_name : 'Unknown User'}</span>
                    })
                  )
                )}
              </div>
            </div>

            {/* Subtasks */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="sec-lbl">Subtasks ({editing ? editSubtasks.length : subtasks.length})</div>
                {editing && <button className="btn btn-primary btn-sm" onClick={addSubtask}>＋ Add Subtask</button>}
              </div>

              {(!editing ? subtasks : editSubtasks).map((s: any, i: number) => (
                <div key={s.id} className="block-draft">
                  <div className="block-hdr">
                    <span className="block-lbl">Subtask {i + 1}</span>
                    {!editing ? (
                      <span className={`pill ${getPillClass(s.status)}`}>{s.status}</span>
                    ) : (
                      <button className="btn-delete" onClick={() => removeSub(s)}>🗑 Remove</button>
                    )}
                  </div>

                  {!editing ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 4 }}>{s.topic}</div>
                      {s.description && <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 8 }}>{s.description}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--txt3)', marginTop: 10 }}>
                        <span>{s.start_date || '?'} → {s.end_date || '?'}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {s.assignees && s.assignees.map((uid: string) => {
                            const uObj = projectTeam.find(u => u.id === uid) || allUsers.find(u => u.id === uid)
                            return (
                              <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div className="av" style={{ width: 18, height: 18, fontSize: 8 }}>{getInitials(uObj?.full_name)}</div>
                                <span>{uObj ? uObj.full_name.split(' ')[0] : 'User'}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fg">
                        <label className="fl">Title *</label>
                        <input className="fi" value={s.topic} onChange={e => updateSub(String(s.id), 'topic', e.target.value)} />
                      </div>
                      <div className="fg">
                        <label className="fl">Description</label>
                        <textarea className="fta" style={{ minHeight: 46 }} value={s.description || ''} onChange={e => updateSub(String(s.id), 'description', e.target.value)} />
                      </div>
                      <div className="g2" style={{ gap: 8, marginBottom: 10 }}>
                        <div><label className="fl">Start date</label><input type="date" className="fi" value={s.start_date || ''} onChange={e => updateSub(String(s.id), 'start_date', e.target.value)} /></div>
                        <div><label className="fl">End date</label><input type="date" className="fi" value={s.end_date || ''} onChange={e => updateSub(String(s.id), 'end_date', e.target.value)} /></div>
                      </div>
                      <div className="g2" style={{ gap: 8 }}>
                        <div>
                          <label className="fl">Assign to</label>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                            {editAssignees.length === 0 ? <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Assign main task first</span> : 
                              editAssignees.map(uid => {
                                const uObj = projectTeam.find(u => u.id === uid) || allUsers.find(u => u.id === uid)
                                const sel = (s.assignees || []).includes(uid)
                                return (
                                  <button key={uid} type="button" onClick={() => toggleSubAssignee(String(s.id), uid)} className={`tgl ${sel ? 'on' : ''}`} style={{ fontSize: 11, padding: '2px 10px' }}>
                                    {sel ? '✓ ' : ''}{uObj ? uObj.full_name.split(' ')[0] : 'User'}
                                  </button>
                                )
                              })
                            }
                          </div>
                        </div>
                        <div>
                          <label className="fl">Status</label>
                          <select className="fsel" value={s.status} onChange={e => updateSub(String(s.id), 'status', e.target.value)}>
                            {STATUSES.map(st => <option key={st}>{st}</option>)}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {(!editing && subtasks.length === 0) && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No subtasks available.</div>}
            </div>

            {/* Resources */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="sec-lbl">Resources ({resources.length})</div>
                {editing && <button className="btn btn-primary btn-sm" onClick={addResource}>＋ Add Resource</button>}
              </div>

              {resources.map((r, i) => (
                !editing ? (
                  <div key={i} className="res-row">
                    <svg style={{ marginTop: 2, flexShrink: 0, color: 'var(--txt3)' }} width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M9 15l6 -6"></path><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"></path><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"></path></svg>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 3 }}>{r.title || `Resource ${i+1}`}</div>
                      <a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--pill-ip-txt)', textDecoration: 'underline', wordBreak: 'break-all' }}>{r.link}</a>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="block-draft">
                    <div className="block-hdr">
                      <span className="block-lbl">Resource {i + 1}</span>
                      <button className="btn-delete" onClick={() => removeResource(i)}>🗑 Remove</button>
                    </div>
                    <div className="fg">
                      <label className="fl">Title *</label>
                      <input className="fi" value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} />
                    </div>
                    <div className="fg" style={{ marginBottom: 0 }}>
                      <label className="fl">Link</label>
                      <input className="fi" value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} placeholder="https://" />
                    </div>
                  </div>
                )
              ))}
              {resources.length === 0 && !editing && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No resources attached.</div>}
            </div>

          </div>

          {/* RIGHT COLUMN - SUMMARY */}
          <div>
            <div className="card">
              <div className="sec-lbl" style={{ display: 'block', marginBottom: 14 }}>Task Info</div>
              <div className="sum-row">
                <span className="sum-lbl">Project</span>
                <span className="sum-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--txt2)' }}></div>{task.project_name || 'None'}</span>
              </div>
              <div className="sum-row">
                <span className="sum-lbl">Type</span>
                <span className="sum-val">{task.type} {isRecurring && <span className="pill" style={{ background: 'var(--pill-oh-bg)', color: 'var(--pill-oh-txt)', fontSize: 8 }}>↻ Recurring</span>}</span>
              </div>
              <div className="sum-row"><span className="sum-lbl">Start</span><span className="sum-val">{task.start_date || '—'}</span></div>
              <div className="sum-row"><span className="sum-lbl">End</span><span className="sum-val">{task.end_date || '—'}</span></div>
              <div className="sum-row"><span className="sum-lbl">Status</span><span className={`pill ${getPillClass(task.status)}`}>{task.status}</span></div>
              
              <div className="sum-row">
                <span className="sum-lbl">Assigned</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {(task.assignees || []).map((uid: string) => {
                    const uObj = projectTeam.find(u => u.id === uid) || allUsers.find(u => u.id === uid)
                    return <div key={uid} className="av" style={{ width: 22, height: 22, fontSize: 9 }}>{getInitials(uObj?.full_name)}</div>
                  })}
                  {(!task.assignees || task.assignees.length === 0) && <span className="sum-val">—</span>}
                </div>
              </div>
              <div className="sum-row">
                <span className="sum-lbl">Subtasks</span>
                <span className="sum-val">{subtasks.filter(s => s.status === 'Completed').length}/{subtasks.length} done</span>
              </div>
              <div className="sum-row"><span className="sum-lbl">Resources</span><span className="sum-val">{resources.length}</span></div>
              
              {isRecurring && task.start_date && task.end_date && task.type && (
                <div className="sum-row">
                  <span className="sum-lbl">Next instance</span>
                  <span className="sum-val" style={{ color: 'var(--pill-c-txt)', fontWeight: 700 }}>{nextRecurrence(task.start_date, task.end_date, task.type).start}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}