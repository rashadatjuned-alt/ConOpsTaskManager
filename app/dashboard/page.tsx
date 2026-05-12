'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { Activity, CheckCircle2, Clock, ListTodo } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: me } = await supabase.from('Users').select('full_name, role').eq('id', session.user.id).single()
      const name = me?.full_name || ''
      
      const { data: t } = await supabase.from('Tasks').select('*')
      
      // Filter tasks assigned to me
      const myTasks = (t || []).filter(task => 
        (task.owner || '').includes(name) || 
        (task.assignees || []).includes(name)
      )
      
      setTasks(myTasks)
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) return <AppShell title="Dashboard">Loading metrics...</AppShell>

  // Calculate metrics
  const activeTasks = tasks.filter(t => t.status === 'In Progress').length
  const pendingTasks = tasks.filter(t => t.status === 'Not Started').length
  const completedTasks = tasks.filter(t => t.status === 'Completed').length
  
  const today = new Date(); today.setHours(0,0,0,0)
  const nextWeek = new Date(); nextWeek.setDate(today.getDate() + 7)
  const dueSoon = tasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const d = new Date(t.end_date)
    return d >= today && d <= nextWeek
  }).length

  const cards = [
    { id: 'In Progress', count: activeTasks, icon: <Activity size={24}/>, color: 'var(--sl-mod)' },
    { id: 'Due This Week', count: dueSoon, icon: <Clock size={24}/>, color: 'var(--sl-heavy)' },
    { id: 'Not Started', count: pendingTasks, icon: <ListTodo size={24}/>, color: 'var(--txt-muted)' },
    { id: 'Completed', count: completedTasks, icon: <CheckCircle2 size={24}/>, color: 'var(--sl-light)' },
  ]

  return (
    <AppShell title="Personal Dashboard">
      <div className="metrics-grid">
        {cards.map(c => (
          <div key={c.id} className="metric-widget" onClick={() => router.push('/my-tasks')}>
            <div className="widget-icon" style={{ color: c.color }}>{c.icon}</div>
            <div className="widget-value">{c.count}</div>
            <div className="widget-label">{c.id}</div>
            
            {/* Conditional bottom indicator line for important cards */}
            {(c.id === 'In Progress' || c.id === 'Due This Week') && c.count > 0 && (
              <div className="widget-indicator" style={{ background: c.color }} />
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .metric-widget {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        .metric-widget:hover {
          transform: translateY(-4px);
          border-color: var(--txt-label);
          box-shadow: 0 10px 20px -10px var(--accent-glow);
        }

        .widget-icon {
          margin-bottom: 16px;
          opacity: 0.9;
        }

        .widget-value {
          font-size: 36px;
          font-weight: 900;
          color: var(--txt-main);
          line-height: 1;
          margin-bottom: 8px;
        }

        .widget-label {
          font-size: 11px;
          color: var(--txt-muted);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .widget-indicator {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          opacity: 0.8;
        }
      `}</style>
    </AppShell>
  )
}
