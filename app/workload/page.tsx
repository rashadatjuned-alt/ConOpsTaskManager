'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusPill'
import { 
  Users, ArrowLeft, Settings, X, Filter, LayoutGrid, Activity 
} from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const AVATAR_BG = ['#E6F1FB','#EAF3DE','#EEEDFE','#FAEEDA','#FAECE7','#E1F5EE']
const AVATAR_CL = ['#0C447C','#27500A','#3C3489','#633806','#712B13','#085041']

function ini(name: string) {
  const p = (name||'?').trim().split(' ')
  return p.length >= 2 ? (p[0][0]+p[p.length - 1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}

// Workload Stage Color Helper
function getLoadColor(load: string) {
  switch (load) {
    case 'overload': return '#EF4444' // Red
    case 'heavy': return '#F97316'    // Orange
    case 'moderate': return '#3B82F6' // Blue
    case 'light': return '#22C55E'    // Green
    default: return '#888888'
  }
}

type Tab = 'overview' | 'heatmap' | 'capacity'
interface Thresholds { normal: number; heavy: number; overload: number }

export default function Workload() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [myRole, setMyRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [projFilter, setProjFilter] = useState('All')
  const [showSettings, setShowSettings] = useState(false)
  const [showModal, setShowModal] = useState<string | null>(null)
  const [thresholds, setThresholds] = useState<Thresholds>({ normal: 3, heavy: 6, overload: 10 })
  const [draftT, setDraftT] = useState<Thresholds>({ normal: 3, heavy: 6, overload: 10 })

  useEffect(() => {
    const saved = localStorage.getItem('workload-thresholds')
    if (saved) {
      const parsed = JSON.parse(saved)
      setThresholds(parsed); setDraftT(parsed)
    }
    
    const loadData = async () => {
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
      setUsers(u.data || []); setTasks(t.data || []); setSubtasks(s.data || []); setProjects(p.data || []);
      setLoading(false)
    }
    loadData()
  }, [])

  const today = new Date(); today.setHours(0,0,0,0)
  const nextWeek = new Date(); nextWeek.setDate(today.getDate() + 7)
  const thisMonth = today.getMonth(); const thisYear = today.getFullYear()

  const memberStats = useMemo(() => {
    return users.filter(u => u.role !== 'Admin').map((u, idx) => {
      const name = u.full_name || u.email
      
      // Handle array or string assignees defensively
      const isAssigned = (t: any) => {
        const ownerMatch = String(t.owner || '').toLowerCase().includes(name.toLowerCase());
        const assigneeMatch = String(t.assignees || '').toLowerCase().includes(name.toLowerCase());
        return ownerMatch || assigneeMatch;
      }

      const uTasks = tasks.filter(isAssigned)
      const filtered = projFilter === 'All' ? uTasks : uTasks.filter(t => t.project_name === projFilter)
      
      const counts = { 
        'Not Started': filtered.filter(t => t.status === 'Not Started').length, 
        'In Progress': filtered.filter(t => t.status === 'In Progress').length, 
        'On-Hold': filtered.filter(t => t.status === 'On-Hold').length, 
        'Completed': filtered.filter(t => t.status === 'Completed').length 
      }
      
      const userSubtasks = subtasks.filter(s => String(s.owner || '').toLowerCase().includes(name.toLowerCase()))
      const openTasks = filtered.filter(t => t.status !== 'Completed').length
      
      // Calculate Total Projects the user is assigned to
      const userProjectNames = new Set(filtered.map(t => t.project_name).filter(Boolean))

      return {
        ...u, 
        name, 
        total: filtered.length, 
        counts, 
        subCount: userSubtasks.length, 
        openTasks,
        totalProjects: userProjectNames.size,
        load: openTasks >= thresholds.overload ? 'overload' : openTasks >= thresholds.heavy ? 'heavy' : openTasks >= thresholds.normal ? 'moderate' : 'light',
        color: AVATAR_BG[idx % 6], 
        textColor: AVATAR_CL[idx % 6]
      }
    })
  }, [users, tasks, subtasks, projFilter, thresholds])

  const globalMetrics = useMemo(() => {
    const fTasks = projFilter === 'All' ? tasks : tasks.filter(t => t.project_name === projFilter)
    const mTasks = fTasks.map(t => ({ ...t, dateObj: t.end_date ? new Date(t.end_date) : null }))
    return {
      'Not Started': mTasks.filter(t => t.status === 'Not Started'),
      'In Progress': mTasks.filter(t => t.status === 'In Progress'),
      'On-Hold': mTasks.filter(t => t.status === 'On-Hold'),
      'Completed': mTasks.filter(t => t.status === 'Completed'),
      'Overdue': mTasks.filter(t => t.dateObj && t.dateObj < today && t.status !== 'Completed'),
      'Due This Week': mTasks.filter(t => t.dateObj && t.dateObj >= today && t.dateObj <= nextWeek && t.status !== 'Completed'),
      'Due This Month': mTasks.filter(t => t.dateObj && t.dateObj.getMonth() === thisMonth && t.dateObj.getFullYear() === thisYear && t.status !== 'Completed'),
    }
  }, [tasks, projFilter, today])

  if (loading) return <AppShell title="Workload Oversight">Loading Capacity Data...</AppShell>

  return (
    <AppShell title="Workload Oversight">
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} className="tv-btn" style={{ padding: '8px' }}><ArrowLeft size={18}/></button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Team Bandwidth</h2>
            <p style={{ color: 'var(--txt3)', fontSize: 13 }}>Analyzing distribution across {projFilter}.</p>
          </div>
        </div>
        <button className="tv-btn" onClick={() => setShowSettings(true)}><Settings size={14} style={{ marginRight: 6 }}/> Thresholds</button>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 8, padding: '4px 10px' }}>
          <Filter size={14} color="var(--txt3)" />
          <select style={{ background: 'transparent', border: 'none', color: 'var(--txt)', fontSize: 13, outline: 'none' }} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
            <option value="All">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--bg2)', padding: 4, borderRadius: 8, border: '1px solid var(--brd)' }}>
          {[
            { id: 'overview', icon: <LayoutGrid size={14}/>, label: 'Overview' },
            { id: 'heatmap', icon: <Activity size={14}/>, label: 'Heatmap' },
            { id: 'capacity', icon: <Users size={14}/>, label: 'Capacity' }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: tab === t.id ? 'var(--bg)' : 'transparent', color: tab === t.id ? 'var(--txt)' : 'var(--txt3)' }}>
              {t.icon} {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {['Not Started', 'In Progress', 'On-Hold', 'Completed'].map(id => {
          const count = globalMetrics[id as keyof typeof globalMetrics].length
          return (
            <div key={id} onClick={() => count > 0 && setShowModal(id)} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 18, cursor: count > 0 ? 'pointer' : 'default', opacity: count > 0 ? 1 : 0.6 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{count}</div>
              <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase' }}>{id}</div>
            </div>
          )
        })}
      </div>

      {/* TABS */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {memberStats.map(m => (
            <div key={m.id} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: m.color, color: m.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{ini(m.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{m.role}</div>
                </div>
                {/* Fixed Color Badge */}
                <div style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, background: `${getLoadColor(m.load)}1A`, color: getLoadColor(m.load) }}>
                  {m.load.toUpperCase()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {STATUSES.map(s => (
                  <div key={s} style={{ background: 'var(--bg2)', padding: '8px 10px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><StatusDot status={s} /> {s}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{m.counts[s]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'heatmap' && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', textAlign: 'left' }}>
                <th style={{ padding: '14px 20px', fontSize: 11, color: 'var(--txt3)' }}>TEAM MEMBER</th>
                <th style={{ padding: '14px 10px', fontSize: 11, color: 'var(--txt3)', textAlign: 'center', width: 130 }}>TOTAL PROJECTS</th>
                {projects.map(p => (
                  <th key={p.id} style={{ padding: '14px 10px', fontSize: 10, textAlign: 'center', minWidth: 100 }}>{p.name.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberStats.map(m => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--brd)' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: m.color, color: m.textColor, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(m.name)}</div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    </div>
                  </td>
                  {/* New Total Projects Assigned Column */}
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <div style={{ margin: 'auto', width: 36, height: 36, borderRadius: 6, background: 'var(--bg2)', color: 'var(--txt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                      {m.totalProjects}
                    </div>
                  </td>
                  {projects.map(p => { 
                    const count = tasks.filter(t => t.project_name === p.name && (String(t.owner||'').includes(m.name) || String(t.assignees||'').includes(m.name))).length; 
                    return (
                      <td key={p.id} style={{ padding: '4px', textAlign: 'center' }}>
                        <div style={{ margin: 'auto', width: 36, height: 36, borderRadius: 6, background: count > 0 ? '#E6F1FB' : 'transparent', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {count || '-'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'capacity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memberStats.sort((a,b) => b.openTasks - a.openTasks).map((m, idx) => (
            <div key={m.id} style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 24, fontSize: 13, fontWeight: 800, color: 'var(--txt3)' }}>#{idx + 1}</div>
              <div style={{ width: 200, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color, color: m.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{ini(m.name)}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div></div>
              
              {/* Progress bar respecting proper stage color */}
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min((m.openTasks / thresholds.overload) * 100, 100)}%`, height: '100%', background: getLoadColor(m.load), transition: '0.3s' }} />
                </div>
              </div>
              
              <div style={{ width: 100, textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 800 }}>{m.total}</div><div style={{ fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase' }}>Lifetime Tasks</div></div>
            </div>
          ))}
        </div>
      )}

      {/* POPUP MODAL FOR METRICS */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(null)}>
          <div style={{ width: '90%', maxWidth: 900, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--brd)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' }}>Team {showModal} Summary</div><button onClick={() => setShowModal(null)} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer' }}><X size={20}/></button></div>
            <div style={{ padding: 0, maxHeight: '70vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead><tr style={{ fontSize: 11, color: 'var(--txt3)', textTransform: 'uppercase', background: 'var(--bg2)' }}><th style={{ padding: '14px 20px' }}>Task Title</th><th>Project</th><th>Progress</th><th style={{ textAlign: 'right', paddingRight: 20 }}>Members</th></tr></thead>
                <tbody>{globalMetrics[showModal as keyof typeof globalMetrics].map(t => { const subs = subtasks.filter(s => s.parent_task_id === t.id); const pct = subs.length ? Math.round((subs.filter(s => s.status === 'Completed').length / subs.length) * 100) : (t.status === 'Completed' ? 100 : 0); return (<tr key={t.id} style={{ borderBottom: '1px solid var(--brd)', fontSize: 13 }}><td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push(`/tasks/${t.id}`)}>{t.topic}</td><td style={{ color: 'var(--txt2)' }}>{t.project_name}</td><td>{pct}%</td><td style={{ textAlign: 'right', paddingRight: 20 }}><div style={{ display: 'flex', justifyContent: 'flex-end' }}>{[t.owner, ...(t.assignees || [])].filter(Boolean).map((name, i) => (<div key={i} title={name} style={{ width: 22, height: 22, borderRadius: '50%', fontSize: 8, fontWeight: 800, background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)', marginLeft: -8 }}>{ini(name)}</div>))}</div></td></tr>)})}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* THRESHOLD SETTINGS - Fixed Transparency */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter: 'blur(2px)' }}>
          <div style={{ width: 400, padding: 24, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--brd)', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontWeight:700 }}>Capacity Thresholds</div>
              <X size={18} cursor="pointer" color="var(--txt3)" onClick={() => setShowSettings(false)}/>
            </div>
            
            {[ 
              { k:'normal', l:'Moderate Start' }, 
              { k:'heavy', l:'Heavy Start' }, 
              { k:'overload', l:'Overload Start' } 
            ].map(row => (
              <div key={row.k} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize:11, fontWeight:800, color:'var(--txt2)' }}>{row.l}</label>
                  <span style={{ fontWeight: 800 }}>{draftT[row.k as keyof Thresholds]}</span>
                </div>
                <input type="range" min="1" max="25" style={{ width:'100%' }} value={draftT[row.k as keyof Thresholds]} onChange={e => setDraftT({...draftT, [row.k]: parseInt(e.target.value)})} />
              </div>
            ))}
            <button className="btn btn-primary" style={{ width:'100%', marginTop:10 }} onClick={() => { setThresholds(draftT); localStorage.setItem('workload-thresholds', JSON.stringify(draftT)); setShowSettings(false); }}>Save Configurations</button>
          </div>
        </div>
      )}

    </AppShell>
  )
}