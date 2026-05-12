'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Briefcase, Calendar, CheckSquare, Clock } from 'lucide-react'

export default function MyProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProjects = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [pRes, tRes] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at', { ascending: false }),
        supabase.from('Tasks').select('project_name, status')
      ])

      const enrichedProjects = (pRes.data || []).map(proj => {
        const pTasks = (tRes.data || []).filter(t => t.project_name === proj.name)
        const completed = pTasks.filter(t => t.status === 'Completed').length
        const total = pTasks.length
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100)
        return { ...proj, taskCount: total, completedCount: completed, progress }
      })

      setProjects(enrichedProjects)
      setLoading(false)
    }
    loadProjects()
  }, [])

  if (loading) return <AppShell title="My Projects">Loading portfolio...</AppShell>

  return (
    <AppShell title="Active Projects">
      <div className="project-grid">
        {projects.map(p => (
          <div key={p.id} className="project-card" onClick={() => router.push(`/projects/${p.id}`)}>
            <div className="card-top">
              <div className="icon-box"><Briefcase size={16} /></div>
              <span className="status-badge">Active</span>
            </div>
            <h3 className="project-title">{p.name}</h3>
            <div className="project-meta">
              <div className="meta-item"><Calendar size={12} /> {p.start_date || 'No Start'}</div>
              <div className="meta-item"><Clock size={12} /> {p.end_date || 'No Deadline'}</div>
            </div>
            <div className="progress-section">
              <div className="progress-labels"><span>Progress</span><span>{p.progress}%</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${p.progress}%` }} /></div>
            </div>
            <div className="card-bottom">
              <div className="task-summary"><CheckSquare size={14} /> {p.completedCount} / {p.taskCount} Tasks</div>
              <button className="tv-btn view-btn">View Details</button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        
        .project-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          transition: background 0.2s, border-color 0.2s;
        }
        .project-card:hover { background: var(--nav-hover); border-color: var(--accent); }
        
        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .icon-box { width: 32px; height: 32px; border-radius: 8px; background: var(--util-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; }
        .status-badge { font-size: 10px; font-weight: 800; text-transform: uppercase; background: var(--util-bg); color: var(--accent); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); }
        .project-title { font-size: 16px; font-weight: 800; color: var(--txt-main); margin: 0 0 12px 0; }
        .project-meta { display: flex; gap: 16px; margin-bottom: 24px; }
        .meta-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--txt-muted); font-weight: 600; }
        .progress-section { margin-bottom: 20px; margin-top: auto; }
        .progress-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: var(--txt-label); text-transform: uppercase; margin-bottom: 8px; }
        .progress-track { height: 6px; background: var(--util-bg); border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); border-radius: 10px; transition: width 0.5s ease; }
        .card-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid var(--border); }
        .task-summary { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: var(--txt-muted); }
        .view-btn { font-size: 11px; padding: 6px 12px; background: transparent; }
        .project-card:hover .view-btn { background: var(--accent); color: white; border-color: var(--accent); }
      `}</style>
    </AppShell>
  )
}
