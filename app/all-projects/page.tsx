'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, LayoutList, Columns, Info, X, Calendar, Clock, Search, Plus, ChevronsDownUp, ChevronsUpDown, Users } from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

// ─── Project Info Modal (Exact UI from your Screenshot) ────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose }: any) {
  const projTasks = tasks.filter((t: any) => t.project_name === proj.name)
  const done = projTasks.filter((t: any) => t.status === 'Completed').length
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0

  const members = (proj.members || [])
    .map((id: string) => allUsers.find((u: any) => u.id === id))
    .filter(Boolean)

  const startDate = projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0] || '—'
  const endDate = projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0] || '—'
  
  let duration = '—'
  if (startDate !== '—' && endDate !== '—') {
    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 864e5)
    duration = days > 30 ? `${Math.round(days / 30)} month` : `${days} days`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg)', borderRadius: '12px', width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid var(--brd)' }}>
        <div style={{ background: proj.color_code || '#378ADD', padding: '16px 20px 12px', position: 'relative', color: '#fff' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={12} /></button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{proj.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{projTasks.length} task{projTasks.length !== 1 ? 's' : ''} · {pct}% complete</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#fff' }} /></div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {proj.description && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 6 }}>Description</div><div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{proj.description}</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[ { icon: <Calendar size={12} />, label: 'Start Date', val: startDate }, { icon: <Calendar size={12} />, label: 'End Date', val: endDate }, { icon: <Clock size={12} />, label: 'Duration', val: duration } ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 10px' }}><div style={{ display:'flex', alignItems:'center', gap:4, color:'var(--txt3)', fontSize:10, marginBottom:4 }}>{s.icon}{s.label}</div><div style={{ fontSize:12, fontWeight:500 }}>{s.val}</div></div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}>Task Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {[ { l: 'Not Started', b: '#F1EFE8', c: '#5F5E5A' }, { l: 'In Progress', b: '#E6F1FB', c: '#185FA5' }, { l: 'On-Hold', b: '#FAEEDA', c: '#854F0B' }, { l: 'Completed', b: '#EAF3DE', c: '#3B6D11' } ].map(b => (
                <div key={b.l} style={{ background: b.b, borderRadius: 'var(--r)', padding: '6px 8px', textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 600, color: b.c }}>{projTasks.filter(t => t.status === b.l).length}</div><div style={{ fontSize: 9, color: b.c }}>{b.l}</div></div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> Team Members ({members.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map((u: any, i: number) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 'var(--r)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{ini(u.full_name || u.email)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500 }}>{u.full_name || u.email}</div><div style={{ fontSize: 10, color: 'var(--txt3)' }}>{u.role}</div></div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}><div style={{ fontWeight: 500 }}>{projTasks.filter(t => (t.owner || '').includes(u.full_name)).length}</div><div>tasks</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AllProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collTask, setCollTask] = useState<Record<string, boolean>>({})
  const [infoProj, setInfoProj] = useState<any | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const load = async () => {
      const [p, t, s, us] = await Promise.all([
        supabase.from('Projects').select('*').order('name'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Users').select('id,full_name,email,role'),
      ])
      setProjects(p.data || []); setTasks(t.data || []); setSubtasks(s.data || []); setAllUsers(us.data || [])
    }
    load()
  }, [])

  // ── Alphabetical Sort ──
  const sortedProjects = useMemo(() => {
    return projects
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, searchTerm])

  return (
    <AppShell title="All Projects Portfolio">
      {infoProj && <ProjectInfoModal proj={infoProj} tasks={tasks} allUsers={allUsers} onClose={() => setInfoProj(null)} />}

      <div style={{ marginBottom: 20, position: 'relative', width: 300 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }} />
        <input type="text" placeholder="Search all projects..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
          style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg)', color: 'var(--txt)', fontSize: 13, outline: 'none' }} />
      </div>

      {sortedProjects.map(proj => {
        const ptasks = tasks.filter(t => t.project_name === proj.name)
        const pct = ptasks.length ? Math.round((ptasks.filter(t => t.status === 'Completed').length / ptasks.length) * 100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} style={{ border: '1px solid var(--brd)', borderRadius: 12, background: 'var(--bg)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', background: isOpen ? 'var(--bg2)' : 'transparent' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <ChevronRight size={16} style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: '0.2s', color: 'var(--text-muted)' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color_code || '#378ADD' }} />
                <div style={{ fontSize: 15, fontWeight: 700 }}>{proj.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 120 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, width: 30 }}>{pct}%</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--brd)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || '#378ADD' }} /></div>
                </div>
                <button onClick={e => { e.stopPropagation(); setInfoProj(proj) }} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}><Info size={16}/></button>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '0 0 8px 0' }}>
                {ptasks.map(t => {
                  const tSubs = subtasks.filter(s => s.parent_task_id === t.id)
                  const tPct = tSubs.length ? Math.round((tSubs.filter(s => s.status === 'Completed').length / tSubs.length) * 100) : (t.status === 'Completed' ? 100 : 0)
                  const isTaskOpen = !collTask[t.id]

                  return (
                    <div key={t.id} style={{ borderTop: '1px solid var(--brd)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 10px 40px', gap: 12 }}>
                        <div style={{ width: 20 }}>{tSubs.length > 0 && <ChevronRight size={14} style={{ transform: isTaskOpen ? 'rotate(90deg)' : '', cursor: 'pointer' }} onClick={() => setCollTask(c => ({...c, [t.id]: !c[t.id]}))} />}</div>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 500, cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                          <div style={{ width: 160, fontSize: 11, color: 'var(--txt3)', textAlign: 'right', paddingRight: 20 }}>{t.start_date} → {t.end_date}</div>
                          <div style={{ width: 100, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 20 }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--brd)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${tPct}%`, height: '100%', background: 'var(--txt3)' }} /></div>
                            <span style={{ fontSize: 10, width: 25 }}>{tPct}%</span>
                          </div>
                          <div style={{ width: 100 }}><StatusPill status={t.status} /></div>
                          <div style={{ width: 60, textAlign: 'right' }}><button className="tv-btn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => router.push(`/tasks/${t.id}`)}>Edit</button></div>
                        </div>
                      </div>

                      {tSubs.length > 0 && isTaskOpen && (
                        <div>{tSubs.map(s => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 16px 6px 72px', gap: 12 }}>
                            <div style={{ flex: 1, fontSize: 13, color: 'var(--txt2)' }}>↳ {s.topic}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                              <div style={{ width: 160, fontSize: 11, color: 'var(--txt3)', textAlign: 'right', paddingRight: 20 }}>{s.start_date} → {s.end_date}</div>
                              <div style={{ width: 100, paddingRight: 20 }} />
                              <div style={{ width: 100 }}><StatusPill status={s.status} /></div>
                              <div style={{ width: 60 }} />
                            </div>
                          </div>
                        ))}</div>
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
