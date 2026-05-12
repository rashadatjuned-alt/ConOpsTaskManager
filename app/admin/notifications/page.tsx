'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Send, Settings, Activity, Save, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

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
]

export default function NotificationManagement() {
  const [activeTab, setActiveTab] = useState('Configuration')

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--txt3)' }}>Configure which events trigger notifications and for which roles.</p>
        <button className="btn-create-pop" style={{ padding: '6px 16px' }}>
          <Save size={14} /> Save All
        </button>
      </div>

      {/* CONFIGURATION TABLE */}
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
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--nav-active-txt)', width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--nav-active-txt)', width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--nav-active-txt)', width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  {event.days ? (
                    <input 
                      type="number" 
                      defaultValue={event.days}
                      style={{ width: '50px', padding: '4px', textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '6px', color: 'var(--txt)', fontSize: '12px' }} 
                    />
                  ) : (
                    <span style={{ color: 'var(--txt3)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
