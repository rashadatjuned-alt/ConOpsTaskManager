'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, LayoutList, Columns, Info, X, Users, Calendar, Clock, Search, Plus } from 'lucide-react'
import Link from 'next/link'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const

const AVATAR_BG = ['#E6F1FB','#EAF3DE','#EEEDFE','#FAEEDA','#FAECE7','#E1F5EE']
const AVATAR_CL = ['#0C447C','#27500A','#3C3489','#633806','#712B13','#085041']

function ini(name: string) {
  const p = (name||'?').trim().split(' ')
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}

// ─── Project Info Modal (Compact Version) ──────────────────────────────────────
function ProjectInfoModal({ proj, tasks, allUsers, onClose }: {
  proj: any; tasks: any[]; allUsers: any[]; onClose: () => void
}) {
  const projTasks = tasks.filter(t => t.project_name === proj.name)
  const done      = projTasks.filter(t => t.status === 'Completed').length
  const pct       = projTasks.length ? Math.round(done / projTasks.length * 100) : 0

  const members = (proj.members || [])
    .map((id: string) => allUsers.find((u: any) => u.id === id))
    .filter(Boolean)

  const startDate = proj.start_date || projTasks.map((t:any)=>t.start_date).filter(Boolean).sort()[0]
  const endDate   = proj.end_date   || projTasks.map((t:any)=>t.end_date).filter(Boolean).sort().reverse()[0]
  let duration = '—'
  if (startDate && endDate) {
    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 864e5)
    if (days < 0)        duration = '—'
    else if (days < 7)   duration = `${days} day${days!==1?'s':''}`
    else if (days < 30)  duration = `${Math.round(days/7)} week${Math.round(days/7)!==1?'s':''}`
    else if (days < 365) duration = `${Math.round(days/30)} month${Math.round(days/30)!==1?'s':''}`
    else                 duration = `${(days/365).toFixed(1)} years`
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'var(--bg)', borderRadius:'var(--rl)', width:480,
        maxHeight:'85vh', overflow:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>

        <div style={{ background: proj.color_code||'#378ADD', borderRadius:'var(--rl) var(--rl) 0 0',
          padding:'16px 20px 12px', position:'relative' }}>
          <button onClick={onClose}
            style={{ position:'absolute', top:12, right:12, background:'rgba(255,255,255,0.2)',
              border:'none', borderRadius:'50%', width:24, height:24, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
            <X size={12}/>
          </button>
          <div style={{ fontSize:16, fontWeight:600, color:'#fff', marginBottom:4 }}>{proj.name}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.8)' }}>
            {projTasks.length} task{projTasks.length!==1?'s':''} · {pct}% complete
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,0.3)', borderRadius:2,
            marginTop:10, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'#fff', borderRadius:2 }}/>
          </div>
        </div>

        <div style={{ padding:'16px 20px' }}>
          {proj.description && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase',
                letterSpacing:'0.06em', color:'var(--txt3)', marginBottom:6 }}>Description</div>
              <div style={{ fontSize:12, color:'var(--txt2)', lineHeight:1.5 }}>{proj.description}</div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
            {[
              { icon:<Calendar size={12}/>, label:'Start Date', val: startDate||'—' },
              { icon:<Calendar size={12}/>, label:'End Date',   val: endDate||'—' },
              { icon:<Clock size={12}/>,    label:'Duration',   val: duration },
            ].map(({ icon, label, val }) => (
              <div key={label} style={{ background:'var(--bg2)', borderRadius:'var(--r)', padding:'8px 10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4,
                  color:'var(--txt3)', fontSize:10, marginBottom:4 }}>{icon}{label}</div>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--txt)' }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase',
              letterSpacing:'0.06em', color:'var(--txt3)', marginBottom:8 }}>Task Breakdown</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              {[
                { label:'Not Started', bg:'#F1EFE8', color:'#5F5E5A' },
                { label:'In Progress', bg:'#E6F1FB', color:'#185FA5' },
                { label:'On-Hold',     bg:'#FAEEDA', color:'#854F0B' },
                { label:'Completed',   bg:'#EAF3DE', color:'#3B6D11' },
              ].map(({ label, bg, color }) => (
                <div key={label} style={{ background:bg, borderRadius:'var(--r)',
                  padding:'6px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:600, color }}>{projTasks.filter(t=>t.status===label).length}</div>
                  <div style={{ fontSize:9, color, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase',
              letterSpacing:'0.06em', color:'var(--txt3)', marginBottom:8,
              display:'flex', alignItems:'center', gap:4 }}>
              <Users size={11}/> Team Members ({members.length})
            </div>
            {members.length === 0
              ? <div style={{ fontSize:12, color:'var(--txt3)' }}>No members assigned to this project.</div>
              : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {members.map((u: any, idx: number) => {
                    const name = u.full_name || u.email
                    const bg   = AVATAR_BG[idx % AVATAR_BG.length]
                    const cl   = AVATAR_CL[idx % AVATAR_CL.length]
                    const memberTasks = projTasks.filter(t =>
                      (t.owner||'').toLowerCase().includes(name.toLowerCase())
                    )
                    return (
                      <div key={u.id} style={{ display:'flex', alignItems:'center', gap:8,
                        padding:'6px 8px', background:'var(--bg2)', borderRadius:'var(--r)' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%',
                          background:bg, color:cl, display:'flex', alignItems:'center',
                          justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>
                          {ini(name)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:500, color:'var(--txt)' }}>{name}</div>
                          <div style={{ fontSize:10, color:'var(--txt3)' }}>{u.role}</div>
                        </div>
                        <div style={{ fontSize:10, color:'var(--txt3)', textAlign:'right' }}>
                          <div style={{ fontWeight:500, color:'var(--txt)' }}>{memberTasks.length}</div>
                          <div>tasks</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        </div>
