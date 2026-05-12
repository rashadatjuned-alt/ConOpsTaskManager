'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Search } from 'lucide-react'

export default function AllTasks() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Managers pull all tasks
      const { data: t } = await supabase.from('Tasks').select('*').order('end_date')
      setTasks(t || [])
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) return <AppShell title="Global Tasks">Loading operations data...</AppShell>

  // Filter logic
  const filteredTasks = tasks.filter(t => 
    t.topic?.toLowerCase().includes(search.toLowerCase()) || 
    t.project_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.owner?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell title="Global Tasks Oversight">
      
      {/* Table Toolbar */}
      <div className="table-toolbar">
        <div className="search-box">
          <Search size={16} color="var(--txt-label)" />
          <input 
            type="text" 
            placeholder="Search by topic, project, or owner..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="metric-summary">
          Total Records: <span>{filteredTasks.length}</span>
        </div>
      </div>

      {/* High Density Table */}
      <div className="table-container">
        <table className="executive-table">
          <thead>
            <tr>
              <th>Task Topic</th>
              <th>Project</th>
              <th>Primary Owner</th>
              <th>Deadline</th>
              <th style={{ textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(t => (
              <tr key={t.id} onClick={() => router.push(`/tasks/${t.id}`)}>
                <td className="fw-bold topic-cell">{t.topic}</td>
                <td className="muted-cell">{t.project_name}</td>
                <td className="owner-cell">
                   <div className="avatar-mini">{t.owner ? t.owner.slice(0,2).toUpperCase() : '?'}</div>
                   {t.owner || 'Unassigned'}
                </td>
                <td className="muted-cell">{t.end_date || 'N/A'}</td>
                <td style={{ textAlign: 'right' }}><StatusPill status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredTasks.length === 0 && (
          <div className="empty-state">No tasks match your search parameters.</div>
        )}
      </div>

      <style jsx>{`
        .table-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          padding: 10px 16px;
          border-radius: 10px;
          width: 350px;
        }

        .search-box input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--txt-main);
          font-size: 13px;
          width: 100%;
        }

        .metric-summary {
          font-size: 12px;
          font-weight: 700;
          color: var(--txt-muted);
        }

        .metric-summary span {
          color: var(--txt-main);
          background: var(--util-bg);
          padding: 4px 10px;
          border-radius: 6px;
          margin-left: 8px;
        }

        .table-container {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .executive-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .executive-table th {
          background: var(--footer-bg);
          padding: 14px 20px;
          font-size: 10px;
          font-weight: 800;
          color: var(--txt-label);
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid var(--border);
        }

        .executive-table td {
          padding: 16px 20px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
        }

        .executive-table tr {
          cursor: pointer;
        }

        .executive-table tr:hover td {
          background: var(--nav-hover);
        }

        .fw-bold { font-weight: 700; color: var(--txt-main); }
        .muted-cell { color: var(--txt-muted); font-weight: 500; }
        
        .topic-cell {
          max-width: 300px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .owner-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: var(--txt-main);
        }

        .avatar-mini {
          width: 24px;
          height: 24px;
          background: var(--util-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          color: var(--accent);
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--txt-muted);
          font-size: 13px;
          font-weight: 600;
        }
      `}</style>
    </AppShell>
  )
}
