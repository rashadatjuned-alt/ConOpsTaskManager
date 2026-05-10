'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAssignees } from '@/lib/projectUtils'

const STATUS_DOT: Record<string, string> = {
  'Not Started': 'var(--txt3)', 'In Progress': '#3b82f6',
  'On-Hold': '#f59e0b', 'Completed': '#22c55e',
}
const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  'Not Started': { bg: 'var(--pill-ns-bg)', color: 'var(--pill-ns-txt)' },
  'In Progress': { bg: 'var(--blue2)', color: 'var(--blue)' },
  'On-Hold':     { bg: 'var(--amber2)', color: 'var(--amber)' },
  'Completed':   { bg: 'var(--accent2)', color: 'var(--accent)' },
}
function Pill({ status }: { status: string }) {
  const s = STATUS_PILL[status] || STATUS_PILL['Not Started']
  return <span style={{ background: s.bg, color: s.color, fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500, flexShrink: 0 }}>{status}</span>
}

export default function AllProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks,    setTasks]    = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [myRole,   setMyRole]   = useState('')
  const [open,     setOpen]     = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || 'Team Member')
      const [{ data: p }, { data: t }, { data: s }] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
      ])
      setProjects(p || [])
      setTasks(t || [])
      setSubtasks(s || [])
      setLoading(false)
    }
    load()
  }, [])

  if (myRole && myRole === 'Team Member') return (
    <AppShell title="All Projects">
      <div style={{ background: 'var(--red2)', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: 12 }}>
        Access denied — Managers and Admins only.
      </div>
    </AppShell>
  )

  const canDelete = myRole === 'Admin' || myRole === 'Manager'
  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id] }))

  const deleteProject = async (proj: any) => {
    if (!confirm(`Delete "${proj.name}"? Tasks in this project will remain but lose their project association.`)) return
    await supabase.from('Projects').delete().eq('id', proj.id)
    setProjects(p => p.filter((x: any) => x.id !== proj.id))
  }

  const deleteTask = async (taskId: string, topic: string) => {
    if (!confirm(`Delete task "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('parent_task_id', taskId)
    await supabase.from('Tasks').delete().eq('id', taskId)
    setTasks(p => p.filter((t: any) => t.id !== taskId))
    setSubtasks(p => p.filter((s: any) => s.parent_task_id !== taskId))
  }

  if (loading) return <AppShell title="All Projects"><div style={{ padding: 40, color: 'var(--txt3)', textAlign: 'center' }}>Loading…</div></AppShell>

  return (
    <AppShell title="All Projects">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{projects.length} project{projects.length !== 1 ? 's' : ''}</div>
        <Link href="/projects/create" style={S.newBtn}>+ New Project</Link>
      </div>

      {projects.length === 0 && (
        <div style={S.empty}><div style={{ fontSize: 32 }}>📁</div><div style={{ marginTop: 8 }}>No projects yet.</div></div>
      )}

      {projects.map(proj => {
        const pt   = tasks.filter((t: any) => t.project_name === proj.name)
        const done = pt.filter((t: any) => t.status === 'Completed').length
        const pct  = pt.length ? Math.round(done / pt.length * 100) : 0
        const isOpen = open[proj.id]

        return (
          <div key={proj.id} style={S.projCard}>
            <div style={S.projHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}
                onClick={() => toggle(proj.id)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: 'transform 0.18s', flexShrink: 0 }}>
                  <path d="M4 2.5l4 3.5-4 3.5" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: proj.color_code || '#3b82f6', flexShrink: 0 }} />
                <div style={S.projName}>{proj.name}</div>
                {proj.description && <div style={S.projDesc}>{proj.description}</div>}
                <div style={S.projMeta}>{pt.length} tasks</div>
                <div style={S.projPct}>{pct}%</div>
                <div style={{ width: 60, height: 3, background: 'var(--brd2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: proj.color_code || '#3b82f6', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Link href="/tasks/create" style={S.iconBtn}>+ Task</Link>
                {(myRole === 'Manager' || myRole === 'Admin') && (
                  <Link href={`/projects/${proj.id}`} style={{ ...S.iconBtn, color: 'var(--blue)', borderColor: 'rgba(26,115,232,0.2)', background: 'var(--blue2)' }}>✏ Edit</Link>
                )}
                {canDelete && (
                  <button onClick={() => deleteProject(proj)} style={{ ...S.iconBtn, color: 'var(--red)', borderColor: 'rgba(197,34,31,0.2)' }}>🗑</button>
                )}
              </div>
            </div>

            {isOpen && (
              <div style={S.taskList}>
                <div style={S.divider} />
                {pt.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '6px 0' }}>No tasks yet.</div>
                ) : pt.map((t: any) => {
                  const subs = subtasks.filter((s: any) => String(s.parent_task_id) === String(t.id))
                  const doneS = subs.filter((s: any) => s.status === 'Completed').length
                  return (
                    <div key={t.id} style={S.taskRow}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[t.status] || 'var(--txt3)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>
                        <div style={S.taskName}>{t.topic}</div>
                        <div style={S.taskMeta}>
                          {t.end_date && <span>{t.end_date}</span>}
                          {getAssignees(t).length > 0 && <span>{getAssignees(t).join(', ')}</span>}
                          {t.type !== 'One-time' && <span>↻ {t.type}</span>}
                        </div>
                      </div>
                      {subs.length > 0 && <span style={S.subBadge}>{doneS}/{subs.length}</span>}
                      <Pill status={t.status} />
                      <button onClick={() => router.push(`/tasks/${t.id}`)} style={S.editBtn}>Edit</button>
                      {canDelete && (
                        <button onClick={() => deleteTask(t.id, t.topic)} style={S.delBtn}>🗑</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </AppShell>
  )
}

const S: Record<string, React.CSSProperties> = {
  empty:      { textAlign: 'center', padding: '4rem 0', color: 'var(--txt3)', fontSize: 13 },
  newBtn:     { background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  projCard:   { background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
  projHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--input-bg)' },
  projName:   { fontSize: 13, fontWeight: 600, color: 'var(--txt)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  projDesc:   { fontSize: 11, color: 'var(--txt3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  projMeta:   { fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' },
  projPct:    { fontSize: 11, fontWeight: 600, color: 'var(--txt3)', fontFamily: 'monospace' },
  taskList:   { padding: '0 14px 12px' },
  divider:    { height: 1, background: 'var(--brd)', marginBottom: 8 },
  taskRow:    { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, marginBottom: 4, border: '1px solid var(--row-brd)', transition: 'background 0.12s' },
  taskName:   { fontSize: 12.5, fontWeight: 500, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  taskMeta:   { fontSize: 11, color: 'var(--txt3)', display: 'flex', gap: 8, marginTop: 2 },
  subBadge:   { fontSize: 10, color: 'var(--txt3)', background: 'var(--input-bg)', padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 },
  iconBtn:    { background: 'var(--brd)', color: 'var(--txt3)', border: '1px solid var(--brd2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontFamily: 'inherit' },
  editBtn:    { background: 'var(--brd)', color: 'var(--txt3)', border: '1px solid var(--brd2)', borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', flexShrink: 0 },
  delBtn:     { background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', flexShrink: 0 },
}
