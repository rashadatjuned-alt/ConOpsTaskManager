'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { Edit2, X, Check, Info } from 'lucide-react'

const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#22c55e','#ef4444','#06b6d4','#f97316','#ec4899','#6366f1','#14b8a6']

export default function ProjectInfoPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [project,      setProject]      = useState<any>(null)
  const [allUsers,     setAllUsers]     = useState<any[]>([])
  const [tasks,        setTasks]        = useState<any[]>([])
  const [subtasks,     setSubtasks]     = useState<any[]>([])
  const [myRole,       setMyRole]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [isEditing,    setIsEditing]    = useState(false)
  const [saving,       setSaving]       = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [members, setMembers] = useState<string[]>([])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const { data: me } = await supabase.from('Users').select('role').eq('id', session?.user.id).single()
    setMyRole(me?.role || 'Team Member')

    const [{ data: proj }, { data: users }, { data: t }, { data: s }] = await Promise.all([
      supabase.from('Projects').select('*').eq('id', id).single(),
      supabase.from('Users').select('id,full_name,email,role').neq('role', 'Admin').order('full_name'),
      supabase.from('Tasks').select('*'),
      supabase.from('Subtasks').select('*'),
    ])

    if (proj) {
      setProject(proj)
      setName(proj.name); setDesc(proj.description); setColor(proj.color_code); setMembers(proj.members || [])
      setAllUsers(users || [])
      const projTasks = (t || []).filter((tk: any) => tk.project_name === proj.name)
      setTasks(projTasks)
      const projTaskIds = projTasks.map((tk: any) => tk.id)
      setSubtasks((s || []).filter((sub: any) => projTaskIds.includes(sub.parent_task_id)))
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  // ── Calculated Metrics ──
  const stats = useMemo(() => {
    const totalT = tasks.length
    const doneT  = tasks.filter(t => t.status === 'Completed').length
    const totalS = subtasks.length
    
    // Date Logic: Earliest Start, Latest End
    const startDates = tasks.map(t => t.start_date).filter(Boolean).sort()
    const endDates   = tasks.map(t => t.end_date).filter(Boolean).sort()
    
    return {
      totalTasks: totalT,
      completedTasks: doneT,
      totalSubs: totalS,
      progress: totalT > 0 ? Math.round((doneT / totalT) * 100) : 0,
      startDate: startDates[0] || '—',
      endDate: endDates[endDates.length - 1] || '—'
    }
  }, [tasks, subtasks])

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('Projects').update({ name, description: desc, color_code: color, members }).eq('id', id)
      if (name !== project.name) {
        await supabase.from('Tasks').update({ project_name: name }).eq('project_name', project.name)
      }
      setIsEditing(false)
      loadData()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  if (loading) return <AppShell title="Loading..."><div style={{ padding: 40, textAlign: 'center' }}>Loading Project Data...</div></AppShell>
  if (!project) return <AppShell title="Not Found">Project not found.</AppShell>

  const canEdit = myRole === 'Admin' || myRole === 'Manager'

  return (
    <AppShell title={`Project: ${name}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .tv-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: var(--shadow-sm); }
        .tv-label { font-size: 11px; text-transform: uppercase; color: var(--text-label); font-weight: 600; letter-spacing: 0.05em; margin-bottom: 6px; display: block; }
        .tv-val { font-size: 15px; color: var(--text-main); }
        .tv-input { width: 100%; padding: 10px 14px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-main); outline: none; }
        .progress-container { width: 100%; height: 8px; background: var(--subtask-bg); border-radius: 10px; margin-top: 10px; overflow: hidden; }
        .progress-bar { height: 100%; transition: width 0.5s ease; }
        .member-chip { display: flex; alignItems: center; gap: 8px; padding: 6px 12px; background: var(--subtask-bg); border-radius: 20px; font-size: 13px; color: var(--text-main); border: 1px solid var(--border-color); }
      `}} />

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        
        {/* HEADER BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: color }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>{name}</h1>
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            {canEdit && !isEditing && (
              <button className="tv-btn" onClick={() => setIsEditing(true)}><Edit2 size={14}/> Edit Project</button>
            )}
            {isEditing && (
              <>
                <button className="tv-btn" onClick={() => setIsEditing(false)}><X size={14}/> Cancel</button>
                <button className="tv-btn tv-btn-primary" onClick={handleSave} disabled={saving}>
                   {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* TOP STATS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 20 }}>
          <div className="tv-card" style={{ marginBottom: 0 }}>
            <span className="tv-label">Progress</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pill-blue-txt)' }}>{stats.progress}%</div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${stats.progress}%`, background: color }} />
            </div>
          </div>
          <div className="tv-card" style={{ marginBottom: 0 }}>
            <span className="tv-label">Timeline</span>
            <div className="tv-val" style={{ fontWeight: 600 }}>{stats.startDate} — {stats.endDate}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Static based on task range</div>
          </div>
          <div className="tv-card" style={{ marginBottom: 0 }}>
            <span className="tv-label">Task Health</span>
            <div className="tv-val"><strong>{stats.completedTasks}</strong> / {stats.totalTasks} Tasks</div>
            <div className="tv-val" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stats.totalSubs} Subtasks total</div>
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div className="tv-card">
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-color)', marginBottom: 20, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Project Information
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: isEditing ? '1fr 1fr' : '1fr', gap: 24 }}>
            <div className="tv-field">
              <span className="tv-label">Project Title</span>
              {isEditing ? (
                <input className="tv-input" value={name} onChange={e => setName(e.target.value)} />
              ) : (
                <div className="tv-val" style={{ fontSize: 18, fontWeight: 500 }}>{name}</div>
              )}
            </div>

            {isEditing && (
              <div className="tv-field">
                <span className="tv-label">Color Scheme</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? '2px solid var(--text-main)' : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="tv-field" style={{ marginTop: 20 }}>
            <span className="tv-label">Description</span>
            {isEditing ? (
              <textarea className="tv-input" style={{ minHeight: 100 }} value={desc} onChange={e => setDesc(e.target.value)} />
            ) : (
              <div className="tv-val" style={{ lineHeight: 1.6, color: 'var(--text-muted)' }}>{desc || 'No description provided.'}</div>
            )}
          </div>
        </div>

        {/* TEAM SECTION */}
        <div className="tv-card">
          <div className="tv-section-title">
            Team Members
            {!isEditing && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{members.length} Total</span>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {allUsers.map(u => {
              const isSelected = members.includes(u.id)
              if (!isEditing && !isSelected) return null
              
              return (
                <button
                  key={u.id}
                  disabled={!isEditing}
                  onClick={() => setMembers(prev => prev.includes(u.id) ? prev.filter(m => m !== u.id) : [...prev, u.id])}
                  className="member-chip"
                  style={{
                    cursor: isEditing ? 'pointer' : 'default',
                    borderColor: isSelected ? color : 'var(--border-color)',
                    background: isSelected ? `${color}15` : 'var(--subtask-bg)',
                    opacity: !isSelected && isEditing ? 0.5 : 1
                  }}
                >
                  {isSelected && <Check size={14} style={{ color: color }} />}
                  {u.full_name || u.email}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
