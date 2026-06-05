import { useState, useRef, useEffect } from 'react'

export default function MenuBar({
  activePodName, pods, activePodId, onSwitchPod,
  teamName,
  onReshuffle, onScreenshot, onToggleFacts, showFacts, onAdvance,
  sessionDate, onSessionDateChange, isToday,
  authUser, canManage, onLogin, onLogout,
  removedCount,
  onAddBack, onManageTeam, onManagePods, onSettings,
  onTimeOff, onCalendar, onHome,
  slug,
}) {
  const podList = Object.entries(pods)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', handle)
    return () => window.removeEventListener('mousedown', handle)
  }, [menuOpen])

  function menuAction(fn) { setMenuOpen(false); fn() }

  return (
    <header className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 flex-wrap">
      <button onClick={onHome} className="font-bold text-lg text-white mr-1 whitespace-nowrap hover:text-blue-300 transition-colors">
        🗓️ Stand-Up
      </button>
      {teamName && <span className="text-slate-500 text-sm">/ {teamName}</span>}

      {podList.length > 1 && (
        <select
          className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600"
          value={activePodId ?? ''}
          onChange={e => onSwitchPod(e.target.value)}
        >
          {podList.map(([id, pod]) => <option key={id} value={id}>{pod.name}</option>)}
        </select>
      )}
      {podList.length <= 1 && <span className="text-slate-300 text-sm font-medium">{activePodName}</span>}

      {/* Session date picker */}
      <div className="flex items-center gap-1.5 ml-2 bg-slate-700 rounded-lg px-2 py-1 border border-slate-600">
        <input
          type="date"
          className="bg-transparent text-white text-sm w-32 focus:outline-none"
          value={sessionDate}
          onChange={e => onSessionDateChange(e.target.value)}
        />
        {!isToday && (
          <button
            onClick={() => onSessionDateChange(new Date().toISOString().split('T')[0])}
            className="text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap"
          >
            Today
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <button onClick={onAdvance} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium">▶ Next</button>
      <button onClick={onReshuffle} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-sm font-medium">🔀 Shuffle</button>
      <button onClick={onScreenshot} className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded text-sm font-medium">📷 Screenshot</button>
      <button onClick={onToggleFacts} className={`px-3 py-1.5 rounded text-sm font-medium ${showFacts ? 'bg-amber-700 hover:bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'} text-white`}>📅 Facts</button>

      {/* Manage menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className={`px-3 py-1.5 rounded text-sm font-medium text-white ${menuOpen ? 'bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
          ⚙️ Manage {menuOpen ? '▲' : '▼'}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 min-w-[210px] py-1">

            {removedCount > 0 && (
              <>
                <button onClick={() => menuAction(onAddBack)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-green-300 hover:bg-slate-700 font-medium">
                  ↩️ Add Back ({removedCount})
                </button>
                <hr className="border-slate-600 my-1" />
              </>
            )}

            {canManage ? (
              <>
                <div className="px-3 py-1 text-xs text-slate-500 uppercase tracking-wide">Team</div>
                <button onClick={() => menuAction(onManageTeam)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
                  👥 Team Members
                </button>
                <button onClick={() => menuAction(onManagePods)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
                  🏷️ Pods
                </button>

                <hr className="border-slate-600 my-1" />
                <div className="px-3 py-1 text-xs text-slate-500 uppercase tracking-wide">Time Off</div>
                <button onClick={() => menuAction(onCalendar)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
                  📆 Time Off Calendar
                </button>
                <button onClick={() => menuAction(onTimeOff)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
                  📋 Import ADP PDF
                </button>

                <hr className="border-slate-600 my-1" />
                <div className="px-3 py-1 text-xs text-slate-500 uppercase tracking-wide">App</div>
                <button onClick={() => menuAction(onSettings)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
                  🔧 Settings
                </button>

                <hr className="border-slate-600 my-1" />
                <button onClick={() => menuAction(onLogout)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700">
                  🔓 Sign Out ({authUser?.email?.split('@')[0]})
                </button>
              </>
            ) : (
              <>
                <div className="px-4 py-2 text-xs text-slate-500">Viewing as guest</div>
                <hr className="border-slate-600 my-1" />
                <button onClick={() => menuAction(onLogin)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-slate-700">
                  <GoogleIcon /> Sign in to Manage
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline-block">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
