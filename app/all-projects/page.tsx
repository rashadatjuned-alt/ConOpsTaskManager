'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { 
  ChevronRight, LayoutList, Columns, Info, X, Calendar, 
  ChevronsUpDown, Plus, Filter, Target, Users, Clock, Edit3, Trash2, AlertTriangle, Check
} from 'lucide-react'
import Link from 'next/link'
import type { Resource } from '@/types'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']
const PROJECT_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#84CC16', '#EF4444', '#4D7C0F', '#B45309', '#0284C7', '#2DD4BF', '#EC4899']

function ini(name: string) {
  const p = (name || 'User').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '?')[0].toUpperCase()
}

// ── PROJECT OVERVIEW & RESOURCE EDITING MODAL ──
function ProjectInfoModal({ proj, tasks, allUsers, onClose, onRefresh }: any) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [deleteStage, setDeleteStage] = useState(0)
  const [saving, setSaving] = useState(false)
  
  const [editName, setEditName] = useState(proj.name)
  const [editDesc, setEditDesc] = useState(proj.description || '')
  const [editColor, setEditColor] = useState(proj.color_code || PROJECT_COLORS[0])
  
  const activeMemberIds = (proj.project_members || []).map((m: any) => m.user_id)
  const [editMembers, setEditMembers] = useState<string[]>(activeMemberIds)
  const [resources, setResources] = useState<Resource[]>(Array.isArray(proj.resources) ? proj.resources : [])

  // Live state sync tracker
  useEffect(() => {
    setEditName(proj.name)
    setEditDesc(proj.description || '')
    setEditColor(proj.color_code || PROJECT_COLORS[0])
    const currentIds = (proj.project_members || []).map((m: any) => m.user_id)
    setEditMembers(currentIds)
    setResources(Array.isArray(proj.resources) ? proj.resources : [])
  }, [proj])

  const projTasks = useMemo(() => tasks.filter((t: any) => t.project_id === proj.id || t.project_name === proj.name), [tasks, proj.id, proj.name])
  const done = projTasks.filter((t: any) => t.status === 'Completed').length
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0
  const startDate = projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0] || '—'
  const endDate = projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0] || '—'

  const addResource = () => setResources(p => [...p, { sl: p.length + 1, title: '', link: '' }])
  const updateResource = (i: number, field: 'title' | 'link', val: string) =>
    setResources(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const removeResource = (i: number) =>
    setResources(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sl: idx + 1 })))

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error: projError } = await supabase.from('Projects')
        .update({ 
          name: editName.trim(), 
          description: editDesc.trim(), 
          color_code: editColor,
          resources: resources
        })
        .eq('id', proj.id)

      if (projError) throw projError

      if (editName.trim() !== proj.name) {
        await supabase.from('Tasks').update({ project_name: editName.trim() }).eq('project_id', proj.id)
      }

      await supabase.from('project_members').delete().eq('project_id', proj.id)
      if (editMembers.length > 0) {
        const payload = editMembers.map(uid => ({ project_id: proj.id, user_id: uid }))
        await supabase.from('project_members').insert(payload)
      }

      setMode('view')
      onRefresh(proj.id)
    } catch (err: any) {
      alert(`Save operation failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── UPGRADED DELETE HANDLER WITH EXPLICIT DATABASE VISIBILITY ──
  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('Projects').delete().eq('id', proj.id)
      
      if (error) {
        // Pop up the exact database reason instead of failing silently
        console.error("Supabase Deletion Error Details:", error)
        alert(`Failed to delete project: ${error.message}\nHint: ${error.hint || 'Check Row-Level Security policies.'}`)
        return
      }

      setDeleteStage(0)
      onClose()
      onRefresh()
    } catch (err: any) {
      alert(`An unexpected system error occurred: ${err.message}`)
    }
  }

  const toggleMemberId = (userId: string) => {
    setEditMembers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg)', borderRadius: '24px', width: 560, maxHeight: '85vh', overflow: 'hidden', border: '1px solid var(--brd)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        <div style={{ background: mode === 'edit' ? editColor : (proj.color_code || PROJECT_COLORS[0]), padding: '24px', color: '#fff' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{mode === 'edit' ? 'Modify Scope' : proj.name}</div>
            <button onClick={() => { setMode(mode === 'view' ? 'edit' : 'view'); setDeleteStage(0); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mode === 'view' ? <Edit3 size={16} /> : <X size={16} />}
            </button>
          </div>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {deleteStage > 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: 16, marginLeft: 'auto', marginRight: 'auto' }} />
              <div style={{ fontSize: 18, fontWeight: 800 }}>Confirm Deletion</div>
              <p style={{ fontSize: 13, color: 'var(--txt2)', margin: '12px 0 24px' }}>Wiping this project removes all relationally nested tasks and subtasks permanently.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" style={{ flex: 1, padding: 10, borderRadius: 8, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--brd)', color: 'var(--txt)' }} onClick={() => setDeleteStage(0)}>Cancel</button>
                <button className="btn" style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800, borderRadius: 8, cursor: 'pointer' }} onClick={handleDelete}>Permanently Delete</button>
              </div>
            </div>
          ) : mode === 'edit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)' }}>PROJECT NAME</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width:'100%', padding:'10px', borderRadius:8, border:'1px solid var(--brd)', background:'var(--bg2)', color:'var(--txt)', marginTop: 6, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)' }}>DESCRIPTION</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ width:'100%', minHeight:80, padding:'10px', borderRadius:8, border:'1px solid var(--brd)', background:'var(--bg2)', color:'var(--txt)', marginTop: 6, outline: 'none', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)' }}>COLOR SCHEME</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                  {PROJECT_COLORS.map(c => (
                    <div key={c} onClick={() => setEditColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: editColor === c ? '3px solid var(--txt)' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)' }}>TEAM MEMBERS</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--bg2)', padding: 10, borderRadius: 10, marginTop: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {allUsers.map((u: any) => {
                    const active = editMembers.includes(u.id);
                    return (
                      <div key={u.id} onClick={() => toggleMemberId(u.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: active ? 'var(--bg)' : 'transparent', border: active ? '1px solid var(--brd)' : '1px solid transparent' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{u.full_name}</span>
                        {active && <Check size={14} color={editColor} />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)' }}>PROJECT RESOURCES</label>
                  <button type="button" onClick={addResource} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--txt)' }}>＋ Add Resource</button>
                </div>
                {resources.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '12px', border: '1px dashed var(--brd)', borderRadius: 8 }}>No attachments or scope documentation linked.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                    {resources.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input value={r.title} onChange={e => updateResource(i, 'title', e.target.value)} placeholder="Label..." style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', outline: 'none' }} />
                        <input value={r.link} onChange={e => updateResource(i, 'link', e.target.value)} placeholder="https://..." style={{ flex: 2, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', outline: 'none' }} />
                        <button type="button" onClick={() => removeResource(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--brd)' }}>
                <button onClick={() => setDeleteStage(1)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={16} /> Delete</button>
                <button onClick={handleSave} disabled={saving} style={{ background: editColor, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : '💾 Save Details'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 13, color:'var(--txt2)', whiteSpace: 'pre-wrap' }}>{proj.description || 'No description provided.'}</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[ 
                  { l: 'Start Date', v: startDate, i: Calendar }, 
                  { l: 'End Date', v: endDate, i: Target }, 
                  { l: 'Total Tasks', v: projTasks.length, i: LayoutList } 
                ].map(s => (
                  <div key={s.l} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px', border: '1px solid var(--brd)', textAlign: 'center' }}>
                    <div style={{ color:'var(--txt3)', fontSize:9, fontWeight:800, textTransform:'uppercase', display:'flex', alignItems:'center', gap:4, marginBottom: 4, justifyContent: 'center' }}><s.i size={12}/>{s.l}</div>
                    <div style={{ fontSize:12, fontWeight:700 }}>{s.v}</div>
                  </div>
                ))}
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)' }}>OVERALL PROGRESS</label>
                  <span style={{ fontSize: 11, fontWeight: 800, color: proj.color_code || PROJECT_COLORS[0] }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--brd)' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || PROJECT_COLORS[0] }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', marginBottom: 8, display: 'block' }}>PROJECT ATTACHMENTS & DOCUMENTATION</label>
                {resources.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>No project-level resource reference links attached. Click the top pencil to add some.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg2)', padding: 12, borderRadius: 12, border: '1px solid var(--brd)' }}>
                    {resources.map((r, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: 'var(--txt)' }}>{r.title || 'Untitled Link'}</span>
                        <a href={r.link} target="_blank" rel="noreferrer" style={{ color: proj.color_code || PROJECT_COLORS[0], textDecoration: 'underline', wordBreak: 'break-all', marginLeft: 12 }}>{r.link}</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', marginBottom: 10, display: 'block' }}>PROJECT MEMBERS</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                  {(proj.project_members || []).map((pm: any, i: number) => {
                    const u = allUsers.find((user: any) => user.id === pm.user_id);
                    if (!u) return null;
                    
                    const count = tasks.filter(t => (t.project_id === proj.id) && Array.isArray(t.task_assignees) && t.task_assignees.some((ta: any) => ta.user_id === u.id)).length;
                    
                    return (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '8px', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{ini(u.full_name)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{u.full_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{u.role || 'Member'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{count}</div>
                          <div style={{ fontSize: 8, color: 'var(--txt3)' }}>TASKS</div>
                        </div>
                      </div>
                    )
                  })}
                  {(proj.project_members || []).length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center' }}>No team members added yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── STATUS PICKER INLINE BLOCK ──
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

// ── KANBAN BOARD SUB-VIEW ──
function KanbanBoard({ tasks, projects, allUsers, filterId, onStatusChange }: any) {
  const router = useRouter();
  const filtered = tasks.filter((t: any) => filterId === 'all' || t.project_id === Number(filterId));
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      {STATUSES.map(status => (
        <div key={status} style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '10px', minHeight: '80vh', border: '1px solid var(--brd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><StatusDot status={status} /><span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>{status}</span></div>
            <span style={{ fontSize: '10px', background: 'var(--bg)', padding: '1px 6px', borderRadius: '6px', color: 'var(--txt3)', fontWeight: 700 }}>{filtered.filter((t: any) => t.status === status).length}</span>
          </div>
          {filtered.filter((t: any) => t.status === status).map((t: any) => {
            const targetProj = projects.find((p: any) => p.id === t.project_id || p.name === t.project_name);
            const projectMembers = (targetProj?.project_members || []).map((m: any) => allUsers.find((u: any) => u.id === m.user_id)).filter(Boolean);
            
            return (
              <div key={t.id} onClick={() => router.push(`/tasks/${t.id}`)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '10px', padding: '10px', marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ fontSize: '9px', color: 'var(--txt3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{t.project_name}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt)', marginBottom: 10, lineHeight: 1.3 }}>{t.topic}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex' }}>
                    {projectMembers.slice(0, 3).map((u: any, i: number) => (
                      <div key={u.id} style={{ width: 22, height: 22, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, border: '2px solid var(--bg)', marginLeft: i > 0 ? '-5px' : '0' }}>{ini(u.full_name)}</div>
                    ))}
                  </div>
                  <StatusPicker current={t.status} onUpdate={(val) => onStatusChange(t.id, val)} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  )
}

// ── MAIN PORTFOLIO MODULE ──
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

  const loadData = async (syncProjectId?: any) => {
    try {
      const [p, t, us, pm, ta] = await Promise.all([
        supabase.from('Projects').select('*').order('name'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Users').select('id,full_name,role'),
        supabase.from('project_members').select('*'),
        supabase.from('task_assignees').select('*')
      ])

      if (p.error)  alert(`Projects Table Load Failure: ${p.error.message}`)
      if (t.error)  alert(`Tasks Table Load Failure: ${t.error.message}`)
      if (us.error) alert(`Users Table Load Failure: ${us.error.message}`)
      if (pm.error) alert(`Project Members Table Load Failure: ${pm.error.message}`)
      if (ta.error) alert(`Task Assignees Table Load Failure: ${ta.error.message}`)

      const hydratedProjects = (p.data || []).map(proj => {
        const matchingMembers = (pm.data || []).filter(m => m.project_id === proj.id)
        return {
          ...proj,
          project_members: matchingMembers
        }
      })

      const hydratedTasks = (t.data || []).map(task => {
        const matchingAssignees = (ta.data || []).filter(assignee => assignee.task_id === task.id)
        return {
          ...task,
          task_assignees: matchingAssignees
        }
      })

      setProjects(hydratedProjects)
      setTasks(hydratedTasks)
      setAllUsers(us.data || [])

      if (syncProjectId) {
        const freshRecord = hydratedProjects.find(p => String(p.id) === String(syncProjectId))
        if (freshRecord) {
          setInfoProj(freshRecord)
        }
      }
    } catch (err: any) {
      alert(`System Runtime Error: ${err.message}`)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('Tasks').update({ status: newStatus }).eq('id', id)
    if (!error) setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
  }

  const filteredProjects = useMemo(() => filterId === 'all' ? projects : projects.filter(p => String(p.id) === String(filterId)), [projects, filterId])

  return (
    <AppShell title="All Projects Portfolio">
      {infoProj && <ProjectInfoModal proj={infoProj} tasks={tasks} allUsers={allUsers} onClose={() => setInfoProj(null)} onRefresh={loadData} />}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, background:'var(--bg2)', border:'1px solid var(--brd)', borderRadius:10, padding:'6px 12px' }}>
          <Filter size={14} color="var(--txt3)" />
          <select value={filterId} onChange={e => setFilterId(e.target.value)} style={{ background:'transparent', border:'none', color:'var(--txt)', fontSize:13, outline:'none', cursor: 'pointer' }}>
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn" onClick={() => setAllExpanded(!allExpanded)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--brd)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
          <ChevronsUpDown size={14}/> {allExpanded ? 'Collapse All Sections' : 'Expand All Sections'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
           <button className={`btn ${view === 'list' ? 'selected' : ''}`} style={{ padding: 8, borderRadius: 8, cursor: 'pointer', background: view === 'list' ? 'var(--bg2)' : 'transparent', border: '1px solid var(--brd)' }} onClick={() => setView('list')}><LayoutList size={16} /></button>
           <button className={`btn ${view === 'kanban' ? 'selected' : ''}`} style={{ padding: 8, borderRadius: 8, cursor: 'pointer', background: view === 'kanban' ? 'var(--bg2)' : 'transparent', border: '1px solid var(--brd)' }} onClick={() => setView('kanban')}><Columns size={16} /></button>
           <Link href="/projects/create" className="btn-primary-action" style={{ textDecoration: 'none', background: 'var(--txt)', color: 'var(--bg)', padding: '8px 16px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}><Plus size={14}/> New Project</Link>
        </div>
      </div>

      {view === 'list' ? (
        filteredProjects.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', border: '1px dashed var(--brd)', borderRadius: 12 }}>No active projects setup in portfolio registry dashboard.</div>
        ) : (
          filteredProjects.map(proj => {
            const ptasks = tasks.filter(t => t.project_id === proj.id || t.project_name === proj.name)
            const pct = ptasks.length ? Math.round((ptasks.filter(t => t.status === 'Completed').length / ptasks.length) * 100) : 0
            const isOpen = allExpanded && !collapsed[proj.id]
            const projectMembers = (proj.project_members || []).map((m: any) => allUsers.find(u => u.id === m.user_id)).filter(Boolean)

            return (
              <div key={proj.id} style={{ border: '1px solid var(--brd)', borderRadius: 14, background: 'var(--bg)', overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shd)' }}>
                <div style={{ padding: '10px 16px', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <ChevronRight size={16} style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: '0.2s', color: 'var(--txt3)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color_code || PROJECT_COLORS[0] }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{proj.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: 16 }}>
                      {projectMembers.map((u: any, i: number) => (
                        <div key={u.id} style={{ width: 24, height: 24, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, border: '2px solid var(--bg2)', marginLeft: i > 0 ? '-5px' : '0' }} title={u.full_name}>{ini(u.full_name)}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 120 }}>
                      <div style={{ flex: 1, height: 5, background: 'var(--brd)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: proj.color_code || PROJECT_COLORS[0] }} /></div>
                      <span style={{ fontSize: 10, fontWeight: 800, width: 30, color: 'var(--txt2)' }}>{pct}%</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setInfoProj(proj); }} style={{ background: 'var(--bg3)', border: 'none', color: 'var(--txt2)', cursor: 'pointer', width: 26, height: 26, borderRadius: 6, display:'flex', alignItems:'center', justifyContent:'center' }}><Info size={14}/></button>
                  </div>
                </div>
                {isOpen && (
                  ptasks.length === 0 ? (
                    <div style={{ padding: '14px 20px', fontSize: 13, color: 'var(--txt3)', fontStyle: 'italic', background: 'var(--bg)' }}>No active tasks recorded under this project scope.</div>
                  ) : (
                    ptasks.map(t => (
                      <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 200px 120px 110px', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--brd)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><StatusDot status={t.status} /></div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', textAlign: 'right' }}>{t.start_date || '—'}  ~  {t.end_date || '—'}</div>
                        <div style={{ height: 4, background: 'var(--brd)', borderRadius: 4, overflow: 'hidden', margin: '0 10px' }}><div style={{ width: `${t.status === 'Completed' ? 100 : 0}%`, height: '100%', background: 'var(--txt3)' }} /></div>
                        <StatusPicker current={t.status} onUpdate={(val) => handleStatusChange(t.id, val)} />
                      </div>
                    ))
                  )
                )}
              </div>
            )
          })
        )
      ) : (
        <KanbanBoard tasks={tasks} projects={projects} allUsers={allUsers} filterId={filterId} onStatusChange={handleStatusChange} />
      )}
    </AppShell>
  )
}