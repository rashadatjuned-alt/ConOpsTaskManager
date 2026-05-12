// Inside your User Management return statement:
<div className="table-container">
  {/* Add a header row for alignment */}
  <div style={{ display: 'flex', padding: '12px 20px', borderBottom: '2px solid var(--brd)', fontSize: '11px', fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
    <div style={{ width: '40px' }}>User</div>
    <div style={{ flex: 1, paddingLeft: '12px' }}>Name & Email</div>
    <div style={{ width: '150px' }}>Role</div>
    <div style={{ width: '180px', textAlign: 'right' }}>Actions</div>
  </div>

  {users.map(u => (
    <div key={u.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--brd)', background: 'var(--bg)' }}>
      {/* Avatar column */}
      <div className="avatar-mini" style={{ width: 40, height: 40, borderRadius: '8px' }}>
        {u.full_name?.slice(0, 2).toUpperCase()}
      </div>

      {/* Info column */}
      <div style={{ flex: 1, paddingLeft: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--txt)' }}>{u.full_name}</div>
        <div style={{ fontSize: '12px', color: 'var(--txt3)' }}>{u.email}</div>
      </div>

      {/* Role column - Fixed width for alignment */}
      <div style={{ width: '150px' }}>
        <select 
          className="avatar-mini" 
          style={{ width: '120px', height: '32px', padding: '0 8px', background: 'var(--bg2)' }}
          value={u.role}
        >
          <option>Admin</option>
          <option>Manager</option>
          <option>Team Member</option>
        </select>
      </div>

      {/* Actions column - Fixed width prevents button stretching */}
      <div style={{ width: '180px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button className="tv-btn" style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}>
           🔑 New Password
        </button>
        <button className="icon-btn" style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  ))}
</div>
