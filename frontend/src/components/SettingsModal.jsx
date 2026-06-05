import { useState } from 'react'


export default function SettingsModal({ settings, themes, onClose, teamApi: api }) {
  const [values, setValues] = useState({
    timer_minutes: settings?.timer_minutes ?? 2,
    timer_enabled: settings?.timer_enabled ?? true,
    theme: settings?.theme ?? 'auto',
    holiday_lead_days: settings?.holiday_lead_days ?? 20,
    default_pod: settings?.default_pod ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      await api.patchSettings(values)
      setSaved(true)
      setTimeout(onClose, 600)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  function set(key, val) {
    setValues(v => ({ ...v, [key]: val }))
    setSaved(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">🔧 Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Timer */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Per-Person Timer</h3>
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-blue-500"
                  checked={values.timer_enabled}
                  onChange={e => set('timer_enabled', e.target.checked)}
                />
                Enable countdown timer
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-400">Minutes per person</label>
              <input
                type="number"
                min={1}
                max={10}
                className="w-20 bg-slate-700 text-white text-sm rounded px-3 py-1.5 disabled:opacity-40"
                value={values.timer_minutes}
                disabled={!values.timer_enabled}
                onChange={e => set('timer_minutes', Number(e.target.value))}
              />
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Color Theme</h3>
            <select
              className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2"
              value={values.theme}
              onChange={e => set('theme', e.target.value)}
            >
              <option value="auto">🤖 Auto (holiday-aware)</option>
              {Object.entries(themes).map(([key, t]) => (
                <option key={key} value={key}>{t.name}</option>
              ))}
            </select>

            {values.theme === 'auto' && (
              <div className="mt-2 flex items-center gap-3">
                <label className="text-sm text-slate-400">Holiday lead days</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="w-20 bg-slate-700 text-white text-sm rounded px-3 py-1.5"
                  value={values.holiday_lead_days}
                  onChange={e => set('holiday_lead_days', Number(e.target.value))}
                />
              </div>
            )}
          </section>
        </div>

        {err && (
          <div className="mx-6 mb-3 px-3 py-2 bg-red-900/40 text-red-300 text-sm rounded">{err}</div>
        )}

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={`px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50
              ${saved ? 'bg-green-700' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
