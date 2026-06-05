import { useState, useEffect } from 'react'
import { teamsApi } from '../api.js'

export default function SuperAdminPanel({ authUser, onLogout, onNavigate }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [invitesByTeam, setInvitesByTeam] = useState({})
  const [newTeamSlug, setNewTeamSlug] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [generatingInvite, setGeneratingInvite] = useState(null)
  const [copiedToken, setCopiedToken] = useState(null)

  useEffect(() => { loadTeams() }, [])

  async function loadTeams() {
    setLoading(true)
    try {
      const t = await teamsApi.list()
      setTeams(t)
      // Load invites for each team
      const inviteMap = {}
      await Promise.all(t.map(async team => {
        try {
          inviteMap[team.slug] = await teamsApi.listInvites(team.slug)
        } catch (_) { inviteMap[team.slug] = [] }
      }))
      setInvitesByTeam(inviteMap)
    } finally {
      setLoading(false)
    }
  }

  async function createTeam(e) {
    e.preventDefault()
    setError(null)
    try {
      await teamsApi.create(newTeamSlug.trim().toLowerCase(), newTeamName.trim())
      setNewTeamSlug('')
      setNewTeamName('')
      setSuccess(`Team "${newTeamName}" created!`)
      setTimeout(() => setSuccess(null), 3000)
      await loadTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteTeam(slug) {
    if (!confirm(`Archive team "${slug}"? Data will be preserved.`)) return
    try {
      await teamsApi.delete(slug)
      await loadTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  async function generateInvite(slug) {
    setGeneratingInvite(slug)
    try {
      const result = await teamsApi.createInvite(slug)
      await loadTeams()
      setSuccess(`Invite created! URL copied.`)
      copyToClipboard(result.url)
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingInvite(null)
    }
  }

  async function revokeInvite(slug, token) {
    try {
      await teamsApi.revokeInvite(slug, token)
      await loadTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  function copyInvite(url, token) {
    copyToClipboard(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString()
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('/')} className="text-slate-400 hover:text-white text-sm">← Home</button>
          <span className="font-bold text-xl text-white">⚙️ Super Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">{authUser.email}</span>
          <button onClick={onLogout} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">Sign Out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Alerts */}
        {error && (
          <div className="px-4 py-3 bg-red-900/40 text-red-300 rounded-lg text-sm flex justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}
        {success && (
          <div className="px-4 py-3 bg-green-900/40 text-green-300 rounded-lg text-sm">{success}</div>
        )}

        {/* Create team */}
        <section className="bg-slate-800 rounded-xl p-5">
          <h2 className="text-white font-bold text-lg mb-4">Create New Team</h2>
          <form onSubmit={createTeam} className="flex gap-3 flex-wrap">
            <input
              className="bg-slate-700 text-white rounded px-3 py-2 text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="slug (e.g. platform)"
              value={newTeamSlug}
              onChange={e => setNewTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              required
            />
            <input
              className="bg-slate-700 text-white rounded px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Display Name (e.g. Platform Team)"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              required
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium">
              + Create
            </button>
          </form>
          <p className="text-slate-500 text-xs mt-2">Slug must be lowercase letters, numbers, hyphens, underscores. Cannot be changed later.</p>
        </section>

        {/* Teams */}
        <section>
          <h2 className="text-white font-bold text-lg mb-4">Teams</h2>
          {loading ? (
            <div className="text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="space-y-4">
              {teams.map(team => {
                const invites = invitesByTeam[team.slug] || []
                const activeInvites = invites.filter(i => !i.used && (!i.expires_at || i.expires_at > new Date().toISOString()))
                return (
                  <div key={team.slug} className="bg-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-white font-semibold text-lg">{team.name}</span>
                        <span className="ml-2 text-slate-500 text-sm font-mono">/team/{team.slug}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onNavigate(`/team/${team.slug}`)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                        >Open ↗</button>
                        <button
                          onClick={() => generateInvite(team.slug)}
                          disabled={generatingInvite === team.slug}
                          className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded text-sm"
                        >
                          {generatingInvite === team.slug ? '…' : '+ Invite Manager'}
                        </button>
                        <button
                          onClick={() => deleteTeam(team.slug)}
                          className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 rounded text-sm"
                        >Archive</button>
                      </div>
                    </div>

                    {/* Active invites */}
                    {activeInvites.length > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Pending Invites</p>
                        <div className="space-y-2">
                          {activeInvites.map(inv => (
                            <div key={inv.token} className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2">
                              <span className="text-slate-300 text-xs font-mono flex-1 truncate">
                                {window.location.origin}/invite/{inv.token}
                              </span>
                              <span className="text-slate-500 text-xs">expires {formatDate(inv.expires_at)}</span>
                              <button
                                onClick={() => copyInvite(`${window.location.origin}/invite/${inv.token}`, inv.token)}
                                className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs"
                              >
                                {copiedToken === inv.token ? '✓ Copied' : 'Copy URL'}
                              </button>
                              <button
                                onClick={() => revokeInvite(team.slug, inv.token)}
                                className="px-2 py-1 bg-slate-600 hover:bg-red-800 text-slate-300 rounded text-xs"
                              >Revoke</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Info */}
        <section className="bg-slate-800/50 rounded-xl p-5 text-slate-400 text-sm space-y-2">
          <h3 className="text-white font-semibold">How Invites Work</h3>
          <p>1. Click <strong className="text-slate-200">+ Invite Manager</strong> to generate a link (valid 48 hrs)</p>
          <p>2. Send the link via Teams/Slack/email to the person you want to grant access</p>
          <p>3. They click the link, sign in with their Google/Gmail account, and are automatically authorized</p>
          <p>4. They can now access <strong className="text-slate-200">Manage</strong> features for that team only</p>
        </section>
      </div>
    </div>
  )
}
