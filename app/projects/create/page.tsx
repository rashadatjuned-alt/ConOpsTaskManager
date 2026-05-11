'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Check, Users, Palette, FileText, FolderPlus } from 'lucide-react'

const COLORS = [
  { hex: '#378ADD', label: 'Blue'        },
  { hex: '#7F77DD', label: 'Purple'      },
  { hex: '#EF9F27', label: 'Amber'       },
  { hex: '#639922', label: 'Olive'       },
  { hex: '#E24B4A', label: 'Red'         },
  { hex: '#3B6D11', label: 'Forest'      },
  { hex: '#854F0B', label: 'Brown'       },
  { hex: '#185FA5', label: 'Navy'        },
]

export default function CreateProject() {
  const router = useRouter()
  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [color,   setColor]   = useState('#378ADD')
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [users,   setUsers]   = useState<any[]>([])
  const [members, setMembers] = useState<string[]>([])

  useEffect(() => {
    supabase.from('Users').select('id,full_name,email,role')
      .then(({ data }) => setUsers(data || []))
  }, [])

  const toggleMember = (id: string) =>
    setMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('Projects').insert({
      name: name.trim(), description: desc.trim(), color_code: color, members
    })
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/all-projects')
  }

  const selectedColor = COLORS.find(c => c.hex === color)

  return (
    <AppShell title="New Project">
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {error && <div className="alert alert-error" style={{ marginBottom:16 }}>{error}</div>}

        {/* ── Page header ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <div style={{
            width:40, height:40, borderRadius:10, background: color,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'background 0.2s', flexShrink:0
          }}>
            <FolderPlus size={20} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:600, color:'var(--txt)' }}>
              {name.trim() || 'New Project'}
            </div>
            <div style={{ fontSize:12, color:'var(--txt3)', marginTop:2 }}>
              Fill in the details below to create your project
            </div>
          </div>
        </div>

        {/* ══ SECTION 1 — Basic Info ═══════════════════════════════════ */}
        <div className="create-section">
          <div className="create-section-header">
            <div className="create-section-icon" style={{ background:'#EAF3DE', color:'#3B6D11' }}>
              <FileText size={14}/>
            </div>
            <div>
              <div className="create-section-title">Basic Information</div>
              <div className="create-section-sub">Name and description of the project</div>
            </div>
          </div>
          <div className="create-section-body">
            <div className="form-group">
              <label className="form-label">Project Name <span style={{ color:'#cc3333' }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. Q4 Campaign, Product Launch..."
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ fontSize:14 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="What is this project about? Goals, scope, key deliverables..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                style={{ minHeight:90 }}
              />
            </div>
          </div>
        </div>

        {/* ══ SECTION 2 — Accent Colour ════════════════════════════════ */}
        <div className="create-section">
          <div className="create-section-header">
            <div className="create-section-icon" style={{ background:'#FAEEDA', color:'#854F0B' }}>
              <Palette size={14}/>
            </div>
            <div>
              <div className="create-section-title">Accent Colour</div>
              <div className="create-section-sub">Used for project identification across the app</div>
            </div>
          </div>
          <div className="create-section-body">
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  style={{
                    position:'relative',
                    width:36, height:36,
                    borderRadius:'50%',
                    background: c.hex,
                    border: color===c.hex ? `3px solid ${c.hex}` : '3px solid transparent',
                    outline: color===c.hex ? `2px solid ${c.hex}` : '2px solid transparent',
                    outlineOffset: 2,
                    cursor:'pointer',
                    transition:'all 0.15s',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                  {color === c.hex && <Check size={16} color="#fff" strokeWidth={3}/>}
                </button>
              ))}
            </div>
            {selectedColor && (
              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:color }}/>
                <span style={{ fontSize:12, color:'var(--txt3)' }}>{selectedColor.label} — {color}</span>
              </div>
            )}
          </div>
        </div>

        {/* ══ SECTION 3 — Team Members ══════════════════════════════════ */}
        <div className="create-section">
          <div className="create-section-header">
            <div className="create-section-icon" style={{ background:'#EEEDFE', color:'#534AB7' }}>
              <Users size={14}/>
            </div>
            <div>
              <div className="create-section-title">Team Members</div>
              <div className="create-section-sub">
                Select who can be assigned tasks in this project
                {members.length > 0 && (
                  <span style={{ marginLeft:8, background: color, color:'#fff', fontSize:10, padding:'1px 7px', borderRadius:10, fontWeight:600 }}>
                    {members.length} selected
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="create-section-body">
            {users.length === 0
              ? <div style={{ fontSize:13, color:'var(--txt3)' }}>No users found.</div>
              : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {users.map(u => {
                    const sel  = members.includes(u.id)
                    const name = u.full_name || u.email
                    const ini  = name.split(' ').map((p:string) => p[0]).join('').slice(0,2).toUpperCase()
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleMember(u.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:10,
                          padding:'8px 12px',
                          borderRadius:'var(--r)',
                          border: sel ? `1.5px solid ${color}` : '1.5px solid var(--brd)',
                          background: sel ? `${color}10` : 'var(--bg)',
                          cursor:'pointer',
                          transition:'all 0.15s',
                          textAlign:'left',
                        }}>
                        {/* Avatar */}
                        <div style={{
                          width:32, height:32, borderRadius:'50%',
                          background: sel ? color : '#EEEDFE',
                          color: sel ? '#fff' : '#534AB7',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, fontWeight:700, flexShrink:0,
                          transition:'all 0.15s',
                        }}>{ini}</div>
                        {/* Name + role */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                          {u.role && <div style={{ fontSize:11, color:'var(--txt3)' }}>{u.role}</div>}
                        </div>
                        {/* Checkmark */}
                        <div style={{
                          width:18, height:18, borderRadius:'50%',
                          border: sel ? `none` : '1.5px solid var(--brd2)',
                          background: sel ? color : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          flexShrink:0, transition:'all 0.15s',
                        }}>
                          {sel && <Check size={11} color="#fff" strokeWidth={3}/>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            }
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:32 }}>
          <button className="btn" onClick={() => router.back()}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            style={{ minWidth:130, justifyContent:'center' }}>
            {saving ? 'Creating...' : '✓ Create Project'}
          </button>
        </div>
      </div>

      <style>{`
        .create-section {
          background: var(--bg);
          border: 0.5px solid var(--brd);
          border-radius: 10px;
          margin-bottom: 14px;
          overflow: hidden;
        }
        .create-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: var(--bg2);
          border-bottom: 0.5px solid var(--brd);
        }
        .create-section-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .create-section-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--txt);
        }
        .create-section-sub {
          font-size: 11px;
          color: var(--txt3);
          margin-top: 1px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .create-section-body {
          padding: 16px 18px;
        }
      `}</style>
    </AppShell>
  )
}
