'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Trash2, Plus, ArrowLeft, Copy } from 'lucide-react'
import type { Status } from '@/types'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const TYPES = ['One-time','Weekly','Monthly','Quarterly','Semi-annually','Annually']

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function shiftMonth(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function nextDate(start: string, end: string, type: string): { start: string; end: string } {
  const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 864e5)
  let newStart = start
  if (type === 'Weekly')       newStart = shiftDate(start, 7)
  else if (type === 'Monthly') newStart = shiftMonth(start, 1)
  else if (type === 'Quarterly') newStart = shiftMonth(start, 3)
  else if (type === 'Semi-annually') newStart = shiftMonth(start, 6)
  else if (type === 'Annually') newStart = shiftMonth(start, 12)
  return { start: newStart, end: shiftDate(newStart, duration) }
}

interface Subtask {
  id: string
  topic: string
  owner?: string
  start_date: string
  end_date: string
  status: Status
  isNew?: boolean
}

export default function TaskDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [task,           setTask]           = useState<any>(null)
  const [subtasks,       setSubtasks]       = useState<Subtask[]>([])
  const [projectMembers, setProjectMembers] = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [cloning,        setCloning]        = useState(false)
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState('')
  const [newComment,     setNewComment]     = useState('')
  const [comments,       setComments]       = useState<any[]>([])
  const [myUser,         setMyUser]         = useState<any>(null)
  const [myRole,         setMyRole]         = useState('')

  const loadSubtasks = async () => {
    const { data, error } = await supabase
      .from('Subtasks')
      .select('*')
      .eq('parent_task_id', Number(id))
      .order('id')
    if (error) { setError(`Failed to load subtasks: ${error.message}`); return }
    setSubtasks(data || [])
  }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: me } = await supabase.from('Users').select('*').eq('id', session?.user.id).single()
      setMyUser(me)
      setMyRole(me?.role || 'Team Member')

      const { data: taskData } = await supabase.from('Tasks').select('*').eq('id', id).single()
      setTask(taskData)
      await loadSubtasks()

      if (taskData?.project_name) {
        const { data: proj } = await supabase.from('Projects').select('members').eq('name', taskData.project_name).single()
        if (proj?.members?.length) {
          const { data: users } = await supabase.from('Users').select('id,full_name,email,role').in('id', proj.members)
          setProjectMembers((users || []).filter((u: any) => u.role !== 'Admin'))
        } else {
          const { data: users } = await supabase.from('Users').select('id,full_name,email,role')
          setProjectMembers((users || []).filter((u: any) => u.role !== 'Admin'))
        }
      } else {
        const { data: users } = await supabase.from('Users').select('id,full_name,email,role')
        setProjectMembers((users || []).filter((u: any) => u.role !== 'Admin'))
      }
      setLoading(false)
    }
    load()
  }, [id])

  const canDelete = myRole === 'Admin' || myRole === 'Manager'

  const updateTask = useCallback((field: string, value: string) =>
    setTask((prev: any) => ({ ...prev, [field]: value })), [])

  const updateSubtask = useCallback((sid: string, field: string, value: string) =>
    setSubtasks(prev => prev.map(s => s.id === sid ? { ...s, [field]: value } : s)), [])

  const addSubtask = () => {
    setSubtasks(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      topic: '',
      owner: '',
      start_date: task?.start_date || '',
      end_date: task?.end_date || '',
      status: 'Not Started' as Status,
      isNew: true
    }])
  }

  const deleteSubtask = async (s: Subtask) => {
    if (!canDelete) return
    if (!s.isNew && !confirm('Delete this subtask?')) return
    if (!s.isNew) await supabase.from('Subtasks').delete().eq('id', s.id)
    await loadSubtasks()
  }

  const deleteTask = async () => {
    if (!canDelete) return
    if (!confirm(`Delete task "${task.topic}"?`)) return
    setDeleting(true)
    await supabase.from('Subtasks').delete().eq('parent_task_id', Number(id))
    await supabase.from('Tasks').delete().eq('id', id)
    router.back()
  }

  const cloneTask = async () => {
    setCloning(true)
    try {
      const isRecurring = task.type && task.type !== 'One-time'
      let newStart = task.start_date
      let newEnd   = task.end_date
      if (isRecurring && task.start_date && task.end_date) {
        const shifted = nextDate(task.start_date, task.end_date, task.type)
        newStart = shifted.start
        newEnd   = shifted.end
      }
      const { data: newTask } = await supabase.from('Tasks').insert({
        project_name: task.project_name,
        topic: isRecurring ? task.topic : `${task.topic} (copy)`,
        description: task.description,
        owner: task.owner,
        type: task.type,
        start_date: newStart,
        end_date: newEnd,
        status: 'Not Started',
        tags: task.tags,
      }).select().single()

      if (newTask && subtasks.length > 0) {
        for (const s of subtasks) {
          let subStart = s.start_date
          let subEnd   = s.end_date
          if (isRecurring && s.start_date && s.end_date) {
            const shifted = nextDate(s.start_date, s.end_date, task.type)
            subStart = shifted.start
            subEnd   = shifted.end
          }
          await supabase.from('Subtasks').insert({
            parent_task_id: newTask.id,
            topic: s.topic,
            owner: s.owner || null,
            start_date: subStart,
            end_date: subEnd,
            status: 'Not Started',
          })
        }
      }
      setSuccess('✅ Task cloned!')
      setTimeout(() => router.push(`/tasks/${newTask?.id}`), 800)
    } catch (e: any) {
      setError(e.message)
    }
    setCloning(false)
  }

  const handleSave = async () => {
    setError(''); setSaving(true)
    if (task.status === 'Completed' && subtasks.length > 0) {
      if (!subtasks.every(s => s.status === 'Completed')) {
        setError('All subtasks must be completed before marking task as Completed.')
        setSaving(false); return
      }
    }
    for (const s of subtasks) {
      if (!s.topic.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
      if (s.start_date < task.start_date || s.end_date > task.end_date) {
        setError(`Subtask "${s.topic}" dates must be within parent task dates.`); setSaving(false); return
      }
    }
    try {
      await supabase.from('Tasks').update({
        topic: task.topic, description: task.description, owner: task.owner,
        status: task.status, start_date: task.start_date, end_date: task.end_date,
        type: task.type, tags: task.tags,
      }).eq('id', id)

      for (const s of subtasks) {
        if (s.isNew) {
          await supabase.from('Subtasks').insert({
            parent_task_id: Number(id),
            topic: s.topic, owner: s.owner || null,
            start_date: s.start_date, end_date: s.end_date, status: s.status
          })
        } else {
          await supabase.from('Subtasks').update({
            topic: s.topic, owner: s.owner || null,
            start_date: s.start_date, end_date: s.end_date, status: s.status
          }).eq('id', s.id)
        }
      }

      await loadSubtasks()
      setSuccess('✅ Changes saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const addComment = () => {
    if (!newComment.trim() || !myUser) return
    const name = myUser.full_name || myUser.email
    setComments(prev => [...prev, { id: Date.now(), user: name, text: newComment.trim(), time: 'just now' }])
    setNewComment('')
  }

  // Parse current owners as array for toggle logic
  const currentOwners = (task?.owner || '').split(',').map((o: string) => o.trim()).filter(Boolean)

  const toggleOwner = (name: string) => {
    const next = currentOwners.includes(name)
      ? currentOwners.filter((o: string) => o !== name)
      : [...currentOwners, name]
    updateTask('owner', next.join(', '))
  }

  const completedSubs = subtasks.filter(s => s.status === 'Completed').length
  const isRecurring   = task?.type && task.type !== 'One-time'

  if (loading) return <AppShell title="Task Detail"><div style={{ padding: 40, color: 'var(--txt3)' }}>Loading...</div></AppShell>
  if (!task)   return <AppShell title="Task Detail"><div className="alert alert-error">Task not found.</div></AppShell>

  return (
    <AppShell title={task.topic || 'Task Detail'}>
      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <button className="btn btn-icon" onClick={() => router.back()}><ArrowLeft size={14}/></button>
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'var(--txt)', minWidth:0 }}>{task.topic}</div>
        <StatusPill status={task.status}/>
        {isRecurring && <span className="pill pill-rc" style={{ fontSize:11 }}>↻ {task.type}</span>}
        <button className="btn btn-sm" onClick={cloneTask} disabled={cloning}>
          <Copy size={13}/>
          {cloning ? 'Cloning...' : isRecurring ? `Clone → Next ${task.type}` : 'Clone Task'}
        </button>
        {canDelete && (
          <button className="btn btn-danger btn-sm" onClick={deleteTask} disabled={deleting}>
            <Trash2 size={13}/> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>

      {isRecurring && (
        <div className="alert alert-info" style={{ marginBottom:12 }}>
          🔄 <strong>{task.type} recurring task</strong> — Clone to create the next instance with dates shifted forward.
        </div>
      )}

      {error   && <div className="alert alert-error"   style={{ marginBottom:12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:12 }}>{success}</div>}

      {/* MAIN CONTENT */}
      <div className="two-col">
        <div>
          <div className="card">
            <div className="form-section">Task Details</div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" value={task.topic || ''} onChange={e => updateTask('topic', e.target.value)}/>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={task.status} onChange={e => updateTask('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={task.type} onChange={e => updateTask('type', e.target.value)}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={task.start_date||''} onChange={e => updateTask('start_date', e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" type="date" value={task.end_date||''} onChange={e => updateTask('end_date', e.target.value)}/>
              </div>
            </div>

            {/* ── Owner toggle — fixed highlighting ── */}
            <div className="form-group">
              <label className="form-label">
                Assigned To
                {currentOwners.length > 0 && (
                  <span style={{ fontSize:10, color:'var(--txt3)', marginLeft:6, fontWeight:400, textTransform:'none', letterSpacing:0 }}>
                    {currentOwners.length} assigned
                  </span>
                )}
              </label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                {projectMembers.map(u => {
                  const name = u.full_name || u.email
                  // ✅ Fix: check against the parsed array, not a substring match on the raw string
                  const isSelected = currentOwners.includes(name)
                  return (
                    <button key={u.id} type="button"
                      className={isSelected ? 'toggle-btn sel-owner' : 'toggle-btn'}
                      onClick={() => toggleOwner(name)}>
                      {isSelected ? '✓ ' : ''}{name}
                    </button>
                  )
                })}
              </div>
              {currentOwners.length > 0 && (
                <div style={{ marginTop:6, fontSize:12, color:'var(--txt3)' }}>
                  Assigned: {currentOwners.join(', ')}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={task.description||''} onChange={e => updateTask('description', e.target.value)}/>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div style={{ fontSize:13, fontWeight:500, marginBottom:10, color:'var(--txt)' }}>Task Info</div>
            <div className="meta-grid">
              <div><div className="meta-label">Project</div><div className="meta-value">{task.project_name||'—'}</div></div>
              <div><div className="meta-label">Owner</div><div className="meta-value">{task.owner||'—'}</div></div>
              <div><div className="meta-label">Start</div><div className="meta-value">{task.start_date||'—'}</div></div>
              <div><div className="meta-label">End</div><div className="meta-value">{task.end_date||'—'}</div></div>
              <div><div className="meta-label">Type</div><div className="meta-value">{task.type||'—'}</div></div>
              <div><div className="meta-label">Status</div><div className="meta-value"><StatusPill status={task.status}/></div></div>
            </div>
            {isRecurring && task.start_date && task.end_date && (
              <>
                <div style={{ borderTop:'0.5px solid var(--brd)', margin:'10px 0' }}/>
                <div style={{ fontSize:12, color:'var(--txt3)' }}>
                  Next instance: <strong style={{ color:'var(--txt)' }}>{nextDate(task.start_date, task.end_date, task.type).start}</strong>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize:13, fontWeight:500, marginBottom:10, color:'var(--txt)' }}>Comments</div>
            {comments.length === 0 && <div style={{ fontSize:13, color:'var(--txt3)', marginBottom:12 }}>No comments yet.</div>}
            {comments.map(c => (
              <div key={c.id} className="notif-item">
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--txt)' }}>{c.user}</div>
                  <div style={{ fontSize:13, color:'var(--txt2)', marginTop:2 }}>{c.text}</div>
                </div>
                <div style={{ fontSize:11, color:'var(--txt3)' }}>{c.time}</div>
              </div>
            ))}
            <div className="comment-box">
              <input className="comment-input" placeholder="Add a comment..." value={newComment}
                onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key==='Enter' && addComment()}/>
              <button className="btn btn-primary" onClick={addComment}>Send</button>
            </div>
          </div>
        </div>
      </div>

      {/* SUBTASKS */}
      <div className="card" style={{ marginTop:32 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--txt)' }}>
            Subtasks
            {subtasks.length > 0 && (
              <span style={{ marginLeft:8, fontSize:13, color:'var(--txt3)' }}>
                {completedSubs} of {subtasks.length} completed
              </span>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={addSubtask}>
            <Plus size={13}/> Add Subtask
          </button>
        </div>

        {subtasks.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--txt3)', background:'var(--bg2)', borderRadius:'var(--r)' }}>
            No subtasks yet.<br/>Click <strong>+ Add Subtask</strong> to create one.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {subtasks.map((s, i) => (
              <div key={s.id} style={{ background:'var(--bg2)', borderRadius:'var(--r)', padding:'12px 16px', border:'0.5px solid var(--brd)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--txt3)', width:28 }}>#{i+1}</span>
                  <input className="form-input" style={{ flex:1, minWidth:200, fontSize:14 }} placeholder="Subtask title"
                    value={s.topic} onChange={e => updateSubtask(s.id, 'topic', e.target.value)}/>
                  <select className="form-select" style={{ width:160 }} value={s.owner||''}
                    onChange={e => updateSubtask(s.id, 'owner', e.target.value)}>
                    <option value="">Unassigned</option>
                    {projectMembers.map(u => <option key={u.id} value={u.full_name||u.email}>{u.full_name||u.email}</option>)}
                  </select>
                  <select className="form-select" style={{ width:130 }} value={s.status}
                    onChange={e => updateSubtask(s.id, 'status', e.target.value)}>
                    {STATUSES.map(st => <option key={st}>{st}</option>)}
                  </select>
                  <input className="form-input" type="date" style={{ width:130 }} value={s.start_date}
                    onChange={e => updateSubtask(s.id, 'start_date', e.target.value)}/>
                  <input className="form-input" type="date" style={{ width:130 }} value={s.end_date}
                    onChange={e => updateSubtask(s.id, 'end_date', e.target.value)}/>
                  <StatusPill status={s.status}/>
                  {canDelete && (
                    <button onClick={() => deleteSubtask(s)} style={{ background:'none', border:'none', color:'#cc3333', padding:4, cursor:'pointer' }}>
                      <Trash2 size={15}/>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
