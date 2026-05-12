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
          <div 
            key={c.id} 
            className="metric-widget" 
            onClick={() => c.count > 0 && router.push('/my-tasks')}
            style={{ opacity: c.count > 0 ? 1 : 0.6, cursor: c.count > 0 ? 'pointer' : 'default' }}
          >
            <div className="widget-header">
              <div className="widget-icon" style={{ color: c.color }}>{c.icon}</div>
              <div className="widget-value">{c.count}</div>
            </div>
            <div className="widget-label">{c.id}</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .metric-widget {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          transition: background 0.2s, border-color 0.2s;
        }

        .metric-widget:hover {
          background: var(--nav-hover);
          border-color: var(--txt-label);
        }

        .widget-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .widget-value {
          font-size: 28px;
          font-weight: 800;
          color: var(--txt-main);
          line-height: 1;
        }

        .widget-label {
          font-size: 10px;
          color: var(--txt-muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </AppShell>
  )
}
