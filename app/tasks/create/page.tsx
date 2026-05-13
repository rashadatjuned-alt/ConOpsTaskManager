'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Resource } from '@/types'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const TYPES    = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

interface SubtaskDraft {
  id: string
  topic: string
  description: string
  assignees: string[] 
  start_date: string
  end_date: string
  status: string
}

export default function CreateTask() {
  const router   = useRouter()
  const today    = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  const [allProjects,    setAllProjects]    = useState<any[]>([])
  const [allUsers,       setAllUsers]       = useState<any[]>([])   
  const [projectTeam,    setProjectTeam]    = useState<any[]>([])
  
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState('')
  const [saving,         setSaving]         = useState(false)

  // Task State
  const [projectId,   setProjectId]   = useState('') 
  const [topic,       setTopic]       = useState('')
  const [type,        setType]        = useState('One-time')
  const [status,      setStatus]      = useState('Not Started')
  const [startDate,   setStartDate]   = useState(today)
  const [endDate,     setEndDate]     = useState(nextWeek)
  const [desc,        setDesc]        = useState('')
  
  const [assignees,   setAssignees]   = useState<string[]>([])
  const [resources,   setResources]   = useState<Resource[]>([])
  const [subtasks,    setSubtasks]    = useState<SubtaskDraft[]>([])

  // ── INITIAL LOAD: Dynamic Role-Based Filtering ──
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const myId = session.user.id

      // 1. Fetch current user's profile to parse authorization role privileges
      const { data: me } = await supabase.from('Users').select('role').eq('id', myId).single()
      const myRole = me?.role || 'Team Member'

      // 2. Extract base configuration profiles natively
      const [p, u, pm] = await Promise.all([
        supabase.from('Projects').select('id, name'),
        supabase.from('Users').select('id, full_name, email, role'),
        supabase.from('project_members').select('project_id').eq('user_id', myId)
      ])

      const globalProjects = p.data || []
      const assignedProjectIds = (pm.data || []).map(m => m.project_id)

      // 3. Conditional filter evaluation track
      const accessibleProjects = (myRole === 'Admin' || myRole === 'Manager')
        ? globalProjects
        : globalProjects.filter(proj => assignedProjectIds.includes(proj.id))

      setAllProjects(accessibleProjects)
      setAllUsers((u.data || []).filter((usr: any) => usr.role !== 'Admin'))
    }
    load()
  }, [])

  // ── FILTER TEAM MEMBERS BASED ON SELECTED PROJECT ──
  useEffect(() => {
    if (!projectId) { 
      setProjectTeam([])
      setAssignees([]) 
      return 
    }
    
    const fetchProjectTeam = async () => {
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        
      if (members && members.length > 0) {
        const memberIds = members.map(m => m.user_id)
        setProjectTeam(allUsers.filter(u => memberIds.includes(u.id)))
      } else {
        setProjectTeam([]) 
      }
    }
    
    fetchProjectTeam()
    setAssignees([])
    setSubtasks(prev => prev.map(s => ({ ...s, assignees: [] })))
  }, [projectId, allUsers])

  const toggleAssignee = useCallback((userId: string) => {
    setAssignees(prev => {
      const next = prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      if (prev.includes(userId)) {
        setSubtasks(subs => subs.map(s => ({
          ...s, assignees: s.assignees.filter(a => a !== userId)
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
        assignees: s.assignees.includes(userId) ? s.assignees.filter(a => a !== userId) : [...s.assignees, userId] 
      }
    }))
  }

  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  const addSubtask = () => setSubtasks(prev => [...prev, {
    id: `new-${Date.now()}`, topic: '', description: '', assignees: [], 
    start_date: startDate, end_date: endDate, status: 'Not Started'
  }])
  const updateSub = (id: string, field: string, val: string) =>
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s))
  const removeSub = (id: string) => setSubtasks(prev => prev.filter(s => s.id !== id))

  const handleSubmit = async () => {
    setError(''); setSuccess(''); setSaving(true)
    
    if (!projectId) { setError('Please select a project context.'); setSaving(false); return }
    if (!topic.trim()) { setError('Task title is required.'); setSaving(false); return }
    if (endDate < startDate) { setError('End date cannot be before start date.'); setSaving(false); return }
    
    const selectedProject = allProjects.find(p => p.id === Number(projectId))

    try {
      const { data: taskData, error: taskErr } = await supabase.from('Tasks').insert({
        project_id: Number(projectId), 
        project_name: selectedProject ? selectedProject.name : '', 
        topic: topic.trim(), 
        description: desc.trim(),
        type: type, 
        start_date: startDate,
        end_date: endDate, 
        status: status, 
        tags: [],
        resources: resources
      }).select().single()

      if (taskErr) throw taskErr

      if (assignees.length > 0) {
        const taskAssigneePayload = assignees.map(userId => ({
          task_id: taskData.id,
          user_id: userId
        }))
        await supabase.from('task_assignees').insert(taskAssigneePayload)
      }

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
          const subAssigneePayload = s.assignees.map(userId => ({
            subtask_id: subData.id,
            user_id: userId
          }))
          await supabase.from('subtask_assignees').insert(subAssigneePayload)
        }
      }
      
      setSuccess(`✅ Task created successfully!`)
      setTimeout(() => router.push('/my-tasks'), 1000)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const selectedProject = allProjects.find(p => p.id === Number(projectId))

  return (
    <AppShell title="Create Task">
      <style dangerouslySetInnerHTML={{ __html: `
        .tv-wrapper { color: var(--text-main); font-size: 14px; display: flex; flex-direction: column; gap: 20px; }
        .tv-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 12px; }
        .tv-back-nav { color: var(--text-muted); text-decoration: none; display: flex; align-items: center; gap: 8px; cursor: pointer; background: none; border: none; font-size: 14px; }
        .tv-actions { display: flex; gap: 10px; align-items: center; }
        .tv-btn { background-color: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; }
        .tv-btn-primary { background-color: var(--txt); color: var(--bg); font-weight: 700; }
        .tv-card { background-color: var(--bg); border: 1px solid var(--brd); border-radius: 12px; padding: 20px; }
        .tv-section-title { font-size: 15px; font-weight: 600; color: var(--txt); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--brd); padding-bottom: 12px; }
        .tv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
        .tv-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 16px; }
        .tv-field { display: flex; flex-direction: column; gap: 6px; }
        .tv-label { font-size: 11px; text-transform: uppercase; color: var(--txt3); font-weight: 600; letter-spacing: 0.05em; }
        .tv-input { width: 100%; padding: 8px 12px; background: var(--bg2); border: 1px solid var(--brd); border-radius: 6px; color: var(--txt); font-size: 14px; outline: none; }
        .tv-textarea { width: 100%; padding: 8px 12px; background: var(--bg2); border: 1px solid var(--brd); border-radius: 6px; color: var(--txt); font-size: 14px; outline: none; min-height: 80px; resize: vertical; }
        .tv-table { width: 100%; border-collapse: collapse; text-align: left; }
        .tv-table th { font-size: 11px; text-transform: uppercase; color: var(--txt3); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--brd); }
        .tv-table td { font-size: 13px; color: var(--txt); padding: 12px; border-bottom: 1px solid var(--brd); vertical-align: top; }
        .tv-chip-container { display: flex; gap: 8px; flex-wrap: wrap; }
        .tv-chip { background: var(--bg2); border: 1px solid var(--brd); border-radius: 16px; padding: 4px 12px; font-size: 12px; color: var(--txt); cursor: pointer; transition: 0.2s;}
        .tv-chip.selected { background-color: var(--txt); color: var(--bg); border-color: var(--txt); }
        .tv-alert { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
        .tv-alert-error { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .tv-alert-success { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; }
      `}} />

      <div className="tv-wrapper">
        <div className="tv-top-bar">
          <button className="tv-back-nav" onClick={() => router.back()}>✕ Cancel</button>
          <div className="tv-actions">
            <select className="tv-input" style={{ width: 130, padding: '6px 10px' }} value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="tv-btn tv-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating...' : '💾 Create Task'}
            </button>
          </div>
        </div>

        {error   && <div className="tv-alert tv-alert-error">{error}</div>}
        {success && <div className="tv-alert tv-alert-success">{success}</div>}

        {/* ── 1. TASK CORE SPECIFICATIONS ── */}
        <div className="tv-card">
          <div className="tv-section-title">New Task Details</div>
          <div className="tv-grid-2">
            <div className="tv-field">
              <span className="tv-label">Project Scope Matrix *</span>
              <select className="tv-input" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Select an assigned project...</option>
                {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="tv-field">
              <span className="tv-label">Task Title *</span>
              <input className="tv-input" placeholder="Task objective title..." value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
          </div>

          <div className="tv-field" style={{ marginBottom: 20 }}>
            <span className="tv-label">Description</span>
            <textarea className="tv-textarea" placeholder="Context, details, expectations..." value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          <div className="tv-grid-4">
            <div className="tv-field">
              <span className="tv-label">Start Date</span>
              <input type="date" className="tv-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="tv-field">
              <span className="tv-label">End Date</span>
              <input type="date" className="tv-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="tv-field">
              <span className="tv-label">Frequency Type</span>
              <select className="tv-input" value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── 2. TEAM ASSIGNMENT POOL ── */}
        <div className="tv-card">
          <div className="tv-section-title">Assigned Personnel</div>
          <div className="tv-chip-container">
            {!projectId ? (
               <span style={{ fontSize: 13, color: 'var(--txt3)' }}>Select a project scope matrix to view available roster assignees.</span>
            ) : projectTeam.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--txt3)' }}>⚠️ No active team rosters assigned to this project's database metadata record.</span>
            ) : (
              projectTeam.map((u: any) => {
                const sel = assignees.includes(u.id)
                return (
                  <button key={u.id} type="button" onClick={() => toggleAssignee(u.id)} className={`tv-chip ${sel ? 'selected' : ''}`}>
                    {sel ? '✓ ' : ''}{u.full_name}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── 3. RESOURCES LINKS ATTACHMENTS ── */}
        <div className="tv-card">
          <div className="tv-section-title">
            Resources
            <button className="tv-btn" onClick={addResource}>＋ Add Asset Link</button>
          </div>
          {resources.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--txt3)' }}>No resource attachments added to this work node.</div>
          ) : (
            <table className="tv-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>SL</th>
                  <th>Description</th>
                  <th>URL Address</th>
                  <th style={{ width: 60, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r, i) => (
                  <tr key={i}>
                    <td>{r.sl}</td>
                    <td><input className="tv-input" style={{ padding: '6px 10px' }} value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} placeholder="Label..." /></td>
                    <td><input className="tv-input" style={{ padding: '6px 10px' }} value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} placeholder="https://..." /></td>
                    <td style={{ textAlign: 'right' }}><button className="tv-btn" style={{ color: '#ef4444', borderColor: 'transparent', background: 'transparent' }} onClick={() => removeResource(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 4. SUBTASK PACKAGES SECTION ── */}
        <div className="tv-card">
          <div className="tv-section-title">
            Subtask Work Breakdowns
            <button className="tv-btn" onClick={addSubtask}>＋ Add Subtask</button>
          </div>
          {subtasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--txt3)' }}>No subtask breakdowns specified for this objective card.</div>
          ) : (
            <table className="tv-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>SL</th>
                  <th style={{ width: '30%' }}>Scope Topic & Deliverable Notes</th>
                  <th>Timeline</th>
                  <th>Assigned Pool</th>
                  <th style={{ width: 60, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {subtasks.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input className="tv-input" style={{ padding: '6px 10px' }} value={s.topic} onChange={e => updateSub(String(s.id), 'topic', e.target.value)} placeholder="Title..." />
                        <textarea className="tv-textarea" style={{ padding: '6px 10px', minHeight: 40 }} value={s.description || ''} onChange={e => updateSub(String(s.id), 'description', e.target.value)} placeholder="Notes..." />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input type="date" className="tv-input" style={{ padding: '4px 8px', fontSize: 12 }} value={s.start_date} onChange={e => updateSub(String(s.id), 'start_date', e.target.value)} />
                        <input type="date" className="tv-input" style={{ padding: '4px 8px', fontSize: 12 }} value={s.end_date} onChange={e => updateSub(String(s.id), 'end_date', e.target.value)} />
                      </div>
                    </td>
                    <td>
                      <div className="tv-chip-container" style={{ gap: 4 }}>
                        {assignees.length === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Assign main task first</span>
                        ) : (
                          assignees.map(userId => {
                            const uObj = projectTeam.find(u => u.id === userId)
                            const sel = s.assignees.includes(userId)
                            return (
                              <button key={userId} type="button" onClick={() => toggleSubAssignee(String(s.id), userId)} className={`tv-chip ${sel ? 'selected' : ''}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                                {uObj ? uObj.full_name.split(' ')[0] : 'Member'}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}><button className="tv-btn" style={{ color: '#ef4444', borderColor: 'transparent', background: 'transparent' }} onClick={() => removeSub(s.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  )
}