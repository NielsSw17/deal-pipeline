import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'

const ROLES = ['admin', 'member']

function UserRow({ user, currentUser, onUpdate, onDelete }) {
  const [editing, setEditing]   = useState(false)
  const [form, setForm]         = useState({
    full_name: user.full_name,
    email:     user.email || '',
    role:      user.role,
    is_active: user.is_active,
    password:  '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        full_name: form.full_name,
        email:     form.email || null,
        role:      form.role,
        is_active: form.is_active,
      }
      if (form.password) payload.password = form.password
      await onUpdate(user.id, payload)
      setEditing(false)
      setForm(f => ({ ...f, password: '' }))
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className={!user.is_active ? 'user-row-inactive' : ''}>
      <td className="settings-td">
        <span className="user-avatar">{user.full_name[0]}</span>
        {user.full_name}
        {user.id === currentUser.id && <span className="badge-you">You</span>}
      </td>
      <td className="settings-td settings-td-mono">{user.username}</td>
      <td className="settings-td">{user.email || '—'}</td>
      <td className="settings-td">
        <span className={`role-badge role-${user.role}`}>{user.role}</span>
      </td>
      <td className="settings-td">
        <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="settings-td settings-actions">
        {editing ? (
          <div className="user-edit-form">
            <div className="user-edit-row">
              <label>Full name</label>
              <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="user-edit-row">
              <label>Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="user-edit-row">
              <label>Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="user-edit-row">
              <label>Status</label>
              <select className="form-select" value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="user-edit-row">
              <label>New password</label>
              <input className="form-input" type="password" placeholder="Leave blank to keep" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="user-edit-btns">
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            {user.id !== currentUser.id && (
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => onDelete(user)}>Delete</button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState({ username: '', full_name: '', email: '', role: 'member', password: '' })
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState('')

  const [pwForm, setPwForm]       = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving]   = useState(false)
  const [pwMsg, setPwMsg]         = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleUpdate = async (id, data) => {
    const updated = await api.updateUser(id, data)
    setUsers(u => u.map(x => x.id === id ? updated : x))
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.full_name}" (${user.username})? This cannot be undone.`)) return
    await api.deleteUser(user.id)
    setUsers(u => u.filter(x => x.id !== user.id))
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      const created = await api.createUser(addForm)
      setUsers(u => [...u, created])
      setAddForm({ username: '', full_name: '', email: '', role: 'member', password: '' })
      setShowAdd(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwMsg('')
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg('New passwords do not match')
      return
    }
    setPwSaving(true)
    try {
      await api.changePassword(pwForm.current_password, pwForm.new_password)
      setPwMsg('Password changed successfully')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      setPwMsg(err.message)
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <h2 className="settings-title">Settings</h2>

      {/* Change own password */}
      <div className="settings-section">
        <h3 className="settings-section-title">Change My Password</h3>
        <form className="pw-form" onSubmit={handleChangePassword}>
          <input
            className="form-input"
            type="password"
            placeholder="Current password"
            value={pwForm.current_password}
            onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
            required
          />
          <input
            className="form-input"
            type="password"
            placeholder="New password (min 8 chars)"
            value={pwForm.new_password}
            onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
            required
          />
          <input
            className="form-input"
            type="password"
            placeholder="Confirm new password"
            value={pwForm.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            required
          />
          {pwMsg && <div className={`pw-msg ${pwMsg.includes('success') ? 'pw-msg-ok' : 'pw-msg-err'}`}>{pwMsg}</div>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={pwSaving}>
            {pwSaving ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* User management (admin only) */}
      {currentUser?.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-section-header">
            <h3 className="settings-section-title">User Management</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>
              {showAdd ? 'Cancel' : '+ Add User'}
            </button>
          </div>

          {showAdd && (
            <form className="add-user-form" onSubmit={handleAdd}>
              <input className="form-input" placeholder="Username" value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} required />
              <input className="form-input" placeholder="Full name" value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} required />
              <input className="form-input" type="email" placeholder="Email (optional)" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
              <select className="form-select" value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input className="form-input" type="password" placeholder="Initial password (min 8 chars)" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} required />
              <button className="btn btn-primary btn-sm" type="submit" disabled={adding}>
                {adding ? 'Creating…' : 'Create User'}
              </button>
            </form>
          )}

          {error && <div className="login-error">{error}</div>}

          {loading ? (
            <div className="loading-state"><div className="spinner" /><span>Loading users…</span></div>
          ) : (
            <div className="settings-table-wrap">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      currentUser={currentUser}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
