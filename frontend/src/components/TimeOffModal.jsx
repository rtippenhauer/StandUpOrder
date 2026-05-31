import { useState } from 'react'
import { timeOffApi } from '../api.js'

const STATUS_COLORS = {
  matched: 'text-green-400',
  unmatched: 'text-amber-400',
}

export default function TimeOffModal({ onClose, onSaved }) {
  const [step, setStep] = useState('upload') // upload | review | saved
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [entries, setEntries] = useState([])
  const [roster, setRoster] = useState([])
  const [nameOverrides, setNameOverrides] = useState({}) // adp_name → roster_name

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await timeOffApi.parsePdf(file)
      setEntries(result.entries)
      setRoster(result.roster)
      setStep('review')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function resolvedName(entry) {
    return nameOverrides[entry.adp_name] ?? entry.roster_name
  }

  function setOverride(adpName, rosterName) {
    setNameOverrides(prev => ({ ...prev, [adpName]: rosterName || null }))
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      // Save any new name mappings
      const newMappings = {}
      for (const entry of entries) {
        const override = nameOverrides[entry.adp_name]
        if (override && override !== entry.roster_name) {
          newMappings[entry.adp_name] = override
        }
      }
      if (Object.keys(newMappings).length > 0) {
        await timeOffApi.saveNameMap(newMappings)
      }

      // Resolve final names and import as entries (creates timeoff_entries.json records)
      const resolved = entries
        .map(e => ({ ...e, roster_name: resolvedName(e) }))
        .filter(e => e.roster_name && e.roster_name !== '__skip__')

      await timeOffApi.importAdp(resolved)
      setStep('saved')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Group entries by date for display
  const byDate = {}
  for (const entry of entries) {
    if (!byDate[entry.date]) byDate[entry.date] = []
    byDate[entry.date].push(entry)
  }
  const sortedDates = Object.keys(byDate).sort()

  const unmatchedCount = entries.filter(e => !resolvedName(e)).length

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">📅 Import ADP Time Off</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* Upload step */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <div className="text-slate-400 text-sm text-center max-w-sm">
              In ADP, go to <strong className="text-slate-200">My Team → Reports & Analytics → My Team Time Off Request</strong>, run the report, download the PDF, and upload it here.
            </div>
            <label className="cursor-pointer px-6 py-4 bg-slate-700 hover:bg-slate-600 border-2 border-dashed border-slate-500 hover:border-blue-500 rounded-xl text-center transition-colors">
              <div className="text-2xl mb-2">📄</div>
              <div className="text-white font-medium">Click to upload PDF</div>
              <div className="text-slate-400 text-xs mt-1">ADP My Team Time Off Request report</div>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFile} />
            </label>
            {loading && <div className="text-slate-400 text-sm">Parsing PDF…</div>}
            {error && <div className="text-red-400 text-sm">{error}</div>}
          </div>
        )}

        {/* Review step */}
        {step === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {entries.length === 0 ? (
                <div className="text-slate-400 text-center py-8">
                  No approved PTO found in this report. Flex Hybrid and Canceled entries are excluded.
                </div>
              ) : (
                <>
                  {unmatchedCount > 0 && (
                    <div className="mb-3 px-3 py-2 bg-amber-900/40 text-amber-300 text-sm rounded-lg">
                      ⚠️ {unmatchedCount} {unmatchedCount === 1 ? 'entry needs' : 'entries need'} manual name matching below.
                    </div>
                  )}

                  <div className="space-y-4">
                    {sortedDates.map(dateStr => {
                      const dayEntries = byDate[dateStr]
                      const d = new Date(dateStr + 'T12:00:00')
                      const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                      return (
                        <div key={dateStr} className="bg-slate-700/50 rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-slate-700 text-sm font-semibold text-slate-200">
                            {label}
                          </div>
                          <div className="divide-y divide-slate-700/50">
                            {dayEntries.map((entry, i) => {
                              const matched = resolvedName(entry)
                              return (
                                <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                                  <div className="flex-1">
                                    <span className="text-white text-sm">{entry.adp_name}</span>
                                    <span className="text-slate-400 text-xs ml-2">{entry.hours}h PTO</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 text-xs">→</span>
                                    {matched ? (
                                      <span className="text-green-400 text-sm font-medium">{matched}</span>
                                    ) : (
                                      <select
                                        className="bg-slate-600 text-amber-300 text-sm rounded px-2 py-1 border border-amber-600/50"
                                        value={nameOverrides[entry.adp_name] || ''}
                                        onChange={e => setOverride(entry.adp_name, e.target.value)}
                                      >
                                        <option value="">— select person —</option>
                                        {roster.map(n => (
                                          <option key={n} value={n}>{n}</option>
                                        ))}
                                        <option value="__skip__">Skip this entry</option>
                                      </select>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="mx-4 mb-2 px-3 py-2 bg-red-900/40 text-red-300 text-sm rounded">{error}</div>
            )}

            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
              <button
                onClick={() => setStep('upload')}
                className="text-sm text-slate-400 hover:text-white"
              >
                ← Upload different file
              </button>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || entries.length === 0}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium"
                >
                  {loading ? 'Saving…' : `Save ${entries.filter(e => resolvedName(e) && resolvedName(e) !== '__skip__').length} entries`}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Saved step */}
        {step === 'saved' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <div className="text-5xl">✅</div>
            <div className="text-white font-semibold text-lg">Time off schedule saved!</div>
            <div className="text-slate-400 text-sm text-center">
              People will be automatically removed from stand-up on their days off.
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
