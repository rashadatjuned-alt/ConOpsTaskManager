'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'

const TABS = ['Send', 'Configuration', 'Activity'] as const
type Tab = typeof TABS[number]

const EVENT_ICONS: Record<string, string> = {
  task_assigned:       '📋',
  subtask_assigned:    '📎',
  task_unassigned:     '❌',
  task_status_changed: '🔄',
  task_completed:      '✅',
  task_due_soon:       '⏰',
  task_overdue:        '⚠️',
  task_created:        '➕',
  project_milestone:   '🎯',
  user_joined:         '👤',
  password_reset_sent: '🔑',
}

export default function AdminNotifications() {
  const [tab,      setTab]      = useState<Tab>('Send')
  const [users,    setUsers]    = useState<any[]>([])
  const [notifs,   setNotifs]   = useState<any[]>([])
  const [config,   setConfig]   = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [myRole,   setMyRole]   = useState('')
  const [msg,      setMsg]      = useState('')
  const [target,   setTarget]   = useState('all')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || '')

      const [{ data: us }, { data: ns }, { data: cfg }, { data: act }] = await Promise.all([
        supabase.from('Users').select('*').order('full_name'),
        supabase.from('Notifications').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('NotificationConfig').select('*').order('label'),
        supabase.from('NotificationActivity').select('*').order('created_at', { ascending: false }).limit(100),
      ])
      setUsers(us || [])
      setNotifs(ns || [])
      setConfig(cfg || [])
      setActivity(act || [])
    }
    load()
  }, [])

  if (myRole && myRole !== 'Admin') return (
    <AppShell title="Notifications Management">
      <div style={S.denied}>Admin only.</div>
    </AppShell>
  )

  // ── Send notification ──────────────────────────────────
  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    const targets = target === 'all' ? users : users.filter((u: any) => u.id === target)
    for (const u of targets) {
      await supabase.from('Notifications').insert({ user_id: u.id, message: message.trim(), is_read: false })
    }
    setMsg(`✅ Sent to ${targets.length} user${targets.length !== 1 ? 's' : ''}!`)
    setMessage('')
    const { data } = await supabase.from('Notifications').select('*').order('created_at', { ascending: false }).limit(50)
    setNotifs(data || [])
    setSending(false)
    setTimeout(() => setMsg(''), 3000)
  }

  // ── Save config changes ────────────────────────────────
  const updateConfig = async (id: string, field: string, value: any) => {
    setConfig(prev => prev.map((c: any) => c.id === id ? { ...c, [field]: value } : c))
    await supabase.from('NotificationConfig').update({ [field]: value }).eq('id', id)
  }

  const saveAllConfig = async () => {
    setSaving(true)
    for (const c of config) {
      await supabase.from('NotificationConfig').update({
        team_member:   c.team_member,
        manager:       c.manager,
        enabled:       c.enabled,
        deadline_days: c.deadline_days,
      }).eq('id', c.id)
    }
    setMsg('✅ Configuration saved!')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <AppShell title="Notifications Management">
      {msg && <div style={S.alertOk}>{msg}</div>}

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...S.tabBtn, ...(tab === t ? S.tabBtnActive : {}) }}>
            {t === 'Send' ? '📤 Send' : t === 'Configuration' ? '⚙️ Configuration' : '📊 Activity'}
          </button>
        ))}
      </div>

      {/* ── TAB: SEND ── */}
      {tab === 'Send' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Send Manual Notification</div>
            <div style={S.fg}>
              <label style={S.lbl}>Send To</label>
              <select style={S.input} value={target} onChange={e => setTarget(e.target.value)}>
                <option value="all">All Users ({users.length})</option>
                <optgroup label="By Role">
                  <option value="role_manager">All Managers</option>
                  <option value="role_team">All Team Members</option>
                </optgroup>
                <optgroup label="Individual">
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>)}
                </optgroup>
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Message</label>
              <textarea style={S.textarea} value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your notification message..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={send} disabled={sending || !message.trim()} style={S.primaryBtn}>
                {sending ? 'Sending...' : '📤 Send Notification'}
              </button>
            </div>
          </div>

          {/* Recent sent */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Recent Notifications ({notifs.length})
          </div>
          <div style={S.card}>
            {notifs.length === 0 && <div style={S.empty}>No notifications sent yet.</div>}
            {notifs.map((n: any, i: number) => {
              const user = users.find((u: any) => u.id === n.user_id)
              return (
                <div key={n.id} style={{ ...S.notifRow, borderBottom: i < notifs.length - 1 ? '1px solid var(--brd)' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? 'var(--txt3)' : 'var(--blue)', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 2 }}>
                      To: <strong style={{ color: 'var(--txt2)' }}>{user?.full_name || user?.email || 'Unknown'}</strong> · {n.created_at?.slice(0, 10)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--txt)' }}>{n.message}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: n.is_read ? 'var(--bg3)' : 'var(--blue2)', color: n.is_read ? 'var(--txt3)' : 'var(--blue)', fontWeight: 500 }}>
                    {n.is_read ? 'Read' : 'Unread'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB: CONFIGURATION ── */}
      {tab === 'Configuration' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
              Configure which events trigger notifications and for which roles.
            </div>
            <button onClick={saveAllConfig} disabled={saving} style={S.primaryBtn}>
              {saving ? 'Saving...' : '💾 Save All'}
            </button>
          </div>

          <div style={S.card}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px 100px', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--brd)', marginBottom: 4 }}>
              <div style={S.colHdr}>Event</div>
              <div style={{ ...S.colHdr, textAlign: 'center' }}>Enabled</div>
              <div style={{ ...S.colHdr, textAlign: 'center' }}>Team Member</div>
              <div style={{ ...S.colHdr, textAlign: 'center' }}>Manager</div>
              <div style={{ ...S.colHdr, textAlign: 'center' }}>Deadline Days</div>
            </div>

            {config.map((c: any) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px 100px', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--brd)', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span>{EVENT_ICONS[c.event_key] || '🔔'}</span>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{c.description}</div>
                </div>

                {/* Enabled toggle */}
                <div style={{ textAlign: 'center' }}>
                  <Toggle value={c.enabled} onChange={v => updateConfig(c.id, 'enabled', v)} />
                </div>

                {/* Team Member toggle */}
                <div style={{ textAlign: 'center' }}>
                  <Toggle value={c.team_member} onChange={v => updateConfig(c.id, 'team_member', v)} disabled={!c.enabled} />
                </div>

                {/* Manager toggle */}
                <div style={{ textAlign: 'center' }}>
                  <Toggle value={c.manager} onChange={v => updateConfig(c.id, 'manager', v)} disabled={!c.enabled} />
                </div>

                {/* Deadline days (only for task_due_soon) */}
                <div style={{ textAlign: 'center' }}>
                  {c.deadline_days !== null ? (
                    <input
                      type="number" min={1} max={30}
                      value={c.deadline_days}
                      onChange={e => updateConfig(c.id, 'deadline_days', parseInt(e.target.value) || 1)}
                      style={{ width: 60, padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: 6, color: 'var(--txt)', fontSize: 13, textAlign: 'center', fontFamily: 'inherit', outline: 'none' }}
                    />
                  ) : (
                    <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ marginTop: 14, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Role Notification Logic</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { role: '👤 Team Member', events: ['Assigned to task or subtask', 'Removed from task', 'Task status changed (their tasks)', 'Task due soon (their tasks)', 'Task overdue (their tasks)', 'Password reset sent'] },
                { role: '📋 Manager', events: ['All Team Member events', 'New task created in any project', 'Task completed in any project', 'Task overdue in any project', 'Project reaches 50% or 100%', 'New user joined the system'] },
              ].map(({ role, events }) => (
                <div key={role}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', marginBottom: 7 }}>{role}</div>
                  {events.map(e => (
                    <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--txt2)', marginBottom: 4 }}>
                      <span style={{ color: 'var(--accent)', fontSize: 10 }}>✓</span> {e}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ACTIVITY ── */}
      {tab === 'Activity' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 12 }}>
            {activity.length} notification events logged
          </div>
          {activity.length === 0 && (
            <div style={S.emptyState}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
              <div>No activity yet. Notifications will appear here as they are triggered.</div>
            </div>
          )}
          <div style={S.card}>
            {activity.map((a: any, i: number) => {
              const targetUser = users.find((u: any) => u.id === a.target_user_id)
              const byUser     = users.find((u: any) => u.id === a.triggered_by)
              return (
                <div key={a.id} style={{ ...S.notifRow, borderBottom: i < activity.length - 1 ? '1px solid var(--brd)' : 'none' }}>
                  <div style={{ fontSize: 18, flexShrink: 0 }}>{EVENT_ICONS[a.event_key] || '🔔'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--txt)', marginBottom: 3 }}>{a.message}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={S.metaTag}>
                        To: {targetUser?.full_name || targetUser?.email || a.target_user_id}
                      </span>
                      {byUser && (
                        <span style={S.metaTag}>By: {byUser.full_name || byUser.email}</span>
                      )}
                      {a.entity_type && (
                        <span style={S.metaTag}>{a.entity_type}: {a.entity_name}</span>
                      )}
                      <span style={{ ...S.metaTag, background: 'var(--blue2)', color: 'var(--blue)' }}>
                        {a.event_key.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {a.created_at?.slice(0, 16).replace('T', ' ')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </AppShell>
  )
}

// ── Toggle component ───────────────────────────────────────
function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'var(--bg3)' : value ? 'var(--accent)' : 'var(--bg3)',
        position: 'relative', transition: 'background 0.2s', opacity: disabled ? 0.4 : 1, flexShrink: 0,
      }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 3, left: value ? 21 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

// ── Styles ─────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  denied:      { color: 'var(--red)', padding: 20, fontSize: 13 },
  alertOk:     { background: 'var(--accent2)', color: 'var(--accent)', border: '1px solid rgba(106,179,62,0.3)', borderRadius: 6, padding: '9px 14px', fontSize: 12, marginBottom: 14 },
  tabBar:      { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 10, padding: 4 },
  tabBtn:      { flex: 1, padding: '8px 12px', border: 'none', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', background: 'transparent', color: 'var(--txt3)', fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.14s' },
  tabBtnActive:{ background: 'var(--bg3)', color: 'var(--txt)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  card:        { background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 10, padding: 16, marginBottom: 12 },
  cardTitle:   { fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 },
  fg:          { marginBottom: 12 },
  lbl:         { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt3)', display: 'block', marginBottom: 5 },
  input:       { width: '100%', padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: 6, color: 'var(--txt)', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  textarea:    { width: '100%', padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--brd2)', borderRadius: 6, color: 'var(--txt)', fontSize: 13, fontFamily: 'inherit', outline: 'none', minHeight: 90, resize: 'vertical' },
  primaryBtn:  { background: 'var(--accent)', color: 'var(--accent2)', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  colHdr:      { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt3)' },
  notifRow:    { display: 'flex', gap: 12, padding: '10px 4px', alignItems: 'flex-start' },
  metaTag:     { fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--txt3)', whiteSpace: 'nowrap' },
  empty:       { fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '12px 0' },
  emptyState:  { textAlign: 'center', padding: '4rem 0', color: 'var(--txt3)', fontSize: 13 },
}
