'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { ArrowLeft, User, Calendar, Layers, CheckCircle2 } from 'lucide-react'

export default function TaskDetail({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [task, setTask] = useState<any>(null)
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Fetch Task
      const { data: tData } = await supabase.from('Tasks').select('*').eq('id', params.id).single()
      if (!tData) {
        router.push('/dashboard')
        return
      }
      setTask(tData)

      // Fetch Subtasks
      const { data: sData } = await supabase.from('Subtasks').select('*').eq('parent_task_id', params.id).order('created_at')
      setSubtasks(sData || [])
      setLoading(false)
    }
    loadData()
  }, [params.id, router])

  if (loading) return <AppShell title="Task Context">Loading operation details...</AppShell>

  const subProgress = subtasks.length === 0 ? 0 : Math.round((subtasks.filter(s => s.status === 'Completed').length / subtasks.length) * 100)

  return (
    <AppShell title="Task Context">
      
      {/* Back Button & Breadcrumb */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} className="tv-btn" style={{ padding: '8px' }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 13, color: 'var(--txt-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          {task.project_name} / Details
        </span>
      </div>

      <div className="task-layout">
        
        {/* LEFT COLUMN: Main Details */}
        <div className="main-col">
          <div className="detail-card">
            <div className="d-header">
              <h1 className="d-title">{task.topic}</h1>
              <StatusPill status={task.status} />
            </div>
            
            <div className="d-section">
              <h3 className="s-label">Task Description</h3>
              <div className="d-body">
                {task.description ? (
                  <div dangerouslySetInnerHTML={{ __html: task.description }} />
                ) : (
                  <span style={{ color: 'var(--txt-muted)' }}>No description provided for this task.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Metadata & Subtasks */}
        <div className="side-col">
          
          {/* Meta Card */}
          <div className="meta-card">
            <h3 className="s-label">Operation Details</h3>
            
            <div className="meta-item">
              <div className="mi-icon"><User size={14} /></div>
              <div className="mi-content">
                <span className="mi-lbl">Primary Owner</span>
                <span className="mi-val">{task.owner || 'Unassigned'}</span>
              </div>
            </div>

            <div className="meta-item">
              <div className="mi-icon"><Layers size={14} /></div>
              <div className="mi-content">
                <span className="mi-lbl">Project Context</span>
                <span className="mi-val" style={{ color: 'var(--accent)' }}>{task.project_name}</span>
              </div>
            </div>

            <div className="meta-row">
              <div className="meta-item inline">
                <div className="mi-icon"><Calendar size={14} /></div>
                <div className="mi-content">
                  <span className="mi-lbl">Start</span>
                  <span className="mi-val">{task.start_date || '--'}</span>
                </div>
              </div>
              <div className="meta-item inline">
                <div className="mi-icon"><Calendar size={14} /></div>
                <div className="mi-content">
                  <span className="mi-lbl">Deadline</span>
                  <span className="mi-val">{task.end_date || '--'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subtasks Card */}
          <div className="meta-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="s-label" style={{ margin: 0 }}>Subtasks</h3>
              <span className="st-progress">{subProgress}%</span>
            </div>
            
            <div className="subtask-list">
              {subtasks.map(s => (
                <div key={s.id} className="subtask-item">
                  <CheckCircle2 size={16} color={s.status === 'Completed' ? 'var(--sl-light)' : 'var(--txt-label)'} />
                  <span style={{ textDecoration: s.status === 'Completed' ? 'line-through' : 'none', color: s.status === 'Completed' ? 'var(--txt-muted)' : 'var(--txt-main)' }}>
                    {s.title}
                  </span>
                </div>
              ))}
              {subtasks.length === 0 && <div className="empty-sub">No subtasks found.</div>}
            </div>
          </div>

        </div>
      </div>

      <style jsx>{`
        .task-layout {
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }

        .main-col { flex: 2; }
        .side-col { flex: 1; display: flex; flex-direction: column; gap: 24px; }

        .detail-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
        }

        .d-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border);
        }

        .d-title { font-size: 24px; font-weight: 800; color: var(--txt-main); margin: 0; max-width: 80%; line-height: 1.3; }
        
        .s-label { font-size: 11px; font-weight: 800; color: var(--txt-label); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        
        .d-body { font-size: 14px; color: var(--txt-muted); line-height: 1.7; }
        
        /* Side Cards */
        .meta-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
        }

        .meta-item { display: flex; gap: 12px; margin-bottom: 20px; }
        .meta-item:last-child { margin-bottom: 0; }
        .meta-row { display: flex; gap: 16px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); }
        .meta-item.inline { margin-bottom: 0; flex: 1; }

        .mi-icon { width: 32px; height: 32px; background: var(--util-bg); border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--txt-muted); flex-shrink: 0; }
        .mi-content { display: flex; flex-direction: column; justify-content: center; }
        .mi-lbl { font-size: 10px; font-weight: 700; color: var(--txt-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .mi-val { font-size: 13px; font-weight: 700; color: var(--txt-main); }

        .st-progress { background: var(--nav-active); color: var(--accent); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; }
        
        .subtask-list { display: flex; flex-direction: column; gap: 12px; }
        .subtask-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; font-weight: 600; padding: 12px; background: var(--util-bg); border-radius: 8px; border: 1px solid var(--border); }
        .empty-sub { font-size: 12px; color: var(--txt-muted); font-style: italic; text-align: center; padding: 12px; }
      `}</style>
    </AppShell>
  )
}
