'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, TrendingUp, Folders, Users } from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const

export default function Dashboard() {
  const router  = useRouter()
  const [tasks,    setTasks]    = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users,    setUsers]    = useState<any[]>([])
  const [notifs,   setNotifs]   = useState<any[]>([])
  const [me,       setMe]       = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  // Track which pipeline columns are expanded
  const [colExpanded, setColExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      const [t, p, us, n] = await Promise.all([
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Users').select('id,full_name,email,role'),
        supabase.from('Notifications').select('*')
          .eq('user_id', session.user.id).eq('is_read', false)
          .order('created_at', { ascending: false }).limit(5),
      ])
      setTasks(t.data || [])
      setProjects(p.data || [])
      setUsers(us.data || [])
      setNotifs(n.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date(); today.setHours(0,0,0,0)

  const isMyTask = (t: any) => {
    const o = (t.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e) || o.includes(n)
  }

  const myTasks   = tasks.filter(isMyTask)
  const total     = tasks.length
  const inProg    = tasks.filter(t => t.status === 'In Progress').length
  const completed = tasks.filter(t => t.status === 'Completed').length
  const overdue   = tasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
  }).length

  const myOverdue = myTasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
  })
  const myDueSoon = myTasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const e = new Date(t.end_date); e.setHours(0,0,0,0)
    const diff = Math.round((e.getTime() - today.getTime()) / 864e5)
    return diff >= 0 && diff <= 7
  })

  const completionRate = total ? Math.round(completed/total*100) : 0

  const StatCard = ({ icon, label, value, color, onClick }: any) => (
    <div className="stat-card" onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ padding:6, borderRadius:'var(--r)', background:'var(--bg)', display:'flex' }}>{icon}</div>
      </div>
      <div className={`stat-value ${color||''}`} style={{ fontSize:28, marginBottom:4 }}>
        {loading ? '—' : value}
      </div>
      <div className="stat-label" style={{ fontSize:12 }}>{label}</div>
    </div>
  )

  const PIPELINE_PREVIEW = 4

  return (
    <AppShell title="Dashboard">
      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(5,1fr)', marginBottom:16 }}>
        <StatCard icon={<Folders size={16} color="#185FA5"/>}    label="Total Tasks"  value={total}        color="blue" />
        <StatCard icon={<AlertCircle size={16} color="#cc3333"/>} label="Overdue"      value={overdue}      color="red"
          onClick={overdue > 0 ? () => router.push('/my-tasks') : undefined} />
        <StatCard icon={<TrendingUp size={16} color="#854F0B"/>}  label="In Progress"  value={inProg}       color="amber" />
        <StatCard icon={<CheckCircle2 size={16} color="#3B6D11"/>}label="Completed"    value={completed}    color="green" />
        <StatCard icon={<Users size={16} color="#534AB7"/>}       label="Team Members" value={users.length} />
      </div>

      {/* Completion bar */}
      <div className="card" style={{ padding:'12px 16px', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>Overall Completion</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#3B6D11' }}>{completionRate}%</div>
        </div>
        <div className="prog-bar" style={{ height:8 }}>
          <div className="prog-fill" style={{ width:`${completionRate}%`, background:'#3B6D11', transition:'width 0.4s ease' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--txt3)' }}>
          <span>{completed} completed</span>
          <span>{tasks.filter(t=>t.status==='On-Hold').length} on hold</span>
          <span>{inProg} in progress</span>
          <span>{tasks.filter(t=>t.status==='Not Started').length} not started</span>
        </div>
      </div>

      {/* 3 col section */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Col 1 — My overdue + due soon */}
        <div>
          {myOverdue.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#cc3333', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                My Overdue
                <span style={{ background:'#fff0f0', color:'#cc3333', fontSize:10, padding:'1px 6px', borderRadius:10 }}>{myOverdue.length}</span>
              </div>
              {myOverdue.slice(0,3).map(t => (
                <div key={t.id} className="task-row overdue" onClick={() => router.push(`/tasks/${t.id}`)}>
                  <StatusDot status={t.status}/>
                  <div style={{ flex:1 }}>
                    <div className="task-name">{t.topic}</div>
                    <div className="task-meta"><span>Due {t.end_date}</span><span>{t.project_name}</span></div>
                  </div>
                  <StatusPill status={t.status}/>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            Due This Week
            <span style={{ background:'var(--bg2)', color:'var(--txt3)', fontSize:10, padding:'1px 6px', borderRadius:10 }}>{myDueSoon.length}</span>
          </div>
          {myDueSoon.length === 0
            ? <div style={{ fontSize:12, color:'var(--txt3)', padding:'8px 0' }}>Nothing due this week.</div>
            : myDueSoon.slice(0,4).map(t => (
                <div key={t.id} className="task-row" onClick={() => router.push(`/tasks/${t.id}`)}>
                  <StatusDot status={t.status}/>
                  <div style={{ flex:1 }}>
                    <div className="task-name">{t.topic}</div>
                    <div className="task-meta"><span>Due {t.end_date}</span><span>{t.project_name}</span></div>
                  </div>
                  <StatusPill status={t.status}/>
                </div>
              ))
          }
        </div>

        {/* Col 2 — Projects */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>Projects</div>
            <Link href="/my-projects" className="btn btn-sm" style={{ fontSize:11 }}>View all</Link>
          </div>
          {projects.length === 0
            ? <div style={{ fontSize:12, color:'var(--txt3)' }}>No projects yet.</div>
            : projects.slice(0,6).map(proj => {
                const pt   = tasks.filter(t => t.project_name === proj.name)
                const done = pt.filter(t => t.status === 'Completed').length
                const over = pt.filter(t => {
                  if (!t.end_date || t.status === 'Completed') return false
                  const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
                }).length
                const pct = pt.length ? Math.round(done/pt.length*100) : 0
                return (
                  <div key={proj.id} style={{ marginBottom:12, cursor:'pointer' }} onClick={() => router.push('/my-projects')}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <div className="proj-dot" style={{ background: proj.color_code||'#378ADD' }}/>
                      <div style={{ fontSize:13, fontWeight:500, flex:1, color:'var(--txt)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{proj.name}</div>
                      <div style={{ fontSize:11, color:'var(--txt3)', whiteSpace:'nowrap' }}>{done}/{pt.length}</div>
                      {over > 0 && <span className="pill pill-oh" style={{ fontSize:9 }}>{over} late</span>}
                      <span style={{ fontSize:11, fontWeight:600, color: pct===100?'#3B6D11':'var(--txt3)', whiteSpace:'nowrap' }}>{pct}%</span>
                    </div>
                    <div className="prog-bar">
                      <div className="prog-fill" style={{ width:`${pct}%`, background: proj.color_code||'#378ADD', transition:'width 0.4s' }}/>
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* Col 3 — Notifications */}
        <div>
          {notifs.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>
                  Unread
                  <span style={{ background:'#E6F1FB', color:'#185FA5', fontSize:10, padding:'1px 6px', borderRadius:10, marginLeft:6 }}>{notifs.length}</span>
                </div>
                <Link href="/notifications" className="btn btn-sm" style={{ fontSize:11 }}>View all</Link>
              </div>
              <div className="card" style={{ padding:'4px 12px' }}>
                {notifs.map(n => (
                  <div key={n.id} className="notif-item">
                    <div className="notif-dot" style={{ background:'#378ADD' }}/>
                    <div className="notif-text">{n.message}</div>
                    <div className="notif-time">{n.created_at?.slice(0,10)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {notifs.length === 0 && (
            <div style={{ fontSize:12, color:'var(--txt3)' }}>No unread notifications.</div>
          )}
        </div>
      </div>

      {/* Pipeline kanban */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>Team Pipeline</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/workload" className="btn btn-sm" style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }}>
            <Users size={13}/> Workload
          </Link>
          <Link href="/tasks/create" className="btn btn-primary btn-sm">+ New Task</Link>
        </div>
      </div>

      <div className="kanban-grid">
        {STATUSES.map(status => {
          const group = tasks.filter(t => t.status === status)
          const isExpanded = colExpanded[status]
          const visibleTasks = isExpanded ? group : group.slice(0, PIPELINE_PREVIEW)
          const remaining = group.length - PIPELINE_PREVIEW

          return (
            <div key={status}>
              <div className="col-header">
                <div style={{ width:8, height:8, borderRadius:'50%', background:
                  status==='Not Started'?'#aaa':status==='In Progress'?'#378ADD':
                  status==='On-Hold'?'#EF9F27':'#639922' }}/>
                {status}<span className="col-count">{group.length}</span>
              </div>

              {group.length === 0
                ? <div className="col-empty">No tasks</div>
                : visibleTasks.map(t => (
                    <div key={t.id} className="task-row" style={{ marginBottom:6, cursor:'pointer' }}
                      onClick={() => router.push(`/tasks/${t.id}`)}>
                      <StatusDot status={t.status}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div className="task-name" style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.topic}</div>
                        {t.end_date && (
                          <div className="task-meta"><span>Due {t.end_date}</span></div>
                        )}
                      </div>
                    </div>
                  ))
              }

              {/* Expand / collapse more */}
              {group.length > PIPELINE_PREVIEW && (
                <button
                  onClick={() => setColExpanded(prev => ({ ...prev, [status]: !prev[status] }))}
                  style={{
                    width: '100%', marginTop:4, padding:'5px 0',
                    background:'var(--bg2)', border:'0.5px solid var(--brd)',
                    borderRadius:'var(--r)', fontSize:11, color:'var(--txt3)',
                    cursor:'pointer', fontFamily:'Inter,sans-serif',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
                >
                  {isExpanded
                    ? '▲ Show less'
                    : `+${remaining} more`
                  }
                </button>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
