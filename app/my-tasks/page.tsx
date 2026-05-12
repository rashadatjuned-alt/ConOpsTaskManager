'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'

export default function MyTasks() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTasks = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: me } = await supabase.from('Users').select('full_name').eq('id', session.user.id).single()
      const name = me?.full_name || ''
      
      const { data: t } = await supabase.from('Tasks').select('*').order('end_date')
      
      const myTasks = (t || []).filter(task => 
        (task.owner || '').includes(name) || 
        (task.assignees || []).includes(name)
      )
      
      setTasks(myTasks)
      setLoading(false)
    }
    loadTasks()
  }, [])

  if (loading) return <AppShell title="My Pipeline">Loading pipeline...</AppShell>

  // Group tasks by status for a Kanban-lite feel
  const groupedTasks = {
    'Active': tasks.filter(t => t.status === 'In Progress' || t.status === 'Not Started'),
    'On Hold': tasks.filter(t => t.status === 'On-Hold'),
    'Completed': tasks.filter(t => t.status === 'Completed'),
  }

  return (
    <AppShell title="My Pipeline">
      
      <div className="pipeline-container">
        
        {/* Active Tasks Column */}
        <div className="pipeline-section">
          <h3 className="section-title">Active Work <span>{groupedTasks['Active'].length}</span></h3>
          <div className="task-list">
            {groupedTasks['Active'].map(t => (
              <div key={t.id} className="task-card" onClick={() => router.push(`/tasks/${t.id}`)}>
                <div className="task-header">
                  <span className="task-project">{t.project_name}</span>
                  <StatusPill status={t.status} />
                </div>
                <div className="task-topic">{t.topic}</div>
                <div className="task-footer">
                  <span className="task-date">Due: {t.end_date || 'No Date'}</span>
                </div>
              </div>
            ))}
            {groupedTasks['Active'].length === 0 && <div className="empty-state">No active tasks.</div>}
          </div>
        </div>

        {/* You can replicate the .pipeline-section above for On-Hold or Completed tasks if you want a side-by-side board, 
            or just stack them vertically as shown below. */}
            
        <div className="pipeline-section" style={{ marginTop: '32px' }}>
          <h3 className="section-title">Completed <span>{groupedTasks['Completed'].length}</span></h3>
          <div className="task-list" style={{ opacity: 0.7 }}>
            {groupedTasks['Completed'].slice(0, 5).map(t => (
              <div key={t.id} className="task-card completed" onClick={() => router.push(`/tasks/${t.id}`)}>
                <div className="task-header">
                  <span className="task-project">{t.project_name}</span>
                </div>
                <div className="task-topic" style={{ textDecoration: 'line-through', color: 'var(--txt-muted)' }}>{t.topic}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style jsx>{`
        .pipeline-container {
          max-width: 800px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--txt-main);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-title span {
          background: var(--border);
          color: var(--txt-muted);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .task-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 20px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .task-card:hover {
          background: var(--nav-hover);
          border-color: var(--txt-label);
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .task-project {
          font-size: 10px;
          font-weight: 800;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .task-topic {
          font-size: 15px;
          font-weight: 700;
          color: var(--txt-main);
          margin-bottom: 12px;
        }

        .task-footer {
          display: flex;
          align-items: center;
          font-size: 11px;
          color: var(--txt-muted);
          font-weight: 600;
        }

        .empty-state {
          padding: 24px;
          text-align: center;
          background: var(--card-bg);
          border: 1px dashed var(--border);
          border-radius: 12px;
          color: var(--txt-muted);
          font-size: 13px;
          font-weight: 600;
        }
      `}</style>
    </AppShell>
  )
}
