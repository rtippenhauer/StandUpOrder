function Chip({ name, onRestore, tone }) {
  const tones = {
    ooo: 'bg-amber-900/40 border-amber-700/60 text-amber-100',
    removed: 'bg-slate-700/60 border-slate-600 text-slate-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full border text-sm ${tones[tone]}`}>
      {name}
      <button
        onClick={() => onRestore([name])}
        title={`Add ${name} back`}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-green-700 text-green-300 hover:text-white font-bold leading-none"
      >
        +
      </button>
    </span>
  )
}

function Group({ label, names, tone, onRestore }) {
  if (names.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">
        {label} ({names.length})
      </span>
      {names.map(n => <Chip key={n} name={n} tone={tone} onRestore={onRestore} />)}
      {names.length > 1 && (
        <button
          onClick={() => onRestore(names)}
          className="text-xs text-green-400 hover:text-green-300 ml-1"
        >
          Add all back
        </button>
      )}
    </div>
  )
}

export default function AbsenceBar({ outOfOffice, removed, expected, total, onRestore }) {
  if (total === 0 && outOfOffice.length === 0 && removed.length === 0) return null
  return (
    <div className="mx-4 mt-3 px-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl flex flex-wrap items-center gap-x-8 gap-y-2">
      <div className="flex items-center gap-2" title="People in today's speaking order">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">👥 Expected</span>
        <span className="text-lg font-bold text-white">{expected}</span>
        <span className="text-sm text-slate-400">of {total}</span>
      </div>
      <Group label="🌴 Out of Office" names={outOfOffice} tone="ooo" onRestore={onRestore} />
      <Group label="✕ Removed" names={removed} tone="removed" onRestore={onRestore} />
    </div>
  )
}
