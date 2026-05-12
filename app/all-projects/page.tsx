'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, LayoutList, Columns, Info, X, Calendar, Clock, Search, Plus, ChevronsUpDown, Users } from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started', 'In Progress', 'On-Hold', 'Completed'] as const
const AVATAR_BG = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#FAEEDA', '#FAECE7', '#E1F5EE']
const AVATAR_CL = ['#0C447C', '#27500A', '#3C3489', '#633806', '#712B13', '#085041']

function ini(name: string) {
  const p = (name || '?').trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

// ─── PROJECT INFO MODAL (Screenshot Matched) ───────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose }: any) {
  const projTasks = tasks.filter((t: any) => t.project_name === proj.name)
  const done = projTasks.filter((t: any) => t.status === 'Completed').length
  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0
  const startDate = projTasks.map((t: any) => t.start_date).filter(Boolean).sort()[0] || '—'
  const endDate = projTasks.map((t: any) => t.end_date).filter(Boolean).sort().reverse()[0] || '—'
  
  let duration = '—'
  if (startDate !== '—' && endDate !== '—') {
    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 864e5)
    duration = days > 30 ? `${Math.round(days / 30)} month` : `${days} days`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg)', borderRadius: '12px', width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid var(--brd)' }}>
        <div style={{ background: proj.color_code || '#378ADD', padding: '16px 20px 12px', position: 'relative', color: '#fff' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={12} /></button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{proj.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{projTasks.length} task{projTasks.length !== 1 ? 's' : ''} · {pct}% complete</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#fff' }} /></div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {proj.description && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 6 }}>Description</div><div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{proj.description}</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[ { icon: <Calendar size={12} />, label: 'Start Date', val: startDate }, { icon: <Calendar size={12} />, label: 'End Date', val: endDate }, { icon: <Clock size={12} />, label: 'Duration', val: duration } ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 10px' }}><div style={{ display:'flex', alignItems:'center', gap:4, color:'var(--txt3)', fontSize:10, marginBottom:4, fontWeight:700 }}>{s.icon}{s.label}</div><div style={{ fontSize:12, fontWeight:600 }}>{s.val}</div></div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8 }}>Task Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {[ { l: 'Not Started', b: '#F1EFE8', c: '#5F5E5A' }, { l: 'In Progress', b: '#E6F1FB', c: '#185FA5' }, { l: 'On-Hold', b: '#FAEEDA', c: '#854F0B' }, { l: 'Completed', b: '#EAF3DE', c: '#3B6D11' } ].map(b => (
                <div key={b.l} style={{ background: b.b, borderRadius: 'var(--r)', padding: '6px 8px', textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: b.c }}>{projTasks.filter(t => t.status === b.l).length}</div><div style={{ fontSize: 8, color: b.c, fontWeight: 700 }}>{b.l}</div></div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> Team Members ({members.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map((u: any, i: number) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 'var(--r)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: AVATAR_BG[i % 6], color: AVATAR_CL[i % 6], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{ini(u.full_name || u.email)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{u.full_name || u.email}</div><div style={{ fontSize: 10, color: 'var(--txt3)' }}>{u.role}</div></div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}><div style={{ fontWeight: 700 }}>{projTasks.filter(t => (t.assignees || []).includes(u.full_name) || t.owner === u.full_name).length}</div><div>tasks</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function AllProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collTask, setCollTask] = useState<Record<string, boolean>>({})
  const [infoProj, setInfoProj] = useState<any | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [view, setView] = useState<'list' | 'kanban'>('list')

  useEffect(() => {
    const load = async () => {
      const [p, t, s, us] = await Promise.all([
        supabase.from('Projects').select('*'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
        supabase.from('Users').select('id,full_name,email,role'),
      ])
      setProjects(p.data || []); setTasks(t.data || []); setSubtasks(s.data || []); setAllUsers(us.data || [])
    }
    load()
  }, [])

  const sortedProjects = useMemo(() => {
    return projects
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, searchTerm])

  return (
    <AppShell title="All Projects Portfolio">
      {infoProj && <ProjectInfoModal proj={infoProj} tasks={tasks} allUsers={allUsers} onClose={() => setInfoProj(null)} />}

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }} />
            <input type="text" placeholder="Search projects..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
              style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg)', color: 'var(--txt)', fontSize: 13, outline: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
           <button className={view === 'list' ? 'btn btn-primary' : 'btn'} onClick={() => setView('list')} title="List View"><LayoutList size={16} /></button>
           <button className={view === 'kanban' ? 'btn btn-primary' : 'btn'} onClick={() => setView('kanban')} title="Kanban View"><Columns size={16} /></button>
           <Link href="/projects/create" className="btn btn-primary" style={{ marginLeft: 8 }}><Plus size={14}/> New Project</Link>
        </div>
      </div>

      {view === 'list' ? (
        /* ─── LIST VIEW ─── */
        sortedProjects.map(proj => {
          const ptasks = tasks.filter(t => t.project_name === proj.name)
          const pct = ptasks.length ? Math.round((ptasks.filter(t => t.status === 'Completed').length / ptasks.length) * 100) : 0
          const isOpen = !collapsed[proj.id]
          return (
            <div key={proj.id} style={{ border: '1px solid var(--brd)', borderRadius: 12, background: 'var(--bg)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', cursor: 'pointer', background: isOpen ? 'var(--bg2)' : 'transparent' }} onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: '0.2s', color: 'var(--txt3)' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color_code || '#378ADD' }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{proj.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt3)' }}>({ptasks.length} tasks)</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap
