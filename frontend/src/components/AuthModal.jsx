import { useState } from 'react'
import { api, setToken } from '../api.js'

export default function AuthModal({ hasUsers, onSuccess, onClose }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const isSetup = !hasUsers

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (isSetup) {
      if (!username.trim()) return setError('Username is required')
      if (password.length < 4) return setError('Password must be at least 4 characters')
      if (password !== confirm) return setError('Passwords do not match')
    }

    setLoading(true)
    try {
      if (isSetup) {
        // First-run: create first user then login
        await api.createUser(username.trim(), password)
      }
      const result = await api.login(username.trim(), password)
      setToken(result.token)
      onSuccess(result.username, result.token)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">
            {isSetup ? '🔐 Create Admin Account' : '🔐 Sign In'}
          </h2>
          {!isSetup && onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          )}
        </div>

        {isSetup && (
          <div className="mx-6 mt-4 px-3 py-2 bg-blue-900/40 text-blue-300 text-sm rounded">
            First-time setup — create an admin account to protect management features.
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Username</label>
            <input
              className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isSetup ? 'new-password' : 'current-password'}
            />
          </div>
          {isSetup && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Confirm Password</label>
              <input
                type="password"
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-900/40 text-red-300 text-sm rounded">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {loading ? 'Please wait…' : isSetup ? 'Create Account & Sign In' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
