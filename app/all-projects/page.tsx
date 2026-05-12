'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Plus, Info, X, ChevronsDownUp, ChevronsUpDown, Calendar, Users, Edit3 } from 'lucide-react'
import Link from 'next/link'

const COLORS = ['#378ADD','#7F77DD','#EF9F27','#639922','#E24B4A','#3B6D11','#854F0B','#185FA5','#14B8A6','#EC4899']

// ─── Project Info & Edit Modal (Same as before) ──────────────────────────────
function ProjectInfoModal({ proj, tasks, subtasks, allUsers, canEdit, onClose, onRefresh }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(proj.name);
  const [editDesc, setEditDesc] = useState(proj.description || '');
  const [editColor, setEditColor] = useState(proj.color_code || '#378ADD');
  const [editMembers, setEditMembers] = useState(proj.members || []);

  const projTasks = useMemo(() => tasks.filter((t: any) => t.project_name === proj.name), [tasks, proj.name]);
  const done = projTasks.filter((t: any) => t.status === 'Completed').length;
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
  const startDate = projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0] || '—';
  const endDate = projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0] || '—';

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('Projects').update({ name: editName, description: editDesc, color_code: editColor, members: editMembers }).eq('id', proj.id);
    if (editName !== proj.name) await supabase.from('Tasks').update({ project_name: editName }).eq('project_name', proj.name);
    setSaving(false); setIsEditing(false); onRefresh();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 12, width: 500, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
        <div style={{ background: editColor, padding: '24px', position: 'relative', color: '#fff' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{editName}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{projTasks.length} tasks • {pct}% complete</div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 10, marginTop: 14, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#fff' }} /></div>
        </div>
        <div style={{ padding: 24 }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }} value={editName} onChange={e => setEditName(e.target.value)} />
              <textarea style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', minHeight: 80 }} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              <button className="tv-btn tv-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : '💾 Update Details'}</button>
            </div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{editDesc || 'No description.'}</div>
          )}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
             {!isEditing && canEdit && <button className="tv-btn" onClick={() => setIsEditing(true)}><Edit3 size={14}/> Modify</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AllProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [myRole, setMyRole] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const [collTask, setCollTask] = useState<Record<string,boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)
  const [infoProj, setInfoProj] = useState<any | null>(null)

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
    setMyRole(u?.role || '')

    const [p, t, s, us] = await Promise.all([
      supabase.from('Projects').select('*').order('name'), 
      supabase.from('Tasks').select('*').order('end_date'),
      supabase.from('Subtasks').select('*'),
      supabase.from('Users').select('id,full_name,email,role'),
    ])
    setProjects(p.data || [])
    setTasks(t.data || [])
    setSubtasks(s.data || [])
    setAllUsers(us.data || [])
  }

  useEffect(() => { loadData() }, [])

  // Strict Alphabetical Sort
  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects])

  const toggleAll = () => {
    const next = !allExpanded
    setAllExpanded(next)
    const newState: Record<string,boolean> = {}
    projects.forEach(p => { newState[p.id] = !next })
    setCollapsed(newState)
  }

  return (
    <AppShell title="All Projects Portfolio">
      {infoProj && (
        <ProjectInfoModal proj={infoProj} tasks={tasks} subtasks={subtasks} allUsers={allUsers} canEdit={myRole === 'Admin' || myRole === 'Manager'} onClose={() => setInfoProj(null)} onRefresh={loadData} />
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <button className="tv-btn" onClick={toggleAll}>
          {allExpanded ? <ChevronsDownUp size={14}/> : <ChevronsUpDown size={14}/>}
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
        <Link href="/projects/create" className="tv-btn tv-btn-primary"><Plus size={14}/> New Project</Link>
      </div>

      {sortedProjects.map(proj => {
        const ptasks = tasks.filter(t => t.project_name === proj.name)
        const done = ptasks.filter(t => t.status === 'Completed').length
        const pct = ptasks.length ? Math.round(done / ptasks.length * 100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--card-bg)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? 'var(--subtask-bg)' : 'transparent' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <ChevronRight size={16} style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color_code || '#378ADD' }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>{proj.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 100 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, width: 30 }}>{pct}%</span>
                  <div style={{ flex: 1, height: 5, background: 'var(--border-color)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || '#378ADD' }} /></div>
                </div>
                <button onClick={e => { e.stopPropagation(); setInfoProj(proj) }} className="tv-btn" style={{ padding: 6 }}><Info size={14}/></button>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '0 16px 12px 48px' }}>
                {ptasks.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>No tasks found.</div> : 
                  ptasks.map(t => {
                    const tSubs = subtasks.filter(s => s.parent_task_id === t.id);
                    const tDone = tSubs.filter(s => s.status === 'Completed').length;
                    const tPct = tSubs.length ? Math.round((tDone / tSubs.length) * 100) : (t.status === 'Completed' ? 100 : 0);
                    const isTaskOpen = !collTask[t.id];

                    return (
                      <div key={t.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '4px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {tSubs.length > 0 && <ChevronRight size={12} style={{ transform: isTaskOpen ? 'rotate(90deg)' : '', transition: '0.2s' }} onClick={(e) => { e.stopPropagation(); setCollTask(c => ({...c, [t.id]: !c[t.id]})) }} />}
                            <div style={{ fontSize: 14, fontWeight: 500, cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 11, color: 'var(--text-muted)' }}>
                            <div style={{ width: 140 }}>{t.start_date} → {t.end_date}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 80 }}>
                              <div style={{ flex: 1, height: 4, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${tPct}%`, height: '100%', background: 'var(--text-muted)' }} /></div>
                              <span style={{ fontSize: 10 }}>{tPct}%</span>
                            </div>
                            <div style={{ width: 90 }}><StatusPill status={t.status} /></div>
                            <button className="tv-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => router.push(`/tasks/${t.id}`)}>Edit</button>
                          </div>
                        </div>

                        {/* Subtasks */}
                        {tSubs.length > 0 && isTaskOpen && (
                          <div style={{ paddingLeft: 20, paddingBottom: 8 }}>
                            {tSubs.map(s => (
                              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                                <div style={{ flex: 1, color: 'var(--text-muted)' }}>↳ {s.topic}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                  <div style={{ width: 140, color: 'var(--text-muted)', fontSize: 11 }}>{s.start_date} → {s.end_date}</div>
                                  <div style={{ width: 80 }} /> {/* Spacer for progress bar column */}
                                  <div style={{ width: 90 }}><StatusPill status={s.status} /></div>
                                  <div style={{ width: 44 }} /> {/* Spacer for button column */}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                }
              </div>
            )}
          </div>
        )
      })}
    </AppShell>
  )
}
