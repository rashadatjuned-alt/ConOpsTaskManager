'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, LayoutList, Columns, Info, Plus, ChevronsUpDown, Filter } from 'lucide-react'
import Link from 'next/link'

export default function MyProjects() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [me, setMe] = useState<any>(null)
  const [filterId, setFilterId] = useState('all')
  const [allExpanded, setAllExpanded] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: u } = await supabase.from('Users').select('*').eq('id', session?.user.id).single()
      setMe(u)
      const [p, t] = await Promise.all([
        supabase.from('Projects').select('*').order('name'),
        supabase.from('Tasks').select('*').order('end_date')
      ])
      setProjects(p.data || []); setTasks(t.data || [])
    }
    load()
  }, [])

  const myFilteredProjects = useMemo(() => {
    return projects.filter(p => (p.members || []).includes(me?.id) && (filterId === 'all' || p.id === filterId))
  }, [projects, me, filterId])

  return (
    <AppShell title="My Projects Portfolio">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="avatar-mini" title="Click to filter"> <Filter size={14} /> </div>
          <select value={filterId} onChange={e => setFilterId(e.target.value)} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 8, padding: '4px 12px' }}>
            <option value="all">All My Projects</option>
            {myFilteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" onClick={() => setView('list')}><LayoutList size={16}/></button>
          <button className="icon-btn" onClick={() => setView('kanban')}><Columns size={16}/></button>
          <Link href="/projects/create" className="btn-create-pop"><Plus size={14}/> New Project</Link>
        </div>
      </div>

      {/* Render logic exactly as per your AllProjects page, using myFilteredProjects */}
      {/* Ensure you use the <div className="avatar-mini" title={t.owner}> for hover fixes */}
    </AppShell>
  )
}
