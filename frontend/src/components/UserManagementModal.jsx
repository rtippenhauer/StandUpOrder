import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function UserManagementModal({ onClose }) {
  const [users, setUsers] = useState([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPw, setChangingPw] = useState(null) // username being changed
  const [newPw, setNewPw] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const u = await api.getUsers().catch(() => [])
    setUsers(u)
  }

  async function addUser() {
    if (!newUsername.trim() || !newPassword) return setError('Username and password required')
    setSaving(true); setError(null)
    try {
      await api.createUser(newUsername.trim(), newPassword)
      setNewUsername(''); setNewPassword('')
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function deleteUser(username) {
    if (!confirm(`Delete user "${username}"?`)) return
    setSaving(true)
    try { await api.deleteUser(username); await load() }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function changePassword(username) {
    if (!newPw) return setError('Password required')
    setSaving(true); setError(null)
    try {
      await api.updateUserPassword(username, newPw)
      setChangingPw(null); setNewPw('')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">👤 Manage Users</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
          {users.map(u => (
            <div key={u.username} className="bg-slate-700 rounded-lg px-4 py-2.5">
              {changingPw === u.username ? (
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm flex-1">{u.username}</span>
                  <input
                    type="password"
                    placeholder="New password"
                    className="bg-slate-600 text-white text-xs rounded px-2 py-1 w-32"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                  />
                  <button onClick={() => changePassword(u.username)} className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded">Save</button>
                  <button onClick={() => setChangingPw(null)} className="text-xs bg-slate-600 text-white px-2 py-1 rounded">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">{u.username}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setChangingPw(u.username); setNewPw('') }} className="text-xs text-slate-400 hover:text-white">Change PW</button>
                    <button onClick={() => deleteUser(u.username)} className="text-xs text-slate-400 hover:text-red-400">🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-700 p-4 space-y-2">
          <p className="text-xs text-slate-400 font-medium">Add new user</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-700 text-white text-sm rounded px-3 py-1.5 placeholder-slate-400"
              placeholder="Username"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
            />
            <input
              type="password"
              className="flex-1 bg-slate-700 text-white text-sm rounded px-3 py-1.5 placeholder-slate-400"
              placeholder="Password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <button
              onClick={addUser}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded"
            >
              Add
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        <div className="px-6 py-3 border-t border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Done</button>
        </div>
      </div>
    </div>
  )
}
