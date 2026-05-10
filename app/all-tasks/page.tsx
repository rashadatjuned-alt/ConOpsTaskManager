'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAssignees } from '@/lib/projectUtils'

const STATUS_DOT: Record<string, string> = {
  'Not Started': '#6b7280', 'In Progress': '#3b82f6',
  'On-Hold': '#f59e0b', 'Completed': '#22c55e',
}
const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  'Not Started': { bg: '#1f2937', color: '#9ca3af' },
  'In Progress': { bg: '#1e3a5f', color: '#60a5fa' },
  'On-Hold':     { bg: '#3d2400', color: '#f59e0b' },
  'Completed':   { bg: '#052e16', color: '#4ade80' },
}
const STATUSES  = ['Not Started', 'In Progress', 'On-Hold', 'Completed']
const TASK_TYPES = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annually', 'Annually']

function Pill({ status }: { status: string }) {
  const s = STATUS_PILL[status] || STATUS_PILL['Not Started']
  return <span style={{ background: s.bg, color: s.color, fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{status}</span>
}

export default function AllTasks() {
  const router = useRouter()
  const [tasks,    setTasks]    = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [users,    setUsers]    = useState<any[]>([])
  const [myRole,   setMyRole]   = useState('')
  const [loading,  setLoading]  = useState(true)

  // filters
  const [fType,     setFType]     = useState('All')
  const [fProject,  setFProject]  = useState('All')
  const [fStatus,   setFStatus]   = useState('All')
  const [fAssignee, setFAssignee] = useState('All')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || 'Team Member')
      const [{ data: t }, { data: s }, { data: us }] = await Promise.all([
        supabase.from('Tasks').select('*').order('project_name').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Users').select('id,full_name').neq('role', 'Admin'),
      ])
      const allT = t || []
      setTasks(allT)
      setSubtasks(s || [])
      setUsers(us || [])
      setProjects([...new Set(allT.map((x: any) => x.project_name).filter(Boolean))] as string[])
      setLoading(false)
    }
    load()
  }, [])

  if (myRole && myRole === 'Team Member') return (
    <AppShell title="All Tasks">
      <div style={{ background: '#2d0a0a', color: '#f87171', padding: '10px 14px', borderRadius: 6, fontSize: 12 }}>
        Access denied — Managers and Admins only.
      </div>
    </AppShell>
  )

  const canDelete = myRole === 'Admin' || myRole === 'Manager'

  const deleteTask = async (id: string, topic: string) => {
    if (!confirm(`Delete "${topic}"? This cannot be undone.`)) return
    await supabase.from('Subtasks').delete().eq('parent_task_id', id)
    await supabase.from('Tasks').delete().eq('id', id)
    setTasks(p => p.filter((t: any) => t.id !== id))
    setSubtasks(p => p.filter((s: any) => s.parent_task_id !== id))
  }

  // Apply filters
  let filtered = tasks
  if (fType     !== 'All') filtered = filtered.filter((t: any) => t.type === fType)
  if (fProject  !== 'All') filtered = filtered.filter((t: any) => t.project_name === fProject)
  if (fStatus   !== 'All') filtered = filtered.filter((t: any) => t.status === fStatus)
  if (fAssignee !== 'All') filtered = filtered.filter((t: any) =>
    getAssignees(t).some((a: any) => a.toLowerCase() === fAssignee.toLowerCase())
  )

  if (loading) return <AppShell title="All Tasks"><div style={{ padding: 40, color: '#6b7280', textAlign: 'center' }}>Loading…</div></AppShell>

  return (
    <AppShell title="All Tasks">
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={S.sel} value={fType} onChange={e => setFType(e.target.value)}>
          <option value="All">All Types</option>
          {TASK_TYPES.map((t: any) => <option key={t}>{t}</option>)}
        </select>
        <select style={S.sel} value={fProject} onChange={e => setFProject(e.target.value)}>
          <option value="All">All Projects</option>
          {projects.map((p: any) => <option key={p}>{p}</option>)}
        </select>
        <select style={S.sel} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="All">All Status</option>
          {STATUSES.map((s: any) => <option key={s}>{s}</option>)}
        </select>
        <select style={S.sel} value={fAssignee} onChange={e => setFAssignee(e.target.value)}>
          <option value="All">All Assignees</option>
          {users.map((u: any) => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4b5563' }}>{filtered.length} tasks</div>
        <Link href="/tasks/create" style={S.newBtn}>+ Create Task</Link>
      </div>

      {filtered.length === 0 ? (
        <div style={S.empty}><div style={{ fontSize: 32 }}>📋</div><div style={{ marginTop: 8 }}>No tasks found.</div></div>
      ) : (
        <div style={S.tableWrap}>
          {/* Header */}
          <div style={S.headerRow}>
            <div style={{ ...S.col, flex: 3 }}>Task Title</div>
            <div style={{ ...S.col, flex: 2 }}>Project</div>
            <div style={{ ...S.col, flex: 1 }}>Type</div>
            <div style={{ ...S.col, flex: 1.2 }}>Start</div>
            <div style={{ ...S.col, flex: 1.2 }}>End</div>
            <div style={{ ...S.col, flex: 2 }}>Assignees</div>
            <div style={{ ...S.col, flex: 1.5 }}>Status</div>
            {canDelete && <div style={{ ...S.col, width: 60 }}></div>}
          </div>

          {filtered.map((t: any) => {
            const subs = subtasks.filter((s: any) => String(s.parent_task_id) === String(t.id))
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const over  = t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today
            const assignees = getAssignees(t)

            return (
              <div key={t.id}
                style={{ ...S.taskRow, ...(over ? S.overdueRow : {}) }}
                onClick={() => router.push(`/tasks/${t.id}`)}>
                <div style={{ ...S.cell, flex: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[t.status] || '#6b7280', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={S.taskName}>{t.topic}</div>
                    {subs.length > 0 && (
                      <div style={{ fontSize: 10, color: '#4b5563' }}>
                        {subs.filter((s: any) => s.status === 'Completed').length}/{subs.length} subtasks
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ ...S.cell, flex: 2, color: '#6b7280', fontSize: 11 }}>{t.project_name || '—'}</div>
                <div style={{ ...S.cell, flex: 1, fontSize: 11 }}>
                  {t.type !== 'One-time'
                    ? <span style={{ background: '#3d2400', color: '#f59e0b', fontSize: 9, padding: '1px 6px', borderRadius: 8 }}>↻ {t.type}</span>
                    : <span style={{ color: '#4b5563', fontSize: 11 }}>One-time</span>
                  }
                </div>
                <div style={{ ...S.cell, flex: 1.2, color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>{t.start_date || '—'}</div>
                <div style={{ ...S.cell, flex: 1.2, color: over ? '#f87171' : '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>
                  {over && '⚠ '}{t.end_date || '—'}
                </div>
                <div style={{ ...S.cell, flex: 2, color: '#6b7280', fontSize: 11 }}>{assignees.join(', ') || '—'}</div>
                <div style={{ ...S.cell, flex: 1.5 }}><Pill status={t.status} /></div>
                {canDelete && (
                  <div style={{ width: 60, display: 'flex', justifyContent: 'flex-end' }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => deleteTask(t.id, t.topic)} style={S.delBtn}>🗑</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

const S: Record<string, React.CSSProperties> = {
  sel:        { padding: '5px 9px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, background: '#1a1a1a', fontSize: 11.5, color: '#9ca3af', fontFamily: 'inherit', cursor: 'pointer' },
  newBtn:     { background: '#15803d', color: '#bbf7d0', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  empty:      { textAlign: 'center', padding: '4rem 0', color: '#6b7280', fontSize: 13 },
  tableWrap:  { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' },
  headerRow:  { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  col:        { fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151' },
  taskRow:    { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.12s' },
  overdueRow: { background: 'rgba(239,68,68,0.04)', borderLeft: '2px solid rgba(239,68,68,0.35)' },
  cell:       { display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' },
  taskName:   { fontSize: 12.5, fontWeight: 500, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  delBtn:     { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13, padding: '3px 5px' },
}
