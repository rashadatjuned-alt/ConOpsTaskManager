'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Trash2, Plus, ArrowLeft, Copy, X } from 'lucide-react'
import type { Status } from '@/types'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const TYPES = ['One-time','Weekly','Monthly','Quarterly','Semi-annually','Annually']

const AVATAR_BG = ['#E6F1FB','#EAF3DE','#EEEDFE','#FAEEDA','#FAECE7','#E1F5EE']
const AVATAR_CL = ['#0C447C','#27500A','#3C3489','#633806','#712B13','#085041']

const STATUS_CLR: Record<string,string> = {
  'Not Started':'#aaa','In Progress':'#378ADD','On-Hold':'#EF9F27','Completed':'#639922'
}
const STATUS_BG: Record<string,string> = {
  'Not Started':'#F1EFE8','In Progress':'#E6F1FB','On-Hold':'#FAEEDA','Completed':'#EAF3DE'
}

function initials(name: string) {
  const p = (name||'?').trim().split(' ')
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}

function nextDate(start: string, end: string, type: string) {
  const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 864e5)
  const d = new Date(start)
  if (type === 'Weekly') d.setDate(d.getDate()+7)
  else if (type === 'Monthly') d.setMonth(d.getMonth()+1)
  else if (type === 'Quarterly') d.setMonth(d.getMonth()+3)
  else if (type === 'Semi-annually') d.setMonth(d.getMonth()+6)
  else if (type === 'Annually') d.setFullYear(d.getFullYear()+1)
  const ns = d.toISOString().split('T')[0]
  const ne = new Date(d); ne.setDate(ne.getDate()+duration)
  return { start: ns, end: ne.toISOString().split('T')[0] }
}

interface Subtask {
  id: string; topic: string; owner?: string
  start_date: string; end_date: string; status: Status; isNew?: boolean
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

  const loadSubtasks = useCallback(async () => {
    const { data } = await supabase.from('Subtasks').select('*')
      .eq('parent_task_id', Number(id)).order('id')
    setSubtasks(data || [])
  }, [id])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: me } = await supabase.from('Users').select('*').eq('id', session?.user.id).single()
      setMyUser(me); setMyRole(me?.role || 'Team Member')
      const { data: t } = await supabase.from('Tasks').select('*').eq('id', id).single()
      setTask(t)
      await loadSubtasks()
      if (t?.project_name) {
        const { data: proj } = await supabase.from('Projects').select('members').eq('name', t.project_name).single()
        if (proj?.members?.length) {
          const { data: users } = await supabase.from('Users').select('id,full_name,email,role').in('id', proj.members)
          setProjectMembers((users||[]).filter((u:any) => u.role !== 'Admin'))
        } else {
          const { data: users } = await supabase.from('Users').select('id,full_name,email,role')
          setProjectMembers((users||[]).filter((u:any) => u.role !== 'Admin'))
        }
      }
      setLoading(false)
    }
    load()
  }, [id, loadSubtasks])

  const canDelete = myRole === 'Admin' || myRole === 'Manager'
  const updateTask = useCallback((field: string, value: string) =>
    setTask((prev: any) => ({ ...prev, [field]: value })), [])

  const updateSubtask = useCallback((sid: string, field: string, value: string) =>
    setSubtasks(prev => prev.map(s => s.id === sid ? { ...s, [field]: value } : s)), [])

  // Inline subtask status save — no need to press Save Changes
  const saveSubtaskStatus = async (s: Subtask, newStatus: string) => {
    updateSubtask(s.id, 'status', newStatus)
    if (!s.isNew) {
      await supabase.from('Subtasks').update({ status: newStatus }).eq('id', s.id)
    }
  }

  const addSubtask = () => setSubtasks(prev => [...prev, {
    id: Math.random().toString(36).slice(2),
    topic: '', owner: '', start_date: task?.start_date||'',
    end_date: task?.end_date||'', status: 'Not Started' as Status, isNew: true
  }])

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
    if (!task) return
    setCloning(true)
    const isRecurring = task.type && task.type !== 'One-time'
    const dates = isRecurring ? nextDate(task.start_date, task.end_date, task.type)
      : { start: task.start_date, end: task.end_date }
    const { data: newTask } = await supabase.from('Tasks').insert({
      project_name: task.project_name, topic: task.topic,
      description: task.description, owner: task.owner,
      type: task.type, start_date: dates.start, end_date: dates.end,
      status: 'Not Started', tags: task.tags||[],
    }).select().single()
    if (newTask) {
      for (const s of subtasks) {
        await supabase.from('Subtasks').insert({
          parent_task_id: newTask.id, topic: s.topic,
          owner: s.owner||null, start_date: dates.start,
          end_date: dates.end, status: 'Not Started',
        })
      }
      router.push(`/tasks/${newTask.id}`)
    }
    setCloning(false)
  }

  const handleSave = async () => {
    setError(''); setSaving(true)
    if (task.status === 'Completed' && subtasks.some(s => s.status !== 'Completed')) {
      setError('All subtasks must be completed before marking task as Completed.')
      setSaving(false); return
    }
    for (const s of subtasks) {
      if (!s.topic.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
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
            parent_task_id: Number(id), topic: s.topic, owner: s.owner||null,
            start_date: s.start_date, end_date: s.end_date, status: s.status
          })
        } else {
          await supabase.from('Subtasks').update({
            topic: s.topic, owner: s.owner||null,
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
    setComments(prev => [...prev, {
      id: Date.now(), user: myUser.full_name||myUser.email,
      text: newComment.trim(), time: 'just now'
    }])
    setNewComment('')
  }

  // Assignee picker — avatar based
  const AssigneePicker = ({ selected, onToggle }: { selected: string[]; onToggle: (n:string)=>void }) => (
    <div>
      {selected.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
          {selected.map((name, i) => {
            const idx = projectMembers.findIndex(u => (u.full_name||u.email)===name)
            const bg = AVATAR_BG[idx%AVATAR_BG.length]||'#E6F1FB'
            const cl = AVATAR_CL[idx%AVATAR_CL.length]||'#0C447C'
            return (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:5,
                background:bg, border:`1px solid ${cl}33`, borderRadius:20, padding:'3px 10px 3px 4px' }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:cl,
                  color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:9, fontWeight:600 }}>
                  {initials(name)}
                </div>
                <span style={{ fontSize:12, color:cl, fontWeight:500 }}>{name}</span>
                <button type="button" onClick={() => onToggle(name)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:cl, display:'flex', padding:0 }}>
                  <X size={11}/>
                </button>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {projectMembers.map((u, idx) => {
          const name = u.full_name||u.email
          const sel  = selected.includes(name)
          const bg   = AVATAR_BG[idx%AVATAR_BG.length]
          const cl   = AVATAR_CL[idx%AVATAR_CL.length]
          return (
            <button key={u.id} type="button" onClick={() => onToggle(name)} title={name}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                background:'none', border:'none', cursor:'pointer', padding:'6px 8px',
                borderRadius:'var(--r)', outline: sel?`2px solid ${cl}`:'2px solid transparent',
                outlineOffset:2 }}>
              <div style={{ width:34, height:34, borderRadius:'50%',
                background: sel?cl:bg, color: sel?'#fff':cl,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:600, position:'relative', transition:'all 0.15s' }}>
                {initials(name)}
                {sel && (
                  <div style={{ position:'absolute', bottom:-2, right:-2, width:13, height:13,
                    borderRadius:'50%', background:'#3B6D11', border:'2px solid var(--bg)',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'#fff', fontSize:7 }}>✓</span>
                  </div>
                )}
              </div>
              <span style={{ fontSize:10, color: sel?'var(--txt)':'var(--txt3)',
                maxWidth:52, overflow:'hidden', textOverflow:'ellipsis',
                whiteSpace:'nowrap', fontWeight: sel?500:400 }}>
                {name.split(' ')[0]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const completedSubs = subtasks.filter(s => s.status === 'Completed').length
  const isRecurring   = task?.type && task.type !== 'One-time'

  if (loading) return <AppShell title="Task Detail"><div style={{ padding:40, color:'var(--txt3)' }}>Loading...</div></AppShell>
  if (!task)   return <AppShell title="Task Detail"><div className="alert alert-error">Task not found.</div></AppShell>

  const ownerList = (task.owner||'').split(',').map((o:string)=>o.trim()).filter(Boolean)

  return (
    <AppShell title={task.topic||'Task Detail'}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <button className="btn btn-icon" onClick={() => router.back()}><ArrowLeft size={14}/></button>
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'var(--txt)', minWidth:0 }}>{task.topic}</div>
        <StatusPill status={task.status}/>
        {isRecurring && <span className="pill pill-rc" style={{ fontSize:11 }}>↻ {task.type}</span>}
        <button className="btn btn-sm" onClick={cloneTask} disabled={cloning}>
          <Copy size={13}/> {cloning ? 'Cloning...' : isRecurring ? `Clone → Next ${task.type}` : 'Clone Task'}
        </button>
        {canDelete && (
          <button className="btn btn-danger btn-sm" onClick={deleteTask} disabled={deleting}>
            <Trash2 size={13}/> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>

      {isRecurring && (
        <div className="alert alert-info" style={{ marginBottom:12 }}>
          🔄 <strong>{task.type} recurring task</strong> — When marked Completed, clone it to create the next instance.
        </div>
      )}

      {error   && <div className="alert alert-error"   style={{ marginBottom:12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:12 }}>{success}</div>}

      {/* Main 2-col */}
      <div className="two-col">
        <div>
          <div className="card">
            <div className="form-section">Task Details</div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" value={task.topic||''} onChange={e => updateTask('topic', e.target.value)}/>
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

            {/* Assignee picker */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom:8, display:'block' }}>Assigned To</label>
              <AssigneePicker
                selected={ownerList}
                onToggle={(name) => {
                  const next = ownerList.includes(name)
                    ? ownerList.filter((o:string) => o !== name)
                    : [...ownerList, name]
                  updateTask('owner', next.join(', '))
                }}
              />
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

      {/* Subtasks */}
      <div className="card" style={{ marginTop:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--txt)' }}>
            Subtasks
            {subtasks.length > 0 && (
              <span style={{ marginLeft:8, fontSize:13, color:'var(--txt3)', fontWeight:400 }}>
                {completedSubs} of {subtasks.length} completed
              </span>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={addSubtask}>
            <Plus size={13}/> Add Subtask
          </button>
        </div>

        {subtasks.length === 0 ? (
          <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--txt3)',
            background:'var(--bg2)', borderRadius:'var(--r)' }}>
            No subtasks yet. Click <strong>+ Add Subtask</strong> to create one.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {subtasks.map((s, i) => (
              <div key={s.id} style={{ background:'var(--bg2)', borderRadius:'var(--r)',
                padding:'10px 14px', border:'0.5px solid var(--brd)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--txt3)', width:24, flexShrink:0 }}>#{i+1}</span>

                  {/* Title */}
                  <input className="form-input" style={{ flex:1, minWidth:160, fontSize:13 }}
                    placeholder="Subtask title" value={s.topic}
                    onChange={e => updateSubtask(s.id, 'topic', e.target.value)}/>

                  {/* Assignee avatars */}
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    {projectMembers.slice(0,6).map((u, idx) => {
                      const name = u.full_name||u.email
                      const sel  = s.owner === name
                      const bg   = AVATAR_BG[idx%AVATAR_BG.length]
                      const cl   = AVATAR_CL[idx%AVATAR_CL.length]
                      return (
                        <button key={u.id} type="button" onClick={() => updateSubtask(s.id,'owner', sel?'':name)}
                          title={name}
                          style={{ width:28, height:28, borderRadius:'50%', border:'none',
                            cursor:'pointer', fontSize:10, fontWeight:600,
                            background: sel?cl:bg, color: sel?'#fff':cl,
                            outline: sel?`2px solid ${cl}`:'none', outlineOffset:1,
                            transition:'all 0.15s', flexShrink:0 }}>
                          {initials(name)}
                        </button>
                      )
                    })}
                  </div>

                  {/* Inline status — click to cycle, auto-saves */}
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    {STATUSES.map(st => (
                      <button key={st} type="button"
                        onClick={() => saveSubtaskStatus(s, st)}
                        title={st}
                        style={{ padding:'3px 8px', borderRadius:20, border:'0.5px solid',
                          fontSize:10, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
                          background: s.status===st ? STATUS_BG[st] : 'transparent',
                          color: s.status===st ? STATUS_CLR[st] : 'var(--txt3)',
                          borderColor: s.status===st ? STATUS_CLR[st]+'66' : 'var(--brd)' }}>
                        {st === 'Not Started' ? 'Not Started'
                          : st === 'In Progress' ? 'In Progress'
                          : st === 'On-Hold' ? 'On Hold'
                          : '✓ Done'}
                      </button>
                    ))}
                  </div>

                  {/* Dates */}
                  <input className="form-input" type="date" style={{ width:120, fontSize:12 }}
                    value={s.start_date} onChange={e => updateSubtask(s.id,'start_date',e.target.value)}/>
                  <input className="form-input" type="date" style={{ width:120, fontSize:12 }}
                    value={s.end_date} onChange={e => updateSubtask(s.id,'end_date',e.target.value)}/>

                  {canDelete && (
                    <button onClick={() => deleteSubtask(s)}
                      style={{ background:'none', border:'none', color:'#cc3333', padding:4, cursor:'pointer', flexShrink:0 }}>
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
                {/* Owner label */}
                {s.owner && (
                  <div style={{ fontSize:11, color:'var(--txt3)', marginTop:6, paddingLeft:34 }}>
                    → {s.owner}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {subtasks.length > 0 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
