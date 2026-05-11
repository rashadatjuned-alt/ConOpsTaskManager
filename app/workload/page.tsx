'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Users, AlertTriangle, CheckCircle2, BarChart2 } from 'lucide-react'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const STATUS_CLR: Record<string, string> = {
  'Not Started': '#B4B2A9',
  'In Progress': '#378ADD',
  'On-Hold':     '#EF9F27',
  'Completed':   '#639922',
}
const AVATAR_COLORS = [
  { bg:'#E6F1FB', color:'#0C447C' },
  { bg:'#EAF3DE', color:'#27500A' },
  { bg:'#EEEDFE', color:'#3C3489' },
  { bg:'#FAEEDA', color:'#633806' },
  { bg:'#FAECE7', color:'#712B13' },
  { bg:'#E1F5EE', color:'#085041' },
]

function initials(name: string) {
  const p = (name||'??').trim().split(' ')
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}

type Tab = 'overview' | 'heatmap' | 'capacity'

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

  if (!loading && myRole === 'Team Member') {
    return (
      <AppShell title="Workload">
        <div className="alert alert-error">Access denied — Managers and Admins only.</div>
      </AppShell>
    )
  }

  // When a project is selected, only show members of that project
  const selectedProject = projects.find(p => p.name === projFilter)
  const filteredUsers = projFilter === 'All'
    ? users.filter(u => u.role !== 'Admin')
    : users.filter(u => {
        if (u.role === 'Admin') return false
        // Check if user is in project members array
        if (selectedProject?.members?.includes(u.id)) return true
        // Or if user has a task in this project
        const name = u.full_name || u.email
        return tasks.some(t =>
          t.project_name === projFilter &&
          (t.owner||'').toLowerCase().includes(name.toLowerCase())
        )
      })

  // Build per-member stats
  const memberStats = filteredUsers.map((u, idx) => {
    const name = u.full_name || u.email
    const allMyTasks = tasks.filter(t => {
      const owner = (t.owner || '').toLowerCase()
      return owner.includes(name.toLowerCase()) || owner.includes((u.email||'').toLowerCase())
    })
    const filteredTasks = projFilter === 'All'
      ? allMyTasks
      : allMyTasks.filter(t => t.project_name === projFilter)

    const mySubs = subtasks.filter(s => {
      const owner = (s.owner || '').toLowerCase()
      return owner.includes(name.toLowerCase()) || owner.includes((u.email||'').toLowerCase())
    })

    const overdueList = filteredTasks.filter(t => {
      if (!t.end_date || t.status === 'Completed') return false
      const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
    })

    const byStatus: Record<string, number> = {}
    STATUSES.forEach(s => { byStatus[s] = filteredTasks.filter(t => t.status === s).length })

    const projSet = [...new Set(allMyTasks.map((t: any) => t.project_name).filter(Boolean))]
    const total   = filteredTasks.length
    const done    = byStatus['Completed']
    const pct     = total ? Math.round(done / total * 100) : 0
    const load    = total >= 10 ? 'overloaded' : total >= 6 ? 'heavy' : total >= 3 ? 'moderate' : 'light'

    return {
      ...u, name, idx,
      tasks: filteredTasks, allTasks: allMyTasks,
      subtasks: mySubs, overdue: overdueList,
      byStatus, projSet, total, done, pct, load,
      color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    }
  })

  const totalOverdue   = memberStats.reduce((a, m) => a + m.overdue.length, 0)
  const totalAssigned  = memberStats.reduce((a, m) => a + m.total, 0)
  const teamCompletion = totalAssigned ? Math.round(memberStats.reduce((a,m) => a+m.done,0) / totalAssigned * 100) : 0

  const LOAD_STYLE: Record<string, { label: string; bg: string; color: string }> = {
    light:      { label: 'Light',      bg:'#EAF3DE', color:'#3B6D11' },
    moderate:   { label: 'Moderate',   bg:'#E6F1FB', color:'#185FA5' },
    heavy:      { label: 'Heavy',      bg:'#FAEEDA', color:'#854F0B' },
    overloaded: { label: 'Overloaded', bg:'#FCEBEB', color:'#A32D2D' },
  }

  const focusedMember = focusUser ? memberStats.find(m => m.id === focusUser) : null

  return (
    <AppShell title="Team Workload">

      {/* Filters + tabs */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <select className="form-select" style={{ width:200 }} value={projFilter}
          onChange={e => { setProjFilter(e.target.value); setFocusUser(null) }}>
          <option value="All">All Projects</option>
          {projects.map(p => <option key={p.id}>{p.name}</option>)}
        </select>
        {projFilter !== 'All' && (
          <span style={{ fontSize:12, color:'var(--txt3)' }}>
            {filteredUsers.length} member{filteredUsers.length!==1?'s':''} in this project
          </span>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {(['overview','heatmap','capacity'] as Tab[]).map(t => (
            <button key={t} className={tab===t ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
              onClick={() => { setTab(t); setFocusUser(null) }}
              style={{ textTransform:'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards — full inline grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><Users size={15} color="#185FA5"/></div>
          <div className="stat-value blue" style={{ fontSize:26 }}>{loading ? '—' : filteredUsers.length}</div>
          <div className="stat-label">{projFilter === 'All' ? 'Team members' : 'Members in project'}</div>
        </div>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><BarChart2 size={15} color="#854F0B"/></div>
          <div className="stat-value amber" style={{ fontSize:26 }}>{loading ? '—' : totalAssigned}</div>
          <div className="stat-label">{projFilter === 'All' ? 'Total tasks' : `Tasks in ${projFilter}`}</div>
        </div>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><AlertTriangle size={15} color="#cc3333"/></div>
          <div className="stat-value red" style={{ fontSize:26 }}>{loading ? '—' : totalOverdue}</div>
          <div className="stat-label">Overdue tasks</div>
        </div>
        <div className="stat-card">
          <div style={{ marginBottom:8 }}><CheckCircle2 size={15} color="#3B6D11"/></div>
          <div className="stat-value green" style={{ fontSize:26 }}>{loading ? '—' : `${teamCompletion}%`}</div>
          <div className="stat-label">Team completion</div>
        </div>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:'var(--txt3)' }}>Loading team data...</div>}

      {/* ─── OVERVIEW TAB ─── */}
      {!loading && tab === 'overview' && !focusedMember && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {memberStats.map(m => {
            const ls = LOAD_STYLE[m.load]
            return (
              <div key={m.id} className="card"
                style={{ cursor:'pointer', transition:'box-shadow 0.15s' }}
                onClick={() => setFocusUser(m.id)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow='')}>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:m.color.bg, color:m.color.color,
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
                    background: m.overdue.length > 0 ? '#FCEBEB' : ls.bg,
                    color: m.overdue.length > 0 ? '#A32D2D' : ls.color,
                    whiteSpace:'nowrap', flexShrink:0 }}>
                    {m.overdue.length > 0 ? `⚠ ${m.overdue.length} overdue` : ls.label}
                  </span>
                </div>

                {/* 4-stat mini grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginBottom:12 }}>
                  {[
                    { label:'Tasks',    val: m.total },
                    { label:'Subtasks', val: m.subtasks.length },
                    { label:'Projects', val: m.projSet.length },
                    { label:'Done',     val: `${m.pct}%`,
                      color: m.pct===100?'#3B6D11': m.pct>=50?'#854F0B':'#A32D2D' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign:'center', padding:'6px 4px',
                      background:'var(--bg2)', borderRadius:'var(--r)' }}>
                      <div style={{ fontSize:14, fontWeight:500, color: color||'var(--txt)' }}>{val}</div>
                      <div style={{ fontSize:10, color:'var(--txt3)' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Status bars */}
                {STATUSES.map(s => {
                  const cnt = m.byStatus[s] || 0
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
          {memberStats.length === 0 && (
            <div style={{ gridColumn:'1/-1' }} className="empty-state">
              <div style={{fontSize:32}}>👥</div>
              <div style={{marginTop:8}}>No members found for this project.</div>
            </div>
          )}
        </div>
      )}

      {/* ─── MEMBER DRILL-DOWN ─── */}
      {!loading && tab === 'overview' && focusedMember && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <button className="btn btn-sm" onClick={() => setFocusUser(null)}>← Back</button>
            <div style={{ width:32, height:32, borderRadius:'50%',
              background: focusedMember.color.bg, color: focusedMember.color.color,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500 }}>
              {initials(focusedMember.name)}
            </div>
            <div style={{ fontSize:14, fontWeight:500 }}>{focusedMember.name}</div>
            <span style={{ fontSize:11, color:'var(--txt3)' }}>{focusedMember.role}</span>
            <div style={{ marginLeft:'auto', fontSize:12, color:'var(--txt3)' }}>
              {focusedMember.total} tasks · {focusedMember.subtasks.length} subtasks · {focusedMember.projSet.length} projects
            </div>
          </div>

          {focusedMember.overdue.length > 0 && (
            <div className="alert alert-error" style={{ marginBottom:12 }}>
              ⚠ {focusedMember.overdue.length} overdue task{focusedMember.overdue.length>1?'s':''}
            </div>
          )}

          {focusedMember.projSet.length === 0
            ? <div className="empty-state"><div style={{fontSize:32}}>📋</div><div style={{marginTop:8}}>No tasks assigned.</div></div>
            : focusedMember.projSet.map((projName: string) => {
                const projTasks = focusedMember.tasks.filter((t: any) => t.project_name === projName)
                if (!projTasks.length) return null
                const proj = projects.find(p => p.name === projName)
                return (
                  <div key={projName} className="card" style={{ padding:0, overflow:'hidden', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
                      background:'var(--bg2)', borderBottom:'0.5px solid var(--brd)' }}>
                      <div className="proj-dot" style={{ background: proj?.color_code||'#378ADD' }}/>
                      <div style={{ fontSize:13, fontWeight:500, flex:1, color:'var(--txt)' }}>{projName}</div>
                      <div style={{ fontSize:12, color:'var(--txt3)' }}>{projTasks.length} task{projTasks.length!==1?'s':''}</div>
                    </div>
                    <div style={{ padding:'8px 16px 12px' }}>
                      {projTasks.map((t: any) => {
                        const isOver = t.status !== 'Completed' && t.end_date && new Date(t.end_date) < today
                        const taskSubs = subtasks.filter(s => s.parent_task_id === t.id)
                        return (
                          <div key={t.id}>
                            <div className={`task-row ${isOver?'overdue':''}`}
                              onClick={() => router.push(`/tasks/${t.id}`)}>
                              <div style={{ width:8, height:8, borderRadius:'50%',
                                background:STATUS_CLR[t.status]||'#aaa', flexShrink:0 }}/>
                              <div style={{ flex:1 }}>
                                <div className="task-name">{t.topic}</div>
                                <div className="task-meta">
                                  {isOver && <span style={{color:'#cc3333'}}>⚠ Due {t.end_date}</span>}
                                  {!isOver && t.end_date && <span>Due {t.end_date}</span>}
                                  {taskSubs.length > 0 && (
                                    <span>{taskSubs.filter((s:any)=>s.status==='Completed').length}/{taskSubs.length} subtasks</span>
                                  )}
                                </div>
                              </div>
                              <StatusPill status={t.status}/>
                            </div>
                            {taskSubs.filter((s: any) => {
                              const o = (s.owner||'').toLowerCase()
                              return o.includes(focusedMember.name.toLowerCase()) || o.includes((focusedMember.email||'').toLowerCase())
                            }).map((s: any) => (
                              <div key={s.id} className="sub-row"
                                style={{ paddingLeft:28, marginBottom:3, cursor:'pointer' }}
                                onClick={() => router.push(`/tasks/${t.id}`)}>
                                <span style={{ color:'var(--txt3)', fontSize:12 }}>↳</span>
                                <span style={{ flex:1, fontSize:12 }}>{s.topic}</span>
                                <span style={{ fontSize:11, color:'var(--txt3)' }}>{s.end_date}</span>
                                <StatusPill status={s.status}/>
                              </div>
                            ))}
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

      {/* ─── HEATMAP TAB ─── */}
      {!loading && tab === 'heatmap' && (
        <div className="card" style={{ overflowX:'auto' }}>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:14, color:'var(--txt)' }}>
            Task load — member × project
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'6px 10px', color:'var(--txt3)', fontWeight:500, width:130 }}>Member</th>
                {projects.map(p => (
                  <th key={p.id} style={{ textAlign:'center', padding:'6px 8px', color:'var(--txt3)', fontWeight:500 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:90 }} title={p.name}>{p.name}</div>
                  </th>
                ))}
                <th style={{ textAlign:'center', padding:'6px 8px', color:'var(--txt)', fontWeight:600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {memberStats.map((m, i) => (
                <tr key={m.id} style={{ borderTop:'0.5px solid var(--brd)' }}>
                  <td style={{ padding:'8px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:26, height:26, borderRadius:'50%',
                        background:m.color.bg, color:m.color.color,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, fontWeight:500, flexShrink:0 }}>
                        {initials(m.name)}
                      </div>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100, fontSize:12 }}>{m.name}</div>
                    </div>
                  </td>
                  {projects.map(p => {
                    const cnt = m.allTasks.filter((t: any) => t.project_name === p.name).length
                    const bg  = cnt === 0 ? 'transparent' : cnt <= 2 ? '#E6F1FB' : cnt <= 5 ? '#FAEEDA' : '#FCEBEB'
                    const clr = cnt === 0 ? 'var(--txt3)' : cnt <= 2 ? '#185FA5' : cnt <= 5 ? '#854F0B' : '#A32D2D'
                    return (
                      <td key={p.id} style={{ textAlign:'center', padding:'8px' }}>
                        <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                          width:36, height:28, borderRadius:'var(--r)', background:bg, color:clr,
                          fontSize:12, fontWeight: cnt>0 ? 500 : 400 }}>
                          {cnt || '—'}
                        </div>
                      </td>
                    )
                  })}
                  <td style={{ textAlign:'center', padding:'8px' }}>
                    <span style={{ fontWeight:600, fontSize:13,
                      color: m.total>=10?'#A32D2D': m.total>=6?'#854F0B': m.total>=3?'#185FA5':'#3B6D11' }}>
                      {m.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display:'flex', gap:16, marginTop:14, fontSize:11, color:'var(--txt3)', alignItems:'center' }}>
            <span>Load:</span>
            {[
              { bg:'transparent', border:'0.5px solid var(--brd)', label:'None' },
              { bg:'#E6F1FB', label:'1–2' },
              { bg:'#FAEEDA', label:'3–5' },
              { bg:'#FCEBEB', label:'6+' },
            ].map(({ bg, border, label }) => (
              <span key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:20, height:16, borderRadius:3, background:bg,
                  border: border||'none', display:'inline-block' }}/>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── CAPACITY TAB ─── */}
      {!loading && tab === 'capacity' && (
        <div>
          <div style={{ fontSize:12, color:'var(--txt3)', marginBottom:12 }}>
            Members ranked by open task count. Heavy ≥6, overloaded ≥10. Click a row to see their tasks.
          </div>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {[...memberStats].sort((a,b) => b.total - a.total).map((m, i, arr) => {
              const open    = m.total - (m.byStatus['Completed']||0)
              const maxOpen = Math.max(...arr.map(x => x.total - (x.byStatus['Completed']||0)), 1)
              const pct     = Math.round(open / maxOpen * 100)
              const ls      = LOAD_STYLE[m.load]
              return (
                <div key={m.id}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
                    borderBottom: i < arr.length-1 ? '0.5px solid var(--brd)' : 'none',
                    cursor:'pointer', transition:'background 0.15s' }}
                  onClick={() => { setTab('overview'); setFocusUser(m.id) }}
                  onMouseEnter={e => (e.currentTarget.style.background='var(--bg2)')}
                  onMouseLeave={e => (e.currentTarget.style.background='')}>

                  <div style={{ width:24, color:'var(--txt3)', fontSize:11, fontWeight:500, textAlign:'right', flexShrink:0 }}>
                    #{i+1}
                  </div>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:m.color.bg, color:m.color.color,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:500, flexShrink:0 }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ width:140, flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize:11, color:'var(--txt3)' }}>{m.role}</div>
                  </div>

                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11, color:'var(--txt3)' }}>
                      <span>{open} open tasks</span>
                      <span>{m.pct}% done</span>
                    </div>
                    <div style={{ height:8, background:'var(--bg2)', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, transition:'width 0.3s',
                        background: m.load==='overloaded'?'#E24B4A': m.load==='heavy'?'#EF9F27':
                          m.load==='moderate'?'#378ADD':'#639922' }}/>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:16, flexShrink:0, fontSize:12, color:'var(--txt3)' }}>
                    <span>{m.total} tasks</span>
                    <span>{m.subtasks.length} subs</span>
                    <span>{m.projSet.length} proj</span>
                  </div>

                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:500,
                    whiteSpace:'nowrap', flexShrink:0,
                    background: m.overdue.length > 0 ? '#FCEBEB' : ls.bg,
                    color: m.overdue.length > 0 ? '#A32D2D' : ls.color }}>
                    {m.overdue.length > 0 ? `⚠ ${m.overdue.length} overdue` : ls.label}
                  </span>
                </div>
              )
            })}
            {memberStats.length === 0 && (
              <div style={{ padding:24, textAlign:'center', fontSize:13, color:'var(--txt3)' }}>
                No members found for this project.
              </div>
            )}
          </div>
        </div>
      )}

    </AppShell>
  )
}
