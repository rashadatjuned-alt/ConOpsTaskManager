'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, LayoutList, Columns, X, Calendar, Clock, Search, Plus, ChevronsUpDown, Users, Filter } from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

// ─── INTERACTIVE STATUS PICKER ─────────────────────────────────────────────
const StatusPicker = ({ current, onUpdate }: { current: string, onUpdate: (val: string) => void }) => {
  const getColor = (s: string) => {
    if (s === 'Completed') return { bg: 'rgba(99, 153, 34, 0.1)', fg: '#639922' }
    if (s === 'In Progress') return { bg: 'rgba(55, 138, 221, 0.1)', fg: '#378ADD' }
    if (s === 'On-Hold') return { bg: 'rgba(239, 159, 39, 0.1)', fg: '#EF9F27' }
    return { bg: 'rgba(170, 170, 170, 0.1)', fg: '#aaa' }
  }
  const colors = getColor(current)

  return (
    <select 
      value={current} 
      onChange={(e) => onUpdate(e.target.value)}
      style={{
        background: colors.bg, color: colors.fg, border: 'none', fontSize: '10px',
        fontWeight: 700, padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase',
        outline: 'none', cursor: 'pointer', appearance: 'none', width: '90px', textAlign: 'center'
      }}
    >
      {STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--bg)', color: 'var(--txt)' }}>{s}</option>)}
    </select>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AllTasks() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [myRole, setMyRole] = useState('')
  const [pf, setPf] = useState('All') // Project Filter
  const [af, setAf] = useState('All') // Assignee Filter
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
    setMyRole(u?.role || '')

    const [t, s, p, us] = await Promise.all([
      supabase.from('Tasks').select('*').order('end_date'),
      supabase.from('Subtasks').select('*'),
      supabase.from('Projects').select('*').order('name'),
      supabase.from('Users').select('id,full_name,email,role'),
    ])
    setTasks(t.data || []); setSubtasks(s.data || []); setProjects(p.data || []); setAllUsers(us.data || []);
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleStatusChange = async (id: string, newStatus: string, isSubtask: boolean) => {
    const table = isSubtask ? 'Subtasks' : 'Tasks'
    const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id)
    if (!error) {
      if (isSubtask) setSubtasks(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
      else setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesProject = pf === 'All' || t.project_name === pf
      const matchesAssignee = af === 'All' || (t.owner || '').includes(af) || (t.assignees || []).includes(af)
      return matchesProject && matchesAssignee
    })
  }, [tasks, pf, af])

  const groupedTasks = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    filteredTasks.forEach(t => {
      const p = t.project_name || 'Unassigned'
      grouped[p] = (grouped[p] || []).concat(t)
    })
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredTasks])

  const toggleAll = () => {
    const nextValue = !allExpanded
    setAllExpanded(nextValue)
    const newState: Record<string, boolean> = {}
    groupedTasks.forEach(([proj]) => { newState[proj] = !nextValue })
    setCollapsed(newState)
  }

  if (myRole === 'Team Member') return <AppShell title="All Tasks"><div className="alert alert-error">Access denied — Managers and Admins only.</div></AppShell>
  if (loading) return <AppShell title="All Tasks">Loading...</AppShell>

  return (
    <AppShell title="All Tasks Oversight">
      {/* ─── Toolbar ─── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 8, padding: '4px 10px' }}>
          <Filter size={14} color="var(--txt3)" />
          <select style={{ background: 'transparent', border: 'none', color: 'var(--txt)', fontSize: 13, outline: 'none' }} value={pf} onChange={e => setPf(e.target.value)}>
            <option value="All">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 8, padding: '4px 10px' }}>
          <Users size={14} color="var(--txt3)" />
          <select style={{ background: 'transparent', border: 'none', color: 'var(--txt)', fontSize: 13, outline: 'none' }} value={af} onChange={e => setAf(e.target.value)}>
            <option value="All">All Assignees</option>
            {allUsers.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
          </select>
        </div>

        <button className="tv-btn" onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
          <ChevronsUpDown size={14} />
          <span style={{ fontSize: 12 }}>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className={view === 'list' ? 'btn btn-primary' : 'btn'} onClick={() => setView('list')}><LayoutList size={16} /></button>
          <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')}><Columns size={16} /></button>
          <Link href="/tasks/create" className="btn btn-primary" style={{ marginLeft: 8 }}><Plus size={14} /> Create Task</Link>
        </div>
      </div>

      {/* ─── List View ─── */}
      {view === 'list' && groupedTasks.map(([proj, pTasks]) => (
        <div key={proj} style={{ border: '1px solid var(--brd)', borderRadius: 12, background: 'var(--bg)', overflow: 'hidden', marginBottom: 16 }}>
          <div 
            style={{ padding: '10px 16px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => setCollapsed(prev => ({ ...prev, [proj]: !prev[proj] }))}
          >
            <ChevronRight size={14} style={{ transform: collapsed[proj] ? '' : 'rotate(90deg)', transition: '0.2s', color: 'var(--txt3)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#378ADD' }} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{proj}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>({pTasks.length} tasks)</div>
          </div>

          {!collapsed[proj] && pTasks.map(t => {
            const tSubs = subtasks.filter(s => s.parent_task_id === t.id)
            const tPct = tSubs.length ? Math.round((tSubs.filter(s => s.status === 'Completed').length / tSubs.length) * 100) : (t.status === 'Completed' ? 100 : 0)
            
            return (
              <div key={t.id} style={{ borderTop: '1px solid var(--brd)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 10px 40px', gap: 12 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <StatusDot status={t.status} />
                    <div style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                    <div style={{ display: 'flex' }}>
                      {[t.owner, ...(t.assignees || [])].filter(Boolean).slice(0, 3).map((name, i) => (
                        <div key={i} title={name} style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 8, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--bg)', marginLeft: i > 0 ? -6 : 0 }}>{ini(name)}</div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <div style={{ width: 195, fontSize: 11, color: 'var(--txt3)', textAlign: 'right', paddingRight: 24, whiteSpace: 'nowrap' }}>
                      {t.start_date || '—'} <span style={{ color: 'var(--brd)', margin: '0 4px' }}>→</span> {t.end_date || '—'}
                    </div>
                    <div style={{ width: 100, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 20 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--brd)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${tPct}%`, height: '100%', background: 'var(--txt3)' }} /></div>
                      <span style={{ fontSize: 10, width: 25, color: 'var(--txt3)' }}>{tPct}%</span>
                    </div>
                    <div style={{ width: 95 }}><StatusPicker current={t.status} onUpdate={(val) => handleStatusChange(t.id, val, false)} /></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* ─── Kanban View ─── */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
          {STATUSES.map(status => {
            const group = filteredTasks.filter(t => t.status === status)
            return (
              <div key={status} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 12, minHeight: '70vh' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StatusDot status={status} /><span style={{ fontSize: 13, fontWeight: 700 }}>{status}</span></div>
                  <span style={{ fontSize: 11, background: 'var(--brd)', padding: '2px 8px', borderRadius: 10, color: 'var(--txt3)', fontWeight: 600 }}>{group.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {group.map(t => (
                    <div key={t.id} onClick={() => router.push(`/tasks/${t.id}`)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 8, padding: 12, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{t.project_name}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 10 }}>{t.topic}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--txt3)' }}><Calendar size={11} style={{ marginRight: 4 }} /> {t.end_date}</div>
                        <div style={{ display: 'flex' }}>
                          {[t.owner, ...(t.assignees || [])].filter(Boolean).slice(0, 2).map((name, i) => (
                            <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', fontSize: 7, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--bg)', marginLeft: i > 0 ? -4 : 0 }}>{ini(name)}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
