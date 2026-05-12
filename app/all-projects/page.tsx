'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
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

// ─── Project Info Modal ──────────────────────────────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose }: {
  proj: any; tasks: any[]; allUsers: any[]; onClose: () => void
}) {
  const projTasks = tasks.filter(t => t.project_name === proj.name)
  const done = projTasks.filter(t => t.status === 'Completed').length
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0

  const members = (proj.members || [])
    .map((id: string) => allUsers.find((u: any) => u.id === id))
    .filter(Boolean)

  const startDate = projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0] || '—'
  const endDate = projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0] || '—'
  
  return (
    <div 
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', border: '1px solid var(--brd)', width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ background: proj.color_code || '#378ADD', padding: '20px', position: 'relative', color: '#fff' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', cursor: 'pointer' }}><X size={12} /></button>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{proj.name}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{projTasks.length} tasks · {pct}% complete</div>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--bg2)', padding: '10px', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>Start Date</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{startDate}</div>
            </div>
            <div style={{ background: 'var(--bg2)', padding: '10px', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>End Date</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{endDate}</div>
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}>Task Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {['Not Started', 'In Progress', 'On-Hold', 'Completed'].map(st => (
              <div key={st} style={{ background: 'var(--bg2)', padding: '8px 4px', borderRadius: 'var(--r)', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{projTasks.filter(t => t.status === st).length}</div>
                <div style={{ fontSize: 8, color: 'var(--txt3)' }}>{st.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AllProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collTask, setCollTask] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [infoProj, setInfoProj] = useState<any | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const load = async () => {
      const [p, t, s, us] = await Promise.all([
        supabase.from('Projects').select('*'),
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

  // Show EVERYTHING, sorted alphabetically
  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, searchTerm])

  const ProjectHierarchy = ({ proj }: { proj: any }) => {
    const ptasks = tasks.filter(t => t.project_name === proj.name)
    const pct = ptasks.length ? Math.round((ptasks.filter(t => t.status === 'Completed').length / ptasks.length) * 100) : 0
    const isOpen = !collapsed[proj.id]

    return (
      <div style={{ border: '1px solid var(--brd)', borderRadius: 'var(--rl)', background: 'var(--bg)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? 'var(--bg2)' : 'transparent' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: '0.2s' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: proj.color_code || '#378ADD' }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>{proj.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 100 }}>
              <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{pct}%</span>
              <div style={{ flex: 1, height: 4, background: 'var(--brd)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || '#378ADD' }} />
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); setInfoProj(proj) }} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}><Info size={14} /></button>
          </div>
        </div>

        {isOpen && (
          <div style={{ padding: '0 14px 12px 34px' }}>
            {ptasks.map(t => {
              const tSubs = subtasks.filter(s => s.parent_task_id === t.id)
              const tPct = tSubs.length ? Math.round((tSubs.filter(s => s.status === 'Completed').length / tSubs.length) * 100) : (t.status === 'Completed' ? 100 : 0)
              const isTaskOpen = !collTask[t.id]

              return (
                <div key={t.id} style={{ borderTop: '1px solid var(--bg2)', padding: '6px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tSubs.length > 0 && <ChevronRight size={12} style={{ transform: isTaskOpen ? 'rotate(90deg)' : '' }} onClick={(e) => { e.stopPropagation(); setCollTask(c => ({...c, [t.id]: !c[t.id]})) }} />}
                      <div style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 11, color: 'var(--txt3)' }}>
                      <div style={{ width: 130, textAlign: 'right' }}>{t.start_date} → {t.end_date}</div>
                      <div style={{ width: 60, height: 4, background: 'var(--brd)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${tPct}%`, height: '100%', background: 'var(--txt3)' }} /></div>
                      <div style={{ width: 85 }}><StatusPill status={t.status} /></div>
                      <button className="tv-btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => router.push(`/tasks/${t.id}`)}>Edit</button>
                    </div>
                  </div>
                  {tSubs.length > 0 && isTaskOpen && (
                    <div style={{ paddingLeft: 20, marginTop: 4 }}>
                      {tSubs.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                          <div style={{ flex: 1, color: 'var(--txt2)' }}>↳ {s.topic}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                            <div style={{ width: 130, color: 'var(--txt3)', fontSize: 11, textAlign: 'right' }}>{s.start_date} → {s.end_date}</div>
                            <div style={{ width: 60 }} />
                            <div style={{ width: 85 }}><StatusPill status={s.status} /></div>
                            <div style={{ width: 40 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell title="All Projects Portfolio">
      {infoProj && <ProjectInfoModal proj={infoProj} tasks={tasks} allUsers={allUsers} onClose={() => setInfoProj(null)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }} />
          <input type="text" placeholder="Search all projects..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 'var(--r)', border: '1px solid var(--brd)', background: 'var(--bg)', color: 'var(--txt)', fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
           <button className={view === 'list' ? 'btn btn-primary' : 'btn'} onClick={() => setView('list')}><LayoutList size={15} /></button>
           <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')}><Columns size={15} /></button>
        </div>
      </div>
      {filteredProjects.map(p => <ProjectHierarchy key={p.id} proj={p} />)}
    </AppShell>
  )
}
