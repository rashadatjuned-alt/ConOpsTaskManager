'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusDot } from '@/components/ui/StatusPill'
import { 
  Users, CheckCircle2, ListTodo, Clock, X, 
  Settings, ArrowLeft, Filter, LayoutGrid, Activity 
} from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const AVATAR_BG = ['#E6F1FB','#EAF3DE','#EEEDFE','#FAEEDA','#FAECE7','#E1F5EE']
const AVATAR_CL = ['#0C447C','#27500A','#3C3489','#633806','#712B13','#085041']

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

  const memberStats = useMemo(() => {
    return users.filter(u => u.role !== 'Admin').map((u, idx) => {
      const name = u.full_name || u.email
      const uTasks = tasks.filter(t => (t.owner||'').toLowerCase().includes(name.toLowerCase()) || (t.assignees || []).some((a:string) => a.toLowerCase().includes(name.toLowerCase())))
      const filtered = projFilter === 'All' ? uTasks : uTasks.filter(t => t.project_name === projFilter)
      const openTasks = filtered.filter(t => t.status !== 'Completed').length

      return {
        ...u, name, openTasks,
        counts: {
          'Not Started': filtered.filter(t => t.status === 'Not Started').length,
          'In Progress': filtered.filter(t => t.status === 'In Progress').length,
          'On-Hold': filtered.filter(t => t.status === 'On-Hold').length,
          'Completed': filtered.filter(t => t.status === 'Completed').length,
        },
        load: openTasks >= thresholds.overload ? 'overload' : openTasks >= thresholds.heavy ? 'heavy' : openTasks >= thresholds.normal ? 'moderate' : 'light',
        color: AVATAR_BG[idx % 6], textColor: AVATAR_CL[idx % 6]
      }
    })
  }, [users, tasks, projFilter, thresholds])

  if (loading) return <AppShell title="Workload Oversight">Loading...</AppShell>

  return (
    <AppShell title="Workload Oversight">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} className="tv-btn" style={{ padding: '8px' }}><ArrowLeft size={18}/></button>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--txt-main)' }}>Team Bandwidth</h2>
        </div>
        <button className="tv-btn" onClick={() => setShowSettings(true)}><Settings size={14} style={{ marginRight: 6 }}/> Thresholds</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--util-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
          <Filter size={14} color="var(--txt-muted)" />
          <select style={{ background: 'transparent', border: 'none', color: 'var(--txt-main)', fontSize: 13, outline: 'none' }} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
            <option value="All">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--util-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
          {[
            { id: 'overview', icon: <LayoutGrid size={14}/>, label: 'Overview' },
            { id: 'heatmap', icon: <Activity size={14}/>, label: 'Heatmap' },
            { id: 'capacity', icon: <Users size={14}/>, label: 'Capacity' }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: tab === t.id ? 'var(--card-bg)' : 'transparent', color: tab === t.id ? 'var(--txt-main)' : 'var(--txt-muted)' }}>
              {t.icon} {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {memberStats.map(m => (
            <div key={m.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: m.color, color: m.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>{ini(m.name)}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-main)' }}>{m.name}</div><div style={{ fontSize: 11, color: 'var(--txt-muted)' }}>{m.role}</div></div>
                <div style={{ fontSize: 10, fontWeight: 800, color: m.load === 'overload' ? 'var(--sl-over)' : 'var(--sl-light)' }}>{m.load.toUpperCase()}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {STATUSES.map(s => (
                  <div key={s} style={{ background: 'var(--util-bg)', padding: '8px 10px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--txt-main)' }}><StatusDot status={s} /> {s}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt-main)' }}>{m.counts[s]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'heatmap' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--util-bg)', textAlign: 'left' }}><th style={{ padding: '14px 20px', fontSize: 11, color: 'var(--txt-label)' }}>TEAM MEMBER</th>{projects.slice(0, 5).map(p => (<th key={p.id} style={{ padding: '14px 10px', fontSize: 10, color: 'var(--txt-label)', textAlign: 'center' }}>{p.name.toUpperCase()}</th>))}</tr></thead>
            <tbody>{memberStats.map(m => (<tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 24, height: 24, borderRadius: '50%', background: m.color, color: m.textColor, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(m.name)}</div><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt-main)' }}>{m.name}</span></div></td>{projects.slice(0, 5).map(p => { const count = tasks.filter(t => t.project_name === p.name && (t.owner||'').includes(m.name)).length; return (<td key={p.id} style={{ padding: '4px', textAlign: 'center' }}><div style={{ margin: 'auto', width: 36, height: 36, borderRadius: 6, background: count > 0 ? 'var(--accent-glow)' : 'transparent', color: count > 0 ? 'var(--accent)' : 'var(--txt-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{count || '0'}</div></td>)})}</tr>))}</tbody>
          </table>
        </div>
      )}

      {tab === 'capacity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memberStats.sort((a,b) => b.openTasks - a.openTasks).map((m, idx) => (
            <div key={m.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 24, fontSize: 13, fontWeight: 800, color: 'var(--txt-label)' }}>#{idx + 1}</div>
              <div style={{ width: 200, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color, color: m.textColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{ini(m.name)}</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-main)' }}>{m.name}</div></div>
              <div style={{ flex: 1 }}><div style={{ height: 8, background: 'var(--util-bg)', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${Math.min((m.openTasks / thresholds.overload) * 100, 100)}%`, height: '100%', background: m.load === 'overload' ? 'var(--sl-over)' : 'var(--accent)' }} /></div></div>
              <div style={{ width: 60, textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt-main)' }}>{m.openTasks}</div></div>
            </div>
          ))}
        </div>
      )}

      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ width:400, padding:24, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12 }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}><div style={{ fontWeight:700, color: 'var(--txt-main)' }}>Capacity Thresholds</div><X size={18} cursor="pointer" color="var(--txt-muted)" onClick={() => setShowSettings(false)}/></div>{[ { k:'normal', l:'Moderate Start' }, { k:'heavy', l:'Heavy Start' }, { k:'overload', l:'Overload Start' } ].map(row => (<div key={row.k} style={{ marginBottom: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><label style={{ fontSize:11, fontWeight:800, color:'var(--txt-muted)' }}>{row.l}</label><span style={{ fontWeight: 800, color: 'var(--txt-main)' }}>{draftT[row.k as keyof Thresholds]}</span></div><input type="range" min="1" max="25" style={{ width:'100%' }} value={draftT[row.k as keyof Thresholds]} onChange={e => setDraftT({...draftT, [row.k]: parseInt(e.target.value)})} /></div>))}<button className="tv-btn" style={{ width:'100%', marginTop:10 }} onClick={() => { setThresholds(draftT); localStorage.setItem('workload-thresholds', JSON.stringify(draftT)); setShowSettings(false); }}>Save Configurations</button></div>
        </div>
      )}
    </AppShell>
  )
}
