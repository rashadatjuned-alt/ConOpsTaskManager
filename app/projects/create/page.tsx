'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
  '#6366f1', '#14b8a6',
]
const TYPES = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

export default function CreateProject() {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const [allUsers, setAllUsers] = useState<any[]>([])    // non-admin users
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  // project fields
  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [color,   setColor]   = useState('#3b82f6')
  const [members, setMembers] = useState<string[]>([])   // user ids

  // inline tasks
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    supabase.from('Users').select('id,full_name,email,role')
      .then(({ data }: { data: any[] | null }) => setAllUsers((data || []).filter((u: any) => u.role !== 'Admin')))
  }, [])

  const toggleMember = (id: string) =>
    setMembers(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id])

  const selectedTeam = allUsers.filter((u: any) => members.includes(u.id))

  const addTask = () => setTasks(p => [...p, {
    id: `t-${Date.now()}`, topic: '', description: '',
    type: 'One-time', assignees: [],
    start_date: today,
    end_date: new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0],
  }])
  const updateTask = (id: string, field: string, val: any) =>
    setTasks(p => p.map((t: any) => t.id === id ? { ...t, [field]: val } : t))
  const removeTask = (id: string) => setTasks(p => p.filter((t: any) => t.id !== id))

  const toggleTaskAssignee = (taskId: string, name: string) =>
    setTasks(p => p.map((t: any) => {
      if (t.id !== taskId) return t
      const cur: string[] = t.assignees || []
      return { ...t, assignees: cur.includes(name) ? cur.filter((a: string) => a !== name) : [...cur, name] }
    }))

  const handleSubmit = async () => {
    setError(''); setSaving(true)
    if (!name.trim()) { setError('Project name is required.'); setSaving(false); return }
    for (const t of tasks) {
      if (!t.topic.trim()) { setError('All task titles are required.'); setSaving(false); return }
    }

    try {
      const { data: proj, error: projErr } = await supabase.from('Projects').insert({
        name: name.trim(), description: desc.trim(), color_code: color, members,
      }).select().single()
      if (projErr) throw new Error(projErr.message)

      for (const t of tasks) {
        const { error: taskErr } = await supabase.from('Tasks').insert({
          project_name: proj.name,
          topic: t.topic.trim(),
          description: t.description?.trim() || '',
          assignees: t.assignees || [],
          type: t.type,
          start_date: t.start_date,
          end_date: t.end_date,
          status: 'Not Started',
          resources: [], tags: [],
        })
        if (taskErr) console.error('Task insert error:', taskErr.message)
      }

      router.push('/all-projects')
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  return (
    <AppShell title="New Project">
      <div style={{ maxWidth: 860 }}>
        {error && <div style={S.alertErr}>{error}</div>}

        {/* Project Details */}
        <div style={S.card}>
          <div style={S.cardTitle}>Project Details</div>

          <div style={S.fg}>
            <label style={S.lbl}>Project Name *</label>
            <input style={S.input} placeholder="e.g. Q4 Campaign" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>Description</label>
            <textarea style={S.textarea} placeholder="What is this project about?" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>Color Tag</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: color === c ? `3px solid ${c}` : '2px solid transparent',
                  outlineOffset: 2, transition: 'outline 0.12s',
                }} />
              ))}
            </div>
          </div>

          {/* Project Team */}
          <div style={S.fg}>
            <label style={S.lbl}>Project Team (excludes Admin)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {allUsers.map((u: any) => {
                const sel = members.includes(u.id)
                const ini = (u.full_name || u.email || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <button key={u.id} type="button" onClick={() => toggleMember(u.id)}
                    style={{ ...S.chip, ...(sel ? S.chipSel : {}), display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: sel ? 'var(--accent)' : 'var(--bg3)',
                      color: sel ? 'var(--accent2)' : 'var(--txt3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 700, flexShrink: 0,
                    }}>{ini}</div>
                    {sel ? '✓ ' : ''}{u.full_name || u.email}
                  </button>
                )
              })}
            </div>
            {members.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
                {members.length} member{members.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </div>

        {/* Inline Tasks */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={S.cardTitle}>
              Main Tasks <span style={{ color: 'var(--txt3)', fontWeight: 400 }}>({tasks.length})</span>
            </div>
            <button style={S.addBtn} onClick={addTask}>+ Add Task</button>
          </div>

          {tasks.length === 0 ? (
            <div style={S.emptyMsg}>No tasks yet. Click "+ Add Task" to create tasks for this project.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tasks.map((t, i) => (
                <div key={t.id} style={S.taskCard}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <span style={S.taskNum}>Task {i + 1}</span>
                    <button onClick={() => removeTask(t.id)} style={{ ...S.removeBtn, marginLeft: 'auto' }}>✕ Remove</button>
                  </div>

                  <div style={S.grid2}>
                    <div style={S.fg}>
                      <label style={S.lbl}>Task Title *</label>
                      <input style={S.input} placeholder="Task title" value={t.topic} onChange={e => updateTask(t.id, 'topic', e.target.value)} />
                    </div>
                    <div style={S.fg}>
                      <label style={S.lbl}>Task Type</label>
                      <select style={S.input} value={t.type} onChange={e => updateTask(t.id, 'type', e.target.value)}>
                        {TYPES.map(ty => <option key={ty}>{ty}</option>)}
                      </select>
                    </div>
                    <div style={S.fg}>
                      <label style={S.lbl}>Start Date</label>
                      <input type="date" style={S.input} value={t.start_date} onChange={e => updateTask(t.id, 'start_date', e.target.value)} />
                    </div>
                    <div style={S.fg}>
                      <label style={S.lbl}>End Date</label>
                      <input type="date" style={S.input} value={t.end_date} onChange={e => updateTask(t.id, 'end_date', e.target.value)} />
                    </div>
                  </div>

                  <div style={S.fg}>
                    <label style={S.lbl}>Description</label>
                    <textarea style={{ ...S.textarea, minHeight: 50 }} placeholder="Optional" value={t.description} onChange={e => updateTask(t.id, 'description', e.target.value)} />
                  </div>

                  <div style={S.fg}>
                    <label style={S.lbl}>Assign To (from project team)</label>
                    {selectedTeam.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Add team members to the project first.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {selectedTeam.map((u: any) => {
                          const sel = (t.assignees || []).includes(u.full_name)
                          return (
                            <button key={u.id} type="button"
                              onClick={() => toggleTaskAssignee(t.id, u.full_name)}
                              style={{ ...S.chip, ...(sel ? S.chipSel : {}), fontSize: 11, padding: '2px 8px' }}>
                              {sel ? '✓ ' : ''}{u.full_name}
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
            {saving ? 'Creating…' : `Create Project${tasks.length > 0 ? ` + ${tasks.length} Task${tasks.length > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string, React.CSSProperties> = {
  alertErr:  { background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(197,34,31,0.2)', borderRadius: 6, padding: '9px 14px', fontSize: 12, marginBottom: 12 },
  card:      { background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 10, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 },
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  fg:        { marginBottom: 12 },
  lbl:       { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt3)', display: 'block', marginBottom: 5 },
  input:     { width: '100%', padding: '7px 10px', background: 'var(--input-bg)', border: '1px solid var(--input-brd)', borderRadius: 6, color: 'var(--txt)', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  textarea:  { width: '100%', padding: '7px 10px', background: 'var(--input-bg)', border: '1px solid var(--input-brd)', borderRadius: 6, color: 'var(--txt)', fontSize: 13, fontFamily: 'inherit', outline: 'none', minHeight: 72, resize: 'vertical' },
  chip:      { padding: '3px 10px', fontSize: 12, borderRadius: 20, border: '1px solid var(--input-brd)', cursor: 'pointer', background: 'transparent', color: 'var(--txt3)', fontFamily: 'inherit' },
  chipSel:   { background: 'var(--accent)', color: 'var(--accent2)', borderColor: 'var(--accent)' },
  addBtn:    { background: 'var(--blue)', color: 'var(--blue2)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
  saveBtn:   { background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { background: 'var(--brd)', color: 'var(--txt3)', border: '1px solid var(--input-brd)', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  taskCard:  { background: 'var(--input-bg)', border: '1px solid var(--card-brd)', borderRadius: 8, padding: '12px 14px' },
  taskNum:   { fontSize: 10, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  emptyMsg:  { fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '14px 0' },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '2px 4px' },
}
