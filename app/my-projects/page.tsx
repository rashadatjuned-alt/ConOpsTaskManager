'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, LayoutList, Columns, Info, X, Users, Calendar, Clock, Search, Plus } from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const

const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

// ─── Project Info Modal (Compact Version) ──────────────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose }: {
  proj: any; tasks: any[]; allUsers: any[]; onClose: () => void
}) {
  const projTasks = tasks.filter(t => t.project_name === proj.name)
  const done = projTasks.filter(t => t.status === 'Completed').length
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0

  const members = (proj.members || [])
    .map((id: string) => allUsers.find((u: any) => u.id === id))
    .filter(Boolean)

  const startDate = proj.start_date || projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0]
  const endDate = proj.end_date || projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0]
  let duration = '—'
  
  if (startDate && endDate) {
    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 864e5)
    if (days < 0) duration = '—'
    else if (days < 7) duration = `${days} day${days !== 1 ? 's' : ''}`
    else if (days < 30) duration = `${Math.round(days / 7)} week${Math.round(days / 7) !== 1 ? 's' : ''}`
    else if (days < 365) duration = `${Math.round(days / 30)} month${Math.round(days / 30) !== 1 ? 's' : ''}`
    else duration = `${(days / 365).toFixed(1)} years`
  }

  return (
    <div 
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>

        <div style={{ background: proj.color_code || '#378ADD', borderRadius: 'var(--rl) var(--rl) 0 0', padding: '16px 20px 12px', position: 'relative' }}>
          <button 
            onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
          >
            <X size={12} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{proj.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            {projTasks.length} task{projTasks.length !== 1 ? 's' : ''} · {pct}% complete
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#fff', borderRadius: 2 }} />
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {proj.description && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{proj.description}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { icon: <Calendar size={12} />, label: 'Start Date', val: startDate || '—' },
              { icon: <Calendar size={12} />, label: 'End Date', val: endDate || '—' },
              { icon: <Clock size={12} />, label: 'Duration', val: duration },
            ].map(({ icon, label, val }) => (
              <div key={label} style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--txt3)', fontSize: 10, marginBottom: 4 }}>{icon}{label}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 8 }}>Task Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {[
                { label: 'Not Started', bg: '#F1EFE8', color: '#5F5E5A' },
                { label: 'In Progress', bg: '#E6F1FB', color: '#185FA5' },
                { label: 'On-Hold', bg: '#FAEEDA', color: '#854F0B' },
                { label: 'Completed', bg: '#EAF3DE', color: '#3B6D11' },
              ].map(({ label, bg, color }) => (
                <div key={label} style={{ background: bg, borderRadius: 'var(--r)', padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color }}>{projTasks.filter(t => t.status === label).length}</div>
                  <div style={{ fontSize: 9, color, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} /> Team Members ({members.length})
            </div>
            {members.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No members assigned to this project.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.map((u: any, idx: number) => {
                  const name = u.full_name || u.email
                  const bg = AVATAR_BG[idx % AVATAR_BG.length]
                  const cl = AVATAR_CL[idx % AVATAR_CL.length]
                  const memberTasks = projTasks.filter(t => (t.owner || '').toLowerCase().includes(name.toLowerCase()))
                  
                  return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 'var(--r)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: bg, color: cl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                        {ini(name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{name}</div>
                        <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{u.role}</div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--txt3)', textAlign: 'right' }}>
                        <div style={{ fontWeight: 500, color: 'var(--txt)' }}>{memberTasks.length}</div>
                        <div>tasks</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [infoProj, setInfoProj] = useState<any | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      
      const [p, t, s, us] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Users').select('id,full_name,email,role'),
      ])
      
      setProjects(p.data || [])
      setTasks(t.data || [])
      setSubtasks(s.data || [])
      setAllUsers(us.data || [])
    }
    load()
  }, [])

  // Core Filtering Logic
  const isMe = (owner: string) => {
    const o = (owner || '').toLowerCase()
    const e = (me?.email || '').toLowerCase()
    const n = (me?.full_name || '').toLowerCase()
    return o.includes(e) || (n.length > 2 && o.includes(n))
  }

  // Find projects assigned to me, then filter by search term
  const myProjects = projects.filter(proj => {
    let assignedToMe = false;
    if (proj.members?.includes(me?.id)) assignedToMe = true;
    else if (tasks.some(t => t.project_name === proj.name && isMe(t.owner))) assignedToMe = true;
    else {
      const projTaskIds = tasks.filter(t => t.project_name === proj.name).map(t => t.id)
      assignedToMe = subtasks.some(s => projTaskIds.includes(s.parent_task_id) && isMe(s.owner || ''))
    }

    if (!assignedToMe) return false;
    return proj.name.toLowerCase().includes(searchTerm.toLowerCase());
  })

  const toggle = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }))
  const myAllTasks = tasks.filter(t => myProjects.some(p => p.name === t.project_name))

  // ─── Compact List View Component ─────────────────────────────────────────────
  const ProjectHierarchy = ({ proj }: { proj: any }) => {
    const ptasks = tasks.filter(t => t.project_name === proj.name)
    const done = ptasks.filter(t => t.status === 'Completed').length
    const pct = ptasks.length ? Math.round((done / ptasks.length) * 100) : 0
    const isOpen = !collapsed[proj.id]

    return (
      <div style={{ border: '1px solid var(--brd)', borderRadius: 'var(--rl)', background: 'var(--bg)', overflow: 'hidden', marginBottom: 12 }}>
        
        <div 
          style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? 'var(--bg2)' : 'transparent', transition: 'background 0.2s' }}
          onClick={() => toggle(proj.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <ChevronRight size={14} color="var(--txt3)" style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: 'transform 0.2s' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: proj.color_code || '#378ADD', flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt)' }}>{proj.name}</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginLeft: 4 }}>{ptasks.length} task{ptasks.length !== 1 ? 's' : ''}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 100 }}>
              <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 500, minWidth: 24 }}>{pct}%</span>
              <div style={{ flex: 1, height: 4, background: 'var(--brd)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || '#378ADD', borderRadius: 2, transition: 'width 0.3s ease' }} />
              </div>
            </div>

            <button
              onClick={e => { e.stopPropagation(); setInfoProj(proj) }}
              style={{ background: 'transparent', border: '1px solid transparent', borderRadius: 4, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.borderColor = 'var(--brd)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt3)'; e.currentTarget.style.borderColor = 'transparent' }}
              title="Project Information"
            >
              <Info size={13} />
            </button>
          </div>
        </div>

        {isOpen && (
          <div style={{ padding: '4px 14px 12px 34px', borderTop: '1px solid var(--brd)' }}>
            {ptasks.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '4px 0' }}>No tasks assigned.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {ptasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bg2)' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid var(--txt3)' }}></div>
                      <div 
                        style={{ fontSize: 13, color: 'var(--txt)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        onClick={() => router.push(`/tasks/${t.id}`)}
                      >
                        {t.topic}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4, width: 130, justifyContent: 'flex-end' }}>
                         <span>{t.start_date || 'TBD'} <span style={{ margin: '0 2px' }}>→</span> {t.end_date || 'TBD'}</span>
                      </div>

                      <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
                         <StatusPill status={t.status} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 12 }}>
                        <button 
                          onClick={() => router.push(`/tasks/${t.id}`)} 
                          style={{ background: 'var(--bg2)', border: '1px solid transparent', borderRadius: 4, padding: '3px 8px', fontSize: 11, color: 'var(--txt2)', cursor: 'pointer', transition: '0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--txt)'; e.currentTarget.style.borderColor = 'var(--brd)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt2)'; e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          View
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell title="My Projects">
      {infoProj && (
        <ProjectInfoModal
          proj={infoProj} tasks={tasks} allUsers={allUsers}
          onClose={() => setInfoProj(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }} />
          <input 
            type="text" 
            placeholder="Search my projects..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 'var(--r)', border: '1px solid var(--brd)', background: 'var(--bg)', color: 'var(--txt)', fontSize: 13, outline: 'none' }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
            {myProjects.length} project{myProjects.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={view === 'list' ? 'btn btn-primary' : 'btn'} onClick={() => setView('list')} style={{ padding: '5px 8px' }} title="List View"><LayoutList size={15} /></button>
            <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')} style={{ padding: '5px 8px' }} title="Kanban View"><Columns size={15} /></button>
          </div>
        </div>
      </div>

      {myProjects.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>📁</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>No projects assigned to you.</div>
        </div>
      )}

      {view === 'list' && myProjects.map(p => <ProjectHierarchy key={p.id} proj={p} />)}

      {view === 'kanban' && (
        <div className="kanban-grid">
          {STATUSES.map(status => {
            const group = myAllTasks.filter(t => t.status === status)
            return (
              <div key={status}>
                <div className="col-header">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background:
                    status === 'Not Started' ? '#aaa' : status === 'In Progress' ? '#378ADD' :
                    status === 'On-Hold' ? '#EF9F27' : '#639922' }} />
                  <span>{status}</span>
                  <span className="col-count">{group.length}</span>
                </div>
                {group.length === 0 ? (
                  <div className="col-empty">No tasks</div>
                ) : (
                  group.map(t => (
                    <div key={t.id} className="task-row" onClick={() => router.push(`/tasks/${t.id}`)}>
                      <StatusDot status={t.status} />
                      <div style={{ flex: 1 }}>
                        <div className="task-name">{t.topic}</div>
                        <div className="task-meta"><span>{t.project_name}</span></div>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
