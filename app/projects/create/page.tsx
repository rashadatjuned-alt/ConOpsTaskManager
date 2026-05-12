'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  { hex: '#14B8A6', label: 'Teal'   }, // Added to make 10
  { hex: '#EC4899', label: 'Pink'   }, // Added to make 10
]

interface InlineTask {
  id: string
  topic: string
  description: string
  type: string
  start_date: string
  end_date: string
  assignees: string[]
}

export default function CreateProject() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [color,   setColor]   = useState('#378ADD')
  const [members, setMembers] = useState<string[]>([]) // Array of User IDs
  const [tasks,   setTasks]   = useState<InlineTask[]>([])

  const [users,   setUsers]   = useState<any[]>([]) // Filtered (No Admins)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    supabase.from('Users').select('id,full_name,email,role')
      .then(({ data }) => {
        // Exclude Admins immediately
        setUsers((data || []).filter((u: any) => u.role !== 'Admin'))
      })
  }, [])

  // ── Project Members ──
  const toggleMember = (id: string) => {
    setMembers(prev => {
      const isSelected = prev.includes(id)
      const nextMembers = isSelected ? prev.filter(m => m !== id) : [...prev, id]
      
      // Cascading logic: If a user is removed from the project, remove them from all inline tasks
      if (isSelected) {
        const removedUser = users.find(u => u.id === id)
        const removedName = removedUser?.full_name || removedUser?.email
        if (removedName) {
          setTasks(currentTasks => currentTasks.map(t => ({
            ...t,
            assignees: t.assignees.filter(a => a !== removedName)
          })))
        }
      }
      return nextMembers
    })
  }

  // ── Inline Tasks ──
  const addTask = () => setTasks(prev => [...prev, {
    id: `new-${Date.now()}`, topic: '', description: '', type: 'One-time',
    start_date: today, end_date: nextWeek, assignees: []
  }])

  const updateTask = (id: string, field: string, val: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t))

  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id))

  const toggleTaskAssignee = (taskId: string, name: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      return {
        ...t,
        assignees: t.assignees.includes(name) ? t.assignees.filter(a => a !== name) : [...t.assignees, name]
      }
    }))
  }

  // ── Submit ──
  const handleSubmit = async () => {
    setError(''); setSuccess(''); setSaving(true)
    
    if (!name.trim()) { setError('Project name is required.'); setSaving(false); return }
    
    for (const t of tasks) {
      if (!t.topic.trim()) { setError('All inline task titles are required.'); setSaving(false); return }
      if (t.end_date < t.start_date) { setError(`Task "${t.topic}" has an end date before its start date.`); setSaving(false); return }
    }

    try {
      // 1. Create Project
      const { error: projErr } = await supabase.from('Projects').insert({
        name: name.trim(), 
        description: desc.trim(), 
        color_code: color, 
        members: members
      })
      if (projErr) throw new Error(`Project creation failed: ${projErr.message}`)

      // 2. Create Inline Tasks (if any)
      if (tasks.length > 0) {
        const taskPayloads = tasks.map(t => ({
          project_name: name.trim(),
          topic: t.topic.trim(),
          description: t.description.trim(),
          type: t.type,
          start_date: t.start_date,
          end_date: t.end_date,
          owner: t.assignees.join(', '),
          assignees: t.assignees,
          status: 'Not Started', // Enforced requirement
          tags: []
        }))

        const { error: tasksErr } = await supabase.from('Tasks').insert(taskPayloads)
        if (tasksErr) throw new Error(`Project created, but tasks failed: ${tasksErr.message}`)
      }

      setSuccess(`✅ Project "${name.trim()}" created successfully!`)
      setTimeout(() => router.push('/all-projects'), 1200)
    } catch (e: any) {
      setError(e.message)
    }
    
    setSaving(false)
  }

  // Filter available users for Task Assignment based on selected Project Members
  const projectUsers = users.filter(u => members.includes(u.id))

  return (
    <AppShell title="New Project">
      {/* ── INJECTED CSS FOR AUTO LIGHT/DARK MODE ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .tv-wrapper {
          --bg-color: transparent;
          --card-bg: #ffffff;
          --subtask-bg: #f3f4f6;
          --border-color: #e5e7eb;
          --text-main: #111827;
          --text-muted: #6b7280;
          --text-label: #4b5563;
          --btn-bg: #ffffff;
          --btn-hover: #f3f4f6;
          --btn-delete-bg: #fef2f2;
          --btn-delete-txt: #ef4444;
          --btn-delete-hover: #fee2e2;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .dark .tv-wrapper, 
        [data-theme="dark"] .tv-wrapper {
          --bg-color: transparent;
          --card-bg: #1e1e1e;
          --subtask-bg: #181818;
          --border-color: #2e2e2e;
          --text-main: #e5e5e5;
          --text-muted: #8b8b8b;
          --text-label: #6b6b6b;
          --btn-bg: #2a2a2a;
          --btn-hover: #333333;
          --btn-delete-bg: rgba(239, 68, 68, 0.1);
          --btn-delete-txt: #ef4444;
          --btn-delete-hover: rgba(239, 68, 68, 0.2);
          --shadow-sm: none;
        }
        
        .tv-wrapper { color: var(--text-main); font-size: 14px; display: flex; flex-direction: column; gap: 20px; padding-bottom: 40px; }
        .tv-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 12px; }
        .tv-back-nav { color: var(--text-muted); text-decoration: none; display: flex; align-items: center; gap: 8px; cursor: pointer; background: none; border: none; font-size: 14px; }
        .tv-back-nav:hover { color: var(--text-main); }
        .tv-actions { display: flex; gap: 10px; align-items: center; }
        
        .tv-btn { background-color: var(--btn-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm); transition: 0.2s; }
        .tv-btn:hover { background-color: var(--btn-hover); }
        .tv-btn-primary { background-color: var(--text-main); color: var(--card-bg); }
        .tv-btn-primary:hover { opacity: 0.9; }
        .tv-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .tv-card { background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 24px; box-shadow: var(--shadow-sm); }
        .tv-section-title { font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
        
        .tv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
        .tv-field { display: flex; flex-direction: column; gap: 6px; }
        .tv-label { font-size: 11px; text-transform: uppercase; color: var(--text-label); font-weight: 600; letter-spacing: 0.05em; }
        
        .tv-input { width: 100%; padding: 8px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); font-size: 14px; outline: none; }
        .tv-textarea { width: 100%; padding: 8px 12px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-main); font-size: 14px; outline: none; min-height: 80px; resize: vertical; }
        
        .tv-table { width: 100%; border-collapse: collapse; text-align: left; }
        .tv-table th { font-size: 11px; text-transform: uppercase; color: var(--text-label); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--border-color); }
        .tv-table td { font-size: 13px; color: var(--text-main); padding: 12px; border-bottom: 1px solid var(--border-color); vertical-align: top; }
        .tv-table tr:last-child td { border-bottom: none; }
        
        .tv-action-col { width: 60px; text-align: right; }
        .tv-icon-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; margin-left: 8px; transition: 0.2s; }
        .tv-icon-btn:hover { color: var(--btn-delete-txt); }

        .tv-chip-container { display: flex; gap: 8px; flex-wrap: wrap; }
        .tv-chip { background: var(--btn-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 4px 10px; font-size: 12px; color: var(--text-main); cursor: pointer; transition: 0.2s;}
        .tv-chip.selected { background-color: var(--text-main); color: var(--card-bg); border-color: var(--text-main); }
        
        .tv-alert { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
        .tv-alert-error { background-color: var(--btn-delete-bg); color: var(--btn-delete-txt); }
        .tv-alert-success { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; }
        
        .color-btn { width: 36px; height: 36px; border-radius: 50%; border: 3px solid transparent; outline: 2px solid transparent; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
      `}} />

      <div className="tv-wrapper">
        
        {/* ── TOP ACTION BAR ── */}
        <div className="tv-top-bar">
          <button className="tv-back-nav" onClick={() => router.back()}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"></path></svg>
            Cancel
          </button>
          
          <div className="tv-actions">
            <button className="tv-btn tv-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating...' : '💾 Create Project'}
            </button>
          </div>
        </div>

        {error   && <div className="tv-alert tv-alert-error">{error}</div>}
        {success && <div className="tv-alert tv-alert-success">{success}</div>}

        {/* ── 1. PROJECT DETAILS ── */}
        <div className="tv-card">
          <div className="tv-section-title">Project Details</div>
          
          <div className="tv-grid-2">
            <div className="tv-field">
              <span className="tv-label">Project Name *</span>
              <input className="tv-input" placeholder="e.g. Q4 Campaign, Platform Revamp..." value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="tv-field">
              <span className="tv-label">Color Tag</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 2 }}>
                {COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.hex)}
                    className="color-btn"
                    style={{
                      background: c.hex,
                      borderColor: color === c.hex ? c.hex : 'transparent',
                      outlineColor: color === c.hex ? c.hex : 'transparent',
                      outlineOffset: 2,
                    }}>
                    {color === c.hex && <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="tv-field" style={{ marginBottom: 0 }}>
            <span className="tv-label">Description</span>
            <textarea className="tv-textarea" placeholder="What is this project about? Goals, scope..." value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
        </div>

        {/* ── 2. PROJECT TEAM (Assignees) ── */}
        <div className="tv-card">
          <div className="tv-section-title">
            Project Team
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
              Select members (Admins excluded)
            </span>
          </div>
          <div className="tv-chip-container">
            {users.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No available users.</span>
            ) : (
              users.map((u: any) => {
                const sel = members.includes(u.id)
                return (
                  <button key={u.id} type="button" onClick={() => toggleMember(u.id)} className={`tv-chip ${sel ? 'selected' : ''}`}>
                    {sel ? '✓ ' : ''}{u.full_name || u.email}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── 3. INLINE MAIN TASKS ── */}
        <div className="tv-card">
          <div className="tv-section-title">
            Main Tasks
            <button className="tv-btn" onClick={addTask}>＋ Add Task</button>
          </div>

          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text-muted)' }}>
              No main tasks added yet. You can add them now or create them later.
            </div>
          ) : (
            <table className="tv-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>SL</th>
                  <th style={{ width: '30%' }}>Title & Description</th>
                  <th style={{ width: 130 }}>Task Type</th>
                  <th style={{ width: 130 }}>Dates</th>
                  <th>Task Assignees</th>
                  <th className="tv-action-col"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={t.id}>
                    <td><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>#{i + 1}</span></td>
                    
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input className="tv-input" style={{ padding: '6px 10px' }} value={t.topic} onChange={e => updateTask(t.id, 'topic', e.target.value)} placeholder="Task Title..." />
                        <textarea className="tv-textarea" style={{ padding: '6px 10px', minHeight: 40 }} value={t.description} onChange={e => updateTask(t.id, 'description', e.target.value)} placeholder="Description..." />
                      </div>
                    </td>

                    <td>
                      <select className="tv-input" style={{ padding: '6px 10px' }} value={t.type} onChange={e => updateTask(t.id, 'type', e.target.value)}>
                        {TYPES.map(typeOpt => <option key={typeOpt}>{typeOpt}</option>)}
                      </select>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input type="date" className="tv-input" style={{ padding: '6px 10px', fontSize: 12 }} value={t.start_date} onChange={e => updateTask(t.id, 'start_date', e.target.value)} title="Start Date" />
                        <input type="date" className="tv-input" style={{ padding: '6px 10px', fontSize: 12 }} value={t.end_date} onChange={e => updateTask(t.id, 'end_date', e.target.value)} title="End Date" />
                      </div>
                    </td>

                    <td>
                      <div className="tv-chip-container" style={{ gap: 4 }}>
                        {projectUsers.length === 0 
                          ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Add people to Project Team first</span>
                          : projectUsers.map(u => {
                              const name = u.full_name || u.email
                              const sel = t.assignees.includes(name)
                              return (
                                <button key={u.id} type="button" onClick={() => toggleTaskAssignee(t.id, name)} className={`tv-chip ${sel ? 'selected' : ''}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                                  {sel ? '✓ ' : ''}{name.split(' ')[0]}
                                </button>
                              )
                            })
                        }
                      </div>
                    </td>

                    <td className="tv-action-col">
                      <button className="tv-icon-btn" onClick={() => removeTask(t.id)}>✕</button>
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
