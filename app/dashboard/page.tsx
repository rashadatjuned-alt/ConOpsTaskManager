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
  const isManager = me?.role === 'Manager' || me?.role === 'Admin'

  const isMyTask = (t: any) => {
    const o = (t.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e) || o.includes(n)
  }

  const visibleTasks   = isManager ? tasks : tasks.filter(isMyTask)
  const myTasks        = tasks.filter(isMyTask)
  const total          = visibleTasks.length
  const inProg         = visibleTasks.filter(t => t.status === 'In Progress').length
  const completed      = visibleTasks.filter(t => t.status === 'Completed').length
  const overdue        = visibleTasks.filter(t => {
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

  const visibleProjects = isManager
    ? projects
    : projects.filter(proj => {
        if (proj.members?.includes(me?.id)) return true
        return tasks.some(t => t.project_name === proj.name && isMyTask(t))
      })

  const completionRate = total ? Math.round(completed/total*100) : 0
  const pipelineTasks  = isManager ? tasks : myTasks

  const STATUS_DOT: Record<string,string> = {
    'Not Started':'#aaa','In Progress':'#378ADD','On-Hold':'#EF9F27','Completed':'#639922'
  }

  const StatCard = ({ icon, label, value, color, onClick }: any) => (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ marginBottom:8 }}>{icon}</div>
      <div className={`stat-value ${color||''}`} style={{ fontSize:26, marginBottom:2 }}>
        {loading ? '—' : value}
      </div>
      <div className="stat-label" style={{ fontSize:12 }}>{label}</div>
    </div>
  )

  return (
    <AppShell title={isManager ? 'Dashboard — All Teams' : 'Dashboard'}>

      {/* Stats — 5 columns, full inline grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:16 }}>
        <StatCard icon={<Folders size={16} color="#185FA5"/>}     label={isManager?'Total Tasks':'My Tasks'} value={total}       color="blue" />
        <StatCard icon={<AlertCircle size={16} color="#cc3333"/>}  label="Overdue"       value={overdue}      color="red"
          onClick={overdue > 0 ? () => router.push('/my-tasks') : undefined} />
        <StatCard icon={<TrendingUp size={16} color="#854F0B"/>}   label="In Progress"   value={inProg}       color="amber" />
        <StatCard icon={<CheckCircle2 size={16} color="#3B6D11"/>} label="Completed"     value={completed}    color="green" />
        <StatCard icon={<Users size={16} color="#534AB7"/>}        label="Team Members"  value={users.length} />
      </div>

      {/* Completion bar */}
      <div className="card" style={{ padding:'12px 16px', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>
            {isManager ? 'Team Completion' : 'My Completion'}
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:'#3B6D11' }}>{completionRate}%</div>
        </div>
        <div className="prog-bar" style={{ height:8 }}>
          <div className="prog-fill" style={{ width:`${completionRate}%`, background:'#3B6D11', transition:'width 0.4s ease' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--txt3)' }}>
          <span>{completed} completed</span>
          <span>{visibleTasks.filter(t=>t.status==='On-Hold').length} on hold</span>
          <span>{inProg} in progress</span>
          <span>{visibleTasks.filter(t=>t.status==='Not Started').length} not started</span>
        </div>
      </div>

      {/* 3 col section */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Col 1 — overdue + due soon */}
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
                    <div className="task-meta"><span>Due {t.end_date}</span></div>
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
                    <div className="task-meta"><span>Due {t.end_date}</span></div>
                  </div>
                  <StatusPill status={t.status}/>
                </div>
              ))
          }
        </div>

        {/* Col 2 — projects */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>
              Projects ({visibleProjects.length})
            </div>
            <Link href={isManager ? '/all-projects' : '/my-projects'} className="btn btn-sm" style={{ fontSize:11 }}>View all</Link>
          </div>
          {visibleProjects.length === 0
            ? <div style={{ fontSize:12, color:'var(--txt3)' }}>No projects yet.</div>
            : visibleProjects.slice(0,6).map(proj => {
                const pt   = tasks.filter(t => t.project_name === proj.name)
                const done = pt.filter(t => t.status === 'Completed').length
                const over = pt.filter(t => {
                  if (!t.end_date || t.status === 'Completed') return false
                  const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
                }).length
                const pct = pt.length ? Math.round(done/pt.length*100) : 0
                return (
                  <div key={proj.id} style={{ marginBottom:12, cursor:'pointer' }}
                    onClick={() => router.push(isManager ? '/all-projects' : '/my-projects')}>
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

        {/* Col 3 — notifications */}
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

      {/* Pipeline header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>
          {isManager ? 'Team Pipeline' : 'My Pipeline'}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {isManager && (
            <button className="btn btn-sm" onClick={() => router.push('/workload')}
              style={{ display:'flex', alignItems:'center', gap:5 }}>
              <Users size={12}/> Workload
            </button>
          )}
          <Link href="/tasks/create" className="btn btn-primary btn-sm">+ New Task</Link>
        </div>
      </div>

      {/* Kanban — task name only, no project name clutter */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {STATUSES.map(status => {
          const group = pipelineTasks.filter(t => t.status === status)
          return (
            <div key={status}>
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:8,
                borderBottom:'0.5px solid var(--brd)', marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                  background: STATUS_DOT[status] }}/>
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em',
                  textTransform:'uppercase', color:'var(--txt3)' }}>{status}</span>
                <span style={{ marginLeft:'auto', background:'var(--bg2)', color:'var(--txt3)',
                  fontSize:10, padding:'1px 8px', borderRadius:10 }}>{group.length}</span>
              </div>

              {group.length === 0
                ? <div style={{ fontSize:12, color:'var(--txt3)', textAlign:'center',
                    padding:16, border:'0.5px dashed var(--brd)', borderRadius:'var(--r)' }}>
                    No tasks
                  </div>
                : group.slice(0,4).map(t => (
                    <div key={t.id}
                      onClick={() => router.push(`/tasks/${t.id}`)}
                      style={{ background:'var(--bg)', border:'0.5px solid var(--brd)',
                        borderRadius:'var(--r)', padding:'10px 12px', marginBottom:6,
                        cursor:'pointer', transition:'border-color 0.15s, box-shadow 0.15s' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--brd2)'
                        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--brd)'
                        e.currentTarget.style.boxShadow = ''
                      }}>
                      <div style={{ fontSize:13, color:'var(--txt)', lineHeight:1.4,
                        marginBottom: t.end_date ? 5 : 0 }}>
                        {t.topic}
                      </div>
                      {t.end_date && (
                        <div style={{ fontSize:11, color:'var(--txt3)' }}>Due {t.end_date}</div>
                      )}
                    </div>
                  ))
              }
              {group.length > 4 && (
                <div style={{ fontSize:11, color:'var(--txt3)', textAlign:'center', marginTop:4 }}>
                  +{group.length-4} more
                </div>
              )}
            </div>
          )
        })}
      </div>

    </AppShell>
  )
}
