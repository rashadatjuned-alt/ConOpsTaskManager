'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState, use } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const COLORS = [
  '#3b82f6','#8b5cf6','#f59e0b','#22c55e',
  '#ef4444','#06b6d4','#f97316','#ec4899',
  '#6366f1','#14b8a6',
]

interface EditProjectProps {
  params: Promise<{ id: string }>
}

export default function EditProject({ params }: EditProjectProps) {
  const router = useRouter()
  
  // Next.js 16 requirement: Unwrap params using React.use()
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const [project,     setProject]     = useState<any>(null)
  const [allUsers,    setAllUsers]    = useState<any[]>([])
  const [tasks,       setTasks]       = useState<any[]>([])
  const [subtasks,    setSubtasks]    = useState<any[]>([])
  const [myRole,      setMyRole]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  // Edit fields
  const [name,        setName]        = useState('')
  const [desc,        setDesc]        = useState('')
  const [color,       setColor]       = useState('#3b82f6')
  const [members,     setMembers]     = useState<string[]>([])   // Current selected User IDs

  // Impact preview
  const [showImpact,  setShowImpact]  = useState(false)
  const [removedUsers,setRemovedUsers]= useState<any[]>([])      
  const [impactTasks, setImpactTasks] = useState<any[]>([])      
  const [impactSubs,  setImpactSubs]  = useState<any[]>([])      

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || '')

      // FETCHING: Join with project_members table
      const [{ data: proj }, { data: users }, { data: t }, { data: s }] = await Promise.all([
        supabase.from('Projects').select('*, project_members(user_id)').eq('id', id).single(),
        supabase.from('Users').select('id,full_name,email,role').neq('role', 'Admin').order('full_name'),
        supabase.from('Tasks').select('*'),
        supabase.from('Subtasks').select('*'),
      ])

      if (!proj) { setLoading(false); return }

      // Extract IDs from the join table result
      const existingMemberIds = proj.project_members?.map((m: any) => m.user_id) || []

      setProject({ ...proj, members: existingMemberIds }) // original members for impact logic
      setName(proj.name || '')
      setDesc(proj.description || '')
      setColor(proj.color_code || '#3b82f6')
      setMembers(existingMemberIds)
      setAllUsers(users || [])

      // Tasks and subtasks filtering
      const projTasks = (t || []).filter((tk: any) => tk.project_name === proj.name)
      setTasks(projTasks)
      const projTaskIds = projTasks.map((tk: any) => tk.id)
      setSubtasks((s || []).filter((sub: any) => projTaskIds.includes(sub.parent_task_id)))

      setLoading(false)
    }
    load()
  }, [id])

  const toggleMember = (uid: string) => {
    setMembers(prev => prev.includes(uid) ? prev.filter(m => m !== uid) : [...prev, uid])
  }

  // Calculate impact whenever members change
  useEffect(() => {
    if (!project) return
    const originalMembers: string[] = project.members || []
    const removed = originalMembers.filter((uid: string) => !members.includes(uid))
    const removedUserObjs = allUsers.filter((u: any) => removed.includes(u.id))
    const removedNames = removedUserObjs.map((u: any) => u.full_name || u.email)

    const affectedTasks = tasks.filter((t: any) => {
      const assignees: string[] = Array.isArray(t.assignees) ? t.assignees : (t.owner ? [t.owner] : [])
      return assignees.some((a: string) => removedNames.some((n: string) => a.toLowerCase() === n.toLowerCase()))
    })

    const affectedSubs = subtasks.filter((s: any) => {
      const assignees: string[] = Array.isArray(s.assignees) ? s.assignees : (s.owner ? [s.owner] : [])
      return assignees.some((a: string) => removedNames.some((n: string) => a.toLowerCase() === n.toLowerCase()))
    })

    setRemovedUsers(removedUserObjs)
    setImpactTasks(affectedTasks)
    setImpactSubs(affectedSubs)
  }, [members, project, tasks, subtasks, allUsers])

  const handleSave = async () => {
    if (!name.trim()) { setError('Project name is required.'); return }
    setError('')

    if (removedUsers.length > 0 && (impactTasks.length > 0 || impactSubs.length > 0) && !showImpact) {
      setShowImpact(true)
      return
    }

    setSaving(true)
    try {
      const oldName = project.name

      // 1. Update Project basic details
      await supabase.from('Projects').update({
        name: name.trim(),
        description: desc.trim(),
        color_code: color,
        // members column is intentionally omitted here
      }).eq('id', id)

      // 2. Sync Membership in project_members table
      // Delete old members first
      await supabase.from('project_members').delete().eq('project_id', id)
      
      // Insert current selected members
      if (members.length > 0) {
        const insertData = members.map(uid => ({
          project_id: parseInt(id),
          user_id: uid
        }))
        await supabase.from('project_members').insert(insertData)
      }

      // Handle Task project name updates if changed
      if (name.trim() !== oldName) {
        await supabase.from('Tasks')
          .update({ project_name: name.trim() })
          .eq('project_name', oldName)
      }

      // Handle automatic unassignment for removed users
      if (removedUsers.length > 0) {
        const removedNames = removedUsers.map((u: any) => u.full_name || u.email)

        for (const task of impactTasks) {
          const currentAssignees: string[] = Array.isArray(task.assignees)
            ? task.assignees
            : (task.owner ? task.owner.split(',').map((s: string) => s.trim()) : [])

          const newAssignees = currentAssignees.filter(
            (a: string) => !removedNames.some((n: string) => a.toLowerCase() === n.toLowerCase())
          )
          await supabase.from('Tasks').update({
            assignees: newAssignees,
            owner: newAssignees.join(', '),
          }).eq('id', task.id)
        }

        for (const sub of impactSubs) {
          const currentAssignees: string[] = Array.isArray(sub.assignees)
            ? sub.assignees
            : (sub.owner ? [sub.owner] : [])

          const newAssignees = currentAssignees.filter(
            (a: string) => !removedNames.some((n: string) => a.toLowerCase() === n.toLowerCase())
          )
          await supabase.from('Subtasks').update({
            assignees: newAssignees,
            owner: newAssignees.join(', '),
          }).eq('id', sub.id)
        }
      }

      setSuccess('✅ Project updated successfully!')
      setShowImpact(false)
      setTimeout(() => router.push('/all-projects'), 1500)
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  if (myRole && myRole === 'Team Member') return (
    <AppShell title="Edit Project">
      <div style={{ color: 'var(--red)', padding: 20 }}>Access denied — Managers and Admins only.</div>
    </AppShell>
  )

  if (loading) return <AppShell title="Edit Project"><div style={{ padding: 40, color: 'var(--txt3)', textAlign: 'center' }}>Loading...</div></AppShell>
  if (!project) return <AppShell title="Edit Project"><div style={{ color: 'var(--red)', padding: 20 }}>Project not found.</div></AppShell>

  const hasImpact = removedUsers.length > 0 && (impactTasks.length > 0 || impactSubs.length > 0)

  return (
    <AppShell title={`Edit: ${project.name}`}>
      <div style={{ maxWidth: 720 }}>

        {error   && <div style={S.alertErr}>{error}</div>}
        {success && <div style={S.alertOk}>{success}</div>}

        {hasImpact && !showImpact && (
          <div style={S.alertWarn}>
            ⚠️ Removing <strong>{removedUsers.map((u: any) => u.full_name).join(', ')}</strong> will affect{' '}
            {impactTasks.length > 0 && <strong>{impactTasks.length} task{impactTasks.length !== 1 ? 's' : ''}</strong>}
            {impactTasks.length > 0 && impactSubs.length > 0 && ' and '}
            {impactSubs.length > 0 && <strong>{impactSubs.length} subtask{impactSubs.length !== 1 ? 's' : ''}</strong>}
            {' '}in this project. They will be unassigned automatically.
          </div>
        )}

        <div style={S.card}>
          <div style={S.cardTitle}>Project Details</div>
          <div style={S.fg}>
            <label style={S.lbl}>Project Name *</label>
            <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Project name" />
          </div>
          <div style={S.fg}>
            <label style={S.lbl}>Description</label>
            <textarea style={S.textarea} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this project about?" />
          </div>
          <div style={S.fg}>
            <label style={S.lbl}>Color Tag</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} style={{
                  width: 30, height: 30, borderRadius: '50%', background: c,
                  border: 'none', cursor: 'pointer',
                  outline: color === c ? `3px solid ${c}` : '2px solid transparent',
                  outlineOffset: 3, transition: 'outline 0.15s',
                }} />
              ))}
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Project Team</div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 12 }}>
            These people can be assigned to tasks within this project.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {allUsers.map((u: any) => {
              const sel      = members.includes(u.id)
              const wasHere  = (project.members || []).includes(u.id)
              const isNew    = sel && !wasHere
              const isRemoved= !sel && wasHere
              const ini      = (u.full_name || u.email || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()

              return (
                <button key={u.id} type="button" onClick={() => toggleMember(u.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 12px 5px 7px',
                    borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                    border: isRemoved
                      ? '1.5px dashed var(--red)'
                      : sel ? '1.5px solid var(--accent)' : '1.5px solid var(--brd2)',
                    background: isRemoved
                      ? 'var(--red2)'
                      : sel ? 'var(--accent2)' : 'var(--bg3)',
                    color: isRemoved ? 'var(--red)' : sel ? 'var(--accent)' : 'var(--txt2)',
                  }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', fontSize: 9,
                    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isRemoved ? 'rgba(197,34,31,0.15)' : sel ? 'var(--accent)' : 'var(--bg2)',
                    color: isRemoved ? 'var(--red)' : sel ? 'var(--accent2)' : 'var(--txt3)',
                    flexShrink: 0,
                  }}>{ini}</div>
                  {isRemoved ? '✕ ' : sel ? '✓ ' : ''}{u.full_name || u.email}
                  {isNew     && <span style={{ fontSize: 9, background: 'var(--accent)', color: 'var(--accent2)', padding: '1px 5px', borderRadius: 8, marginLeft: 2 }}>NEW</span>}
                  {isRemoved && <span style={{ fontSize: 9, background: 'var(--red)', color: '#fff', padding: '1px 5px', borderRadius: 8, marginLeft: 2 }}>REMOVING</span>}
                </button>
              )
            })}
          </div>
        </div>

        {hasImpact && (
          <div style={{ ...S.card, border: '1px solid rgba(197,34,31,0.3)', background: 'var(--red2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              ⚠️ Impact Preview — Assignees Being Removed
            </div>
            {impactTasks.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                  Affected Tasks ({impactTasks.length})
                </div>
                {impactTasks.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--card-bg)', borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--red)' }}>📋</span>
                    <span style={{ flex: 1, color: 'var(--txt)', fontWeight: 500 }}>{t.topic}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 32 }}>
          <button onClick={() => router.back()} style={S.cancelBtn}>Cancel</button>
          {hasImpact ? (
            <button onClick={handleSave} disabled={saving} style={{ ...S.dangerBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : `⚠️ Confirm & Save`}
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string, React.CSSProperties> = {
  alertErr:  { background: 'var(--red2)', color: 'var(--red)', border: '1px solid rgba(197,34,31,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  alertOk:   { background: 'var(--accent2)', color: 'var(--accent)', border: '1px solid rgba(46,125,50,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  alertWarn: { background: 'var(--amber2)', color: 'var(--amber)', border: '1px solid rgba(180,83,9,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, lineHeight: 1.6 },
  card:      { background: 'var(--card-bg)', border: '1px solid var(--card-brd)', borderRadius: 12, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 },
  fg:        { marginBottom: 14 },
  lbl:       { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt3)', display: 'block', marginBottom: 5 },
  input:     { width: '100%', padding: '8px 11px', background: 'var(--input-bg)', border: '1px solid var(--input-brd)', borderRadius: 7, color: 'var(--txt)', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  textarea:  { width: '100%', padding: '8px 11px', background: 'var(--input-bg)', border: '1px solid var(--input-brd)', borderRadius: 7, color: 'var(--txt)', fontSize: 13, fontFamily: 'inherit', outline: 'none', minHeight: 80, resize: 'vertical' },
  saveBtn:   { background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { background: 'var(--bg3)', color: 'var(--txt2)', border: '1px solid var(--brd2)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  dangerBtn: { background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}