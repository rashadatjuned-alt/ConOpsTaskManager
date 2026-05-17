'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import {
  Send, Settings, Activity, Save, Clock, BellRing,
  Trash2, Mail, Plus, Pencil, X, Check, AlertCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigRow {
  id: string
  event_key: string
  label: string
  description: string
  icon: string
  enabled: boolean
  team_member: boolean
  manager: boolean
  send_email: boolean          // matches lib/notifications.ts: config.send_email
  deadline_days: number | null
  is_custom: boolean
}

interface ActivityRow {
  id: string
  event_key: string
  message: string
  created_at: string
  target_user_id: string
  entity_name: string | null
  triggered_by: string | null
}

// ─── Event meta (for icon fallback in activity log) ───────────────────────────

const EVENT_META: Record<string, { label: string; icon: string }> = {
  task_assigned:       { label: 'Task assigned',       icon: '📅' },
  subtask_assigned:    { label: 'Subtask assigned',     icon: '📎' },
  task_unassigned:     { label: 'Removed from task',    icon: '❌' },
  task_status_changed: { label: 'Task status changed',  icon: '🔄' },
  task_completed:      { label: 'Task completed',       icon: '✅' },
  task_due_soon:       { label: 'Task due soon',        icon: '⏰' },
  task_overdue:        { label: 'Task overdue',         icon: '⚠️' },
  task_created:        { label: 'Task created',         icon: '➕' },
  project_milestone:   { label: 'Project milestone',    icon: '🚀' },
  project_assigned:    { label: 'Project assigned',     icon: '📁' },
  user_joined:         { label: 'New user joined',      icon: '👥' },
  password_reset_sent: { label: 'Password reset sent',  icon: '🔑' },
  broadcast:           { label: 'Broadcast',            icon: '📢' },
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'success' ? '#1d9e75' : '#ef4444',
      color: '#fff', padding: '12px 20px', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      {type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 4 }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Event Modal (Add / Edit) ─────────────────────────────────────────────────

const BLANK: Omit<ConfigRow, 'id'> = {
  event_key: '', label: '', description: '', icon: '🔔',
  enabled: true, team_member: true, manager: true,
  send_email: false, deadline_days: null, is_custom: true,
}

function EventModal({
  row,
  onClose,
  onSaved,
}: {
  row: Partial<ConfigRow> | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !row?.id
  const [form, setForm] = useState<Omit<ConfigRow, 'id'>>({ ...BLANK, ...row })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.event_key.trim()) return setErr('Event key is required')
    if (!form.label.trim())     return setErr('Label is required')
    setSaving(true)
    setErr('')
    const payload = { ...form, event_key: form.event_key.trim().toLowerCase().replace(/\s+/g, '_') }
    const { error } = isNew
      ? await supabase.from('NotificationConfig').insert(payload)
      : await supabase.from('NotificationConfig').update(payload).eq('id', row!.id!)
    setSaving(false)
    if (error) return setErr(error.message)
    onSaved()
    onClose()
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: 'var(--bg2)', border: '1px solid var(--brd)',
    color: 'var(--txt)', fontSize: 13, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
    textTransform: 'uppercase', display: 'block', marginBottom: 6,
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 480, border: '1px solid var(--brd)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            {isNew ? 'Add notification event' : `Edit — ${form.label}`}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)' }}><X size={18} /></button>
        </div>

        {err && (
          <div style={{ background: '#ef444420', color: '#ef4444', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Label</label>
            <input style={inp} value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Task modified" />
          </div>
          <div>
            <label style={lbl}>Icon</label>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--brd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              {form.icon}
            </div>
          </div>
        </div>

        {/* Emoji picker */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Pick icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['📅','📎','❌','🔄','✅','⏰','⚠️','➕','🚀','📁','👥','🔑','📢','🔔','💬','🏷️','📊','🛠️','🔗','⭐','🎯','📌','🗂️','🧩'].map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => set('icon', emoji)}
                style={{
                  width: 38, height: 38, borderRadius: 8, fontSize: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  border: form.icon === emoji ? '2px solid var(--nav-active-txt)' : '1px solid var(--brd)',
                  background: form.icon === emoji ? 'var(--bg2)' : 'transparent',
                  transition: '0.1s',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Description</label>
          <input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Event key (snake_case)</label>
          <input
            style={{ ...inp, fontFamily: 'monospace', fontSize: 12 }}
            value={form.event_key}
            onChange={e => set('event_key', e.target.value)}
            placeholder="e.g. task_modified"
            disabled={!isNew && !form.is_custom}
          />
          {isNew ? (
            <p style={{ fontSize: 11, color: 'var(--txt3)', margin: '4px 0 0' }}>
              Must match the key passed to <code>sendNotification()</code> in <code>lib/notifications.ts</code>.
              A dev needs to add the trigger call.
            </p>
          ) : !form.is_custom ? (
            <p style={{ fontSize: 11, color: 'var(--txt3)', margin: '4px 0 0' }}>System event keys cannot be renamed.</p>
          ) : null}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Deadline days (optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              style={{ ...inp, width: 80 }}
              type="number" min={1} max={30}
              value={form.deadline_days ?? ''}
              onChange={e => set('deadline_days', e.target.value ? Number(e.target.value) : null)}
              placeholder="—"
            />
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>days before deadline — only for due-soon type events</span>
          </div>
        </div>

        {/* Role toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {([
            ['enabled',     'Globally enabled'],
            ['team_member', 'Team member'],
            ['manager',     'Manager / Admin'],
          ] as [keyof typeof form, string][]).map(([key, label]) => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', background: 'var(--bg2)', padding: '8px 10px', borderRadius: 8,
              border: `1px solid ${form[key] ? 'var(--nav-active-txt)' : 'var(--brd)'}`,
            }}>
              <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)}
                style={{ accentColor: 'var(--nav-active-txt)', width: 15, height: 15 }} />
              {label}
            </label>
          ))}
        </div>

        {/* Email toggle */}
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 14, border: '1px solid var(--brd)', marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.send_email} onChange={e => set('send_email', e.target.checked)}
              style={{ accentColor: 'var(--nav-active-txt)', width: 16, height: 16 }} />
            <Mail size={14} /> Also send as email
          </label>
          {form.send_email && (
            <p style={{ fontSize: 11, color: 'var(--txt3)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Email is sent individually per recipient by <code>lib/notifications.ts</code> via <code>/api/email</code>.
              Subject lines and CTA buttons are auto-generated from the event type — no extra config needed.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: 'var(--nav-active-txt)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: saving ? 0.7 : 1,
          }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationManagement() {
  const [activeTab, setActiveTab] = useState<'Send' | 'Configuration' | 'Activity'>('Configuration')

  const [users,   setUsers]   = useState<any[]>([])
  const [config,  setConfig]  = useState<ConfigRow[]>([])
  const [logs,    setLogs]    = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  const [message,    setMessage]    = useState('')
  const [targetRole, setTargetRole] = useState('All')
  const [sendEmail,  setSendEmail]  = useState(false)
  const [sending,    setSending]    = useState(false)

  const [dirty,     setDirty]     = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [modalRow,  setModalRow]  = useState<Partial<ConfigRow> | null | false>(false)

  const [logSearch,      setLogSearch]      = useState('')
  const [logEventFilter, setLogEventFilter] = useState('All')

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), [])

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [u, c, a] = await Promise.all([
      supabase.from('Users').select('id, full_name, role, email'),
      supabase.from('NotificationConfig').select('*').order('is_custom').order('label'),
      supabase.from('NotificationActivity').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    setUsers(u.data  || [])
    setConfig(c.data || [])
    setLogs(a.data   || [])
    setLoading(false)
    setDirty(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Config ────────────────────────────────────────────────────────────────

  const updateLocal = (id: string, key: keyof ConfigRow, value: any) => {
    setConfig(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r))
    setDirty(true)
  }

  const handleSaveAll = async () => {
    setSavingAll(true)
    for (const row of config) {
      const { error } = await supabase.from('NotificationConfig').update({
        enabled:       row.enabled,
        team_member:   row.team_member,
        manager:       row.manager,
        send_email:    row.send_email,
        deadline_days: row.deadline_days,
        label:         row.label,
        description:   row.description,
        icon:          row.icon,
      }).eq('id', row.id)
      if (error) {
        showToast('Save failed: ' + error.message, 'error')
        setSavingAll(false)
        return
      }
    }
    setSavingAll(false)
    setDirty(false)
    showToast('Configuration saved!')
  }

  const handleDeleteEvent = async (row: ConfigRow) => {
    if (!row.is_custom) return
    if (!confirm(`Delete custom event "${row.label}"? This cannot be undone.`)) return
    const { error } = await supabase.from('NotificationConfig').delete().eq('id', row.id)
    if (error) return showToast('Delete failed: ' + error.message, 'error')
    setConfig(prev => prev.filter(r => r.id !== row.id))
    showToast('Event deleted')
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────
  // Sends in-app + logs to NotificationActivity.
  // If email toggle is on, calls /api/email individually per recipient,
  // matching the per-user contract in lib/notifications.ts.

  const handleBroadcast = async () => {
    if (!message.trim()) return showToast('Please enter a message', 'error')
    setSending(true)

    const recipients = targetRole === 'All' ? users : users.filter(u => u.role === targetRole)
    if (!recipients.length) {
      showToast('No users in this group', 'error')
      setSending(false)
      return
    }

    const now    = new Date().toISOString()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    // 1. In-app notifications (batch)
    const { error } = await supabase.from('Notifications').insert(
      recipients.map(u => ({ user_id: u.id, message, is_read: false }))
    )
    if (error) {
      showToast('Failed: ' + error.message, 'error')
      setSending(false)
      return
    }

    // 2. Activity log — one row per recipient, event_key = 'broadcast'
    await supabase.from('NotificationActivity').insert(
      recipients.map(u => ({ event_key: 'broadcast', target_user_id: u.id, message, created_at: now }))
    )

    // 3. Email — per-user to match /api/email contract (to / recipientName / subject / message / ctaUrl / ctaLabel)
    if (sendEmail) {
      await Promise.allSettled(
        recipients
          .filter(u => u.email)
          .map(u =>
            fetch('/api/email', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to:            u.email,
                recipientName: u.full_name || '',
                subject:       'Announcement from ConOps Tasker',
                message,
                ctaUrl:        `${appUrl}/dashboard`,
                ctaLabel:      'Open ConOps Tasker',
              }),
            }).catch(err => console.error('[broadcast] email failed for', u.email, err))
          )
      )
    }

    showToast(`Broadcast sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}!`)
    setMessage('')
    setSendEmail(false)
    setSending(false)
    loadAll()
    setActiveTab('Activity')
  }

  // ── Activity ──────────────────────────────────────────────────────────────

  const deleteLog = async (id: string) => {
    await supabase.from('NotificationActivity').delete().eq('id', id)
    setLogs(prev => prev.filter(n => n.id !== id))
  }

  const clearAllLogs = async () => {
    if (!confirm('Clear all activity logs? This cannot be undone.')) return
    await supabase.from('NotificationActivity').delete().not('id', 'is', null)
    setLogs([])
    showToast('Activity log cleared')
  }

  const eventKeys    = ['All', ...Array.from(new Set(logs.map(l => l.event_key)))]
  const filteredLogs = logs.filter(l => {
    const user        = users.find(u => u.id === l.target_user_id)
    const matchSearch = !logSearch
      || l.message.toLowerCase().includes(logSearch.toLowerCase())
      || (user?.full_name ?? '').toLowerCase().includes(logSearch.toLowerCase())
    const matchEvent  = logEventFilter === 'All' || l.event_key === logEventFilter
    return matchSearch && matchEvent
  })

  const recipientCount = targetRole === 'All' ? users.length : users.filter(u => u.role === targetRole).length

  const thStyle: React.CSSProperties = {
    padding: '11px 10px', fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', textAlign: 'center',
  }
  const cbStyle: React.CSSProperties = { accentColor: 'var(--nav-active-txt)', width: 15, height: 15, cursor: 'pointer' }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Notifications Management">

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {modalRow !== false && (
        <EventModal row={modalRow ?? undefined} onClose={() => setModalRow(false)} onSaved={loadAll} />
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--bg2)', padding: 4, borderRadius: 12, marginBottom: 32, width: 'fit-content', border: '1px solid var(--brd)' }}>
        {(['Send', 'Configuration', 'Activity'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', transition: '0.15s',
            background: activeTab === tab ? 'var(--bg)' : 'transparent',
            color: activeTab === tab ? 'var(--nav-active-txt)' : 'var(--txt2)',
            boxShadow: activeTab === tab ? 'var(--shd)' : 'none',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            {tab === 'Send'          && <Send size={13} />}
            {tab === 'Configuration' && <Settings size={13} />}
            {tab === 'Activity'      && <Activity size={13} />}
            {tab}
          </button>
        ))}
      </div>

      {/* ══════ SEND ══════ */}
      {activeTab === 'Send' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>Broadcast announcement</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Target audience</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['All', 'Admin', 'Manager', 'Team Member'].map(role => (
                  <button key={role} onClick={() => setTargetRole(role)} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid var(--brd)', transition: '0.15s',
                    background: targetRole === role ? 'var(--txt)' : 'var(--bg2)',
                    color: targetRole === role ? 'var(--bg)' : 'var(--txt)',
                  }}>{role}</button>
                ))}
              </div>
            </div>

            <div style={{ background: '#1d9e7520', border: '1px solid #1d9e7540', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#0f6e56', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} />
              {recipientCount} recipient{recipientCount !== 1 ? 's' : ''} will receive this notification
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="e.g. Server maintenance at 10 PM — please save your work."
                style={{ width: '100%', minHeight: 110, padding: 14, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--brd)', color: 'var(--txt)', outline: 'none', resize: 'none', fontSize: 13, fontFamily: 'inherit' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}>
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
                style={{ accentColor: 'var(--nav-active-txt)', width: 16, height: 16 }} />
              <Mail size={14} /> Also send as external email
            </label>

            <button onClick={handleBroadcast} disabled={sending} style={{
              width: '100%', padding: 13, borderRadius: 10, background: 'var(--nav-active-txt)',
              color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: sending ? 0.7 : 1,
            }}>
              {sending ? 'Sending…' : <><BellRing size={16} /> Push notification</>}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 12 }}>In-app preview</div>
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 14, display: 'flex', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--nav-active-txt)', marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.5 }}>
                    {message || <span style={{ color: 'var(--txt3)' }}>Your message will appear here…</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 5 }}>just now · Admin broadcast</div>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 12 }}>Recent broadcasts</div>
              {(() => {
                // dedupe: show unique messages, not one row per recipient
                const broadcastLogs = logs
                  .filter(l => l.event_key === 'broadcast')
                  .filter((l, i, arr) => arr.findIndex(x => x.message === l.message && x.created_at.slice(0, 10) === l.created_at.slice(0, 10)) === i)
                  .slice(0, 3)
                return broadcastLogs.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No broadcasts sent yet.</div>
                  : broadcastLogs.map((l, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--txt)', padding: '8px 0', borderBottom: i < broadcastLogs.length - 1 ? '1px solid var(--brd)' : 'none' }}>
                      <div style={{ fontWeight: 600 }}>{l.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>{new Date(l.created_at).toLocaleDateString()}</div>
                    </div>
                  ))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══════ CONFIGURATION ══════ */}
      {activeTab === 'Configuration' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--txt3)', margin: 0 }}>
              Control which events fire notifications, for which roles, and whether email is also sent automatically.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {dirty && <span style={{ fontSize: 12, color: '#ef9f27', fontWeight: 700 }}>Unsaved changes</span>}
              <button onClick={() => setModalRow(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg2)', color: 'var(--txt)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={13} /> Add event
              </button>
              <button onClick={handleSaveAll} disabled={savingAll || !dirty} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none',
                background: dirty ? 'var(--nav-active-txt)' : 'var(--bg2)',
                color: dirty ? '#fff' : 'var(--txt3)',
                fontSize: 12, fontWeight: 700, cursor: dirty ? 'pointer' : 'default',
              }}>
                <Save size={13} /> {savingAll ? 'Saving…' : 'Save all'}
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading configuration…</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 680 }}>
                  <colgroup>
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '8%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--brd)' }}>
                      <th style={{ ...thStyle, textAlign: 'left', padding: '11px 16px' }}>Event</th>
                      <th style={thStyle}>Enabled</th>
                      <th style={thStyle}>Team member</th>
                      <th style={thStyle}>Manager</th>
                      <th style={{ ...thStyle, background: '#e6f1fb30', color: '#185fa5' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <Mail size={10} /> Send email
                        </span>
                      </th>
                      <th style={thStyle}>Days</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.map(row => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--brd)', background: row.is_custom ? '#1d9e7508' : 'var(--bg)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{row.icon}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{row.label}</div>
                              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{row.description}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" style={cbStyle} checked={row.enabled} onChange={e => updateLocal(row.id, 'enabled', e.target.checked)} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" style={cbStyle} checked={row.team_member} onChange={e => updateLocal(row.id, 'team_member', e.target.checked)} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" style={cbStyle} checked={row.manager} onChange={e => updateLocal(row.id, 'manager', e.target.checked)} />
                        </td>
                        <td style={{ textAlign: 'center', background: '#e6f1fb15' }}>
                          <input type="checkbox" style={{ ...cbStyle, accentColor: '#185fa5' }} checked={row.send_email} onChange={e => updateLocal(row.id, 'send_email', e.target.checked)} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {row.deadline_days !== null ? (
                            <input type="number" min={1} max={30} value={row.deadline_days}
                              onChange={e => updateLocal(row.id, 'deadline_days', Number(e.target.value))}
                              style={{ width: 44, padding: '3px 5px', textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 6, color: 'var(--txt)', fontSize: 12 }} />
                          ) : <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: row.is_custom ? '#e1f5ee' : '#eeedfe', color: row.is_custom ? '#085041' : '#3c3489' }}>
                            {row.is_custom ? 'custom' : 'system'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => setModalRow(row)} title="Edit" style={{ background: 'none', border: '1px solid var(--brd)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--txt3)' }}>
                              <Pencil size={12} />
                            </button>
                            {row.is_custom && (
                              <button onClick={() => handleDeleteEvent(row)} title="Delete" style={{ background: 'none', border: '1px solid #f7c1c1', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a32d2d' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {config.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
                          No events configured. Run the SQL migration and reload.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--brd)', background: 'var(--bg2)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: 'var(--txt3)' }}>
              <span><span style={{ background: '#eeedfe', color: '#3c3489', padding: '1px 6px', borderRadius: 8, fontWeight: 700, fontSize: 10 }}>system</span> built-in — edit only</span>
              <span><span style={{ background: '#e1f5ee', color: '#085041', padding: '1px 6px', borderRadius: 8, fontWeight: 700, fontSize: 10 }}>custom</span> admin-created — requires dev trigger call</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={11} /> email per-user via <code>lib/notifications.ts</code> → subject &amp; CTA auto-generated
              </span>
            </div>
          </div>
        </>
      )}

      {/* ══════ ACTIVITY ══════ */}
      {activeTab === 'Activity' && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Search messages or recipients…"
              style={{ flex: 1, minWidth: 200, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg)', color: 'var(--txt)', fontSize: 13, outline: 'none' }} />
            <select value={logEventFilter} onChange={e => setLogEventFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--brd)', background: 'var(--bg)', color: 'var(--txt)', fontSize: 12, cursor: 'pointer' }}>
              {eventKeys.map(k => <option key={k}>{k}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{filteredLogs.length} of {logs.length} entries</span>
            <button onClick={clearAllLogs} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #f7c1c1', background: '#fcebeb', color: '#a32d2d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Trash2 size={13} /> Clear all
            </button>
          </div>

          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading…</div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>No matching activity.</div>
            ) : filteredLogs.map((n, idx) => {
              const user      = users.find(u => u.id === n.target_user_id)
              const configRow = config.find(c => c.event_key === n.event_key)
              const meta      = EVENT_META[n.event_key]
              return (
                <div key={n.id} className="hover-bg" style={{ padding: '13px 16px', borderBottom: idx !== filteredLogs.length - 1 ? '1px solid var(--brd)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 16, width: 32, height: 32, background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {configRow?.icon ?? meta?.icon ?? '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 4 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{new Date(n.created_at).toLocaleString()}</span>
                      <span>·</span>
                      <span>{user ? `${user.full_name} (${user.role})` : 'Unknown user'}</span>
                      <span>·</span>
                      <code style={{ background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>{n.event_key}</code>
                      {n.entity_name && <><span>·</span><span>{n.entity_name}</span></>}
                    </div>
                  </div>
                  <button onClick={() => deleteLog(n.id)} title="Delete log entry" style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', padding: 6, flexShrink: 0 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </AppShell>
  )
}