'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckSquare } from 'lucide-react'

export default function CreateTask() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [form, setForm] = useState({
    topic: '', project_name: '', owner: '', start_date: '', end_date: '',
    status: 'Not Started', priority: 'Medium', description: ''
  })

  useEffect(() => {
    const fetchSelectData = async () => {
      const [pRes, uRes] = await Promise.all([
        supabase.from('Projects').select('name').order('name'),
        supabase.from('Users').select('full_name').order('full_name')
      ])
      setProjects(pRes.data || [])
      setUsers(uRes.data || [])
      setLoadingData(false)
    }
    fetchSelectData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.from('Tasks').insert([{ ...form, assignees: [] }])
    setSubmitting(false)
    if (!error) router.push('/my-tasks')
    else alert('Error creating task: ' + error.message)
  }

  if (loadingData) return <AppShell title="Create Task">Loading form requirements...</AppShell>

  return (
    <AppShell title="Assign Task">
      
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.back()} className="tv-btn" style={{ padding: '8px' }}>
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="form-container">
        <div className="form-header">
          <div className="icon-sq"><CheckSquare size={20} /></div>
          <div>
            <h2 className="form-title">New Operation Ticket</h2>
            <p className="form-desc">Create a new task and route it to the appropriate project and owner.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="project-form">
          
          <div className="input-group">
            <label>Task Topic *</label>
            <input required type="text" placeholder="e.g., Vendor Agreement Review" value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} />
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>Project Portfolio *</label>
              <select required value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})}>
                <option value="" disabled>Select Project</option>
                {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Primary Owner *</label>
              <select required value={form.owner} onChange={e => setForm({...form, owner: e.target.value})}>
                <option value="" disabled>Assign To</option>
                {users.map(u => <option key={u.full_name} value={u.full_name}>{u.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div className="input-group">
              <label>Deadline</label>
              <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>Initial Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="On-Hold">On-Hold</option>
              </select>
            </div>
            <div className="input-group">
              <label>Priority Level</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label>Context & Requirements</label>
            <textarea rows={5} placeholder="Provide necessary links, instructions, or context..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => router.back()} className="btn-cancel">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-submit">
              {submitting ? 'Creating...' : 'Deploy Task'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .form-container {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          max-width: 700px;
          overflow: hidden;
        }

        .form-header {
          padding: 32px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .icon-sq {
          width: 48px;
          height: 48px;
          background: var(--accent-glow);
          color: var(--accent);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .form-title { font-size: 20px; font-weight: 800; color: var(--txt-main); margin: 0 0 4px 0; }
        .form-desc { font-size: 13px; color: var(--txt-muted); margin: 0; }

        .project-form { padding: 32px; display: flex; flex-direction: column; gap: 20px; }
        .form-row { display: flex; gap: 16px; }
        .form-row > * { flex: 1; }

        .input-group { display: flex; flex-direction: column; gap: 8px; }
        .input-group label { font-size: 11px; font-weight: 800; color: var(--txt-label); text-transform: uppercase; letter-spacing: 0.5px; }
        
        .input-group input, .input-group textarea, .input-group select {
          background: var(--util-bg);
          border: 1px solid var(--border);
          color: var(--txt-main);
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
          appearance: none; /* Smooths out default browser styling on selects */
        }

        .input-group select {
          background-image: url('data:image/svg+xml;charset=US-ASCII,<svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="%2364748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
          background-repeat: no-repeat;
          background-position: right 16px center;
          padding-right: 40px;
        }

        .input-group input:focus, .input-group textarea:focus, .input-group select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 24px; }
        
        .btn-cancel { background: transparent; border: 1px solid var(--border); color: var(--txt-muted); padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-cancel:hover { background: var(--util-bg); color: var(--txt-main); }

        .btn-submit { background: linear-gradient(135deg, var(--accent), var(--accent-dark)); border: none; color: white; padding: 10px 24px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px var(--accent-glow); }
        .btn-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </AppShell>
  )
}
