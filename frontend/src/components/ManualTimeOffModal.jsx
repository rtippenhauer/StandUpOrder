import { useState, useEffect } from 'react'


export default function ManualTimeOffModal({ roster, defaultDate, onClose, onSaved, teamApi }) {
  const [name, setName] = useState(roster[0] ?? '')
  const [startDate, setStartDate] = useState(defaultDate || new Date().toISOString().split('T')[0])
  const [numDays, setNumDays] = useState(1)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!startDate || !numDays || numDays < 1) return
    teamApi.timeoff.calculate(startDate, numDays)
      .then(setPreview)
      .catch(() => setPreview(null))
  }, [startDate, numDays])

  async function handleSave() {
    if (!name || !startDate || !numDays) return
    setSaving(true); setError(null)
    try {
      await teamApi.timeoff.addEntry({ name, start_date: startDate, num_days: numDays, note })
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const fmtDate = (iso) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">➕ Add Manual Time Off</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Person */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Person</label>
            <select
              className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2"
              value={name}
              onChange={e => setName(e.target.value)}
            >
              {roster.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Start Date</label>
            <input
              type="date"
              className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* Work days */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Number of Work Days</label>
            <input
              type="number"
              min={1}
              max={60}
              className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2"
              value={numDays}
              onChange={e => setNumDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <p className="text-xs text-slate-500 mt-1">Mon–Fri only, skips US federal holidays</p>
          </div>

          {/* Preview */}
          {preview && preview.workdays?.length > 0 && (
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">
                <span className="font-medium text-slate-200">{name}</span> will be out on {preview.workdays.length} day{preview.workdays.length !== 1 ? 's' : ''}:
              </p>
              <div className="flex flex-wrap gap-1">
                {preview.workdays.map(d => (
                  <span key={d} className="text-xs bg-slate-600 text-slate-200 px-2 py-0.5 rounded">
                    {fmtDate(d)}
                  </span>
                ))}
              </div>
              {preview.end_date && (
                <p className="text-xs text-slate-400 mt-2">
                  Returns: <span className="text-slate-200">{fmtDate(preview.end_date)}</span>
                  {' '}(next workday)
                </p>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Note (optional)</label>
            <input
              className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2 placeholder-slate-500"
              placeholder="e.g. vacation, appointment"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name || !startDate}
            className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
