'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusPill'
import { 
  Users, CheckCircle2, ListTodo, Clock, AlertCircle, X, 
  Settings, ArrowLeft, History, Hourglass, CalendarDays, 
  Filter, LayoutGrid, Activity 
} from 'lucide-react'

// ─── CONSTANTS & THEMES ───
const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const AVATAR_BG = ['#E6F1FB','#EAF3DE','#EEEDFE','#FAEEDA','#FAECE7','#E1F5EE']
const AVATAR_CL = ['#0C447C','#27500A','#3C3489','#633806','#712B13','#085041']

const LOAD_COLORS = {
  light: { bg: 'rgba(99, 153, 34, 0.12)', text: '#A3D977', border: 'rgba(99, 153, 34, 0.2)', label: 'Light' },
  moderate: { bg: 'rgba(55, 138, 221, 0.12)', text: '#7FBDF8', border: 'rgba(55, 138, 221, 0.2)', label: 'Moderate' },
  heavy: { bg: 'rgba(239, 159, 39, 0.12)', text: '#FFC875', border: 'rgba(239, 159, 39, 0.2)', label: 'Heavy' },
  overload: { bg: 'rgba(239, 68, 68, 0.12)', text: '#FF8A8A', border: 'rgba(239, 68, 68, 0.2)', label: 'Overload' }
}

function ini(name: string) {
  const p = (name||'?').trim().split(' ')
  return p.length >= 2 ? (p[0][0]+p[p.length - 1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
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

  // ─── DATA CALCULATIONS ───
  const memberStats = useMemo(() => {
    return users.filter(u => u.role !== 'Admin').map((u, idx) => {
      const name = u.full_name || u.email
      const uTasks = tasks.filter(t => (t.owner||'').toLowerCase().includes(name.toLowerCase()) || (t.assignees || []).some((a:string) => a.toLowerCase().includes(name.toLowerCase())))
      const filtered = projFilter === 'All' ? uTasks : uTasks.filter(t => t.project_name === projFilter)
      const openTasks = filtered.filter(t => t.status !== 'Completed').length

      let loadKey: keyof typeof LOAD_COLORS = 'light'
      if (openTasks >= thresholds.overload) loadKey = 'overload'
      else if (openTasks >= thresholds.heavy) loadKey = 'heavy'
      else if (openTasks >= thresholds.normal) loadKey = 'moderate'

      const counts = {
        'Not Started': filtered.filter(t => t.status === 'Not Started').length,
        'In Progress': filtered.filter(t => t.status === 'In Progress').length,
        'On-Hold': filtered.filter(t => t.status === 'On-Hold').length,
        'Completed': filtered.filter(t => t.status === 'Completed').length,
      }
      const userSubtasks = subtasks.filter(s => (s.owner||'').toLowerCase().includes(name.toLowerCase()))

      return {
        ...u, name, openTasks, counts, loadKey,
        subCount: userSubtasks.length,
        total: filtered.length,
        color: AVATAR_BG[idx % 6], textColor: AVATAR_CL[idx % 6]
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
      
      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} className="tv-btn" style={{ padding: '8px' }}><ArrowLeft size={18}/></button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Team Bandwidth</h2>
            <p style={{ color: '#555', fontSize: 13 }}>Analyzing distribution across {projFilter}.</p>
          </div>
        </div>
        <button className="tv-btn" onClick={() => setShowSettings(true)}><Settings size={14} style={{ marginRight: 6 }}/> Thresholds</button>
      </div>

      {/* ─── TOOLBAR ─── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', border: '1px solid #222', borderRadius: 8, padding: '4px 12px' }}>
          <Filter size={14} color="#444" />
          <select style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
            <option value="All">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', background: '#111', padding: 4, borderRadius: 10, border: '1px solid #222' }}>
          {[
            { id: 'overview', icon: <LayoutGrid size={14}/>, label: 'Overview' },
            { id: 'heatmap', icon: <Activity size={14}/>, label: 'Heatmap' },
            { id: 'capacity', icon: <Users size={14}/>, label: 'Capacity' }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: tab === t.id ? '#000' : 'transparent', color: tab === t.id ? '#fff' : '#444', transition: '0.2s' }}>
              {t.icon} {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB: OVERVIEW ─── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {memberStats.map(m => {
            const theme = LOAD_COLORS[m.loadKey]
            return (
              <div key={m.id} style={{ background: '#0f0f0f', border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: m.color, color: m.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900 }}>{ini(m.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: '#444', fontWeight: 600 }}>{m.role}</div>
                  </div>
                  <div style={{ background: theme.bg, color: theme.text, padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', border: `1px solid ${theme.border}` }}>
                    {theme.label}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {STATUSES.map(status => (
                    <div key={status} style={{ background: '#141414', padding: '12px', borderRadius: 12, border: '1px solid #1a1a1a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                        <StatusDot status={status} /> {status}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: m.counts[status] > 0 ? '#fff' : '#222' }}>{m.counts[status]}</div>
                    </div>
                  ))}
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: theme.text, opacity: 0.3 }} />
              </div>
            )
          })}
        </div>
      )}

      {/* ─── TAB: HEATMAP ─── */}
      {tab === 'heatmap' && (
        <div style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#141414' }}>
                <th style={{ padding: '18px 24px', fontSize: 11, color: '#444', textAlign: 'left', fontWeight: 900 }}>TEAM MEMBER</th>
                {projects.slice(0, 5).map(p => (
                  <th key={p.id} style={{ padding: '18px 10px', fontSize: 10, color: '#444', textAlign: 'center', fontWeight: 900 }}>{p.name.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberStats.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #141414' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                       <div style={{ width: 28, height: 28, borderRadius: 8, background: m.color, color: m.textColor, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(m.name)}</div>
                       <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>{m.name}</span>
                    </div>
                  </td>
                  {projects.slice(0, 5).map(p => {
                    const count = tasks.filter(t => t.project_name === p.name && (t.owner||'').includes(m.name) && t.status !== 'Completed').length
                    
                    let cellColor = 'transparent'; let textColor = '#222'
                    if (count >= thresholds.overload) { cellColor = LOAD_COLORS.overload.bg; textColor = LOAD_COLORS.overload.text }
                    else if (count >= thresholds.heavy) { cellColor = LOAD_COLORS.heavy.bg; textColor = LOAD_COLORS.heavy.text }
                    else if (count >= 1) { cellColor = LOAD_COLORS.moderate.bg; textColor = LOAD_COLORS.moderate.text }

                    return (
                      <td key={p.id} style={{ padding: '8px' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: cellColor, color: textColor, margin: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, border: count > 0 ? `1px solid ${cellColor}` : '1px dashed #1a1a1a' }}>
                          {count || '0'}
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

      {/* ─── TAB: CAPACITY ─── */}
      {tab === 'capacity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memberStats.sort((a,b) => b.openTasks - a.openTasks).map((m, idx) => {
            const theme = LOAD_COLORS[m.loadKey]
            const barWidth = Math.min((m.openTasks / thresholds.overload) * 100, 100)
            return (
              <div key={m.id} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 32 }}>
                <div style={{ width: 32, fontSize: 14, fontWeight: 900, color: '#222' }}>{String(idx + 1).padStart(2, '0')}</div>
                <div style={{ width: 220 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: theme.text, fontWeight: 800, textTransform: 'uppercase', marginTop: 4 }}>{theme.label} Pressure</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 10, background: '#000', borderRadius: 20, overflow: 'hidden', border: '1px solid #1a1a1a' }}>
                    <div style={{ width: `${barWidth}%`, height: '100%', background: theme.text, boxShadow: `0 0 20px ${theme.text}44`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  </div>
                </div>
                <div style={{ width: 120, textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{m.openTasks}</div>
                  <div style={{ fontSize: 9, color: '#444', fontWeight: 800, textTransform: 'uppercase' }}>Active Tasks</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── THRESHOLD MODAL ─── */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={() => setShowSettings(false)}>
          <div style={{ width:400, background:'#0f0f0f', border:'1px solid #222', borderRadius:20, padding:32 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:24 }}>
              <div style={{ fontWeight:800, fontSize: 18, color:'#fff' }}>Capacity Settings</div>
              <X size={20} cursor="pointer" color="#444" onClick={() => setShowSettings(false)}/>
            </div>
            {[ 
              { k:'normal', l:'Moderate Start', c: LOAD_COLORS.moderate.text }, 
              { k:'heavy', l:'Heavy Start', c: LOAD_COLORS.heavy.text }, 
              { k:'overload', l:'Overload Start', c: LOAD_COLORS.overload.text } 
            ].map(row => (
              <div key={row.k} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <label style={{ fontSize:11, fontWeight:800, color:'#555', textTransform:'uppercase', letterSpacing:1 }}>{row.l}</label>
                  <span style={{ fontSize: 18, fontWeight: 900, color: row.c }}>{draftT[row.k as keyof Thresholds]}</span>
                </div>
                <input 
                  type="range" min="1" max="20" style={{ width:'100%', accentColor: row.c }} 
                  value={draftT[row.k as keyof Thresholds]} 
                  onChange={e => setDraftT({...draftT, [row.k]: parseInt(e.target.value)})} 
                />
              </div>
            ))}
            <button 
              className="tv-btn" 
              style={{ width:'100%', marginTop:10, padding:'14px', background:'linear-gradient(135deg, #378ADD, #1B5299)', border:'none', color:'white', fontWeight:800 }} 
              onClick={() => { setThresholds(draftT); localStorage.setItem('workload-thresholds', JSON.stringify(draftT)); setShowSettings(false); }}
            >
              Update Configurations
            </button>
          </div>
        </div>
      )}

    </AppShell>
  )
}
