import { useState, useEffect } from 'react'

import ManualTimeOffModal from './ManualTimeOffModal.jsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

// Deterministic color per person name
const PERSON_COLORS = [
  '#2563EB', '#16A34A', '#7C3AED', '#B45309', '#DC2626',
  '#0891B2', '#D97706', '#65A30D', '#E11D48', '#6D28D9',
]
function personColor(name, roster) {
  const idx = roster.indexOf(name)
  return PERSON_COLORS[idx >= 0 ? idx % PERSON_COLORS.length : 0]
}

export default function TimeOffCalendar({ roster, onClose, teamApi }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-based
  const [schedule, setSchedule] = useState({})
  const [entries, setEntries] = useState([])
  const [holidays, setHolidays] = useState(new Set())
  const [selectedDay, setSelectedDay] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => { loadAll() }, [year])

  async function loadAll() {
    const [sched, ents, hols] = await Promise.all([
      teamApi.timeoff.get().catch(() => ({})),
      teamApi.timeoff.getEntries().catch(() => []),
      teamApi.getHolidays(year).catch(() => ({ holidays: [] })),
    ])
    setSchedule(sched)
    setEntries(ents)
    setHolidays(new Set(hols.holidays || []))
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function dateKey(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function isToday(d) {
    return year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
  }

  async function deleteEntry(id) {
    await teamApi.timeoff.deleteEntry(id)
    await loadAll()
    // Refresh selected day
    if (selectedDay) {
      const key = dateKey(selectedDay)
      setSelectedDay(prev => prev) // trigger re-render
    }
  }

  const selectedKey = selectedDay ? dateKey(selectedDay) : null
  const selectedEntries = selectedKey
    ? entries.filter(e => e.workdays?.includes(selectedKey))
    : []

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">📆 Time Off Calendar</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Calendar */}
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="text-slate-400 hover:text-white px-2 py-1 text-lg">←</button>
              <span className="text-white font-semibold">{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} className="text-slate-400 hover:text-white px-2 py-1 text-lg">→</button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs text-slate-500 font-medium py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />
                const key = dateKey(d)
                const outPeople = schedule[key] || []
                const isHoliday = holidays.has(key)
                const isSel = selectedDay === d
                const isTod = isToday(d)
                const isWeekend = new Date(year, month, d).getDay() % 6 === 0

                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(isSel ? null : d)}
                    className={`
                      relative rounded-lg p-1.5 text-left transition-colors min-h-[52px]
                      ${isSel ? 'bg-blue-800 ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'}
                      ${isHoliday ? 'border border-amber-600/50' : ''}
                      ${isWeekend ? 'opacity-50' : ''}
                    `}
                  >
                    <span className={`text-xs font-bold ${isTod ? 'text-blue-400' : isHoliday ? 'text-amber-400' : 'text-slate-300'}`}>
                      {d}
                    </span>
                    {isHoliday && <div className="text-[9px] text-amber-400/70 leading-tight">holiday</div>}
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {outPeople.slice(0, 4).map(name => (
                        <div
                          key={name}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: personColor(name, roster) }}
                          title={name}
                        />
                      ))}
                      {outPeople.length > 4 && (
                        <span className="text-[9px] text-slate-400">+{outPeople.length - 4}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-2">
              {roster.map(name => (
                <div key={name} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: personColor(name, roster) }} />
                  <span className="text-xs text-slate-400">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day detail panel */}
          <div className="w-56 border-l border-slate-700 flex flex-col">
            {selectedDay ? (
              <>
                <div className="p-3 border-b border-slate-700">
                  <p className="text-sm font-semibold text-white">
                    {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  {holidays.has(dateKey(selectedDay)) && (
                    <p className="text-xs text-amber-400 mt-0.5">🎉 US Holiday</p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {selectedEntries.length === 0 ? (
                    <p className="text-xs text-slate-500">No time off scheduled.</p>
                  ) : (
                    selectedEntries.map(e => (
                      <div key={e.id} className="bg-slate-700 rounded p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: personColor(e.name, roster) }} />
                            <span className="text-sm font-medium text-white">{e.name}</span>
                          </div>
                          <button
                            onClick={() => deleteEntry(e.id)}
                            className="text-slate-500 hover:text-red-400 text-xs"
                          >🗑️</button>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 ml-3.5">
                          {e.source === 'adp' ? '📋 ADP' : '✏️ Manual'}
                          {e.note ? ` · ${e.note}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-slate-700">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg"
                  >
                    + Add Time Off
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <p className="text-slate-500 text-sm">Click a day to see details</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg"
                >
                  + Add Time Off
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {showAddModal && (
        <ManualTimeOffModal
          roster={roster}
          defaultDate={selectedDay ? dateKey(selectedDay) : null}
          onClose={() => setShowAddModal(false)}
          onSaved={loadAll}
          teamApi={teamApi}
        />
      )}
    </div>
  )
}
