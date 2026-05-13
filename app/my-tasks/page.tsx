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
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '??').slice(0, 2).toUpperCase()
}

function getTaskMembers(item: any, allUsers: any[]) {
  if (!item) return [];
  return allUsers.filter(u => 
    (item.owner && item.owner.includes(u.full_name)) || 
    (item.assignees && item.assignees.includes(u.full_name))
  );
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
    <select 
      value={current} 
      onChange={(e) => onUpdate(e.target.value)} 
      onClick={e => e.stopPropagation()} 
      style={{ background: colors.bg, color: colors.fg, border: 'none', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase', outline: 'none', cursor: 'pointer', appearance: 'none', width: '82px', textAlign: 'center' }}
    >
      {STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--bg)', color: 'var(--txt)' }}>{s}</option>)}
    </select>
  )
}

export default function MyTasks() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [pf, setPf] = useState('All') // Project Filter
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [kanbanMode, setKanbanMode] = useState<'tasks' | 'subtasks'>('tasks')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)

  const loadData = async () => {
    // 1. Get current authenticated user
    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData.user?.email

    // 2. Fetch all required data
    const [t, p, us, st] = await Promise.all([
      supabase.from('Tasks').select('*').order('end_date'),
      supabase.from('Projects').select('*').order('name'),
      supabase.from('Users').select('id,full_name,email,role'),
      supabase.from('Subtasks').select('*').order('end_date')
    ])
    
    const fetchedUsers = us.data || []
    const currentUser = fetchedUsers.find(u => u.email === userEmail)
    const myName = currentUser?.full_name || ''

    // Helper to check if the current user is assigned
    const isAssignedToMe = (item: any) => {
      if (!item || !myName) return false;
      return (item.owner && item.owner.includes(myName)) || 
             (item.assignees && item.assignees.includes(myName))
    }

    const rawTasks = t.data || []
    const rawSubtasks = st.data || []

    // 3. Filter Logic for "My Tasks"
    const mySubtasks = rawSubtasks.filter(st => {
        const parentTask = rawTasks.find(task => String(task.id) === String(st.parent_task_id))
        return isAssignedToMe(st) || isAssignedToMe(parentTask)
    })

    const myTasks = rawTasks.filter(task => {
        const hasMySubtask = mySubtasks.some(st => String(st.parent_task_id) === String(task.id))
        return isAssignedToMe(task) || hasMySubtask
    })

    setTasks(myTasks) 
    setSubtasks(mySubtasks)
    setProjects(p.data || []) 
    setAllUsers(fetchedUsers) 
  }

  useEffect(() => { loadData() }, [])

  const handleStatusChange = async (id: string, newStatus: string, isSubtask = false) => {
    const table = isSubtask ? 'Subtasks' : 'Tasks'
    const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id)
    if (!error) {
      if (isSubtask) setSubtasks(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
      else setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }
  }

  // Filter Parent Tasks by selected Project Dropdown
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => pf === 'All' || t.project_name === pf)
  }, [tasks, pf])

  // Filter Subtasks by selected Project Dropdown
  const filteredSubtasks = useMemo(() => {
    return subtasks.filter(st => {
      const parent = tasks.find(t => String(t.id) === String(st.parent_task_id))
      return pf === 'All' || parent?.project_name === pf
    })
  }, [subtasks, tasks, pf])

  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredTasks.forEach(t => { groups[t.project_name] = (groups[t.project_name] || []).concat(t) })
    return Object.entries(groups).sort()
  }, [filteredTasks])

  return (
    <AppShell title="My Tasks">
      
      {/* TOOLBAR */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 10, padding: '6px 12px' }}>
          <Filter size={14} color="var(--txt3)" />
          <select value={pf} onChange={e => setPf(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--txt)', fontSize: 13, outline: 'none', fontWeight: 600 }}>
            <option value="All">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        {view === 'list' && (
          <button className="btn" onClick={() => setAllExpanded(!allExpanded)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--brd)', fontSize: 12, fontWeight: 600 }}>
            <ChevronsUpDown size={14} /> {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}

        {view === 'kanban' && (
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 8, padding: 3, border: '1px solid var(--brd)' }}>
            <button 
              onClick={() => setKanbanMode('tasks')}
              style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: kanbanMode === 'tasks' ? 'var(--bg)' : 'transparent', color: kanbanMode === 'tasks' ? 'var(--txt)' : 'var(--txt3)', boxShadow: kanbanMode === 'tasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              My Tasks
            </button>
            <button 
              onClick={() => setKanbanMode('subtasks')}
              style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: kanbanMode === 'subtasks' ? 'var(--bg)' : 'transparent', color: kanbanMode === 'subtasks' ? 'var(--txt)' : 'var(--txt3)', boxShadow: kanbanMode === 'subtasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              My Subtasks
            </button>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <button className={view === 'list' ? 'btn btn-primary' : 'btn'} onClick={() => setView('list')} style={{ borderRadius: 10 }}><LayoutList size={16} /></button>
          <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')} style={{ borderRadius: 10 }}><Columns size={16} /></button>
          <Link href="/tasks/create" className="btn-primary-action" style={{ textDecoration: 'none' }}><Plus size={14} /> Create Task</Link>
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'list' ? (
        groupedTasks.map(([projName, pTasks]) => {
          const projectObj = projects.find(p => p.name === projName);
          const projectColor = projectObj?.color_code || PROJECT_COLORS[0];
          const isProjOpen = allExpanded && !collapsed[projName];
          
          return (
            <div key={projName} style={{ border: '1px solid var(--brd)', borderRadius: 14, background: 'var(--bg)', overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shd)' }}>
              
              <div 
                style={{ padding: '10px 16px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} 
                onClick={() => setCollapsed(prev => ({ ...prev, [projName]: !prev[projName] }))}
              >
                <ChevronRight size={14} style={{ transform: isProjOpen ? 'rotate(90deg)' : '', transition: '0.2s', color: 'var(--txt3)' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: projectColor }} />
                <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{projName}</div>
              </div>
              
              {isProjOpen && pTasks.map(t => {
                const taskAssignees = getTaskMembers(t, allUsers);
                const relatedSubs = subtasks.filter(st => String(st.parent_task_id) === String(t.id));
                const doneSubs = relatedSubs.filter(st => st.status === 'Completed').length;
                const subPct = relatedSubs.length ? Math.round((doneSubs / relatedSubs.length) * 100) : 0;
                const isTaskExpanded = expandedTasks[t.id];

                return (
                  <div key={t.id} style={{ borderTop: '1px solid var(--brd)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 180px 120px 100px 110px', alignItems: 'center', padding: '10px 16px' }}>
                      <div 
                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
                        onClick={() => setExpandedTasks(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                      >
                        {relatedSubs.length > 0 ? (
                           <ChevronRight size={14} style={{ transform: isTaskExpanded ? 'rotate(90deg)' : '', transition: '0.2s', color: '#3B82F6' }} />
                        ) : <StatusDot status={t.status} />}
                      </div>
                      
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                        <span onClick={() => router.push(`/tasks/${t.id}`)} style={{ cursor: 'pointer' }}>{t.topic}</span>
                        {relatedSubs.length > 0 && (
                          <span style={{ fontSize: 10, background: 'var(--bg2)', padding: '2px 6px', borderRadius: 6, marginLeft: 8, color: 'var(--txt3)' }}>
                            {doneSubs}/{relatedSubs.length}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 500 }}>{t.start_date} → {t.end_date}</div>

                      <div style={{ padding: '0 10px' }}>
                        <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--brd)' }}>
                          <div style={{ width: `${subPct}%`, height: '100%', background: projectColor, transition: '0.3s' }} />
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {taskAssignees.map((u: any, i: number) => (
                          <div key={u.id} title={u.full_name} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-4px' : '0', zIndex: 10-i }}>{ini(u.full_name)}</div>
                        ))}
                      </div>
                      
                      <StatusPicker current={t.status} onUpdate={(val) => handleStatusChange(t.id, val)} />
                    </div>

                    {isTaskExpanded && relatedSubs.map(st => (
                        <div key={st.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 180px 120px 100px 110px', alignItems: 'center', padding: '8px 16px 8px 40px', background: 'var(--bg2)', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--txt3)' }} /></div>
                          <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500 }}>{st.topic}</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{st.end_date || '-'}</div>
                          <div /> 
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getTaskMembers(st, allUsers).map((u: any, i: number) => (
                              <div key={u.id} title={u.full_name} style={{ width: 18, height: 18, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900, border: '1px solid var(--bg)', marginLeft: i > 0 ? '-4px' : '0' }}>{ini(u.full_name)}</div>
                            ))}
                          </div>
                          <StatusPicker current={st.status} onUpdate={(val) => handleStatusChange(st.id, val, true)} />
                        </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })
      ) : (
        <KanbanBoard 
          mode={kanbanMode} 
          tasks={filteredTasks} 
          allTasks={tasks}
          subtasks={filteredSubtasks} 
          allUsers={allUsers} 
          onStatusChange={handleStatusChange} 
        />
      )}
    </AppShell>
  )
}

// ─── KANBAN BOARD ──────────────────────────────────────────────────────────
function KanbanBoard({ mode, tasks, allTasks, subtasks, allUsers, onStatusChange }: any) {
  const router = useRouter();
  const itemsToRender = mode === 'tasks' ? tasks : subtasks;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {STATUSES.map(status => {
        const colItems = itemsToRender.filter((item: any) => item.status === status);
        return (
          <div key={status} style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '10px', minHeight: '80vh', border: '1px solid var(--brd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><StatusDot status={status} /><span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>{status}</span></div>
              <span style={{ fontSize: '10px', background: 'var(--bg)', padding: '1px 6px', borderRadius: '6px', color: 'var(--txt3)', fontWeight: 700 }}>{colItems.length}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {colItems.map((item: any) => {
                const members = getTaskMembers(item, allUsers);
                
                if (mode === 'tasks') {
                  const relatedSubs = subtasks.filter((st: any) => String(st.parent_task_id) === String(item.id));
                  const doneSubs = relatedSubs.filter((st: any) => st.status === 'Completed').length;
                  const subPct = relatedSubs.length ? Math.round((doneSubs / relatedSubs.length) * 100) : 0;

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
                        <StatusPicker current={item.status} onUpdate={(val) => onStatusChange(item.id, val)} />
                      </div>
                    </div>
                  );
                }

                // If Subtasks Mode
                const parentTask = allTasks.find((t: any) => String(t.id) === String(item.parent_task_id));
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
                        )) : (
                          <span style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 600 }}>Unassigned</span>
                        )}
                      </div>
                      <StatusPicker current={item.status} onUpdate={(val) => onStatusChange(item.id, val, true)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        );
      })}
    </div>
  )
}