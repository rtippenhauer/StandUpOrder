/**
 * API client — all routes are now scoped to /api/team/{slug}/
 * Auth is via HTTP-only session cookie (no token storage needed).
 */

const BASE = '/api'

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // send session cookie
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (res.status === 401 || res.status === 403) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.detail || 'Authentication required')
    e.status = res.status
    throw e
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

async function uploadFile(path, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(BASE + path, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('Authentication required'), { status: res.status })
  }
  if (!res.ok) return res.json().then(e => Promise.reject(new Error(e.detail)))
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => req('GET', '/auth/me'),
  loginUrl: (next, invite) => {
    const params = []
    if (next) params.push(`next=${encodeURIComponent(next)}`)
    if (invite) params.push(`invite=${encodeURIComponent(invite)}`)
    return `/api/auth/login${params.length ? '?' + params.join('&') : ''}`
  },
  logout: () => req('POST', '/auth/logout'),
}

// ── Teams ─────────────────────────────────────────────────────────────────

export const teamsApi = {
  list: () => req('GET', '/teams'),
  create: (slug, name) => req('POST', '/teams', { slug, name }),
  update: (slug, name) => req('PUT', `/teams/${slug}`, { name }),
  delete: (slug) => req('DELETE', `/teams/${slug}`),

  // Invites
  createInvite: (slug) => req('POST', `/teams/${slug}/invites`),
  listInvites: (slug) => req('GET', `/teams/${slug}/invites`),
  revokeInvite: (slug, token) => req('DELETE', `/teams/${slug}/invites/${token}`),
  getInviteInfo: (token) => req('GET', `/invites/${token}`),

  // Managers
  getManagers: (slug) => req('GET', `/teams/${slug}/managers`),
  removeManager: (slug, email) => req('DELETE', `/teams/${slug}/managers/${encodeURIComponent(email)}`),
}

// ── Team-scoped API factory ───────────────────────────────────────────────

export function teamApi(slug) {
  const T = (path) => `/team/${slug}${path}`
  return {
    // Settings
    getSettings: () => req('GET', T('/settings')),
    patchSettings: (updates) => req('PATCH', T('/settings'), updates),

    // Pods
    getPods: () => req('GET', T('/pods')),
    createPod: (pod) => req('POST', T('/pods'), pod),
    updatePod: (id, pod) => req('PUT', T(`/pods/${encodeURIComponent(id)}`), pod),
    deletePod: (id) => req('DELETE', T(`/pods/${encodeURIComponent(id)}`)),

    // People
    getPeople: () => req('GET', T('/people')),
    createPerson: (person) => req('POST', T('/people'), person),
    updatePerson: (name, update) => req('PUT', T(`/people/${encodeURIComponent(name)}`), update),
    deletePerson: (name) => req('DELETE', T(`/people/${encodeURIComponent(name)}`)),

    // Facts
    getFacts: (date) => req('GET', T(`/facts${date ? `?date=${date}` : ''}`)),

    // Session log
    logSession: (entry) => req('POST', T('/session/log'), entry),

    // Holidays
    getHolidays: (year) => req('GET', T(`/holidays/${year}`)),

    // Time Off
    timeoff: {
      get: () => req('GET', T('/timeoff')),
      getToday: () => req('GET', T('/timeoff/today')),
      getOn: (date) => req('GET', T(`/timeoff/on/${date}`)),
      save: (schedule) => req('PUT', T('/timeoff'), schedule),
      getEntries: () => req('GET', T('/timeoff/entries')),
      addEntry: (entry) => req('POST', T('/timeoff/entries'), entry),
      deleteEntry: (id) => req('DELETE', T(`/timeoff/entries/${id}`)),
      calculate: (start_date, num_days) =>
        req('GET', T(`/timeoff/calculate?start_date=${start_date}&num_days=${num_days}`)),
      parsePdf: (file) => uploadFile(T('/timeoff/parse-pdf'), file),
      saveNameMap: (mapping) => req('POST', T('/timeoff/save-name-map'), mapping),
      importAdp: (entries) => req('POST', T('/timeoff/import-adp'), { entries }),
    },
  }
}

// Legacy compat exports — used by existing components before team context resolves
// These will be overridden in App.jsx once slug is known
export const api = {
  getFacts: (date) => Promise.resolve({ national_days: [], on_this_day: [], fun_trivia: [] }),
  getHolidays: (year) => req('GET', `/holidays/${year}`),
}
export const timeOffApi = {
  calculate: (start_date, num_days) =>
    req('GET', `/timeoff/calculate?start_date=${start_date}&num_days=${num_days}`),
}
