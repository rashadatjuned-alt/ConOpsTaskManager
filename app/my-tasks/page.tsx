'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { 
  ChevronRight, LayoutList, Columns, Plus, Filter, ChevronsUpDown
} from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']
const PROJECT_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#84CC16', '#EF4444', '#4D7C0F', '#B45309', '#0284C7', '#2DD4BF', '#EC4899']

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '?')[0].toUpperCase()
}

const StatusPicker = ({ current, onUpdate }: { current: string, onUpdate: (val: string) => void }) => {
  const getColor = (s: string) => {
    if (s === 'Completed') return { bg: 'rgba(99, 153, 34, 0.1)', fg: '#639922' }
    if (s === 'In Progress') return { bg: 'rgba(55, 138, 221, 0.1)', fg: '#378ADD' }
    if (s === 'On-Hold') return { bg: 'rgba(239, 159, 39, 0.1)', fg: '#EF9F27' }
    return { bg: 'rgba(170, 170, 170, 0.1)', fg: '#aaa' }
  }
  const colors = getColor(current)
  return (
    <select value={current} onChange={(e) => onUpdate(e.target.value)} onClick={e => e.stopPropagation()} style={{ background: colors.bg, color: colors.fg, border: 'none', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase', outline: 'none', cursor: 'pointer', appearance: 'none', width: '82px', textAlign: 'center' }}>
      {STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--bg)', color: 'var(--txt)' }}>{s}</option>)}
    </select>
  )
}

function KanbanBoard({ mode, tasks, allTasks, subtasks, allUsers, onStatusChange }: any) {
  const router = useRouter()
  const itemsToRender = mode === 'tasks' ? tasks : subtasks

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {STATUSES.map(status => {
        const colItems = itemsToRender.filter((item: any) => item.status === status)
        return (
          <div key={status} style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '10px', minHeight: '80vh', border: '1px solid var(--brd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><StatusDot status={status} /><span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>{status}</span></div>
              <span style={{ fontSize: '10px', background: 'var(--bg)', padding: '1px 6px', borderRadius: '6px', color: 'var(--txt3)', fontWeight: 700 }}>{colItems.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {colItems.map((item: any) => {
                const members = (item.task_assignees || item.subtask_assignees || []).map((ta: any) => allUsers.find((u: any) => u.id === ta.user_id)).filter(Boolean)

                if (mode === 'tasks') {
                  const relatedSubs = subtasks.filter((st: any) => String(st.parent_task_id) === String(item.id))
                  const doneSubs = relatedSubs.filter((st: any) => st.status === 'Completed').length
                  const subPct = relatedSubs.length ? Math.round((doneSubs / relatedSubs.length) * 100) : 0

                  return (
                    <div key={item.id} onClick={() => router.push(`/tasks/${item.id}`)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '10px', padding: '10px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{item.project_name}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>{item.topic}</div>
                      {relatedSubs.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${subPct}%`, height: '100%', background: '#3B82F6' }} />
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--txt3)', marginTop: 4, fontWeight: 700 }}>{doneSubs}/{relatedSubs.length} Subtasks</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {members.slice(0, 3).map((u: any, i: number) => (
                            <div key={u.id} title={u.full_name} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-4px' : '0' }}>{ini(u.full_name)}</div>
                          ))}
                        </div>
                        <StatusPicker current={item.status} onUpdate={(val) => onStatusChange(item.id, val, false)} />
                      </div>
                    </div>
                  )
                }

                const parentTask = allTasks.find((t: any) => String(t.id) === String(item.parent_task_id))
                return (
                  <div key={item.id} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '10px', padding: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                      {parentTask?.project_name || 'Project'} • {parentTask?.topic || 'Task'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>{item.topic}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {members.length > 0 ? members.slice(0, 3).map((u: any, i: number) => (
                          <div key={u.id} title={u.full_name} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-4px' : '0' }}>{ini(u.full_name)}</div>
                        )) : <span style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 600 }}>Unassigned</span>}
                      </div>
                      <StatusPicker current={item.status} onUpdate={(val) => onStatusChange(item.id, val, true)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function MyTasks() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})
  
  const [pf, setPf] = useState('All')
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [kanbanMode, setKanbanMode] = useState<'tasks' | 'subtasks'>('tasks')
  const [allExpanded, setAllExpanded] = useState(true)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const myId = session.user.id

      // Load master list models simultaneously
      const [pRes, tRes, sRes, uRes, taRes, saRes] = await Promise.all([
        supabase.from('Projects').select('*').order('name'),
        supabase.from('Tasks').select('*'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Users').select('id,full_name,role'),
        supabase.from('task_assignees').select('*'),
        supabase.from('subtask_assignees').select('*')
      ])

      const uList = uRes.data || []
      const taList = taRes.data || []
      const saList = saRes.data || []

      // Stitch mappings and filter out tasks/subtasks only allocated to my user ID
      const myTaskIds = taList.filter(ta => ta.user_id === myId).map(ta => ta.task_id)
      const mySubtaskIds = saList.filter(sa => sa.user_id === myId).map(sa => sa.subtask_id)

      const hydratedTasks = (tRes.data || []).map(task => ({
        ...task,
        task_assignees: taList.filter(ta => ta.task_id === task.id)
      })).filter(t => myTaskIds.includes(t.id))

      const hydratedSubtasks = (sRes.data || []).map(sub => ({
        ...sub,
        subtask_assignees: saList.filter(sa => sa.subtask_id === sub.id)
      })).filter(s => mySubtaskIds.includes(s.id) || myTaskIds.includes(s.parent_task_id))

      setProjects(pRes.data || [])
      setTasks(hydratedTasks)
      setSubtasks(hydratedSubtasks)
      setAllUsers(uList)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleStatusChange = async (id: string, newStatus: string, isSubtask = false) => {
    const table = isSubtask ? 'Subtasks' : 'Tasks'
    const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id)
    if (!error) {
      if (isSubtask) setSubtasks(p => p.map(s => s.id === id ? { ...s, status: newStatus } : s))
      else setTasks(p => p.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => pf === 'All' || t.project_name === pf)
  }, [tasks, pf])

  const filteredSubtasks = useMemo(() => {
    return subtasks.filter(st => {
      const parent = tasks.find(t => String(t.id) === String(st.parent_task_id))
      return pf === 'All' || parent?.project_name === pf
    })
  }, [subtasks, tasks, pf])

  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredTasks.forEach(t => {
      groups[t.project_name] = (groups[t.project_name] || []).concat(t)
    })
    return Object.entries(groups).sort()
  }, [filteredTasks])

  if (loading) return <AppShell title="My Tasks"><div style={{ padding: 40, textAlign: 'center' }}>Loading your task queue...</div></AppShell>

  return (
    <AppShell title="My Action Workspace">
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 10, padding: '6px 12px' }}>
          <Filter size={14} color="var(--txt3)" />
          <select value={pf} onChange={e => setPf(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--txt)', fontSize: 13, outline: 'none', fontWeight: 600, cursor: 'pointer' }}>
            <option value="All">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        {view === 'list' && (
          <button className="btn" onClick={() => setAllExpanded(!allExpanded)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--brd)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <ChevronsUpDown size={14} /> {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}

        {view === 'kanban' && (
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 8, padding: 3, border: '1px solid var(--brd)' }}>
            <button onClick={() => setKanbanMode('tasks')} style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: kanbanMode === 'tasks' ? 'var(--bg)' : 'transparent', color: kanbanMode === 'tasks' ? 'var(--txt)' : 'var(--txt3)' }}>Tasks</button>
            <button onClick={() => setKanbanMode('subtasks')} style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: kanbanMode === 'subtasks' ? 'var(--bg)' : 'transparent', color: kanbanMode === 'subtasks' ? 'var(--txt)' : 'var(--txt3)' }}>Subtasks</button>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <button className={`btn ${view === 'list' ? 'btn-primary' : ''}`} style={{ padding: 8, borderRadius: 10, cursor: 'pointer' }} onClick={() => setView('list')}><LayoutList size={16} /></button>
          <button className={`btn ${view === 'kanban' ? 'btn-primary' : ''}`} style={{ padding: 8, borderRadius: 10, cursor: 'pointer' }} onClick={() => setView('kanban')}><Columns size={16} /></button>
        </div>
      </div>

      {view === 'list' ? (
        groupedTasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', border: '1px dashed var(--brd)', borderRadius: 12 }}>No active assignments found matching this filter filter.</div>
        ) : (
          groupedTasks.map(([projName, pTasks]) => {
            const projectObj = projects.find(p => p.name === projName)
            const projectColor = projectObj?.color_code || PROJECT_COLORS[0]
            const isProjOpen = allExpanded && !collapsed[projName]

            return (
              <div key={projName} style={{ border: '1px solid var(--brd)', borderRadius: 14, background: 'var(--bg)', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '10px 16px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setCollapsed(p => ({ ...p, [projName]: !p[projName] }))}>
                  <ChevronRight size={14} style={{ transform: isProjOpen ? 'rotate(90deg)' : '', transition: '0.2s', color: 'var(--txt3)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: projectColor }} />
                  <div style={{ fontSize: 13, fontWeight: 700, flex: 1, color: 'var(--txt)' }}>{projName}</div>
                </div>

                {isProjOpen && pTasks.map(t => {
                  const taskAssignees = (t.task_assignees || []).map((ta: any) => allUsers.find((u: any) => u.id === ta.user_id)).filter(Boolean)
                  const relatedSubs = filteredSubtasks.filter(st => String(st.parent_task_id) === String(t.id))
                  const doneSubs = relatedSubs.filter(st => st.status === 'Completed').length
                  const subPct = relatedSubs.length ? Math.round((doneSubs / relatedSubs.length) * 100) : 0
                  const isTaskExpanded = expandedTasks[t.id]

                  return (
                    <div key={t.id} style={{ borderTop: '1px solid var(--brd)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 180px 120px 100px 110px', alignItems: 'center', padding: '10px 16px' }}>
                        <div style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={() => setExpandedTasks(p => ({ ...p, [t.id]: !p[t.id] }))}>
                          {relatedSubs.length > 0 ? <ChevronRight size={14} style={{ transform: isTaskExpanded ? 'rotate(90deg)' : '', transition: '0.2s', color: '#3B82F6' }} /> : <StatusDot status={t.status} />}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                          <span onClick={() => router.push(`/tasks/${t.id}`)} style={{ cursor: 'pointer' }}>{t.topic}</span>
                          {relatedSubs.length > 0 && <span style={{ fontSize: 10, background: 'var(--bg2)', padding: '2px 6px', borderRadius: 6, marginLeft: 8, color: 'var(--txt3)' }}>{doneSubs}/{relatedSubs.length}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 500 }}>{t.start_date} ~ {t.end_date}</div>
                        <div style={{ padding: '0 10px' }}>
                          <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--brd)' }}>
                            <div style={{ width: `${subPct}%`, height: '100%', background: projectColor }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {taskAssignees.map((u: any, i: number) => (
                            <div key={u.id} title={u.full_name} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-4px' : '0' }}>{ini(u.full_name)}</div>
                          ))}
                        </div>
                        <StatusPicker current={t.status} onUpdate={(val) => handleStatusChange(t.id, val, false)} />
                      </div>

                      {isTaskExpanded && relatedSubs.map(st => {
                        const subAssignees = (st.subtask_assignees || []).map((sa: any) => allUsers.find((u: any) => u.id === sa.user_id)).filter(Boolean)
                        return (
                          <div key={st.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 180px 120px 100px 110px', alignItems: 'center', padding: '8px 16px 8px 40px', background: 'var(--bg2)', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--txt3)' }} /></div>
                            <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500 }}>{st.topic}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{st.end_date || '—'}</div>
                            <div />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {subAssignees.map((u: any, i: number) => (
                                <div key={u.id} title={u.full_name} style={{ width: 18, height: 18, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900, border: '1px solid var(--bg)', marginLeft: i > 0 ? '-4px' : '0' }}>{ini(u.full_name)}</div>
                              ))}
                            </div>
                            <StatusPicker current={st.status} onUpdate={(val) => handleStatusChange(st.id, val, true)} />
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })
        )
      ) : (
        <KanbanBoard mode={kanbanMode} tasks={filteredTasks} allTasks={tasks} subtasks={filteredSubtasks} allUsers={allUsers} onStatusChange={handleStatusChange} />
      )}
    </AppShell>
  )
}