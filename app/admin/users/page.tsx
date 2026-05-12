'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/layout/AppShell'
import { UserPlus, Trash2, Key, Search, ChevronDown } from 'lucide-react'

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase.from('Users').select('*').order('full_name')
      if (!error) setUsers(data)
      setLoading(false)
    }
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    total: users.length,
    managers: users.filter(u => u.role === 'Manager').length,
    members: users.filter(u => u.role === 'Team Member').length
  }

  if (loading) return <AppShell title="User Management">Loading...</AppShell>

  return (
    <AppShell title="User Management">
      {/* STATS OVERVIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--txt)' }}>{stats.total}</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>Total Users</div>
        </div>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--txt)' }}>{stats.managers}</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>Managers</div>
        </div>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--txt)' }}>{stats.members}</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>Team Members</div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--txt3)', fontWeight: 600 }}>{filteredUsers.length} users found</div>
        <button className="btn-create-pop" style={{ fontSize: '13px' }}>
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {/* TABLE HEADER */}
      <div style={{ 
        display: 'flex', 
        padding: '12px 20px', 
        borderBottom: '2px solid var(--brd)', 
        fontSize: '11px', 
        fontWeight: 800, 
        color: 'var(--txt3)', 
        textTransform: 'uppercase', 
        letterSpacing: '1px' 
      }}>
        <div style={{ width: '50px' }}>User</div>
        <div style={{ flex: 1, paddingLeft: '12px' }}>Identity & Contact</div>
        <div style={{ width: '150px' }}>Role Selection</div>
        <div style={{ width: '200px', textAlign: 'right' }}>Administrative Actions</div>
      </div>

      {/* USER LIST */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filteredUsers.map(u => (
          <div key={u.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '16px 20px', 
            borderBottom: '1px solid var(--brd)', 
            background: 'var(--bg)',
            transition: 'background 0.2s'
          }}>
            {/* Avatar */}
            <div className="avatar-mini" style={{ width: 42, height: 42, borderRadius: '10px', fontSize: '12px' }}>
              {u.full_name?.slice(0, 2).toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, paddingLeft: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--txt)', marginBottom: '2px' }}>{u.full_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>{u.email}</div>
            </div>

            {/* Role Dropdown */}
            <div style={{ width: '150px' }}>
              <div style={{ position: 'relative', width: '130px' }}>
                <select 
                  style={{ 
                    width: '100%', 
                    padding: '6px 12px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--brd)', 
                    background: 'var(--bg2)', 
                    color: 'var(--txt2)', 
                    fontSize: '12px',
                    fontWeight: 600,
                    appearance: 'none',
                    cursor: 'pointer'
                  }}
                  value={u.role}
                  onChange={() => {}}
                >
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Team Member</option>
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: 10, color: 'var(--txt3)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ width: '200px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="tv-btn" style={{ padding: '6px 14px', gap: '6px', fontSize: '12px' }}>
                <Key size={14} /> New Password
              </button>
              <button className="icon-btn" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '8px' }}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
