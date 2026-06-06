import { useState, useEffect } from 'react'
import { authApi, teamsApi, teamApi } from './api.js'
import { resolveTheme, assignColors, THEMES } from './themes.js'
import TileGrid from './components/TileGrid.jsx'
import FactsPanel from './components/FactsPanel.jsx'
import PodSelector from './components/PodSelector.jsx'
import PodManager from './components/PodManager.jsx'
import TeamManager from './components/TeamManager.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import ScreenshotModal from './components/ScreenshotModal.jsx'
import MenuBar from './components/MenuBar.jsx'
import AddBackModal from './components/AddBackModal.jsx'
import TimeOffModal from './components/TimeOffModal.jsx'
import TimeOffCalendar from './components/TimeOffCalendar.jsx'
import TeamSelectorPage from './components/TeamSelectorPage.jsx'
import InviteAcceptPage from './components/InviteAcceptPage.jsx'
import SuperAdminPanel from './components/SuperAdminPanel.jsx'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ── Route parser ──────────────────────────────────────────────────────────

function parsePath() {
  const path = window.location.pathname
  // /team/{slug}
  const teamMatch = path.match(/^\/team\/([a-z0-9_-]+)\/?$/)
  if (teamMatch) return { type: 'team', slug: teamMatch[1] }
  // /invite/{token}
  const inviteMatch = path.match(/^\/invite\/([A-Za-z0-9_-]+)\/?$/)
  if (inviteMatch) return { type: 'invite', token: inviteMatch[1] }
  // /admin
  if (path === '/admin' || path === '/admin/') return { type: 'admin' }
  // /
  return { type: 'home' }
}

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [route, setRoute] = useState(parsePath)
  const [authUser, setAuthUser] = useState(null)  // { email, is_super_admin, teams }
  const [authLoading, setAuthLoading] = useState(true)

  // Listen for popstate
  useEffect(() => {
    const handler = () => setRoute(parsePath())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Load auth on mount
  useEffect(() => {
    authApi.me().then(u => {
      setAuthUser(u.authenticated ? u : null)
    }).catch(() => setAuthUser(null)).finally(() => setAuthLoading(false))
  }, [])

  async function handleLogout() {
    await authApi.logout().catch(() => {})
    setAuthUser(null)
    navigate('/')
  }

  function handleLoginRedirect(next) {
    window.location.href = authApi.loginUrl(next || window.location.pathname)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-slate-400 text-lg">Loading…</div>
      </div>
    )
  }

  // ── Route rendering ───────────────────────────────────────────────────

  if (route.type === 'invite') {
    return <InviteAcceptPage token={route.token} authUser={authUser} onLoginRedirect={handleLoginRedirect} />
  }

  if (route.type === 'admin') {
    if (!authUser?.is_super_admin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 flex-col gap-4">
          <div className="text-white text-xl">🔐 Super Admin Only</div>
          {!authUser ? (
            <button
              onClick={() => handleLoginRedirect('/admin')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >Sign in with Google</button>
          ) : (
            <div className="text-slate-400 text-sm">{authUser.email} is not the super admin.</div>
          )}
        </div>
      )
    }
    return <SuperAdminPanel authUser={authUser} onLogout={handleLogout} onNavigate={navigate} />
  }

  if (route.type === 'home') {
    return <TeamSelectorPage authUser={authUser} onLogout={handleLogout} onNavigate={navigate} onLoginRedirect={handleLoginRedirect} />
  }

  if (route.type === 'team') {
    return (
      <TeamApp
        slug={route.slug}
        authUser={authUser}
        onLogout={handleLogout}
        onLoginRedirect={handleLoginRedirect}
        onNavigate={navigate}
      />
    )
  }

  return <div className="text-white p-8">404 Not Found</div>
}

// ── TeamApp — the main standup UI for a specific team ─────────────────────

function TeamApp({ slug, authUser, onLogout, onLoginRedirect, onNavigate }) {
  const api = teamApi(slug)

  const [settings, setSettings] = useState(null)
  const [pods, setPods] = useState({})
  const [people, setPeople] = useState({})
  const [activePodId, setActivePodId] = useState(null)
  const [teamInfo, setTeamInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Session state
  const [sessionOrder, setSessionOrder] = useState([])
  const [removedNames, setRemovedNames] = useState(new Set())
  const [currentSpeakerIdx, setCurrentSpeakerIdx] = useState(-1)
  const [sessionDate, setSessionDate] = useState(todayISO())

  // UI modals
  const [showPodSelector, setShowPodSelector] = useState(false)
  const [showFactsPanel, setShowFactsPanel] = useState(true)
  const [showPodManager, setShowPodManager] = useState(false)
  const [showTeamManager, setShowTeamManager] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showScreenshot, setShowScreenshot] = useState(false)
  const [showAddBack, setShowAddBack] = useState(false)
  const [showTimeOff, setShowTimeOff] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [facts, setFacts] = useState(null)

  const canManage = authUser && (authUser.is_super_admin || authUser.teams?.includes(slug))

  function requireAuth(action) {
    if (canManage) {
      action()
    } else {
      onLoginRedirect(`/team/${slug}`)
    }
  }

  // ── Load on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [s, p, pg, teams] = await Promise.all([
          api.getSettings(),
          api.getPods(),
          api.getPeople(),
          teamsApi.list(),
        ])
        setSettings(s); setPods(p); setPeople(pg)
        setTeamInfo(teams.find(t => t.slug === slug) || { slug, name: slug })

        const podIds = Object.keys(p)
        let autoRemoved = new Set()
        try {
          const { out } = await api.timeoff.getToday()
          if (out?.length) autoRemoved = new Set(out)
        } catch (_) {}

        if (s.default_pod && p[s.default_pod]) {
          selectPod(s.default_pod, pg, p, s, autoRemoved)
        } else if (podIds.length === 1) {
          selectPod(podIds[0], pg, p, s, autoRemoved)
        } else if (podIds.length > 1) {
          setRemovedNames(autoRemoved)
          setShowPodSelector(true)
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    init()
    api.getFacts(todayISO()).then(setFacts).catch(() => {})
  }, [slug])

  // ── Session date change ───────────────────────────────────────────────
  useEffect(() => {
    if (!activePodId) return
    async function apply() {
      try {
        const schedule = await api.timeoff.get()
        const out = schedule[sessionDate] || []
        const newRemoved = new Set(out)
        setRemovedNames(newRemoved)
        doShuffle(activePodId, people, pods, settings, newRemoved)
      } catch (_) {}
    }
    apply()
    api.getFacts(sessionDate).then(setFacts).catch(() => {})
  }, [sessionDate])

  // ── Keyboard ──────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const anyModal = showPodManager || showTeamManager || showSettings ||
        showPodSelector || showScreenshot || showAddBack || showTimeOff || showCalendar
      if (anyModal) return
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        advanceSpeaker()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sessionOrder, currentSpeakerIdx, showPodManager, showTeamManager,
      showSettings, showPodSelector, showScreenshot, showAddBack, showTimeOff, showCalendar])

  // ── Core shuffle ──────────────────────────────────────────────────────
  function doShuffle(podId = activePodId, pg = people, p = pods, s = settings, excluded = removedNames) {
    const members = Object.entries(pg)
      .filter(([, podIds]) => podIds.includes(podId))
      .map(([name]) => name)
      .filter(name => !excluded.has(name))
    const shuffled = shuffle(members)
    const theme = resolveTheme(s?.theme ?? 'auto', s?.holiday_lead_days ?? 20)
    const colored = assignColors(shuffled, theme.colors)
    setSessionOrder(colored.map(({ name, color }) => ({ name, color })))
    setCurrentSpeakerIdx(-1)
  }

  function selectPod(podId, pg = people, p = pods, s = settings, excluded = new Set()) {
    setActivePodId(podId)
    setRemovedNames(new Set())
    doShuffle(podId, pg, p, s, excluded)
    setShowPodSelector(false)
  }

  function removeMember(name) {
    const newRemoved = new Set(removedNames)
    newRemoved.add(name)
    setRemovedNames(newRemoved)
    setSessionOrder(prev => {
      const idx = prev.findIndex(m => m.name === name)
      setCurrentSpeakerIdx(ci => ci === idx ? -1 : ci > idx ? ci - 1 : ci)
      return prev.filter(m => m.name !== name)
    })
  }

  function sendToBottom(name) {
    setSessionOrder(prev => {
      const idx = prev.findIndex(m => m.name === name)
      if (idx === -1 || idx === prev.length - 1) return prev
      const next = [...prev]
      const [moved] = next.splice(idx, 1)
      next.push(moved)
      // If this person was active or on-deck, adjust speaker index
      setCurrentSpeakerIdx(ci => {
        if (ci === idx) return ci  // keep highlighting them even at new position
        if (ci > idx) return ci - 1  // shift down since item moved out from above
        return ci
      })
      return next
    })
  }

  function restoreMembers(names) {
    const newRemoved = new Set(removedNames)
    names.forEach(n => newRemoved.delete(n))
    setRemovedNames(newRemoved)
    doShuffle(activePodId, people, pods, settings, newRemoved)
  }

  function advanceSpeaker() {
    setCurrentSpeakerIdx(prev => {
      if (sessionOrder.length === 0) return prev
      if (prev === -1) return 0
      if (prev >= sessionOrder.length - 1) return prev
      return prev + 1
    })
  }

  function handleReshuffle() {
    logCurrentSession()
    doShuffle(activePodId, people, pods, settings, removedNames)
  }

  async function logCurrentSession() {
    if (!activePodId || sessionOrder.length === 0) return
    try {
      await api.logSession({
        pod_id: activePodId,
        pod_name: pods[activePodId]?.name ?? activePodId,
        members: sessionOrder.map((m, i) => ({ name: m.name, position: i + 1 })),
      })
    } catch (_) {}
  }

  async function reloadData() {
    const [s, p, pg] = await Promise.all([api.getSettings(), api.getPods(), api.getPeople()])
    setSettings(s); setPods(p); setPeople(pg)
    return { s, p, pg }
  }

  async function onPodManagerClose() {
    setShowPodManager(false)
    const { s, p, pg } = await reloadData()
    if (activePodId && !p[activePodId]) {
      const next = Object.keys(p)[0]
      if (next) selectPod(next, pg, p, s, new Set())
    } else if (activePodId) doShuffle(activePodId, pg, p, s, removedNames)
  }

  async function onTeamManagerClose() {
    setShowTeamManager(false)
    const { s, p, pg } = await reloadData()
    if (activePodId) doShuffle(activePodId, pg, p, s, removedNames)
  }

  async function onSettingsClose() {
    setShowSettings(false)
    const { s, p, pg } = await reloadData()
    doShuffle(activePodId, pg, p, s, removedNames)
    api.getFacts(sessionDate).then(setFacts).catch(() => {})
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const sessionDateObj = new Date(sessionDate + 'T12:00:00')
  const themeInfo = settings ? resolveTheme(settings.theme, settings.holiday_lead_days, sessionDateObj) : null
  const tilesWithPosition = sessionOrder.map((m, i) => ({
    ...m, position: i + 1,
    isActive: i === currentSpeakerIdx,
    isOnDeck: i === currentSpeakerIdx + 1,
  }))

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="text-slate-400 text-lg">Loading…</div></div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="text-red-400 text-lg">Error: {error}</div></div>

  const activePodName = activePodId ? (pods[activePodId]?.name ?? activePodId) : 'No Pod'
  const roster = Object.keys(people)
  const isToday = sessionDate === todayISO()
  const teamName = teamInfo?.name ?? slug

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {themeInfo?.holiday && (
        <div className="text-center py-1 text-sm font-semibold bg-amber-500 text-amber-950">
          🎉 {themeInfo.holiday} — Auto Theme Active
        </div>
      )}

      <MenuBar
        activePodName={activePodName} pods={pods} activePodId={activePodId}
        teamName={teamName}
        onSwitchPod={(id) => selectPod(id)}
        onReshuffle={handleReshuffle}
        onScreenshot={() => setShowScreenshot(true)}
        onToggleFacts={() => setShowFactsPanel(v => !v)}
        showFacts={showFactsPanel}
        onAdvance={advanceSpeaker}
        sessionDate={sessionDate}
        onSessionDateChange={setSessionDate}
        isToday={isToday}
        authUser={authUser}
        canManage={canManage}
        onLogin={() => onLoginRedirect(`/team/${slug}`)}
        onLogout={onLogout}
        removedCount={removedNames.size}
        onAddBack={() => setShowAddBack(true)}
        onManageTeam={() => requireAuth(() => setShowTeamManager(true))}
        onManagePods={() => requireAuth(() => setShowPodManager(true))}
        onSettings={() => requireAuth(() => setShowSettings(true))}
        onTimeOff={() => requireAuth(() => setShowTimeOff(true))}
        onCalendar={() => requireAuth(() => setShowCalendar(true))}
        onHome={() => onNavigate('/')}
        slug={slug}
        teamApi={api}
      />

      {showFactsPanel && facts && (
        <FactsPanel facts={facts} settings={settings} onClose={() => setShowFactsPanel(false)} />
      )}

      <main className="flex-1 p-4">
        {sessionOrder.length === 0 && removedNames.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <p className="text-lg">No team members in this pod.</p>
            {canManage && (
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                onClick={() => setShowTeamManager(true)}>
                Manage Team Members
              </button>
            )}
          </div>
        ) : sessionOrder.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <p className="text-lg">Everyone is out on this day.</p>
            <button className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm"
              onClick={() => setShowAddBack(true)}>
              ↩️ Add People Back
            </button>
          </div>
        ) : (
          <TileGrid
            tiles={tilesWithPosition}
            timerMinutes={settings?.timer_minutes ?? 2}
            timerEnabled={settings?.timer_enabled ?? true}
            onRemove={removeMember}
            onSendToBottom={sendToBottom}
          />
        )}
      </main>

      <footer className="text-center py-2 text-xs text-slate-600">
        Space / → to advance · ✕ on tile to remove from today · ↓ to move to end
      </footer>

      {showPodSelector && <PodSelector pods={pods} onSelect={(id) => selectPod(id)} onClose={() => setShowPodSelector(false)} />}
      {showAddBack && <AddBackModal removedNames={[...removedNames]} onRestore={restoreMembers} onClose={() => setShowAddBack(false)} />}
      {showScreenshot && <ScreenshotModal tiles={tilesWithPosition} podName={activePodName} sessionDate={sessionDate} facts={facts} holidayName={themeInfo?.holiday} themeColors={themeInfo?.colors} onClose={() => setShowScreenshot(false)} />}

      {canManage && showPodManager && <PodManager pods={pods} people={people} onClose={onPodManagerClose} teamApi={api} />}
      {canManage && showTeamManager && <TeamManager people={people} pods={pods} onClose={onTeamManagerClose} teamApi={api} />}
      {canManage && showSettings && <SettingsModal settings={settings} themes={THEMES} onClose={onSettingsClose} teamApi={api} />}
      {canManage && showTimeOff && <TimeOffModal onClose={() => setShowTimeOff(false)} onSaved={() => {}} teamApi={api} />}
      {canManage && showCalendar && <TimeOffCalendar roster={roster} onClose={() => setShowCalendar(false)} teamApi={api} />}
    </div>
  )
}
