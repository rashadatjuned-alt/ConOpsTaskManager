'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { ArrowLeft, Calendar, Clock, CheckSquare, Target, Users } from 'lucide-react'

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: pData } = await supabase.from('Projects').select('*').eq('id', params.id).single()
      if (!pData) { router.push('/my-projects'); return }
      setProject(pData)

      const { data: tData } = await supabase.from('Tasks').select('*').eq('project_name', pData.name).order('end_date')
      setTasks(tData || [])
      setLoading(false)
    }
    loadData()
  }, [params.id, router])

  if (loading) return <AppShell title="Project Details">Loading project data...</AppShell>

  const completedTasks = tasks.filter(t => t.status === 'Completed').length
  const progress = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100)
  
  const allAssignees = new Set<string>()
  tasks.forEach(t => {
    if (t.owner) allAssignees.add(t.owner)
    if (t.assignees) t.assignees.forEach((a: string) => allAssignees.add(a))
  })

  return (
    <AppShell title="Project Command Center">
      
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/my-projects')} className="tv-btn" style={{ padding: '8px' }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 13, color: 'var(--txt-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Portfolio / {project.name}
        </span>
      </div>

      <div className="header-card">
        <div className="header-main">
          <div className="title-row">
            <h1 className="project-title">{project.name}</h1>
            <div className="status-badge">Active Deployment</div>
          </div>
          <p className="project-desc">{project.description || 'No detailed description provided for this project.'}</p>
          
          <div className="meta-row">
            <div className="meta-pill"><Calendar size={14} /> Start: {project.start_date || 'TBD'}</div>
            <div className="meta-pill"><Clock size={14} /> End: {project.end_date || 'TBD'}</div>
            <div className="meta-pill"><Users size={14} /> {allAssignees.size} Team Members</div>
          </div>
        </div>

        <div className="header-metrics">
          <div className="metric-box">
            <div className="m-label">Overall Progress</div>
            <div className="m-val">{progress}%</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="metric-box">
            <div className="m-label">Task Completion</div>
            <div className="m-val" style={{ color: 'var(--txt-main)' }}>{completedTasks} <span style={{ fontSize: 16, color: 'var(--txt-muted)' }}>/ {tasks.length}</span></div>
          </div>
        </div>
      </div>

      <div className="ledger-section">
        <h3 className="section-title"><Target size={16} /> Associated Tasks</h3>
        <div className="task-grid">
          {tasks.map(t => (
            <div key={t.id} className="task-row" onClick={() => router.push(`/tasks/${t.id}`)}>
              <div className="t-main">
                <div className="t-topic">{t.topic}</div>
                <div className="t-owner">Owner: {t.owner || 'Unassigned'}</div>
              </div>
              <div className="t-meta">
                <div className="t-date">{t.end_date || 'No Date'}</div>
                <StatusPill status={t.status} />
              </div>
            </div>
          ))}
          {tasks.length === 0 && <div className="empty-state">No tasks have been assigned to this project yet.</div>}
        </div>
      </div>

      <style jsx>{`
        .header-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; display: flex; gap: 40px; margin-bottom: 32px; }
        .header-main { flex: 2; }
        
        .title-row { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
        .project-title { font-size: 24px; font-weight: 900; color: var(--txt-main); margin: 0; }
        .status-badge { background: var(--nav-active); color: var(--accent); padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        
        .project-desc { font-size: 14px; color: var(--txt-muted); line-height: 1.6; margin-bottom: 24px; max-width: 600px; }
        
        .meta-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .meta-pill { display: flex; align-items: center; gap: 8px; background: var(--util-bg); border: 1px solid var(--border); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--txt-muted); }

        .header-metrics { flex: 1; display: flex; flexDirection: column; gap: 16px; border-left: 1px solid var(--border); padding-left: 32px; }
        .metric-box { background: var(--util-bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border); }
        .m-label { font-size: 11px; font-weight: 800; color: var(--txt-label); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .m-val { font-size: 28px; font-weight: 900; color: var(--accent); line-height: 1; margin-bottom: 12px; }
        .progress-track { height: 6px; background: var(--card-bg); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 10px; }

        .section-title { font-size: 14px; font-weight: 800; color: var(--txt-main); margin-bottom: 16px; display: flex; align-items: center; gap: 10px; text-transform: uppercase; letter-spacing: 1px; }
        
        .task-grid { display: flex; flex-direction: column; gap: 8px; }
        .task-row { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
        .task-row:hover { background: var(--nav-hover); border-color: var(--txt-label); }
        
        .t-topic { font-size: 15px; font-weight: 700; color: var(--txt-main); margin-bottom: 4px; }
        .t-owner { font-size: 12px; color: var(--txt-muted); font-weight: 600; }
        .t-meta { display: flex; align-items: center; gap: 24px; }
        .t-date { font-size: 13px; color: var(--txt-muted); font-weight: 600; }
        
        .empty-state { padding: 40px; text-align: center; background: var(--card-bg); border: 1px dashed var(--border); border-radius: 8px; color: var(--txt-muted); font-size: 13px; font-weight: 600; }
      `}</style>
    </AppShell>
  )
}
