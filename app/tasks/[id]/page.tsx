'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Trash2, Plus, ArrowLeft, Copy, Edit2, X } from 'lucide-react'
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
  description?: string
  owner?: string
  start_date: string
  end_date: string
  status: Status
  isNew?: boolean
}

export default function TaskDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [isEditing,      setIsEditing]      = useState(false)
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

  const loadData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { data: me } = await supabase.from('Users').select('*').eq('id', session?.user.id).single()
    setMyUser(me)
    setMyRole(me?.role || 'Team Member')

    const { data: taskData } = await supabase.from('Tasks').select('*').eq('id', id).single()
    setTask(taskData)

    const { data: subData, error: subErr } = await supabase.from('Subtasks').select('*').eq('parent_task_id', Number(id)).order('id')
    if (subErr) setError(`Failed to load subtasks: ${subErr.message}`)
    setSubtasks(subData || [])

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

  useEffect(() => { loadData() }, [id])

  const canDelete = myRole === 'Admin' || myRole === 'Manager'

  const updateTask = useCallback((field: string, value: string) =>
    setTask((prev: any) => ({ ...prev, [field]: value })), [])

  const updateSubtask = useCallback((sid: string, field: string, value: string) =>
    setSubtasks(prev => prev.map(s => s.id === sid ? { ...s, [field]: value } : s)), [])

  const handleTaskStatusChange = async (newStatus: string) => {
    updateTask('status', newStatus)
    if (!isEditing) {
      await supabase.from('Tasks').update({ status: newStatus }).eq('id', id)
      setSuccess('✅ Status updated!')
      setTimeout(() => setSuccess(''), 2000)
    }
  }

  const handleSubtaskStatusChange = async (sid: string, newStatus: string, isNew?: boolean) => {
    updateSubtask(sid, 'status', newStatus)
    if (!isEditing && !isNew) {
      await supabase.from('Subtasks').update({ status: newStatus }).eq('id', sid)
    }
  }

  const addSubtask = () => {
    setIsEditing(true)
    setSubtasks(prev => [...prev, {
      id: crypto.randomUUID(),
      topic: '',
      description: '',
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
    setSubtasks(prev => prev.filter(sub => sub.id !== s.id))
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
        resource_link: task.resource_link,
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
            description: s.description,
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
        topic: task.topic, 
        description: task.description, 
        resource_link: task.resource_link,
        owner: task.owner,
        status: task.status, 
        start_date: task.start_date, 
        end_date: task.end_date,
        type: task.type, 
        tags: task.tags,
      }).eq('id', id)

      await Promise.all(subtasks.map(s => {
        const payload = {
          parent_task_id: Number(id),
          topic: s.topic, 
          description: s.description,
          owner: s.owner || null,
          start_date: s.start_date, 
          end_date: s.end_date, 
          status: s.status
        }
        if (s.isNew) return supabase.from('Subtasks').insert(payload)
        return supabase.from('Subtasks').update(payload).eq('id', s.id)
      }))

      setSuccess('✅ Changes saved!')
      setIsEditing(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    loadData()
  }

  const addComment = () => {
    if (!newComment.trim() || !myUser) return
    const name = myUser.full_name || myUser.email
    setComments(prev => [...prev, { id: Date.now(), user: name, text: newComment.trim(), time: 'just now' }])
    setNewComment('')
  }

  const currentOwners = (task?.owner || '').split(',').map((o: string) => o.trim()).filter(Boolean)
  const toggleOwner = (name: string) => {
    if (!isEditing) return
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
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'var(--txt)', minWidth:0 }}>
          {isEditing ? 'Editing Task...' : task.topic}
        </div>
        <StatusPill status={task.status}/>
        {isRecurring && <span className="pill pill-rc" style={{ fontSize:11 }}>↻ {task.type}</span>}
        
        {/* VIEW CONTROLS */}
        {!isEditing && (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
              <Edit2 size={13}/> Edit
            </button>
            <button className="btn btn-sm" onClick={cloneTask} disabled={cloning}>
              <Copy size={13}/> {cloning ? 'Cloning...' : isRecurring ? `Clone → Next ${task.type}` : 'Clone Task'}
            </button>
            {canDelete && (
              <button className="btn btn-danger btn-sm" onClick={deleteTask} disabled={deleting}>
                <Trash2 size={13}/> {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </>
        )}

        {/* EDIT CONTROLS */}
        {isEditing && (
          <>
            <button className="btn btn-sm" onClick={cancelEdit} disabled={saving}>
              <X size={13}/> Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        )}
      </div>

      {isRecurring && (
        <div className="alert alert-info" style={{ marginBottom:12 }}>
          🔄 <strong>{task.type} recurring task</strong> — Clone to create the next instance with dates shifted forward.
        </div>
      )}

      {error   && <div className="alert alert-error"   style={{ marginBottom:12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:12 }}>{success}</div>}

      {/* MAIN CONTENT - TWO COLUMN LAYOUT */}
      <div className="two-col">
        {/* LEFT COLUMN: FORM */}
        <div>
          <div className="card">
            <div className="form-section">Task Details</div>
            
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" disabled={!isEditing} value={task.topic || ''} onChange={e => updateTask('topic', e.target.value)}/>
            </div>
            
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                {/* Status ALWAYS enabled */}
                <select className="form-select" value={task.status} onChange={e => handleTaskStatusChange(e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" disabled={!isEditing} value={task.type} onChange={e => updateTask('type', e.target.value)}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" disabled={!isEditing} value={task.start_date||''} onChange={e => updateTask('start_date', e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" type="date" disabled={!isEditing} value={task.end_date||''} onChange={e => updateTask('end_date', e.target.value)}/>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Resource Link</label>
              <input className="form-input" type="url" disabled={!isEditing} placeholder="https://..." value={task.resource_link || ''} onChange={e => updateTask('resource_link', e.target.value)}/>
            </div>

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
                  const isSelected = currentOwners.includes(name)
                  if (!isEditing && !isSelected) return null; // Hide unassigned users in View mode
                  return (
                    <button key={u.id} type="button" disabled={!isEditing}
                      className={isSelected ? 'toggle-btn sel-owner' : 'toggle-btn'}
                      style={{ cursor: isEditing ? 'pointer' : 'default', opacity: (!isEditing && !isSelected) ? 0.5 : 1 }}
                      onClick={() => toggleOwner(name)}>
                      {isSelected ? '✓ ' : ''}{name}
                    </button>
                  )
                })}
              </div>
              {currentOwners.length > 0 && !isEditing && (
                <div style={{ marginTop:6, fontSize:12, color:'var(--txt3)' }}>
                  Assigned: {currentOwners.join(', ')}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" disabled={!isEditing} rows={4} value={task.description||''} onChange={e => updateTask('description', e.target.value)}/>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: META INFO & COMMENTS */}
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
          {isEditing && (
            <button type="button" className="btn btn-primary btn-sm" onClick={addSubtask}>
              <Plus size={13}/> Add Subtask
            </button>
          )}
        </div>

        {subtasks.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--txt3)', background:'var(--bg2)', borderRadius:'var(--r)' }}>
            No subtasks yet.<br/>{isEditing && "Click '+ Add Subtask' to create one."}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {subtasks.map((s, i) => (
              <div key={s.id} style={{ background:'var(--bg2)', borderRadius:'var(--r)', padding:'12px 16px', border:'0.5px solid var(--brd)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--txt3)', width:28, marginTop: 8 }}>#{i+1}</span>
                  
                  <div style={{ flex:1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                    {/* Top Row: Title, Owner, Status, Dates */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <input className="form-input" style={{ flex:1, minWidth:150, fontSize:14 }} disabled={!isEditing} placeholder="Subtask title"
                        value={s.topic} onChange={e => updateSubtask(s.id, 'topic', e.target.value)}/>
                      
                      <select className="form-select" style={{ width:160 }} disabled={!isEditing} value={s.owner||''}
                        onChange={e => updateSubtask(s.id, 'owner', e.target.value)}>
                        <option value="">Unassigned</option>
                        {projectMembers.map(u => <option key={u.id} value={u.full_name||u.email}>{u.full_name||u.email}</option>)}
                      </select>
                      
                      {/* Subtask Status ALWAYS enabled */}
                      <select className="form-select" style={{ width:130 }} value={s.status}
                        onChange={e => handleSubtaskStatusChange(s.id, e.target.value, s.isNew)}>
                        {STATUSES.map(st => <option key={st}>{st}</option>)}
                      </select>
                      
                      <input className="form-input" type="date" disabled={!isEditing} style={{ width:130 }} value={s.start_date}
                        onChange={e => updateSubtask(s.id, 'start_date', e.target.value)}/>
                      <input className="form-input" type="date" disabled={!isEditing} style={{ width:130 }} value={s.end_date}
                        onChange={e => updateSubtask(s.id, 'end_date', e.target.value)}/>
                      
                      <StatusPill status={s.status}/>
                      
                      {isEditing && canDelete && (
                        <button onClick={() => deleteSubtask(s)} style={{ background:'none', border:'none', color:'#cc3333', padding:4, cursor:'pointer' }}>
                          <Trash2 size={15}/>
                        </button>
                      )}
                    </div>

                    {/* Bottom Row: Description */}
                    <textarea className="form-textarea" disabled={!isEditing} rows={1} placeholder="Subtask description..." 
                      style={{ fontSize: 13, padding: '6px 10px' }}
                      value={s.description || ''} onChange={e => updateSubtask(s.id, 'description', e.target.value)}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
