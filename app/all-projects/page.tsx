'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { 
  ChevronRight, LayoutList, Columns, Info, X, Calendar, 
  ChevronsUpDown, Plus, Filter, Target, Clock, Edit3, Trash2, AlertTriangle, Check
} from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

const PROJECT_COLORS = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#84CC16', '#EF4444', 
  '#4D7C0F', '#B45309', '#0284C7', '#2DD4BF', '#EC4899'
]

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '??').slice(0, 2).toUpperCase()
}

// ─── PROJECT INFO MODAL ──────────────────────────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose, onRefresh }: any) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [deleteStage, setDeleteStage] = useState(0)
  const [saving, setSaving] = useState(false)
  
  const [editName, setEditName] = useState(proj.name)
  const [editDesc, setEditDesc] = useState(proj.description || '')
  const [editColor, setEditColor] = useState(proj.color_code || PROJECT_COLORS[0])
  
  // Initialize from relational data
  const initialMemberIds = useMemo(() => 
    proj.project_members?.map((m: any) => m.user_id) || [], 
  [proj.project_members])
  
  const [editMembers, setEditMembers] = useState<string[]>(initialMemberIds)

  const projTasks = useMemo(() => tasks.filter((t: any) => t.project_name === proj.name), [tasks, proj.name])
  const done = projTasks.filter((t: any) => t.status === 'Completed').length
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0
  const startDate = projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0] || '—'
  const endDate = projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0] || '—'

  const handleSave = async () => {
    setSaving(true)
    
    // 1. Update Project basic info
    const { error } = await supabase.from('Projects')
      .update({ name: editName, description: editDesc, color_code: editColor })
      .eq('id', proj.id)
    
    // 2. Sync Members Table (Delete then Insert)
    await supabase.from('project_members').delete().eq('project_id', proj.id)
    if (editMembers.length > 0) {
      const inserts = editMembers.map(uid => ({ project_id: proj.id, user_id: uid }))
      await supabase.from('project_members').insert(inserts)
    }

    if (editName !== proj.name) {
      await supabase.from('Tasks').update({ project_name: editName }).eq('project_name', proj.name)
    }

    setSaving(false)
    if (!error) { setMode('view'); onRefresh(); }
  }

  const handleDelete = async () => {
    // cascade delete handles project_members if FK is set to CASCADE
    const { error } = await supabase.from('Projects').delete().eq('id', proj.id)
    if (!error) { onClose(); onRefresh(); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(8px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg)', borderRadius: '24px', width: 520, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.4)', border: '1px solid var(--brd)', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ background: mode === 'edit' ? editColor : (proj.color_code || PROJECT_COLORS[0]), padding: '24px', color: '#fff', transition: '0.4s' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{mode === 'edit' ? 'Edit Project' : proj.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMode(mode === 'view' ? 'edit' : 'view')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mode === 'view' ? <Edit3 size={16} /> : <X size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {deleteStage > 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 18, fontWeight: 800 }}>Confirm Deletion</div>
              <p style={{ fontSize: 13, color: 'var(--txt2)', margin: '12px 0 24px' }}>Wiping this project will remove all related tasks and sub-tasks permanently.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteStage(0)}>Cancel</button>
                <button className="btn" style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800 }} onClick={() => deleteStage === 1 ? setDeleteStage(2) : handleDelete()}>
                  {deleteStage === 1 ? 'Yes, Delete' : 'Confirm Permanent Wipe'}
                </button>
              </div>
            </div>
          ) : mode === 'edit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' }}>Project Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width:'100%', padding:'10px', borderRadius:8, border:'1px solid var(--brd)', background:'var(--bg2)', color:'var(--txt)', outline: 'none', marginTop: 6 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' }}>Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ width:'100%', minHeight:80, padding:'10px', borderRadius:8, border:'1px solid var(--brd)', background:'var(--bg2)', color:'var(--txt)', outline: 'none', marginTop: 6 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' }}>Color Scheme</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                  {PROJECT_COLORS.map(c => (
                    <div key={c} onClick={() => setEditColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: editColor === c ? '3px solid var(--txt)' : '2px solid transparent', transition: '0.2s' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' }}>Project Team</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 150, overflow: 'auto', background: 'var(--bg2)', padding: 10, borderRadius: 10, marginTop: 6 }}>
                  {allUsers.map((u: any) => {
                    const active = editMembers.includes(u.id);
                    return (
                      <div key={u.id} onClick={() => setEditMembers(active ? editMembers.filter(id => id !== u.id) : [...editMembers, u.id])} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, cursor: 'pointer', background: active ? 'var(--bg)' : 'transparent', border: active ? `1px solid ${editColor}` : '1px solid transparent' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: AVATAR_BG[0], color: AVATAR_CL[0], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{ini(u.full_name)}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name}</span>
                        {active && <Check size={14} color={editColor} />}
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--brd)', paddingTop: 20, marginTop: 4 }}>
                <button onClick={() => setDeleteStage(1)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={16} /> Delete
                </button>
                <button onClick={handleSave} disabled={saving} style={{ background: editColor, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: `0 6px 16px ${editColor}50`, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s ease', opacity: saving ? 0.8 : 1 }}>
                  {saving ? 'Saving...' : <>Save Changes <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ fontSize: 13, color:'var(--txt2)', lineHeight: 1.6 }}>{proj.description || 'No description provided.'}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[ { l: 'Start Date', v: startDate, i: Calendar }, { l: 'End Date', v: endDate, i: Target }, { l: 'Total Tasks', v: projTasks.length, i: LayoutList } ].map(s => (
                  <div key={s.l} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px', border: '1px solid var(--brd)', textAlign: 'center' }}>
                    <div style={{ color:'var(--txt3)', fontSize:9, fontWeight:800, textTransform:'uppercase', display:'flex', alignItems:'center', gap:4, marginBottom: 4, justifyContent: 'center' }}><s.i size={10}/>{s.l}</div>
                    <div style={{ fontSize:12, fontWeight:700 }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' }}>Overall Progress</label>
                  <span style={{ fontSize: 11, fontWeight: 800, color: proj.color_code || PROJECT_COLORS[0] }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--brd)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || PROJECT_COLORS[0], borderRadius: 10 }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>Task Distribution</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {STATUSES.map(st => (
                    <div key={st} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 4px', textAlign: 'center', border: '1px solid var(--brd)' }}>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{projTasks.filter(t => t.status === st).length}</div>
                      <div style={{ fontSize: 8, color: 'var(--txt3)', fontWeight: 800 }}>{st.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>Project Members</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(proj.project_members || []).map((m: any, i: number) => {
                    const u = allUsers.find((user: any) => user.id === m.user_id);
                    if (!u) return null;
                    const count = projTasks.filter(t => (t.owner === u.full_name) || (t.assignees || []).includes(u.full_name)).length;
                    return (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '8px', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{ini(u.full_name)}</div>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{u.full_name}</div><div style={{ fontSize: 10, color: 'var(--txt3)' }}>{u.role || 'Member'}</div></div>
                        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, fontWeight: 800 }}>{count}</div><div style={{ fontSize: 8, color: 'var(--txt3)' }}>TASKS</div></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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

export default function AllProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filterId, setFilterId] = useState('all')
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [allExpanded, setAllExpanded] = useState(true)
  const [infoProj, setInfoProj] = useState<any | null>(null)

  const loadData = async () => {
    // UPDATED SELECT: project_members(user_id)
    const [p, t, us] = await Promise.all([
      supabase.from('Projects').select('*, project_members(user_id)').order('name'),
      supabase.from('Tasks').select('*').order('end_date'),
      supabase.from('Users').select('id,full_name,role'),
    ])
    setProjects(p.data || []); setTasks(t.data || []); setAllUsers(us.data || [])
  }

  useEffect(() => { loadData() }, [])

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('Tasks').update({ status: newStatus }).eq('id', id)
    if (!error) setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
  }

  const filteredProjects = useMemo(() => filterId === 'all' ? projects : projects.filter(p => p.id === filterId), [projects, filterId])

  return (
    <AppShell title="All Projects Portfolio">
      {infoProj && <ProjectInfoModal proj={infoProj} tasks={tasks} allUsers={allUsers} onClose={() => setInfoProj(null)} onRefresh={loadData} />}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:10, padding:'6px 12px' }}>
          <Filter size={14} color="var(--txt3)" />
          <select value={filterId} onChange={e => setFilterId(e.target.value)} style={{ background:'transparent', border:'none', color:'var(--txt)', fontSize:13, outline:'none' }}>
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn" onClick={() => setAllExpanded(!allExpanded)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--brd)', fontWeight: 600, fontSize: 12 }}>
          <ChevronsUpDown size={14}/> {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
           <button className={view === 'list' ? 'btn btn-primary' : 'btn'} onClick={() => setView('list')}><LayoutList size={16} /></button>
           <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')}><Columns size={16} /></button>
           <Link href="/projects/create" className="btn-primary-action" style={{ textDecoration: 'none' }}><Plus size={14}/> New Project</Link>
        </div>
      </div>

      {view === 'list' ? (
        filteredProjects.map(proj => {
          const ptasks = tasks.filter(t => t.project_name === proj.name)
          const pct = ptasks.length ? Math.round((ptasks.filter(t => t.status === 'Completed').length / ptasks.length) * 100) : 0
          const isOpen = allExpanded && !collapsed[proj.id]
          
          // MAPPING: Use project_members
          const projectMembers = (proj.project_members || [])
            .map((m: any) => allUsers.find(u => u.id === m.user_id))
            .filter(Boolean)

          return (
            <div key={proj.id} style={{ border: '1px solid var(--brd)', borderRadius: 14, background: 'var(--bg)', overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shd)' }}>
              <div style={{ padding: '10px 16px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: '0.2s', color: 'var(--txt3)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color_code || PROJECT_COLORS[0] }} />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{proj.name}</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: 16 }}>
                    {projectMembers.map((u: any, i: number) => {
                      const count = ptasks.filter(t => (t.owner === u.full_name) || (t.assignees || []).includes(u.full_name)).length;
                      return (
                        <div key={u.id} title={`${u.full_name} • ${count} Tasks`} style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, border: '2px solid var(--bg2)', marginLeft: i > 0 ? '-5px' : '0', zIndex: 10 - i }}>
                          {ini(u.full_name)}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 120 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--brd)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || PROJECT_COLORS[0] }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, width: 30, color: 'var(--txt2)' }}>{pct}%</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setInfoProj(proj) }} style={{ background: 'var(--bg3)', border: 'none', color: 'var(--txt2)', cursor: 'pointer', width: 26, height: 26, borderRadius: 6, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Info size={14}/>
                  </button>
                </div>
              </div>

              {isOpen && ptasks.map(t => (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 200px 120px 110px', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--brd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}><StatusDot status={t.status} /></div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', textAlign: 'right' }}>{t.start_date} → {t.end_date}</div>
                  <div style={{ height: 4, background: 'var(--brd)', borderRadius: 4, overflow: 'hidden', margin: '0 10px' }}><div style={{ width: `${t.status === 'Completed' ? 100 : 0}%`, height: '100%', background: 'var(--txt3)' }} /></div>
                  <StatusPicker current={t.status} onUpdate={(val) => handleStatusChange(t.id, val)} />
                </div>
              ))}
            </div>
          )
        })
      ) : (
        <KanbanBoard tasks={tasks} projects={projects} allUsers={allUsers} filterId={filterId} onStatusChange={handleStatusChange} />
      )}
    </AppShell>
  )
}

function KanbanBoard({ tasks, projects, allUsers, filterId, onStatusChange }: any) {
  const router = useRouter();
  const filtered = tasks.filter((t: any) => {
    if (filterId === 'all') return true;
    const proj = projects.find((p: any) => p.id === filterId);
    return proj?.name === t.project_name;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {STATUSES.map(status => {
        const colTasks = filtered.filter((t: any) => t.status === status);
        return (
          <div key={status} style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '10px', minHeight: '80vh', border: '1px solid var(--brd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><StatusDot status={status} /><span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>{status}</span></div>
              <span style={{ fontSize: '10px', background: 'var(--bg)', padding: '1px 6px', borderRadius: '6px', color: 'var(--txt3)', fontWeight: 700 }}>{colTasks.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {colTasks.map((t: any) => {
                const projectObj = projects.find((p: any) => p.name === t.project_name);
                
                // MAPPING: Use project_members
                const projectMembers = (projectObj?.project_members || [])
                  .map((m: any) => allUsers.find((u: any) => u.id === m.user_id))
                  .filter(Boolean);

                return (
                  <div key={t.id} onClick={() => router.push(`/tasks/${t.id}`)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '10px', padding: '10px', marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{t.project_name}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)', marginBottom: 10, lineHeight: 1.3 }}>{t.topic}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {projectMembers.slice(0, 3).map((u: any, i: number) => (
                          <div key={u.id} title={u.full_name} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-5px' : '0', zIndex: 10 - i }}>
                            {ini(u.full_name)}
                          </div>
                        ))}
                        {projectMembers.length > 3 && <div style={{ fontSize: 8, marginLeft: 4, color: 'var(--txt3)', fontWeight: 800 }}>+{projectMembers.length - 3}</div>}
                      </div>
                      <StatusPicker current={t.status} onUpdate={(val) => onStatusChange(t.id, val)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  )
}