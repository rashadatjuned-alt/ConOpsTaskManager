'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, FolderGit2 } from 'lucide-react'

export default function AllProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Fetch all projects and tasks for system-wide oversight
      const [pRes, tRes] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at', { ascending: false }),
        supabase.from('Tasks').select('project_name, status')
      ])

      const allProjects = pRes.data || []
      const allTasks = tRes.data || []

      // Map task completion metrics to each project
      const enrichedProjects = allProjects.map(proj => {
        const pTasks = allTasks.filter(t => t.project_name === proj.name)
        const completed = pTasks.filter(t => t.status === 'Completed').length
        const total = pTasks.length
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100)

        return { ...proj, taskCount: total, completedCount: completed, progress }
      })

      setProjects(enrichedProjects)
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) return <AppShell title="Global Projects">Loading portfolio data...</AppShell>

  // Search Filter Logic
  const filteredProjects = projects.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell title="Global Project Portfolio">
      
      {/* Table Toolbar */}
      <div className="table-toolbar">
        <div className="search-box">
          <Search size={16} color="var(--txt-label)" />
          <input 
            type="text" 
            placeholder="Search active portfolios by name or scope..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="metric-summary">
          Total Portfolios: <span>{filteredProjects.length}</span>
        </div>
      </div>

      {/* High Density Table Container */}
      <div className="table-container">
        <table className="executive-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Project Scope</th>
              <th>Timeline</th>
              <th>Task Volume</th>
              <th style={{ width: '25%' }}>Completion Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)}>
                
                {/* Name & Description */}
                <td className="scope-cell">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="icon-box"><FolderGit2 size={16} /></div>
                    <div>
                      <div className="fw-bold">{p.name}</div>
                      <div className="muted-desc">{p.description ? p.description.slice(0, 50) + '...' : 'No description'}</div>
                    </div>
                  </div>
                </td>

                {/* Timeline */}
                <td className="muted-cell">
                  {p.start_date || '--'} to <br/>
                  <span style={{ color: 'var(--txt-main)' }}>{p.end_date || 'Ongoing'}</span>
                </td>

                {/* Task Count */}
                <td className="fw-bold" style={{ color: 'var(--txt-muted)' }}>
                  <span style={{ color: 'var(--txt-main)' }}>{p.completedCount}</span> / {p.taskCount}
                </td>

                {/* Inline Progress Bar */}
                <td>
                  <div className="progress-wrapper">
                    <div className="progress-labels">
                      <span>Progress</span>
                      <span>{p.progress}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredProjects.length === 0 && (
          <div className="empty-state">No projects match your search criteria.</div>
        )}
      </div>

      <style jsx>{`
        /* Toolbar Styles */
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
          border-radius: 8px; /* Sharp edge */
          width: 400px;
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

        /* Table Styles */
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
          background: var(--util-bg);
          padding: 16px 24px;
          font-size: 10px;
          font-weight: 800;
          color: var(--txt-label);
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid var(--border);
        }

        .executive-table td {
          padding: 16px 24px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s; /* Flat transition, no bouncy hover */
        }

        .executive-table tr {
          cursor: pointer;
        }

        .executive-table tr:hover td {
          background: var(--nav-hover);
        }

        /* Cell Formatting */
        .fw-bold { font-weight: 700; color: var(--txt-main); }
        .muted-cell { color: var(--txt-muted); font-weight: 500; line-height: 1.6; }
        .muted-desc { font-size: 11px; color: var(--txt-muted); margin-top: 4px; }
        
        .icon-box {
          width: 36px;
          height: 36px;
          background: var(--util-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          flex-shrink: 0;
        }

        /* Inline Progress Bar */
        .progress-wrapper {
          width: 100%;
          max-width: 200px;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-weight: 800;
          color: var(--txt-label);
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .progress-track {
          height: 6px;
          background: var(--util-bg);
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--border);
        }

        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 10px;
          transition: width 0.5s ease;
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
