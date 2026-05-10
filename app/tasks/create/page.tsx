'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Resource } from '@/types'

const TYPES    = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']
const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed']

export default function CreateTask() {
  const router   = useRouter()
  const today    = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  const [allProjects,    setAllProjects]    = useState<any[]>([])
  const [projectTeam,    setProjectTeam]    = useState<any[]>([])   // non-admin members of selected project
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState('')
  const [saving,         setSaving]         = useState(false)

  // task fields
  const [project,    setProject]    = useState('')
  const [topic,      setTopic]      = useState('')
  const [type,       setType]       = useState('One-time')
  const [status,     setStatus]     = useState('Not Started')
  const [startDate,  setStartDate]  = useState(today)
  const [endDate,    setEndDate]    = useState(nextWeek)
  const [desc,       setDesc]       = useState('')
  const [assignees,  setAssignees]  = useState<string[]>([])
  const [subtasks,   setSubtasks]   = useState<any[]>([])
  const [resources,  setResources]  = useState<Resource[]>([])

  useEffect(() => {
    supabase.from('Projects').select('*').then(({ data }: { data: any[] | null }) => setAllProjects(data || []))
  }, [])

  // when project changes, load its team
  useEffect(() => {
    if (!project) { setProjectTeam([]); setAssignees([]); return }
    const load = async () => {
      const proj = allProjects.find(p => p.name === project)
      if (proj?.members?.length) {
        const { data: users } = await supabase.from('Users').select('id,full_name,role').in('id', proj.members)
        setProjectTeam((users || []).filter((u: any) => u.role !== 'Admin'))
      } else {
        const { data: users } = await supabase.from('Users').select('id,full_name,role')
        setProjectTeam((users || []).filter((u: any) => u.role !== 'Admin'))
      }
      setAssignees([])
    }
    load()
  }, [project, allProjects])

  const toggleAssignee = (name: string) =>
    setAssignees(p => p.includes(name) ? p.filter(a => a !== name) : [...p, name])

  const toggleSubAssignee = (subId: string, name: string) =>
    setSubtasks(p => p.map((s: any) => {
      if (s.id !== subId) return s
      const cur: string[] = s.assignees || []
      return { ...s, assignees: cur.includes(name) ? cur.filter((a: string) => a !== name) : [...cur, name] }
    }))

  const addSubtask = () => setSubtasks(p => [...p, {
    id: `new-${Date.now()}`, topic: '', description: '',
    assignees: [], start_date: startDate, end_date: endDate, status: 'Not Started',
  }])
  const updateSub = (id: string, field: string, val: string) =>
    setSubtasks(p => p.map((s: any) => s.id === id ? { ...s, [field]: val } : s))
  const removeSub = (id: string) => setSubtasks(p => p.filter((s: any) => s.id !== id))

  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  const handleSubmit = async () => {
    setError(''); setSaving(true)
    if (!topic.trim()) { setError('Task title is required.'); setSaving(false); return }
    if (endDate < startDate) { setError('End date cannot be before start date.'); setSaving(false); return }
    if (status === 'Completed' && subtasks.some((s: any) => s.status !== 'Completed')) {
      setError('All subtasks must be Completed if the task is Completed.'); setSaving(false); return
    }
    for (const s of subtasks) {
      if (!s.topic.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
    }

    try {
      const { data: taskData, error: taskErr } = await supabase.from('Tasks').insert({
        project_name: project || null,
        topic: topic.trim(),
        description: desc.trim(),
        assignees,
        type, start_date: startDate, end_date: endDate, status,
        resources, tags: [],
      }).select().single()

      if (taskErr) throw new Error(taskErr.message)

      for (const s of subtasks) {
        const { error: subErr } = await supabase.from('Subtasks').insert({
          parent_task_id: taskData.id,
          topic: s.topic.trim(),
          description: s.description?.trim() || '',
          assignees: s.assignees || [],
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.status,
        })
        if (subErr) console.error('Subtask error:', subErr.message)
      }

      // notify assignees
      for (const name of assignees) {
        const { data: users } = await supabase.from('Users').select('id').eq('full_name', name)
        if (users?.[0]?.id) {
          await supabase.from('Notifications').insert({
            user_id: users[0].id,
            message: `You were assigned: "${topic.trim()}"${project ? ` in ${project}` : ''}.`,
            is_read: false,
          })
        }
      }

      setSuccess(`✅ Task "${topic}" created!`)
      setTimeout(() => router.push('/my-tasks'), 1200)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  return (
    <AppShell title="Create Task">
      <div style={{ maxWidth: 860 }}>
        {error   && <div style={S.alertErr}>{error}</div>}
        {success && <div style={S.alertOk}>{success}</div>}

        {/* Task Details */}
        <div style={S.card}>
          <div style={S.cardTitle}>Task Details</div>
          <div style={S.grid2}>
            <div style={S.fg}>
              <label style={S.lbl}>Project</label>
              <select style={S.input} value={project} onChange={e => setProject(e.target.value)}>
                <option value="">No project</option>
                {allProjects.map((p: any) => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Task Title *</label>
              <input style={S.input} placeholder="Short, clear title" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Task Type</label>
              <select style={S.input} value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map((t: any) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Status</label>
              <select style={S.input} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map((s: any) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Start Date</label>
              <input type="date" style={S.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>End Date</label>
              <input type="date" style={S.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div style={S.fg}>
            <label style={S.lbl}>Description</label>
            <textarea style={S.textarea} placeholder="Context, acceptance criteria, notes…" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          {/* Assignees */}
          <div style={S.fg}>
            <label style={S.lbl}>
              Assign To
              {project && projectTeam.length > 0 && (
                <span style={{ fontSize: 10, color: '#4b5563', marginLeft: 6, fontWeight: 400 }}>
                  ({projectTeam.length} from project team)
                </span>
              )}
            </label>
            {!project ? (
              <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Select a project to see assignable team members.</div>
            ) : projectTeam.length === 0 ? (
              <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>No team members in this project yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {projectTeam.map((u: any) => {
                  const sel = assignees.includes(u.full_name)
                  return (
                    <button key={u.id} type="button"
                      onClick={() => toggleAssignee(u.full_name)}
                      style={{ ...S.chip, ...(sel ? S.chipSel : {}) }}>
                      {sel ? '✓ ' : ''}{u.full_name}
                    </button>
                  )
                })}
              </div>
            )}
            {assignees.length > 0 && (
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>Assigned: {assignees.join(', ')}</div>
            )}
          </div>
        </div>

        {/* Resources */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={S.cardTitle}>Resources</div>
            <button style={S.addBtn} onClick={addResource}>+ Add Resource</button>
          </div>
          {resources.length === 0 ? (
            <div style={S.emptyMsg}>No resources. Click "+ Add Resource" to add one.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['SL', 'Title', 'Link', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {resources.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, width: 36, color: '#6b7280' }}>{r.sl}</td>
                    <td style={S.td}><input style={S.inlineInput} value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} placeholder="Resource title" /></td>
                    <td style={S.td}><input style={S.inlineInput} value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} placeholder="https://…" /></td>
                    <td style={{ ...S.td, width: 36 }}><button onClick={() => removeResource(i)} style={S.removeBtn}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Subtasks */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={S.cardTitle}>Subtasks <span style={{ color: '#4b5563', fontWeight: 400 }}>({subtasks.length})</span></div>
            <button style={S.addBtn} onClick={addSubtask}>+ Add Subtask</button>
          </div>
          {subtasks.length === 0 ? (
            <div style={S.emptyMsg}>No subtasks. Click "+ Add Subtask" to add one.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {subtasks.map((s, i) => (
                <div key={s.id} style={S.subCard}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <span style={S.subNum}>Subtask {i + 1}</span>
                    <button onClick={() => removeSub(s.id)} style={{ ...S.removeBtn, marginLeft: 'auto' }}>✕ Remove</button>
                  </div>
                  <div style={S.grid2}>
                    <div style={S.fg}>
                      <label style={S.lbl}>Title *</label>
                      <input style={S.input} placeholder="Subtask title" value={s.topic} onChange={e => updateSub(s.id, 'topic', e.target.value)} />
                    </div>
                    <div style={S.fg}>
                      <label style={S.lbl}>Status</label>
                      <select style={S.input} value={s.status} onChange={e => updateSub(s.id, 'status', e.target.value)}>
                        {STATUSES.map(st => <option key={st}>{st}</option>)}
                      </select>
                    </div>
                    <div style={S.fg}>
                      <label style={S.lbl}>Start Date</label>
                      <input type="date" style={S.input} value={s.start_date} onChange={e => updateSub(s.id, 'start_date', e.target.value)} />
                    </div>
                    <div style={S.fg}>
                      <label style={S.lbl}>End Date</label>
                      <input type="date" style={S.input} value={s.end_date} onChange={e => updateSub(s.id, 'end_date', e.target.value)} />
                    </div>
                  </div>
                  <div style={S.fg}>
                    <label style={S.lbl}>Description</label>
                    <textarea style={{ ...S.textarea, minHeight: 50 }} placeholder="Optional" value={s.description} onChange={e => updateSub(s.id, 'description', e.target.value)} />
                  </div>
                  <div style={S.fg}>
                    <label style={S.lbl}>Assign To (from task assignees)</label>
                    {assignees.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#4b5563' }}>Assign people to the task above first.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {assignees.map(name => {
                          const sel = (s.assignees || []).includes(name)
                          return (
                            <button key={name} type="button"
                              onClick={() => toggleSubAssignee(s.id, name)}
                              style={{ ...S.chip, ...(sel ? S.chipSel : {}), fontSize: 11, padding: '2px 8px' }}>
                              {sel ? '✓ ' : ''}{name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 32 }}>
          <button style={S.cancelBtn} onClick={() => router.back()}>Cancel</button>
          <button style={S.saveBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : `Save Task${subtasks.length > 0 ? ` + ${subtasks.length} Subtask${subtasks.length > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string, React.CSSProperties> = {
  alertErr:  { background: '#2d0a0a', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '9px 14px', fontSize: 12, marginBottom: 12 },
  alertOk:   { background: '#052e16', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '9px 14px', fontSize: 12, marginBottom: 12 },
  card:      { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 },
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  fg:        { marginBottom: 12 },
  lbl:       { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4b5563', display: 'block', marginBottom: 5 },
  input:     { width: '100%', padding: '7px 10px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  textarea:  { width: '100%', padding: '7px 10px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none', minHeight: 72, resize: 'vertical' },
  chip:      { padding: '3px 10px', fontSize: 12, borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'transparent', color: '#9ca3af', fontFamily: 'inherit' },
  chipSel:   { background: '#15803d', color: '#bbf7d0', borderColor: '#15803d' },
  addBtn:    { background: '#1d4ed8', color: '#bfdbfe', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' },
  saveBtn:   { background: '#15803d', color: '#bbf7d0', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  subCard:   { background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '12px 14px' },
  subNum:    { fontSize: 10, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' },
  emptyMsg:  { fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '14px 0' },
  th:        { textAlign: 'left', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#4b5563', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td:        { fontSize: 12, color: '#9ca3af', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' },
  inlineInput: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#e5e7eb', fontSize: 12, fontFamily: 'inherit', width: '100%', outline: 'none' },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '2px 4px' },
}
