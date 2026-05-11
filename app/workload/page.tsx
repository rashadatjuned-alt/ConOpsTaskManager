'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Users, AlertTriangle, CheckCircle2, BarChart2, Settings, X } from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const STATUS_CLR: Record<string,string> = {
  'Not Started':'#B4B2A9','In Progress':'#378ADD','On-Hold':'#EF9F27','Completed':'#639922'
}
const AVATAR_BG = ['#E6F1FB','#EAF3DE','#EEEDFE','#FAEEDA','#FAECE7','#E1F5EE']
const AVATAR_CL = ['#0C447C','#27500A','#3C3489','#633806','#712B13','#085041']

function initials(name: string) {
  const p = (name||'??').trim().split(' ')
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}

type Tab = 'overview' | 'heatmap' | 'capacity'

interface Thresholds { normal: number; heavy: number; overload: number }

export default function Workload() {
  const router = useRouter()
  const [users,    setUsers]    = useState<any[]>([])
  const [tasks,    setTasks]    = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [myRole,   setMyRole]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<Tab>('overview')
  const [projFilter, setProjFilter] = useState('All')
  const [focusUser,  setFocusUser]  = useState<string|null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [thresholds, setThresholds] = useState<Thresholds>({ normal: 3, heavy: 6, overload: 10 })
  const [draftT, setDraftT] = useState<Thresholds>({ normal: 3, heavy: 6, overload: 10 })

  useEffect(() => {
    const saved = localStorage.getItem('workload-thresholds')
    if (saved) { const t = JSON.parse(saved); setThresholds(t); setDraftT(t) }
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: me } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(me?.role || '')
      const [u, t, s, p] = await Promise.all([
        supabase.from('Users').select('id,full_name,email,role').order('full_name'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Projects').select('*').order('name'),
      ])
      setUsers(u.data || [])
      setTasks(t.data || [])
      setSubtasks(s.data || [])
      setProjects(p.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date(); today.setHours(0,0,0,0)

  const saveThresholds = () => {
    if (draftT.normal >= draftT.heavy || draftT.heavy >= draftT.overload) {
      alert('Thresholds must be in order: Normal < Heavy < Overload'); return
    }
    setThresholds(draftT)
    localStorage.setItem('workload-thresholds', JSON.stringify(draftT))
    setShowSettings(false)
  }

  const getLoad = (total: number) =>
    total >= thresholds.overload ? 'overloaded'
    : total >= thresholds.heavy  ? 'heavy'
    : total >= thresholds.normal ? 'moderate'
    : 'light'

  const LOAD_STYLE: Record<string,{label:string;bg:string;color:string}> = {
    light:      { label:'Light',      bg:'#EAF3DE', color:'#3B6D11' },
    moderate:   { label:'Moderate',   bg:'#E6F1FB', color:'#185FA5' },
    heavy:      { label:'Heavy',      bg:'#FAEEDA', color:'#854F0B' },
    overloaded: { label:'Overloaded', bg:'#FCEBEB', color:'#A32D2D' },
  }

  if (!loading && myRole === 'Team Member') {
    return <AppShell title="Workload"><div className="alert alert-error">Access denied — Managers and Admins only.</div></AppShell>
  }

  const selectedProject = projects.find(p => p.name === projFilter)
  const filteredUsers = projFilter === 'All'
    ? users.filter(u => u.role !== 'Admin')
    : users.filter(u => {
        if (u.role === 'Admin') return false
        if (selectedProject?.members?.includes(u.id)) return true
        const name = u.full_name || u.email
        return tasks.some(t => t.project_name === projFilter &&
          (t.owner||'').toLowerCase().includes(name.toLowerCase()))
      })

  const memberStats = filteredUsers.map((u, idx) => {
    const name = u.full_name || u.email
    const allMyTasks = tasks.filter(t =>
      (t.owner||'').toLowerCase().includes(name.toLowerCase()) ||
      (t.owner||'').toLowerCase().includes((u.email||'').toLowerCase())
    )
    const filteredTasks = projFilter === 'All' ? allMyTasks
      : allMyTasks.filter(t => t.project_name === projFilter)
    const mySubs = subtasks.filter(s =>
      (s.owner||'').toLowerCase().includes(name.toLowerCase()) ||
      (s.owner||'').toLowerCase().includes((u.email||'').toLowerCase())
    )
    const overdueList = filteredTasks.filter(t => {
      if (!t.end_date || t.status === 'Completed') return false
      const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
    })
    const byStatus: Record<string,number> = {}
    STATUSES.forEach(s => { byStatus[s] = filteredTasks.filter(t => t.status === s).length })
    const projSet = [...new Set(allMyTasks.map((t:any) => t.project_name).filter(Boolean))]
    const total = filteredTasks.length
    const done  = byStatus['Completed'] || 0
    const pct   = total ? Math.round(done/total*100) : 0
    return {
      ...u, name, idx, tasks: filteredTasks, allTasks: allMyTasks,
      subtasks: mySubs, overdue: overdueList,
      byStatus, projSet, total, done, pct,
      load: getLoad(total),
      color: AVATAR_BG[idx%AVATAR_BG.length],
      textColor: AVATAR_CL[idx%AVATAR_CL.length],
    }
  })

  const totalOverdue   = memberStats.reduce((a,m) => a+m.overdue.length, 0)
  const totalAssigned  = memberStats.reduce((a,m) => a+m.total, 0)
  const teamCompletion = totalAssigned ? Math.round(memberStats.reduce((a,m)=>a+m.done,0)/totalAssigned*100) : 0
  const focusedMember  = focusUser ? memberStats.find(m => m.id === focusUser) : null

  return (
    <AppShell title="Team Workload">

      {/* Settings modal */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="card" style={{ width:400, padding:28 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:500 }}>Workload Thresholds</div>
              <button onClick={() => setShowSettings(false)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt3)' }}>
                <X size={16}/>
              </button>
            </div>
            <div style={{ fontSize:12, color:'var(--txt3)', marginBottom:16 }}>
              Set how many tasks define each load level for your team.
            </div>

            {[
              { key:'normal',   label:'Normal threshold', desc:'Below this = Light', color:'#3B6D11' },
              { key:'heavy',    label:'Heavy threshold',  desc:'At or above = Heavy', color:'#854F0B' },
              { key:'overload', label:'Overload threshold', desc:'At or above = Overloaded', color:'#A32D2D' },
            ].map(({ key, label, desc, color }) => (
              <div key={key} className="form-group">
                <label className="form-label">{label}</label>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="range" min={1} max={20} step={1}
                    value={draftT[key as keyof Thresholds]}
                    onChange={e => setDraftT(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    style={{ flex:1 }}/>
                  <span style={{ fontSize:16, fontWeight:600, color, minWidth:28, textAlign:'center' }}>
                    {draftT[key as keyof Thresholds]}
                  </span>
                </div>
                <div style={{ fontSize:11, color:'var(--txt3)', marginTop:2 }}>{desc}</div>
              </div>
            ))}

            {/* Preview */}
            <div style={{ background:'var(--bg2)', borderRadius:'var(--r)', padding:'10px 12px', marginBottom:16 }}>
              <div style={{ fontSize:11, color:'var(--txt3)', marginBottom:6 }}>Preview:</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[
                  { label:`0–${draftT.normal-1} tasks`, bg:'#EAF3DE', color:'#3B6D11', text:'Light' },
                  { label:`${draftT.normal}–${draftT.heavy-1} tasks`, bg:'#E6F1FB', color:'#185FA5', text:'Moderate' },
                  { label:`${draftT.heavy}–${draftT.overload-1} tasks`, bg:'#FAEEDA', color:'#854F0B', text:'Heavy' },
                  { label:`${draftT.overload}+ tasks`, bg:'#FCEBEB', color:'#A32D2D', text:'Overloaded' },
                ].map(({ label, bg, color, text }) => (
                  <div key={text} style={{ fontSize:10, padding:'3px 8px', borderRadius:20,
                    background:bg, color }}>
                    {text}: {label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveThresholds}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <select className="form-select" style={{ width:200 }} value={projFilter}
          onChange={e => { setProjFilter(e.target.value); setFocusUser(null) }}>
          <option value="All">All Projects</option>
          {projects.map(p => <option key={p.id}>{p.name}</option>)}
        </select>
        {projFilter !== 'All' && (
          <span style={{ fontSize:12, color:'var(--txt3)' }}>
            {filteredUsers.length} member{filteredUsers.length!==1?'s':''} in project
          </span>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:4, alignItems:'center' }}>
          <button className="btn btn-sm" onClick={() => setShowSettings(true)}
            style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Settings size={13}/> Settings
          </button>
          {(['overview','heatmap','capacity'] as Tab[]).map(t => (
            <button key={t} className={tab===t?'btn btn-primary btn-sm':'btn btn-sm'}
              onClick={() => { setTab(t); setFocusUser(null) }}
              style={{ textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><Users size={15} color="#185FA5"/></div>
          <div className="stat-value blue" style={{ fontSize:26 }}>{loading?'—':filteredUsers.length}</div>
          <div className="stat-label">{projFilter==='All'?'Team members':'Members in project'}</div>
        </div>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><BarChart2 size={15} color="#854F0B"/></div>
          <div className="stat-value amber" style={{ fontSize:26 }}>{loading?'—':totalAssigned}</div>
          <div className="stat-label">Total tasks</div>
        </div>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><AlertTriangle size={15} color="#cc3333"/></div>
          <div className="stat-value red" style={{ fontSize:26 }}>{loading?'—':totalOverdue}</div>
          <div className="stat-label">Overdue tasks</div>
        </div>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><CheckCircle2 size={15} color="#3B6D11"/></div>
          <div className="stat-value green" style={{ fontSize:26 }}>{loading?'—':`${teamCompletion}%`}</div>
          <div className="stat-label">Team completion</div>
        </div>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Loading...</div>}

      {/* ─── OVERVIEW ─── */}
      {!loading && tab==='overview' && !focusedMember && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {memberStats.map(m => {
            const ls = LOAD_STYLE[m.load]
            return (
              <div key={m.id} className="card" style={{ cursor:'pointer' }}
                onClick={() => setFocusUser(m.id)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:m.color, color:m.textColor,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13, fontWeight:500, flexShrink:0 }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize:11, color:'var(--txt3)' }}>{m.role}</div>
                  </div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:500,
                    background: m.overdue.length>0?'#FCEBEB':ls.bg,
                    color: m.overdue.length>0?'#A32D2D':ls.color, whiteSpace:'nowrap' }}>
                    {m.overdue.length>0 ? `⚠ ${m.overdue.length} overdue` : ls.label}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginBottom:12 }}>
                  {[
                    { label:'Tasks',    val:m.total },
                    { label:'Subtasks', val:m.subtasks.length },
                    { label:'Projects', val:m.projSet.length },
                    { label:'Done',     val:`${m.pct}%`,
                      color: m.pct===100?'#3B6D11':m.pct>=50?'#854F0B':'#A32D2D' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign:'center', padding:'6px 4px',
                      background:'var(--bg2)', borderRadius:'var(--r)' }}>
                      <div style={{ fontSize:14, fontWeight:500, color:color||'var(--txt)' }}>{val}</div>
                      <div style={{ fontSize:10, color:'var(--txt3)' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {STATUSES.map(s => {
                  const cnt = m.byStatus[s]||0
                  const pct = m.total ? Math.round(cnt/m.total*100) : 0
                  return (
                    <div key={s} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <div style={{ fontSize:11, color:'var(--txt3)', width:76, flexShrink:0 }}>{s}</div>
                      <div style={{ flex:1, height:5, background:'var(--bg2)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:STATUS_CLR[s], borderRadius:3 }}/>
                      </div>
                      <div style={{ fontSize:11, color:'var(--txt3)', width:16, textAlign:'right' }}>{cnt}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {memberStats.length===0 && (
            <div style={{ gridColumn:'1/-1' }} className="empty-state">
              <div style={{fontSize:32}}>👥</div>
              <div style={{marginTop:8}}>No members found for this project.</div>
            </div>
          )}
        </div>
      )}

      {/* ─── DRILL DOWN ─── */}
      {!loading && tab==='overview' && focusedMember && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <button className="btn btn-sm" onClick={() => setFocusUser(null)}>← Back</button>
            <div style={{ width:32, height:32, borderRadius:'50%',
              background:focusedMember.color, color:focusedMember.textColor,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500 }}>
              {initials(focusedMember.name)}
            </div>
            <div style={{ fontSize:14, fontWeight:500 }}>{focusedMember.name}</div>
            <span style={{ fontSize:11, color:'var(--txt3)' }}>{focusedMember.role}</span>
            <div style={{ marginLeft:'auto', fontSize:12, color:'var(--txt3)' }}>
              {focusedMember.total} tasks · {focusedMember.subtasks.length} subtasks · {focusedMember.projSet.length} projects
            </div>
          </div>
          {focusedMember.overdue.length>0 && (
            <div className="alert alert-error" style={{ marginBottom:12 }}>
              ⚠ {focusedMember.overdue.length} overdue task{focusedMember.overdue.length>1?'s':''}
            </div>
          )}
          {focusedMember.projSet.length===0
            ? <div className="empty-state"><div style={{fontSize:32}}>📋</div><div style={{marginTop:8}}>No tasks assigned.</div></div>
            : focusedMember.projSet.map((projName: string) => {
                const projTasks = focusedMember.tasks.filter((t:any) => t.project_name===projName)
                if (!projTasks.length) return null
                const proj = projects.find(p => p.name===projName)
                return (
                  <div key={projName} className="card" style={{ padding:0, overflow:'hidden', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
                      background:'var(--bg2)', borderBottom:'0.5px solid var(--brd)' }}>
                      <div className="proj-dot" style={{ background:proj?.color_code||'#378ADD' }}/>
                      <div style={{ fontSize:13, fontWeight:500, flex:1, color:'var(--txt)' }}>{projName}</div>
                      <div style={{ fontSize:12, color:'var(--txt3)' }}>{projTasks.length} task{projTasks.length!==1?'s':''}</div>
                    </div>
                    <div style={{ padding:'8px 16px 12px' }}>
                      {projTasks.map((t:any) => {
                        const isOver = t.status!=='Completed' && t.end_date && new Date(t.end_date)<today
                        const taskSubs = subtasks.filter(s => s.parent_task_id===t.id)
                        return (
                          <div key={t.id} className={`task-row ${isOver?'overdue':''}`}
                            onClick={() => router.push(`/tasks/${t.id}`)}>
                            <div style={{ width:8, height:8, borderRadius:'50%',
                              background:STATUS_CLR[t.status]||'#aaa', flexShrink:0 }}/>
                            <div style={{ flex:1 }}>
                              <div className="task-name">{t.topic}</div>
                              <div className="task-meta">
                                {isOver && <span style={{color:'#cc3333'}}>⚠ Due {t.end_date}</span>}
                                {!isOver && t.end_date && <span>Due {t.end_date}</span>}
                                {taskSubs.length>0 && <span>{taskSubs.filter((s:any)=>s.status==='Completed').length}/{taskSubs.length} subtasks</span>}
                              </div>
                            </div>
                            <StatusPill status={t.status}/>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* ─── HEATMAP (simplified, no overflow) ─── */}
      {!loading && tab==='heatmap' && (
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>Task load by member & project</div>
            <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--txt3)', alignItems:'center' }}>
              {[
                { bg:'var(--bg2)', border:'0.5px solid var(--brd)', label:'0' },
                { bg:'#E6F1FB', label:'1–2' },
                { bg:'#FAEEDA', label:'3–5' },
                { bg:'#FCEBEB', label:'6+' },
              ].map(({ bg, border, label }) => (
                <span key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:16, height:16, borderRadius:3, background:bg,
                    border:border||'none', display:'inline-block', flexShrink:0 }}/>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* One row per member — shows top 5 projects to avoid overflow */}
          {memberStats.map((m, mi) => {
            const topProjs = projFilter==='All'
              ? projects.filter(p => m.allTasks.some((t:any) => t.project_name===p.name)).slice(0,5)
              : projects.filter(p => p.name===projFilter)
            return (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10,
                padding:'10px 0', borderBottom: mi<memberStats.length-1?'0.5px solid var(--brd)':'none' }}>
                {/* Member */}
                <div style={{ display:'flex', alignItems:'center', gap:8, width:140, flexShrink:0 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%',
                    background:m.color, color:m.textColor,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, fontWeight:500, flexShrink:0 }}>
                    {initials(m.name)}
                  </div>
                  <span style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                </div>
                {/* Project cells */}
                <div style={{ flex:1, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {topProjs.map(p => {
                    const cnt = m.allTasks.filter((t:any) => t.project_name===p.name).length
                    const bg  = cnt===0?'var(--bg2)':cnt<=2?'#E6F1FB':cnt<=5?'#FAEEDA':'#FCEBEB'
                    const cl  = cnt===0?'var(--txt3)':cnt<=2?'#185FA5':cnt<=5?'#854F0B':'#A32D2D'
                    return (
                      <div key={p.id} style={{ display:'flex', flexDirection:'column',
                        alignItems:'center', gap:3, minWidth:60 }}>
                        <div style={{ fontSize:9, color:'var(--txt3)', maxWidth:60,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>
                          {p.name}
                        </div>
                        <div style={{ width:44, height:28, borderRadius:'var(--r)',
                          background:bg, color:cl, display:'flex', alignItems:'center',
                          justifyContent:'center', fontSize:12, fontWeight: cnt>0?500:400 }}>
                          {cnt||'—'}
                        </div>
                      </div>
                    )
                  })}
                  {projFilter==='All' && projects.filter(p => m.allTasks.some((t:any)=>t.project_name===p.name)).length>5 && (
                    <div style={{ fontSize:11, color:'var(--txt3)', alignSelf:'flex-end' }}>
                      +{projects.filter(p => m.allTasks.some((t:any)=>t.project_name===p.name)).length-5} more
                    </div>
                  )}
                </div>
                {/* Total */}
                <div style={{ width:48, textAlign:'right', flexShrink:0 }}>
                  <span style={{ fontSize:13, fontWeight:600,
                    color: m.load==='overloaded'?'#A32D2D':m.load==='heavy'?'#854F0B':m.load==='moderate'?'#185FA5':'#3B6D11' }}>
                    {m.total}
                  </span>
                  <div style={{ fontSize:10, color:'var(--txt3)' }}>tasks</div>
                </div>
              </div>
            )
          })}
          {memberStats.length===0 && (
            <div style={{ padding:24, textAlign:'center', fontSize:13, color:'var(--txt3)' }}>No members found.</div>
          )}
        </div>
      )}

      {/* ─── CAPACITY ─── */}
      {!loading && tab==='capacity' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ fontSize:12, color:'var(--txt3)' }}>
              Ranked by open tasks. Current thresholds:
            </div>
            {[
              { label:`Light: 0–${thresholds.normal-1}`, bg:'#EAF3DE', color:'#3B6D11' },
              { label:`Moderate: ${thresholds.normal}–${thresholds.heavy-1}`, bg:'#E6F1FB', color:'#185FA5' },
              { label:`Heavy: ${thresholds.heavy}–${thresholds.overload-1}`, bg:'#FAEEDA', color:'#854F0B' },
              { label:`Overloaded: ${thresholds.overload}+`, bg:'#FCEBEB', color:'#A32D2D' },
            ].map(({ label, bg, color }) => (
              <span key={label} style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:bg, color }}>{label}</span>
            ))}
          </div>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {[...memberStats].sort((a,b)=>b.total-a.total).map((m,i,arr) => {
              const open    = m.total-(m.byStatus['Completed']||0)
              const maxOpen = Math.max(...arr.map(x=>x.total-(x.byStatus['Completed']||0)),1)
              const barPct  = Math.round(open/maxOpen*100)
              const ls      = LOAD_STYLE[m.load]
              return (
                <div key={m.id}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
                    borderBottom: i<arr.length-1?'0.5px solid var(--brd)':'none',
                    cursor:'pointer', transition:'background 0.15s' }}
                  onClick={() => { setTab('overview'); setFocusUser(m.id) }}
                  onMouseEnter={e => (e.currentTarget.style.background='var(--bg2)')}
                  onMouseLeave={e => (e.currentTarget.style.background='')}>
                  <div style={{ width:24, color:'var(--txt3)', fontSize:11, fontWeight:500, textAlign:'right', flexShrink:0 }}>#{i+1}</div>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:m.color, color:m.textColor,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, flexShrink:0 }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ width:140, flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize:11, color:'var(--txt3)' }}>{m.role}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11, color:'var(--txt3)' }}>
                      <span>{open} open</span><span>{m.pct}% done</span>
                    </div>
                    <div style={{ height:8, background:'var(--bg2)', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ width:`${barPct}%`, height:'100%', borderRadius:4, transition:'width 0.3s',
                        background: m.load==='overloaded'?'#E24B4A':m.load==='heavy'?'#EF9F27':
                          m.load==='moderate'?'#378ADD':'#639922' }}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:14, flexShrink:0, fontSize:12, color:'var(--txt3)' }}>
                    <span>{m.total} tasks</span>
                    <span>{m.subtasks.length} subs</span>
                    <span>{m.projSet.length} proj</span>
                  </div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:500,
                    whiteSpace:'nowrap', flexShrink:0,
                    background: m.overdue.length>0?'#FCEBEB':ls.bg,
                    color: m.overdue.length>0?'#A32D2D':ls.color }}>
                    {m.overdue.length>0?`⚠ ${m.overdue.length} overdue`:ls.label}
                  </span>
                </div>
              )
            })}
            {memberStats.length===0 && (
              <div style={{ padding:24, textAlign:'center', fontSize:13, color:'var(--txt3)' }}>No members found.</div>
            )}
          </div>
        </div>
      )}

    </AppShell>
  )
}
