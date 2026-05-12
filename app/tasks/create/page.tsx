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
  const [project,     setProject]     = useState('')
  const [topic,       setTopic]       = useState('')
  const [type,        setType]        = useState('One-time')
  const [status,      setStatus]      = useState('Not Started')
  const [startDate,   setStartDate]   = useState(today)
  const [endDate,     setEndDate]     = useState(nextWeek)
  const [desc,        setDesc]        = useState('')
  const [assignees,   setAssignees]   = useState<string[]>([])
  
  // Resources & Subtasks
  const [resources,   setResources]   = useState<Resource[]>([])
  const [subtasks,    setSubtasks]    = useState<SubtaskDraft[]>([])

  useEffect(() => {
    const load = async () => {
      const [p, u] = await Promise.all([
        supabase.from('Projects').select('*'),
        supabase.from('Users').select('id,full_name,email,role'),
      ])
      setAllProjects(p.data || [])
      setAllUsers((u.data || []).filter((usr: any) => usr.role !== 'Admin'))
    }
    load()
  }, [])

  // ── Cascading Logic 1: Filter Project Team based on Project ──
  useEffect(() => {
    if (!project) { 
      setProjectTeam(allUsers)
      setAssignees([]) 
      return 
    }
    const proj = allProjects.find(p => p.name === project)
    if (proj?.members?.length) {
      const members = allUsers.filter(u => proj.members.includes(u.id))
      setProjectTeam(members.length ? members : allUsers)
    } else {
      setProjectTeam(allUsers)
    }
    // Reset assignees when project changes to prevent invalid users
    setAssignees([])
    // Also strip invalid assignees from subtasks
    setSubtasks(prev => prev.map(s => ({ ...s, assignees: [] })))
  }, [project, allProjects, allUsers])

  const toggleAssignee = useCallback((name: string) => {
    setAssignees(prev => {
      const next = prev.includes(name) ? prev.filter(o => o !== name) : [...prev, name]
      // If a user is removed from the main task, remove them from all subtasks too
      if (prev.includes(name)) {
        setSubtasks(subs => subs.map(s => ({
          ...s, assignees: s.assignees.filter(a => a !== name)
        })))
      }
      return next
    })
  }, [])

  const toggleSubAssignee = (subId: string, name: string) => {
    setSubtasks(prev => prev.map(s => {
      if (s.id !== subId) return s
      return { 
        ...s, 
        assignees: s.assignees.includes(name) ? s.assignees.filter(a => a !== name) : [...s.assignees, name] 
      }
    }))
  }

  // ── Handlers ──
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
    
    if (!topic.trim()) { setError('Task title is required.'); setSaving(false); return }
    if (endDate < startDate) { setError('End date cannot be before start date.'); setSaving(false); return }
    
    for (const s of subtasks) {
      if (!s.topic.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
      if (s.start_date < startDate || s.end_date > endDate) {
        setError(`Subtask "${s.topic}" dates must be within parent task dates.`); setSaving(false); return
      }
    }
    if (status === 'Completed' && subtasks.length > 0 && !subtasks.every(s => s.status === 'Completed')) {
      setError('All subtasks must be completed before marking task as Completed.'); setSaving(false); return
    }

    try {
      const { data: taskData, error: taskErr } = await supabase.from('Tasks').insert({
        project_name: project, 
        topic: topic.trim(), 
        description: desc.trim(),
        owner: assignees.join(', '), // Keeping DB string format if expected
        assignees: assignees,        // Saving array if JSON supported
        type: type, 
        start_date: startDate,
        end_date: endDate, 
        status: status, 
        tags: [],
        resources: resources
      }).select().single()

      if (taskErr) throw new Error(`Task save failed: ${taskErr.message}`)

      const subErrors: string[] = []
      for (const s of subtasks) {
        const { error: subErr } = await supabase.from('Subtasks').insert({
          parent_task_id: taskData.id, 
          topic: s.topic.trim(),
          description: s.description.trim(),
          owner: s.assignees.join(', '), 
          assignees: s.assignees,
          start_date: s.start_date,
          end_date: s.end_date, 
          status: s.status,
        })
        if (subErr) subErrors.push(`"${s.topic}": ${subErr.message}`)
      }
      
      if (subErrors.length > 0) {
        setError(`Task saved but subtask errors: ${subErrors.join('; ')}`)
        setSaving(false)
        return
      }

      // Notifications
      const allUsersForNotif = await supabase.from('Users').select('id,full_name,email')
      for (const ownerName of assignees) {
        const u = (allUsersForNotif.data||[]).find((u:any) => (u.full_name || u.email) === ownerName)
        if (u?.id) await supabase.from('Notifications').insert({
          user_id: u.id,
          message: `You were assigned: "${topic.trim()}"${project ? ` in ${project}` : ''}.`,
          is_read: false,
        })
      }

      setSuccess(`✅ Task created!`)
      setTimeout(() => router.push('/my-tasks'), 1200)
    } catch (e: any) { setError(e.message) }
    
    setSaving(false)
  }

  return (
    <AppShell title="Create Task">
      <style dangerouslySetInnerHTML={{ __html: `
        /* LIGHT MODE VARIABLES (DEFAULT) */
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
        
        /* DARK MODE VARIABLES */
        .dark .tv-wrapper, 
        [data-theme="dark"] .tv-wrapper {
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
          --arrow-blue: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2360a5fa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
          --arrow-gray: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a3a3a3%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
        }
        
        /* SHARED STYLES */
        .tv-wrapper { color: var(--text-main); font-size: 14px; display: flex; flex-direction: column; gap: 20px; }
        .tv-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 12px; }
        .tv-back-nav { color: var(--text-muted); text-decoration: none; display: flex; align-items: center; gap: 8px; cursor: pointer; background: none; border: none; font-size: 14px; }
        .tv-back-nav:hover { color: var(--text-main); }
        .tv-actions { display: flex; gap: 10px; align-items: center; }
        
        .tv-btn { background-color: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm); transition: 0.2s; }
        .tv-btn:hover { background-color: var(--btn-hover); }
        .tv-btn-primary { background-color: var(--text-main); color: var(--card-bg); }
        .tv-btn-primary:hover { opacity: 0.9; }
        .tv-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .tv-status-select { background-color: var(--pill-blue-bg); color: var(--pill-blue-txt); border: 1px solid transparent; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; outline: none; appearance: none; padding-right: 24px; background-image: var(--arrow-blue); background-repeat: no-repeat; background-position: right 10px top 50%; background-size: 8px auto; }
        .tv-status-sub { background-color: var(--pill-gray-bg); color: var(--pill-gray-txt); background-image: var(--arrow-gray); padding: 4px 10px; padding-right: 20px; font-size: 11px; }
        .tv-status-sub.in-progress { background-color: var(--pill-blue-bg); color: var(--pill-blue-txt); background-image: var(--arrow-blue); }
        
        .tv-card { background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; box-shadow: var(--shadow-sm); }
        .tv-section-title { font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
        
        .tv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
        .tv-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 16px; }
        .tv-field { display: flex; flex-direction: column; gap: 6px; }
        .tv-label { font-size: 11px; text-transform: uppercase; color: var(--text-label); font-weight: 600; letter-spacing: 0.05em; }
        
        .tv-input { width: 100%; padding: 8px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); font-size: 14px; outline: none; }
        .tv-textarea { width: 100%; padding: 8px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); font-size: 14px; outline: none; min-height: 80px; resize: vertical; }
        
        .tv-table { width: 100%; border-collapse: collapse; text-align: left; }
        .tv-table th { font-size: 11px; text-transform: uppercase; color: var(--text-label); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--border-color); }
        .tv-table td { font-size: 13px; color: var(--text-main); padding: 12px; border-bottom: 1px solid var(--border-color); vertical-align: top; }
        .tv-table tr:last-child td { border-bottom: none; }
        
        .tv-action-col { width: 80px; text-align: right; }
        .tv-icon-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; margin-left: 8px; transition: 0.2s; }
        .tv-icon-btn:hover { color: var(--btn-delete-txt); }

        .tv-chip-container { display: flex; gap: 8px; flex-wrap: wrap; }
        .tv-chip { background: var(--btn-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 4px 10px; font-size: 12px; color: var(--text-main); cursor: pointer; transition: 0.2s;}
        .tv-chip.selected { background-color: var(--text-main); color: var(--card-bg); border-color: var(--text-main); }
        
        .tv-alert { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
        .tv-alert-error { background-color: var(--btn-delete-bg); color: var(--btn-delete-txt); }
        .tv-alert-success { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; }
      `}} />

      <div className="tv-wrapper">
        
        {/* ── TOP ACTION BAR ── */}
        <div className="tv-top-bar">
          <button className="tv-back-nav" onClick={() => router.back()}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg>
            Cancel
          </button>
          
          <div className="tv-actions">
            <select className="tv-status-select" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>

            <button className="tv-btn tv-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating...' : '💾 Create Task'}
            </button>
          </div>
        </div>

        {error   && <div className="tv-alert tv-alert-error">{error}</div>}
        {success && <div className="tv-alert tv-alert-success">{success}</div>}

        {/* ── 1. TASK DETAILS ── */}
        <div className="tv-card">
          <div className="tv-section-title">New Task Details</div>
          
          <div className="tv-grid-2">
            <div className="tv-field">
              <span className="tv-label">Project</span>
              <select className="tv-input" value={project} onChange={e => setProject(e.target.value)}>
                <option value="">Select project...</option>
                {allProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="tv-field">
              <span className="tv-label">Task Title *</span>
              <input className="tv-input" placeholder="Short, clear title" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
          </div>

          <div className="tv-field" style={{ marginBottom: 20 }}>
            <span className="tv-label">Description</span>
            <textarea className="tv-textarea" placeholder="Context, acceptance criteria, notes..." value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          <div className="tv-grid-4" style={{ marginBottom: 0 }}>
            <div className="tv-field">
              <span className="tv-label">Start Date</span>
              <input type="date" className="tv-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="tv-field">
              <span className="tv-label">End Date</span>
              <input type="date" className="tv-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="tv-field">
              <span className="tv-label">Type of Task</span>
              <select className="tv-input" value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── 2. ASSIGNED TO ── */}
        <div className="tv-card">
          <div className="tv-section-title">
            Assigned To
            {project && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
              Showing members from {project}
            </span>}
          </div>
          <div className="tv-chip-container">
            {projectTeam.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No members found.</span>
            ) : (
              projectTeam.map((u: any) => {
                const sel = assignees.includes(u.full_name)
                return (
                  <button key={u.id} type="button" onClick={() => toggleAssignee(u.full_name)} className={`tv-chip ${sel ? 'selected' : ''}`}>
                    {sel ? '✓ ' : ''}{u.full_name}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── 3. RESOURCES ── */}
        <div className="tv-card">
          <div className="tv-section-title">
            Resources
            <button className="tv-btn" onClick={addResource}>＋ Add</button>
          </div>
          
          {resources.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text-muted)' }}>No resources attached.</div>
          ) : (
            <table className="tv-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>SL</th>
                  <th>Description</th>
                  <th>Link</th>
                  <th className="tv-action-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r, i) => (
                  <tr key={i}>
                    <td>{r.sl}</td>
                    <td>
                      <input className="tv-input" style={{ padding: '6px 10px' }} placeholder="Resource name..." value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} /> 
                    </td>
                    <td>
                      <input className="tv-input" style={{ padding: '6px 10px' }} placeholder="https://..." value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} /> 
                    </td>
                    <td className="tv-action-col">
                      <button className="tv-icon-btn" onClick={() => removeResource(i)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 4. SUBTASKS ── */}
        <div className="tv-card">
          <div className="tv-section-title">
            Subtasks
            <button className="tv-btn" onClick={addSubtask}>＋ Add Subtask</button>
          </div>

          {subtasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text-muted)' }}>No subtasks yet.</div>
          ) : (
            <table className="tv-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>SL</th>
                  <th style={{ width: '35%' }}>Title & Description</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th className="tv-action-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subtasks.map((s, i) => (
                  <tr key={s.id}>
                    <td><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>#{i + 1}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input className="tv-input" style={{ padding: '6px 10px' }} value={s.topic} onChange={e => updateSub(String(s.id), 'topic', e.target.value)} placeholder="Title..." />
                        <textarea className="tv-textarea" style={{ padding: '6px 10px', minHeight: 40 }} value={s.description || ''} onChange={e => updateSub(String(s.id), 'description', e.target.value)} placeholder="Description..." />
                      </div>
                    </td>
                    <td>
                      <input type="date" className="tv-input" style={{ padding: '6px 10px' }} value={s.start_date} onChange={e => updateSub(String(s.id), 'start_date', e.target.value)} />
                    </td>
                    <td>
                      <input type="date" className="tv-input" style={{ padding: '6px 10px' }} value={s.end_date} onChange={e => updateSub(String(s.id), 'end_date', e.target.value)} />
                    </td>
                    <td>
                      <div className="tv-chip-container" style={{ gap: 4 }}>
                        {assignees.length === 0 
                          ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Assign task first</span>
                          : assignees.map(name => {
                              const sel = s.assignees.includes(name)
                              return (
                                <button key={name} type="button" onClick={() => toggleSubAssignee(String(s.id), name)} className={`tv-chip ${sel ? 'selected' : ''}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                                  {sel ? '✓ ' : ''}{name.split(' ')[0]}
                                </button>
                              )
                            })
                        }
                      </div>
                    </td>
                    <td>
                      <select 
                        className={`tv-status-select tv-status-sub ${s.status === 'In Progress' ? 'in-progress' : ''}`}
                        value={s.status} 
                        onChange={e => updateSub(String(s.id), 'status', e.target.value)}
                      >
                        {STATUSES.map(st => <option key={st}>{st}</option>)}
                      </select>
                    </td>
                    <td className="tv-action-col">
                      <button className="tv-icon-btn" onClick={() => removeSub(s.id)}>✕</button>
                    </td>
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
