'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Briefcase } from 'lucide-react'

export default function CreateProject() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('Projects').insert([form])
    setLoading(false)
    if (!error) router.push('/my-projects')
    else alert('Error creating project: ' + error.message)
  }

  return (
    <AppShell title="Initiate Project">
      
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.back()} className="tv-btn" style={{ padding: '8px' }}>
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="form-container">
        <div className="form-header">
          <div className="icon-sq"><Briefcase size={20} /></div>
          <div>
            <h2 className="form-title">New Project Scope</h2>
            <p className="form-desc">Define the high-level parameters for your new initiative.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="project-form">
          <div className="input-group">
            <label>Project Name *</label>
            <input required type="text" placeholder="e.g., Q3 Operations Overhaul" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea rows={4} placeholder="Brief summary of objectives..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div className="input-group">
              <label>Target End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => router.back()} className="btn-cancel">Cancel</button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Initiating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .form-container {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          max-width: 600px;
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

        .project-form { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
        .form-row { display: flex; gap: 16px; }
        .form-row > * { flex: 1; }

        .input-group { display: flex; flex-direction: column; gap: 8px; }
        .input-group label { font-size: 11px; font-weight: 800; color: var(--txt-label); text-transform: uppercase; letter-spacing: 0.5px; }
        
        .input-group input, .input-group textarea {
          background: var(--util-bg);
          border: 1px solid var(--border);
          color: var(--txt-main);
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
        }

        .input-group input:focus, .input-group textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
        
        .btn-cancel {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--txt-muted);
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-cancel:hover { background: var(--util-bg); color: var(--txt-main); }

        .btn-submit {
          background: linear-gradient(135deg, var(--accent), var(--accent-dark));
          border: none;
          color: white;
          padding: 10px 24px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
          box-shadow: 0 4px 12px var(--accent-glow);
        }
        .btn-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </AppShell>
  )
}
