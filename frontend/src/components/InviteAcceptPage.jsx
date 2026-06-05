import { useState, useEffect } from 'react'
import { teamsApi, authApi } from '../api.js'

export default function InviteAcceptPage({ token, authUser, onLoginRedirect }) {
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    teamsApi.getInviteInfo(token)
      .then(setInvite)
      .catch(() => setError('This invite link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-slate-400">Checking invite…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-white text-xl font-bold mb-2">Invite Invalid</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <a href="/" className="mt-6 block text-blue-400 hover:text-blue-300 text-sm">← Back to home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-white text-xl font-bold mb-2">Team Invite</h2>
        <p className="text-slate-400 text-sm mb-1">You've been invited to manage:</p>
        <p className="text-white font-semibold text-lg mb-6">{invite.team_name}</p>

        {authUser?.authenticated ? (
          <div>
            <p className="text-slate-400 text-sm mb-4">
              Signed in as <span className="text-white">{authUser.email}</span>
            </p>
            <p className="text-slate-500 text-xs">
              This invite will be applied when you click the link while signed in. If you just signed in via Google, your access has already been granted.
            </p>
            <a
              href={`/team/${invite.team_slug}`}
              className="mt-4 block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              Go to {invite.team_name} →
            </a>
          </div>
        ) : (
          <div>
            <p className="text-slate-400 text-sm mb-6">
              Sign in with your Google / Gmail account to accept.
            </p>
            <button
              onClick={() => onLoginRedirect(null, token)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
            >
              <GoogleIcon /> Sign in with Google
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
