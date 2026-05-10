'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
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

function Pill({ status }: { status: string }) {
  const s = STATUS_PILL[status] || STATUS_PILL['Not Started']
  return <span style={{ background: s.bg, color: s.color, fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500, flexShrink: 0 }}>{status}</span>
}

export default function MyProjects() {
  const router = useRouter()
  const [me,       setMe]       = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [tasks,    setTasks]    = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [open,     setOpen]     = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
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

  const isMe = (row: any) => {
    const assignees = getAssignees(row)
    const name  = (me?.full_name || '').toLowerCase().trim()
    const email = (me?.email || '').toLowerCase().trim()
    return assignees.some((a: any) => {
      const al = a.toLowerCase().trim()
      return al === name || al === email
    })
  }

  const myProjects = projects.filter(proj => {
    if (proj.members?.includes(me?.id)) return true
    if (tasks.some((t: any) => t.project_name === proj.name && isMe(t))) return true
    const projTaskIds = tasks.filter((t: any) => t.project_name === proj.name).map((t: any) => t.id)
    return subtasks.some((s: any) => projTaskIds.includes(s.parent_task_id) && isMe(s))
  })

  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id] }))

  if (loading) return <AppShell title="My Projects"><div style={S.loading}>Loading…</div></AppShell>

  return (
    <AppShell title="My Projects">
      <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 12 }}>
        {myProjects.length} project{myProjects.length !== 1 ? 's' : ''}
      </div>

      {myProjects.length === 0 && (
        <div style={S.empty}><div style={{ fontSize: 32 }}>📁</div><div style={{ marginTop: 8 }}>No projects assigned to you.</div></div>
      )}

      {myProjects.map(proj => {
        const pt   = tasks.filter((t: any) => t.project_name === proj.name)
        const done = pt.filter((t: any) => t.status === 'Completed').length
        const pct  = pt.length ? Math.round(done / pt.length * 100) : 0
        const isOpen = open[proj.id]

        return (
          <div key={proj.id} style={S.projCard}>
            {/* Project header */}
            <div style={S.projHeader} onClick={() => toggle(proj.id)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: 'transform 0.18s', flexShrink: 0 }}>
                <path d="M4 2.5l4 3.5-4 3.5" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: proj.color_code || '#3b82f6', flexShrink: 0 }} />
              <div style={S.projName}>{proj.name}</div>
              {proj.description && (
                <div style={S.projDesc}>{proj.description}</div>
              )}
              <div style={S.projMeta}>{pt.length} task{pt.length !== 1 ? 's' : ''}</div>
              <div style={S.projPct}>{pct}%</div>
              <div style={{ width: 60, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: proj.color_code || '#3b82f6', borderRadius: 2, transition: 'width 0.4s' }} />
              </div>
            </div>

            {/* Tasks */}
            {isOpen && (
              <div style={S.taskList}>
                <div style={S.divider} />
                {pt.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#4b5563', padding: '8px 0' }}>No tasks yet.</div>
                ) : pt.map((t: any) => {
                  const subs = subtasks.filter((s: any) => String(s.parent_task_id) === String(t.id))
                  const doneS = subs.filter((s: any) => s.status === 'Completed').length
                  return (
                    <div key={t.id} style={S.taskRow} onClick={() => router.push(`/tasks/${t.id}`)}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[t.status] || '#6b7280', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.taskName}>{t.topic}</div>
                        <div style={S.taskMeta}>
                          {t.end_date && <span>{t.end_date}</span>}
                          {getAssignees(t).length > 0 && <span>{getAssignees(t).join(', ')}</span>}
                          {t.type !== 'One-time' && <span>↻ {t.type}</span>}
                        </div>
                      </div>
                      {subs.length > 0 && (
                        <span style={S.subBadge}>{doneS}/{subs.length} subtasks</span>
                      )}
                      <Pill status={t.status} />
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
  loading:    { padding: 40, color: '#6b7280', textAlign: 'center' },
  empty:      { textAlign: 'center', padding: '4rem 0', color: '#6b7280', fontSize: 13 },
  projCard:   { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
  projHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', transition: 'background 0.14s' },
  projName:   { fontSize: 13, fontWeight: 600, color: '#f3f4f6', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  projDesc:   { fontSize: 11, color: '#4b5563', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  projMeta:   { fontSize: 11, color: '#4b5563', whiteSpace: 'nowrap' },
  projPct:    { fontSize: 11, fontWeight: 600, color: '#6b7280', fontFamily: 'monospace', whiteSpace: 'nowrap' },
  taskList:   { padding: '0 16px 12px' },
  divider:    { height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 8 },
  taskRow:    { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.12s', marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' },
  taskName:   { fontSize: 12.5, fontWeight: 500, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  taskMeta:   { fontSize: 11, color: '#4b5563', display: 'flex', gap: 8, marginTop: 2 },
  subBadge:   { fontSize: 10, color: '#4b5563', background: '#111', padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 },
}
