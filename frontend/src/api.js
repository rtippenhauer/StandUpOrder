const BASE = '/api'

function getToken() {
  return sessionStorage.getItem('auth_token')
}

export function setToken(token) {
  if (token) sessionStorage.setItem('auth_token', token)
  else sessionStorage.removeItem('auth_token')
}

export function clearToken() {
  sessionStorage.removeItem('auth_token')
}

async function req(method, path, body, skipAuth = false) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (!skipAuth) {
    const token = getToken()
    if (token) opts.headers['Authorization'] = `Bearer ${token}`
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (res.status === 401) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.detail || 'Authentication required')
    e.status = 401
    throw e
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

export const api = {
  getSettings: () => req('GET', '/settings'),
  patchSettings: (updates) => req('PATCH', '/settings', updates),

  getPods: () => req('GET', '/pods'),
  createPod: (pod) => req('POST', '/pods', pod),
  updatePod: (id, pod) => req('PUT', `/pods/${encodeURIComponent(id)}`, pod),
  deletePod: (id) => req('DELETE', `/pods/${encodeURIComponent(id)}`),

  getPeople: () => req('GET', '/people'),
  createPerson: (person) => req('POST', '/people', person),
  updatePerson: (name, update) => req('PUT', `/people/${encodeURIComponent(name)}`, update),
  deletePerson: (name) => req('DELETE', `/people/${encodeURIComponent(name)}`),

  getFacts: (date) => req('GET', `/facts${date ? `?date=${date}` : ''}`),
  logSession: (entry) => req('POST', '/session/log', entry),

  // Auth
  authStatus: () => req('GET', '/auth/status', undefined, true),
  login: (username, password) => req('POST', '/auth/login', { username, password }, true),
  logout: () => req('POST', '/auth/logout'),

  // Users
  getUsers: () => req('GET', '/users'),
  createUser: (username, password) => req('POST', '/users', { username, password }),
  updateUserPassword: (username, password) => req('PUT', `/users/${encodeURIComponent(username)}`, { username, password }),
  deleteUser: (username) => req('DELETE', `/users/${encodeURIComponent(username)}`),

  // Holidays
  getHolidays: (year) => req('GET', `/holidays/${year}`),
}

// Time Off
export const timeOffApi = {
  get: () => req('GET', '/timeoff'),
  getToday: () => req('GET', '/timeoff/today'),
  getOn: (date) => req('GET', `/timeoff/on/${date}`),
  save: (schedule) => req('PUT', '/timeoff', schedule),
  getEntries: () => req('GET', '/timeoff/entries'),
  addEntry: (entry) => req('POST', '/timeoff/entries', entry),
  deleteEntry: (id) => req('DELETE', `/timeoff/entries/${id}`),
  calculate: (start_date, num_days) =>
    req('GET', `/timeoff/calculate?start_date=${start_date}&num_days=${num_days}`),
  parsePdf: (file) => {
    const form = new FormData()
    form.append('file', file)
    const token = getToken()
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch('/api/timeoff/parse-pdf', { method: 'POST', headers, body: form })
      .then(r => {
        if (r.status === 401) throw Object.assign(new Error('Authentication required'), { status: 401 })
        if (!r.ok) return r.json().then(e => Promise.reject(new Error(e.detail)))
        return r.json()
      })
  },
  saveNameMap: (mapping) => req('POST', '/timeoff/save-name-map', mapping),
  importAdp: (entries) => req('POST', '/timeoff/import-adp', { entries }),
}
