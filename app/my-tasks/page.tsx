'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STATUS_DOT: Record<string, string> = {
  'Not Started': 'var(--txt3)',
  'In Progress': '#3b82f6',
  'On-Hold':     '#f59e0b',
  'Completed':   '#22c55e',
}
const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  'Not Started': { bg: 'var(--pill-ns-bg)', color: 'var(--pill-ns-txt)' },
  'In Progress': { bg: 'var(--blue2)', color: 'var(--blue)' },
  'On-Hold':     { bg: 'var(--amber2)', color: 'var(--amber)' },
  'Completed':   { bg: 'var(--accent2)', color: 'var(--accent)' },
}
const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const

// ── helpers ──────────────────────────────────────────────────────────
function Pill({ status }: { status: string }) {
  const s = STATUS_PILL[status] || STATUS_PILL['Not Started']
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
    }}>{status}</span>
  )
}

function Dot({ status }: { status: string }) {
  return (
    <div style={{
      width: 7, height: 7, borderRadius: '50%',
      background: STATUS_DOT[status] || 'var(--txt3)',
      flexShrink: 0, marginTop: 1,
    }} />
  )
}

function assigneesFromRow(row: any): string[] {
  if (Array.isArray(row.assignees) && row.assignees.length > 0) return row.assignees
  if (row.owner) return [row.owner]
  return []
}

// ── component ─────────────────────────────────────────────────────────
export default function MyTasks() {
  const router = useRouter()
  const [me,       setMe]       = useState<any>(null)
  const [tasks,    setTasks]    = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }

      const { data: u } = await supabase
        .from('Users').select('*').eq('id', session.user.id).single()

      const meObj = { ...u, email: session.user.email }
      setMe(meObj)

      const [{ data: tData }, { data: sData }] = await Promise.all([
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
      ])

      const allT = tData || []
      const allS = sData || []

      const myName  = (u?.full_name || '').trim()
      const myEmail = (session.user.email || '').trim().toLowerCase()

      // exact comma-split match against assignees[] OR legacy owner field
      const matchesMe = (row: any): boolean => {
        const assignees: string[] = assigneesFromRow(row)
        return assignees.some((a: any) => {
          const al = a.toLowerCase().trim()
          return al === myName.toLowerCase() || al === myEmail
        })
      }

      const myTaskIds  = new Set(allT.filter(matchesMe).map((t: any) => t.id))
      const subTaskIds = new Set(allS.filter(matchesMe).map((s: any) => s.parent_task_id))
      const allMyIds   = new Set([...myTaskIds, ...subTaskIds])

      setTasks(allT.filter((t: any) => allMyIds.has(t.id)))
      setSubtasks(allS)
      setLoading(false)
    }
    load()
  }, [])

  // update subtask status inline
  const updateSubStatus = async (subId: string | number, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('Subtasks').update({ status: newStatus }).eq('id', subId)
    setSubtasks(prev => prev.map((s: any) => String(s.id) === String(subId) ? { ...s, status: newStatus } : s))
  }

  const toggle = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isOverdue = (t: any) =>
    t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today

  if (loading) return (
    <AppShell title="My Tasks">
      <div style={styles.loading}>Loading your tasks...</div>
    </AppShell>
  )

  return (
    <AppShell title="My Tasks">
      {tasks.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>☑</div>
          <div>No tasks assigned to you.</div>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          {/* Header */}
          <div style={{ ...styles.headerRow }}>
            <div style={{ ...styles.col, flex: 3 }}>Task Title</div>
            <div style={{ ...styles.col, flex: 2 }}>Project</div>
            <div style={{ ...styles.col, flex: 1.2 }}>Start Date</div>
            <div style={{ ...styles.col, flex: 1.2 }}>End Date</div>
            <div style={{ ...styles.col, flex: 2 }}>Assignee</div>
            <div style={{ ...styles.col, flex: 1.5 }}>Status</div>
          </div>

          {tasks.map(task => {
            const subs  = subtasks.filter((s: any) => String(s.parent_task_id) === String(task.id))
            const open  = expanded[task.id]
            const over  = isOverdue(task)
            const assignees = assigneesFromRow(task)

            return (
              <div key={task.id}>
                {/* Main task row */}
                <div
                  style={{
                    ...styles.taskRow,
                    ...(over ? styles.overdueRow : {}),
                  }}
                  onClick={() => router.push(`/tasks/${task.id}`)}
                >
                  {/* expand chevron */}
                  <div
                    style={styles.chevronWrap}
                    onClick={e => { e.stopPropagation(); if (subs.length) toggle(task.id) }}
                  >
                    {subs.length > 0 && (
                      <svg
                        width="10" height="10" viewBox="0 0 10 10" fill="none"
                        style={{
                          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.18s',
                        }}
                      >
                        <path d="M3 2l4 3-4 3" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  <Dot status={task.status} />

                  <div style={{ ...styles.cell, flex: 3 }}>
                    <span style={styles.taskName}>{task.topic}</span>
                    {subs.length > 0 && (
                      <span style={styles.subCount}>{subs.length} subtask{subs.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <div style={{ ...styles.cell, flex: 2, color: 'var(--txt3)' }}>{task.project_name || '—'}</div>
                  <div style={{ ...styles.cell, flex: 1.2, color: 'var(--txt3)', fontFamily: 'monospace', fontSize: 11 }}>{task.start_date || '—'}</div>
                  <div style={{ ...styles.cell, flex: 1.2, color: over ? '#f87171' : 'var(--txt3)', fontFamily: 'monospace', fontSize: 11 }}>
                    {over && <span style={{ marginRight: 3 }}>⚠</span>}
                    {task.end_date || '—'}
                  </div>
                  <div style={{ ...styles.cell, flex: 2, color: 'var(--txt3)', fontSize: 11 }}>
                    {assignees.join(', ') || '—'}
                  </div>
                  <div style={{ ...styles.cell, flex: 1.5 }}>
                    <Pill status={task.status} />
                  </div>
                </div>

                {/* Subtask rows */}
                {subs.length > 0 && open && (
                  <div style={styles.subtaskBlock}>
                    {/* subtask header */}
                    <div style={styles.subHeader}>
                      <div style={{ width: 24 }} />
                      <div style={{ flex: 3, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subtask</div>
                      <div style={{ flex: 1.2, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</div>
                      <div style={{ flex: 1.2, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</div>
                      <div style={{ flex: 2, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assignee</div>
                      <div style={{ flex: 1.5, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</div>
                    </div>
                    {subs.map(sub => {
                      const subAssignees = assigneesFromRow(sub)
                      return (
                        <div
                          key={sub.id}
                          style={styles.subRow}
                          onClick={() => router.push(`/tasks/${task.id}`)}
                        >
                          <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: 'var(--txt3)', fontSize: 11 }}>↳</span>
                          </div>
                          <div style={{ flex: 3, fontSize: 12, color: 'var(--txt2)' }}>{sub.topic}</div>
                          <div style={{ flex: 1.2, fontSize: 11, color: 'var(--txt3)', fontFamily: 'monospace' }}>{sub.start_date || '—'}</div>
                          <div style={{ flex: 1.2, fontSize: 11, color: 'var(--txt3)', fontFamily: 'monospace' }}>{sub.end_date || '—'}</div>
                          <div style={{ flex: 2, fontSize: 11, color: 'var(--txt3)' }}>{subAssignees.join(', ') || '—'}</div>
                          <div style={{ flex: 1.5 }} onClick={e => e.stopPropagation()}>
                            <select
                              value={sub.status}
                              onChange={e => updateSubStatus(sub.id, e.target.value, e as any)}
                              style={styles.statusSelect}
                            >
                              {STATUSES.map((s: any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      )
                    })}
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

// ── styles ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  loading: {
    padding: 40, color: 'var(--txt3)', textAlign: 'center', fontSize: 13,
  },
  empty: {
    textAlign: 'center', padding: '4rem 0', color: 'var(--txt3)', fontSize: 13,
  },
  tableWrap: {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-brd)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px',
    background: 'var(--input-bg)',
    borderBottom: '1px solid var(--brd)',
  },
  col: {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', color: 'var(--txt3)',
  },
  taskRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 16px',
    borderBottom: '1px solid var(--brd)',
    cursor: 'pointer',
    transition: 'background 0.14s',
  } as React.CSSProperties,
  overdueRow: {
    background: 'rgba(239,68,68,0.05)',
    borderLeft: '2px solid rgba(239,68,68,0.4)',
  },
  chevronWrap: {
    width: 16, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, cursor: 'pointer',
  },
  cell: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--txt)', overflow: 'hidden',
  },
  taskName: {
    fontWeight: 500, fontSize: 13, color: 'var(--txt)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  subCount: {
    fontSize: 10, color: 'var(--txt3)', background: 'var(--bg3)',
    padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0,
  },
  subtaskBlock: {
    background: 'var(--bg)',
    borderBottom: '1px solid var(--brd)',
  },
  subHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 16px 4px 16px',
  },
  subRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px',
    borderTop: '1px solid rgba(255,255,255,0.03)',
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  statusSelect: {
    background: '#1f2937', color: 'var(--txt3)',
    border: '1px solid var(--input-brd)',
    borderRadius: 6, padding: '3px 6px', fontSize: 11,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  },
}
