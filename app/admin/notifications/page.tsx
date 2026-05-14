'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { Send, Settings, Activity, Save, CheckCircle2, AlertCircle, Clock, BellRing, Trash2, Mail } from 'lucide-react'

const NOTIFICATION_EVENTS = [
  { id: 1, name: 'New Task Created', desc: 'When a new task is created in a project', icon: '➕' },
  { id: 2, name: 'New User Joined', desc: 'When a new user is added to the system', icon: '👥' },
  { id: 3, name: 'Password Reset Sent', desc: 'When admin sends a password reset', icon: '🔑' },
  { id: 4, name: 'Project Milestone', desc: 'When a project reaches 50% or 100% completion', icon: '🚀' },
  { id: 5, name: 'Removed from Task', desc: 'When a user is removed from a task', icon: '❌' },
  { id: 6, name: 'Subtask Assigned', desc: 'When a user is assigned to a subtask', icon: '📎' },
  { id: 7, name: 'Task Assigned', desc: 'When a user is assigned to a task', icon: '📅' },
  { id: 8, name: 'Task Completed', desc: 'When a task is marked Completed', icon: '✅' },
  { id: 9, name: 'Task Due Soon', desc: 'When a task deadline is approaching', icon: '⏰', days: 2 },
  { id: 10, name: 'Task Overdue', desc: 'When a task passes its deadline incomplete', icon: '⚠️' },
  { id: 11, name: 'Email Broadcast', desc: 'Allow sending actual emails to the user inbox', icon: '📧' },
]

export default function NotificationManagement() {
  const [activeTab, setActiveTab] = useState('Configuration')

  // Backend States
  const [users, setUsers] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Send States
  const [message, setMessage] = useState('')
  const [targetRole, setTargetRole] = useState('All')
  const [sendEmail, setSendEmail] = useState(false)
  const [sending, setSending] = useState(false)

  // Load Database Info
  const loadData = async () => {
    setLoading(true)
    const [u, n] = await Promise.all([
      supabase.from('Users').select('id, full_name, role, email'),
      supabase.from('Notifications').select('*').order('created_at', { ascending: false }).limit(50)
    ])
    setUsers(u.data || [])
    setLogs(n.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Send Broadcast Logic
  const handleBroadcast = async () => {
    if (!message.trim()) return alert("Please enter a message")
    setSending(true)

    const recipients = targetRole === 'All' ? users : users.filter(u => u.role === targetRole)

    if (recipients.length === 0) {
      alert("No users found in this category.")
      setSending(false)
      return
    }

    // 1. IN-APP NOTIFICATIONS
    const payload = recipients.map(u => ({
      user_id: u.id,
      message: message,
      is_read: false
    }))
    const { error } = await supabase.from('Notifications').insert(payload)

    // 2. EXTERNAL EMAIL NOTIFICATIONS
    if (sendEmail) {
      try {
        const validEmails = recipients.map(u => u.email).filter(Boolean)
        if (validEmails.length > 0) {
          await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              emails: validEmails, 
              message: message 
            })
          })
        }
      } catch (err) {
        console.error("Failed to send external emails:", err)
        alert("In-app notifications sent, but external emails failed.")
      }
    }

    if (error) {
      alert("Error sending in-app notifications: " + error.message)
    } else {
      setMessage('')
      setSendEmail(false)
      alert(`Broadcast sent to ${recipients.length} members!`)
      loadData()
      setActiveTab('Activity') 
    }
    setSending(false)
  }

  const deleteNotification = async (id: string) => {
    await supabase.from('Notifications').delete().eq('id', id)
    setLogs(prev => prev.filter(n => n.id !== id))
  }

  return (
    <AppShell title="Notifications Management">
      {/* TAB NAVIGATION */}
      <div style={{ 
        display: 'flex', 
        background: 'var(--bg2)', 
        padding: '4px', 
        borderRadius: '12px', 
        marginBottom: '32px', 
        width: 'fit-content',
        border: '1px solid var(--brd)'
      }}>
        {['Send', 'Configuration', 'Activity'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              padding: '8px 24px', 
              border: 'none', 
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === tab ? 'var(--bg)' : 'transparent',
              color: activeTab === tab ? 'var(--nav-active-txt)' : 'var(--txt2)',
              boxShadow: activeTab === tab ? 'var(--shd)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: '0.2s'
            }}
          >
            {tab === 'Send' && <Send size={14} />}
            {tab === 'Configuration' && <Settings size={14} />}
            {tab === 'Activity' && <Activity size={14} />}
            {tab}
          </button>
        ))}
      </div>

      {/* ─── TAB: SEND BROADCAST ─── */}
      {activeTab === 'Send' && (
        <div style={{ maxWidth: 600, background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: 16, padding: 32 }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: 18, fontWeight: 800 }}>Broadcast Announcement</h3>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Target Audience</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['All', 'Admin', 'Manager', 'Team Member'].map(role => (
                <button 
                  key={role}
                  onClick={() => setTargetRole(role)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--brd)', transition: '0.2s',
                    background: targetRole === role ? 'var(--txt)' : 'var(--bg2)',
                    color: targetRole === role ? 'var(--bg)' : 'var(--txt)'
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Message Content</label>
            <textarea 
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your announcement here... e.g. 'Server maintenance at 5 PM!'"
              style={{ width: '100%', minHeight: 120, padding: 16, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--brd)', color: 'var(--txt)', outline: 'none', resize: 'none', fontSize: 14 }}
            />
          </div>

          {/* EMAIL TOGGLE */}
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input 
              type="checkbox" 
              id="emailToggle"
              checked={sendEmail} 
              onChange={e => setSendEmail(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--nav-active-txt)', cursor: 'pointer' }}
            />
            <label htmlFor="emailToggle" style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={16} /> Also send as External Email
            </label>
          </div>

          <button 
            onClick={handleBroadcast}
            disabled={sending}
            style={{ width: '100%', padding: '14px', borderRadius: 10, background: 'var(--nav-active-txt)', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {sending ? 'Sending...' : <><BellRing size={18}/> Push Notification</>}
          </button>
        </div>
      )}

      {/* ─── TAB: CONFIGURATION ─── */}
      {activeTab === 'Configuration' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--txt3)' }}>Configure which events trigger notifications and for which roles.</p>
            <button className="btn-create-pop" style={{ padding: '6px 16px' }}>
              <Save size={14} /> Save All
            </button>
          </div>

          <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--brd)', background: 'var(--bg2)' }}>
                  <th style={{ padding: '16px 20px', color: 'var(--txt3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Event Details</th>
                  <th style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Enabled</th>
                  <th style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Team Member</th>
                  <th style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Manager</th>
                  <th style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Deadline Days</th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENTS.map(event => (
                  <tr key={event.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px' }}>{event.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: '14px' }}>{event.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>{event.desc}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked style={{ accentColor: 'var(--nav-active-txt)', width: '18px', height: '18px', cursor: 'pointer' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked style={{ accentColor: 'var(--nav-active-txt)', width: '18px', height: '18px', cursor: 'pointer' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" defaultChecked style={{ accentColor: 'var(--nav-active-txt)', width: '18px', height: '18px', cursor: 'pointer' }} /></td>
                    <td style={{ textAlign: 'center' }}>
                      {event.days ? (
                        <input type="number" defaultValue={event.days} style={{ width: '50px', padding: '4px', textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '6px', color: 'var(--txt)', fontSize: '12px' }} />
                      ) : (
                        <span style={{ color: 'var(--txt3)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── TAB: ACTIVITY LOGS ─── */}
      {activeTab === 'Activity' && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt3)' }}>RECENT SYSTEM NOTIFICATIONS</span>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Showing last 50 logs</span>
          </div>

          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>Loading logs...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>No recent activity.</div>
            ) : (
              logs.map((n, idx) => {
                const user = users.find(u => u.id === n.user_id)
                return (
                  <div key={n.id} style={{ padding: '16px 20px', borderBottom: idx !== logs.length - 1 ? '1px solid var(--brd)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: '0.2s' }} className="hover-bg">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)', marginBottom: 4 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} /> {new Date(n.created_at).toLocaleString()}
                        <span style={{ margin: '0 4px' }}>•</span>
                        Recipient: {user ? `${user.full_name} (${user.role})` : 'System'}
                        <span style={{ margin: '0 4px' }}>•</span>
                        Status: <span style={{ color: n.is_read ? '#639922' : '#EF4444', fontWeight: 700 }}>{n.is_read ? 'Read' : 'Unread'}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteNotification(n.id)} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', padding: 8 }} title="Delete Log">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}