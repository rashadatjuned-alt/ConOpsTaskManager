'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Info, X, Calendar, Clock, ChevronsUpDown, Users, Edit3, Save, Filter } from 'lucide-react'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

// ─── PROJECT INFO & EDIT MODAL ─────────────────────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, canEdit, onClose, onRefresh }: any) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState(proj.name)
  const [editDesc, setEditDesc] = useState(proj.description || '')
  const [editColor, setEditColor] = useState(proj.color_code || '#378ADD')
  const [editMembers, setEditMembers] = useState<string[]>(proj.members || [])

  const projTasks = useMemo(() => tasks.filter((t: any) => t.project_name === proj.name), [tasks, proj.name])
  const done = projTasks.filter((t: any) => t.status === 'Completed').length
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0
  const members = (proj.members || []).map((id: string) => allUsers.find((u: any) => u.id === id)).filter(Boolean)
  const startDate = projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0] || '—'
  const endDate = projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0] || '—'
  
  let duration = '—'
  if (startDate !== '—' && endDate !== '—') {
    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 864e5)
    duration = days > 30 ? `${Math.round(days / 30)} month` : `${days} days`
  }

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('Projects').update({ name: editName.trim(), description: editDesc.trim(), color_code: editColor, members: editMembers }).eq('id', proj.id)
    if (editName !== proj.name) await supabase.from('Tasks').update({ project_name: editName.trim() }).eq('project_name', proj.name)
    setSaving(false); setIsEditing(false); onRefresh()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg)', borderRadius: '12px', width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid var(--brd)' }}>
        <div style={{ background: isEditing ? editColor : (proj.color_code || '#378ADD'), padding: '16px 20px 12px', position: 'relative', color: '#fff' }}>
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
            {canEdit && !isEditing && (
              <button onClick={() => setIsEditing(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', width: 24, height: 24, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Modify Project">
                <Edit3 size={12} />
              </button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={12} /></button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{isEditing ? 'Edit Project' : proj.name}</div>
          {!isEditing && <div style={{ fontSize: 12, opacity: 0.8 }}>{projTasks.length} tasks · {pct}% complete</div>}
          {!isEditing && <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#fff' }} /></div>}
        </div>
        <div style={{ padding: '16px 20px' }}>
          {isEditing ? (
            <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
               <input style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', fontSize: 13 }} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project Name" />
               <textarea style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', fontSize: 13, minHeight: 60 }} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
               <div style={{ display:'flex', justifyContent:'flex-end', gap: 8 }}>
                 <button className="tv-btn" onClick={() => setIsEditing(false)}>Cancel</button>
                 <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
               </div>
            </div>
          ) : (
            <>
              {proj.description && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 4 }}>Description</div><div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{proj.description}</div></div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[ { label: 'Start Date', val: startDate }, { label: 'End Date', val: endDate }, { label: 'Duration', val: duration } ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 10px' }}><div style={{ color:'var(--txt3)', fontSize:9, marginBottom:2, fontWeight:700, textTransform:'uppercase' }}>{s.label}</div><div style={{ fontSize:12, fontWeight:600 }}>{s.val}</div></div>
                ))}
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}>Task Breakdown</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {STATUSES.map(st => (
                    <div key={st} style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '6px 4px', textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 800 }}>{projTasks.filter(t => t.status === st).length}</div><div style={{ fontSize: 8, color: 'var(--txt3)', fontWeight: 700 }}>{st.toUpperCase()}</div></div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}><Users size={11} style={{ verticalAlign:'middle', marginRight:4 }}/> Team Members ({members.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.map((u: any, i: number) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 'var(--r)' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>{ini(u.full_name || u.email)}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{u.full_name || u.email}</div></div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}><div style={{ fontWeight: 700 }}>{projTasks.filter(t => (t.owner || '').includes(u.full_name)).length} tasks</div></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function MyProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collTask, setCollTask] = useState<Record<string, boolean>>({})
  const [infoProj, setInfoProj] = useState<any | null>(null)
  const [filterId, setFilterId] = useState('all')
  const [allExpanded, setAllExpanded] = useState(true)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
    setMe({ ...u, email: session.user.email })

    const [p, t, s, us] = await Promise.all([
      supabase.from('Projects').select('*').order('name'),
      supabase.from('Tasks').select('*').order('end_date'),
      supabase.from('Subtasks').select('*'),
      supabase.from('Users').select('id,full_name,email,role'),
    ])
    setProjects(p.data || []); setTasks(t.data || []); setSubtasks(s.data || []); setAllUsers(us.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const isUserAssigned = (owner: string) => {
    const o = (owner || '').toLowerCase(), e = (me?.email || '').toLowerCase(), n = (me?.full_name || '').toLowerCase()
    return o.includes(e) || (n.length > 2 && o.includes(n))
  }

  const myFilteredProjects = useMemo(() => {
    return projects
      .filter(proj => {
        const isMember = proj.members?.includes(me?.id)
        const hasTask = tasks.some(t => t.project_name === proj.name && isUserAssigned(t.owner))
        const hasSub = subtasks.some(s => tasks.find(t => t.id === s.parent_task_id)?.project_name === proj.name && isUserAssigned(s.owner || ''))
        const matchesSearch = filterId === 'all' || proj.id === filterId
        return (isMember || hasTask || hasSub) && matchesSearch
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, tasks, subtasks, me, filterId])

  const toggleCollapseAll = () => {
    const nextValue = !allExpanded
    setAllExpanded(nextValue)
    const newState: Record<string, boolean> = {}
    myFilteredProjects.forEach(p => { newState[p.id] = !nextValue })
    setCollapsed(newState)
  }

  if (loading) return <AppShell title="My Projects">Loading...</AppShell>

  return (
    <AppShell title="My Projects Portfolio">
      {infoProj && <ProjectInfoModal proj={infoProj} tasks={tasks} allUsers={allUsers} canEdit={me?.role === 'Admin' || me?.role === 'Manager'} onClose={() => setInfoProj(null)} onRefresh={loadData} />}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:8, padding:'4px 10px' }}>
          <Filter size={14} color="var(--txt3)" />
          <select value={filterId} onChange={e => setFilterId(e.target.value)} style={{ background:'transparent', border:'none', color:'var(--txt)', fontSize:13, outline:'none', cursor:'pointer' }}>
            <option value="all">All My Projects</option>
            {projects.filter(p => myFilteredProjects.some(mp => mp.id === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="tv-btn" onClick={toggleCollapseAll}><ChevronsUpDown size={14}/></button>
      </div>

      {myFilteredProjects.map(proj => {
        const ptasks = tasks.filter(t => t.project_name === proj.name)
        const pct = ptasks.length ? Math.round((ptasks.filter(t => t.status === 'Completed').length / ptasks.length) * 100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--card-bg)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', cursor: 'pointer', background: isOpen ? 'var(--subtask-bg)' : 'transparent' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: '0.2s', color: 'var(--text-muted)' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color_code || '#378ADD' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>{proj.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 120 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, width: 30 }}>{pct}%</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || '#378ADD' }} /></div>
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
                      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px 8px 40px', gap: 12 }}>
                        <div style={{ width: 20 }}>{tSubs.length > 0 && <ChevronRight size={13} style={{ transform: isTaskOpen ? 'rotate(90deg)' : '', cursor: 'pointer' }} onClick={() => setCollTask(c => ({...c, [t.id]: !c[t.id]}))} />}</div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                          <div style={{ width: 195, fontSize: 11, color: 'var(--txt3)', textAlign: 'right', paddingRight: 24, whiteSpace: 'nowrap' }}>{t.start_date} <span style={{ color: 'var(--brd)', margin: '0 4px' }}>→</span> {t.end_date}</div>
                          <div style={{ width: 100, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 20 }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--brd)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${tPct}%`, height: '100%', background: 'var(--txt3)' }} /></div>
                            <span style={{ fontSize: 10, width: 25 }}>{tPct}%</span>
                          </div>
                          <div style={{ width: 95 }}><StatusPill status={t.status} /></div>
                          <div style={{ width: 60, textAlign: 'right' }}><button className="tv-btn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => router.push(`/tasks/${t.id}`)}>View</button></div>
                        </div>
                      </div>
                      {tSubs.length > 0 && isTaskOpen && (
                        <div>{tSubs.map(s => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 4px 72px', gap: 12 }}>
                            <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>↳ {s.topic}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                              <div style={{ width: 195, fontSize: 11, color: 'var(--txt3)', textAlign: 'right', paddingRight: 24, whiteSpace: 'nowrap' }}>{s.start_date} <span style={{ color: 'var(--brd)', margin: '0 4px' }}>→</span> {s.end_date}</div>
                              <div style={{ width: 100, paddingRight: 20 }} />
                              <div style={{ width: 95 }}><StatusPill status={s.status} /></div>
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
