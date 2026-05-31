import { useState, useRef, useEffect } from 'react'

export default function MenuBar({
  activePodName, pods, activePodId, onSwitchPod,
  onReshuffle, onScreenshot, onToggleFacts, showFacts, onAdvance,
  sessionDate, onSessionDateChange, isToday,
  authedUser, onLogin, onLogout,
  removedCount,
  onAddBack, onManageTeam, onManagePods, onSettings,
  onTimeOff, onCalendar, onUserMgmt,
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
      <span className="font-bold text-lg text-white mr-1 whitespace-nowrap">🗓️ Stand-Up</span>

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
            <button onClick={() => menuAction(onUserMgmt)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
              👤 Users
            </button>

            <hr className="border-slate-600 my-1" />
            {authedUser ? (
              <button onClick={() => menuAction(onLogout)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700">
                🔓 Sign Out ({authedUser})
              </button>
            ) : (
              <button onClick={() => menuAction(onLogin)} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700">
                🔐 Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
