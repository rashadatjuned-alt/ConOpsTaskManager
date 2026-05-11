'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Plus, Info, X, ChevronsDownUp, ChevronsUpDown, Save } from 'lucide-react'
import Link from 'next/link'

const COLORS = ['#378ADD','#7F77DD','#EF9F27','#639922','#E24B4A','#3B6D11','#854F0B','#185FA5']

export default function AllProjects() {
  const router = useRouter()
  const [projects,    setProjects]    = useState<any[]>([])
  const [tasks,       setTasks]       = useState<any[]>([])
  const [subtasks,    setSubtasks]    = useState<any[]>([])
  const [allUsers,    setAllUsers]    = useState<any[]>([])
  const [myRole,      setMyRole]      = useState('')
  const [collapsed,   setCollapsed]   = useState<Record<string,boolean>>({})
  const [collTask,    setCollTask]    = useState<Record<string,boolean>>({})
  const [allExpanded, setAllExpanded] = useState(true)

  // Info/edit panel — always shows editable fields for Manager/Admin
  const [infoProj,    setInfoProj]    = useState<any>(null)
  const [editName,    setEditName]    = useState('')
  const [editDesc,    setEditDesc]    = useState('')
  const [editColor,   setEditColor]   = useState('')
  const [editMembers, setEditMembers] = useState<string[]>([])
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')
  const [editError,   setEditError]   = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || '')
      const [p, t, s, us] = await Promise.all([
        supabase.from('Projects').select('*').order('name'),   // A-Z from DB
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Users').select('id,full_name,email'),
      ])
      setProjects(p.data || [])
      setTasks(t.data || [])
      setSubtasks(s.data || [])
      setAllUsers(us.data || [])
    }
    load()
  }, [])

  const canDelete = myRole === 'Admin' || myRole === 'Manager'
  const canEdit   = myRole === 'Admin' || myRole === 'Manager'

  if (myRole && myRole === 'Team Member') return (
    <AppShell title="All Projects">
      <div className="alert alert-error">Access denied — Managers and Admins only.</div>
    </AppShell>
  )

  // Always A-Z
  const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name))

  const toggleAll = () => {
    const next = !allExpanded
    setAllExpanded(next)
    const newState: Record<string,boolean> = {}
    projects.forEach(p => { newState[p.id] = !next })
    setCollapsed(newState)
  }

  const openInfo = (proj: any) => {
    setInfoProj(proj)
    setEditName(proj.name)
    setEditDesc(proj.description || '')
    setEditColor(proj.color_code || '#378ADD')
    setEditMembers(proj.members || [])
    setSaveMsg('')
    setEditError('')
  }

  const closeInfo = () => {
    setInfoProj(null)
    setSaveMsg('')
    setEditError('')
  }

  const saveEdit = async () => {
    if (!editName.trim()) { setEditError('Project name is required.'); return }
    setSaving(true); setEditError(''); setSaveMsg('')
    const oldName = infoProj.name
    const newName = editName.trim()

    const { error } = await supabase.from('Projects').update({
      name: newName,
      description: editDesc.trim(),
      color_code: editColor,
      members: editMembers,
    }).eq('id', infoProj.id)

    if (error) { setEditError(error.message); setSaving(false); return }

    if (oldName !== newName) {
      await supabase.from('Tasks').update({ project_name: newName }).eq('project_name', oldName)
      setTasks(prev => prev.map(t => t.project_name === oldName ? { ...t, project_name: newName } : t))
    }

    const updated = { ...infoProj, name: newName, description: editDesc.trim(), color_code: editColor, members: editMembers }
    setProjects(prev => prev.map(p => p.id === infoProj.id ? updated : p))
    setInfoProj(updated)
    setSaveMsg('✅ Saved!')
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const deleteProject = async (proj: any) => {
    if (!confirm(`Delete project "${proj.name}"? All tasks will remain but lose their project.`)) return
    await supabase.from('Projects').delete().eq('id', proj.id)
    setProjects(prev => prev.filter(p => p.id !== proj.id))
    if (infoProj?.id === proj.id) closeInfo()
  }

  const deleteTask = async (taskId: string, topic: string) => {
    if (!confirm(`Delete task "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('parent_task_id', taskId)
    await supabase.from('Tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSubtasks(prev => prev.filter(s => s.parent_task_id !== taskId))
  }

  const deleteSubtask = async (subId: string, topic: string) => {
    if (!confirm(`Delete subtask "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('id', subId)
    setSubtasks(prev => prev.filter(s => s.id !== subId))
  }

  return (
    <AppShell title="All Projects">
      {/* Toolbar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="btn btn-sm" onClick={toggleAll} style={{ display:'flex', alignItems:'center', gap:4 }}>
            {allExpanded ? <ChevronsDownUp size={13}/> : <ChevronsUpDown size={13}/>}
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
          <div style={{ fontSize:12, color:'var(--txt3)' }}>{projects.length} project{projects.length!==1?'s':''}</div>
        </div>
        <Link href="/projects/create" className="btn btn-primary btn-sm"><Plus size={13}/> New Project</Link>
      </div>

      {projects.length === 0 && <div className="empty-state"><div style={{ fontSize:32 }}>📁</div><div style={{ marginTop:8 }}>No projects yet.</div></div>}

      {sortedProjects.map(proj => {
        const ptasks = tasks.filter(t => t.project_name === proj.name)
        const done   = ptasks.filter(t => t.status === 'Completed').length
        const pct    = ptasks.length ? Math.round(done / ptasks.length * 100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} className="proj-card">
            <div className="proj-header">
              <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor:'pointer' }}
                onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
                <ChevronRight size={14} color="var(--txt3)"
                  style={{ transform: isOpen?'rotate(90deg)':'', transition:'transform 0.2s' }}/>
                <div className="proj-dot" style={{ background: proj.color_code||'#378ADD' }}/>
                <div className="proj-name">{proj.name}</div>
                {proj.description && (
                  <div className="proj-meta" style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {proj.description}
                  </div>
                )}
                <div className="proj-meta">{ptasks.length} task{ptasks.length!==1?'s':''}</div>
                <div style={{ fontSize:12, color:'var(--txt3)' }}>{pct}%</div>
                <div className="prog-bar" style={{ width:60, marginTop:0 }}>
                  <div className="prog-fill" style={{ width:`${pct}%`, background: proj.color_code||'#378ADD' }}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                <button onClick={() => openInfo(proj)} className="btn btn-sm" title="Project info" style={{ padding:'3px 7px' }}>
                  <Info size={13}/>
                </button>
                <Link href="/tasks/create" className="btn btn-sm" title="Add task">
                  <Plus size={12}/>
                </Link>
                {canDelete && (
                  <button onClick={() => deleteProject(proj)} title="Delete project"
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#cc3333', display:'flex', padding:4 }}>
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>

            {isOpen && (
              <div style={{ paddingLeft:22, paddingRight:16, paddingBottom:10 }}>
                <div style={{ borderTop:'0.5px solid var(--brd)', marginBottom:8 }}/>
                {ptasks.length === 0
                  ? <div style={{ fontSize:13, color:'var(--txt3)', padding:'4px 0' }}>No tasks yet.</div>
                  : ptasks.map(t => {
                      const subs = subtasks.filter(s => s.parent_task_id === t.id)
                      const taskOpen = !collTask[t.id]
                      return (
                        <div key={t.id}>
                          <div className="task-row" style={{ marginBottom: subs.length&&taskOpen ? 3 : 6 }}>
                            {subs.length > 0
                              ? <ChevronRight size={12} color="var(--txt3)"
                                  style={{ transform:taskOpen?'rotate(90deg)':'', transition:'transform 0.2s', cursor:'pointer', flexShrink:0 }}
                                  onClick={e => { e.stopPropagation(); setCollTask(c => ({ ...c, [t.id]:!c[t.id] })) }}/>
                              : <div style={{ width:12, flexShrink:0 }}/>
                            }
                            <StatusDot status={t.status}/>
                            <div className="task-name" onClick={() => router.push(`/tasks/${t.id}`)} style={{ flex:1 }}>{t.topic}</div>
                            <div className="task-meta"><span>{t.owner}</span><span>{t.end_date}</span></div>
                            {(t.tags||[]).map((tag:string) => <span key={tag} className="pill pill-tag" style={{ fontSize:10 }}>{tag}</span>)}
                            <StatusPill status={t.status}/>
                            <button onClick={() => router.push(`/tasks/${t.id}`)} className="btn btn-sm" style={{ padding:'2px 6px', fontSize:11 }}>Edit</button>
                            {canDelete && (
                              <button onClick={() => deleteTask(t.id, t.topic)}
                                style={{ background:'none', border:'none', cursor:'pointer', color:'#cc3333', display:'flex', padding:4 }}>
                                <Trash2 size={13}/>
                              </button>
                            )}
                          </div>
                          {subs.length > 0 && taskOpen && (
                            <div style={{ paddingLeft:28, marginBottom:6 }}>
                              {subs.map(s => (
                                <div key={s.id} className="sub-row" style={{ border:'0.5px solid var(--brd)', borderRadius:'var(--r)', marginBottom:3 }}>
                                  <span style={{ color:'var(--txt3)', fontSize:12 }}>↳</span>
                                  <span style={{ flex:1 }}>{s.topic}</span>
                                  <span style={{ fontSize:11, color:'var(--txt3)' }}>{s.start_date} → {s.end_date}</span>
                                  <StatusPill status={s.status}/>
                                  {canDelete && (
                                    <button onClick={() => deleteSubtask(s.id, s.topic)}
                                      style={{ background:'none', border:'none', cursor:'pointer', color:'#cc3333', display:'flex', padding:2 }}>
                                      <Trash2 size={12}/>
                                    </button>
                                  )}
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

      {/* ── INFO PANEL MODAL ─────────────────────────────────────────── */}
      {infoProj && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e => { if (e.target === e.currentTarget) closeInfo() }}>
          <div className="card" style={{ width:500, maxHeight:'88vh', overflowY:'auto', padding:0, position:'relative', borderRadius:12 }}>

            {/* Panel header — colour accent strip */}
            <div style={{ background: editColor||infoProj.color_code||'#378ADD', borderRadius:'12px 12px 0 0', padding:'16px 20px', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ flex:1, fontSize:16, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {editName || infoProj.name}
              </div>
              <button onClick={closeInfo}
                style={{ background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', color:'#fff', display:'flex', padding:6, borderRadius:6 }}>
                <X size={15}/>
              </button>
            </div>

            <div style={{ padding:'20px 24px 24px' }}>
              {editError && <div className="alert alert-error" style={{ marginBottom:12 }}>{editError}</div>}
              {saveMsg   && <div className="alert alert-success" style={{ marginBottom:12 }}>{saveMsg}</div>}

              {/* ── Project Name ── */}
              <div className="form-group">
                <label className="form-label">Project Name</label>
                {canEdit
                  ? <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project name"/>
                  : <div style={{ fontSize:14, color:'var(--txt)', padding:'7px 0' }}>{infoProj.name}</div>
                }
              </div>

              {/* ── Description ── */}
              <div className="form-group">
                <label className="form-label">Description</label>
                {canEdit
                  ? <textarea className="form-textarea" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="What is this project about?" style={{ minHeight:72 }}/>
                  : <div style={{ fontSize:13, color: editDesc?'var(--txt)':'var(--txt3)', padding:'4px 0', lineHeight:1.6 }}>{infoProj.description || 'No description.'}</div>
                }
              </div>

              {/* ── Colour Scheme ── */}
              <div className="form-group">
                <label className="form-label">Accent Colour</label>
                {canEdit
                  ? (
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                      {COLORS.map(c => (
                        <button key={c} onClick={() => setEditColor(c)} type="button" style={{
                          width:30, height:30, borderRadius:'50%', background:c, border:'none',
                          cursor:'pointer', outline: editColor===c ? `3px solid ${c}` : '2px solid transparent',
                          outlineOffset:2, transition:'outline 0.15s'
                        }}/>
                      ))}
                    </div>
                  )
                  : (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                      <div style={{ width:20, height:20, borderRadius:4, background: infoProj.color_code||'#378ADD' }}/>
                      <span style={{ fontSize:12, color:'var(--txt3)' }}>{infoProj.color_code||'—'}</span>
                    </div>
                  )
                }
              </div>

              {/* ── Members ── */}
              <div className="form-group" style={{ marginBottom: canEdit ? 20 : 0 }}>
                <label className="form-label">
                  Members
                  <span style={{ marginLeft:6, fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>
                    ({canEdit ? editMembers.length : (infoProj.members||[]).length} assigned)
                  </span>
                </label>
                {canEdit
                  ? (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                      {allUsers.map(u => {
                        const sel  = editMembers.includes(u.id)
                        const name = u.full_name || u.email
                        const ini  = name.split(' ').map((p:string) => p[0]).join('').slice(0,2).toUpperCase()
                        return (
                          <button key={u.id} type="button"
                            className={sel ? 'toggle-btn sel-owner' : 'toggle-btn'}
                            onClick={() => setEditMembers(prev => prev.includes(u.id) ? prev.filter(m => m!==u.id) : [...prev, u.id])}
                            style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{
                              width:20, height:20, borderRadius:'50%',
                              background: sel ? 'rgba(255,255,255,0.2)' : '#EEEDFE',
                              color: sel ? '#EAF3DE' : '#534AB7',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:9, fontWeight:600
                            }}>{ini}</div>
                            {sel ? '✓ ' : ''}{name}
                          </button>
                        )
                      })}
                    </div>
                  )
                  : (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                      {(infoProj.members||[]).length === 0
                        ? <span style={{ fontSize:12, color:'var(--txt3)' }}>No members assigned.</span>
                        : (infoProj.members||[]).map((mid: string) => {
                            const u = allUsers.find(u => u.id === mid)
                            if (!u) return null
                            const name = u.full_name || u.email
                            const ini  = name.split(' ').map((p:string) => p[0]).join('').slice(0,2).toUpperCase()
                            return (
                              <div key={mid} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', background:'var(--bg2)', borderRadius:20, fontSize:12 }}>
                                <div style={{ width:20, height:20, borderRadius:'50%', background:'#EEEDFE', color:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:600 }}>{ini}</div>
                                {name}
                              </div>
                            )
                          })
                      }
                    </div>
                  )
                }
              </div>

              {/* ── Stats row (always shown) ── */}
              <div style={{ display:'flex', gap:16, padding:'12px 0', borderTop:'0.5px solid var(--brd)', borderBottom:'0.5px solid var(--brd)', marginBottom: canEdit ? 20 : 0 }}>
                <div style={{ textAlign:'center', flex:1 }}>
                  <div style={{ fontSize:20, fontWeight:600, color:'var(--txt)' }}>{tasks.filter(t=>t.project_name===infoProj.name).length}</div>
                  <div style={{ fontSize:11, color:'var(--txt3)', marginTop:2 }}>Tasks</div>
                </div>
                <div style={{ textAlign:'center', flex:1 }}>
                  <div style={{ fontSize:20, fontWeight:600, color:'#3B6D11' }}>{tasks.filter(t=>t.project_name===infoProj.name&&t.status==='Completed').length}</div>
                  <div style={{ fontSize:11, color:'var(--txt3)', marginTop:2 }}>Completed</div>
                </div>
                <div style={{ textAlign:'center', flex:1 }}>
                  <div style={{ fontSize:20, fontWeight:600, color:'#185FA5' }}>{tasks.filter(t=>t.project_name===infoProj.name&&t.status==='In Progress').length}</div>
                  <div style={{ fontSize:11, color:'var(--txt3)', marginTop:2 }}>In Progress</div>
                </div>
              </div>

              {/* ── Save button (Manager/Admin only) ── */}
              {canEdit && (
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}
                    style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Save size={13}/>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
