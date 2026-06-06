import { useState } from 'react'

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-700 last:border-0">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700/50"
        onClick={() => setOpen(v => !v)}
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

export default function FactsPanel({ facts, settings, onClose }) {
  const nationalDaysCount = settings?.facts_national_days_count ?? 8
  const onThisDayCount = settings?.facts_on_this_day_count ?? 5
  const birthdaysCount = settings?.facts_birthdays_count ?? 5
  const triviaCount = settings?.facts_trivia_count ?? 3
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const sections = [
    facts?.national_days?.length > 0 && nationalDaysCount > 0,
    facts?.on_this_day?.length > 0 && onThisDayCount > 0,
    facts?.famous_birthdays?.length > 0 && birthdaysCount > 0,
    facts?.fun_trivia?.length > 0 && triviaCount > 0,
  ].filter(Boolean).length

  if (sections === 0) return null

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[sections] ?? 'grid-cols-2'

  return (
    <div className="bg-slate-800 border-b border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <span className="text-sm font-bold text-amber-400">📅 Today — {dateStr}</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-sm"
        >
          ✕ Hide
        </button>
      </div>

      <div className={`grid ${gridCols} divide-x divide-slate-700`}>
        {/* National Days */}
        {facts.national_days?.length > 0 && nationalDaysCount > 0 && (
          <Section title="🎊 National Days" defaultOpen={true}>
            <div className="flex flex-wrap gap-1.5">
              {facts.national_days.slice(0, nationalDaysCount).map((day, i) => {
                const name = typeof day === 'object' ? day.name : day
                const url = typeof day === 'object' ? day.url : null
                return url ? (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 bg-amber-600/30 text-amber-300 text-xs rounded-full border border-amber-600/40 hover:bg-amber-600/50 hover:text-amber-200 transition-colors cursor-pointer"
                  >
                    {name}
                  </a>
                ) : (
                  <span key={i} className="px-2 py-0.5 bg-amber-600/30 text-amber-300 text-xs rounded-full border border-amber-600/40">
                    {name}
                  </span>
                )
              })}
            </div>
          </Section>
        )}

        {/* On This Day */}
        {facts.on_this_day?.length > 0 && onThisDayCount > 0 && (
          <Section title="🕰️ On This Day" defaultOpen={true}>
            <ul className="space-y-1">
              {facts.on_this_day.slice(0, onThisDayCount).map((item, i) => (
                <li key={i} className="text-xs text-slate-300">
                  <span className="text-slate-400 font-mono mr-1">{item.year}</span>
                  {item.event}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Famous Birthdays */}
        {facts.famous_birthdays?.length > 0 && birthdaysCount > 0 && (
          <Section title="🎂 Famous Birthdays" defaultOpen={true}>
            <ul className="space-y-1">
              {facts.famous_birthdays.slice(0, birthdaysCount).map((b, i) => (
                <li key={i} className="text-xs text-slate-300">
                  <span className="font-medium text-slate-100">{b.name}</span>
                  <span className="text-slate-400"> b.{b.birth_year} · {b.known_for}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Fun Trivia */}
        {facts.fun_trivia?.length > 0 && triviaCount > 0 && (
          <Section title="🧠 Fun Trivia" defaultOpen={true}>
            <ul className="space-y-1.5">
              {facts.fun_trivia.slice(0, triviaCount).map((t, i) => (
                <li key={i} className="text-xs text-slate-300">💡 {t}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}
