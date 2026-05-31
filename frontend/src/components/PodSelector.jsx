export default function PodSelector({ pods, onSelect, onClose }) {
  const entries = Object.entries(pods)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h2 className="text-xl font-bold text-white mb-2">Select a Pod</h2>
        <p className="text-slate-400 text-sm mb-6">Which team's stand-up are we running today?</p>
        <div className="space-y-3">
          {entries.map(([id, pod]) => (
            <button
              key={id}
              className="w-full text-left px-5 py-4 bg-slate-700 hover:bg-blue-700 rounded-xl text-white font-semibold transition-colors"
              onClick={() => onSelect(id)}
            >
              <span className="text-lg">{pod.name}</span>
              {pod.abbreviation && pod.abbreviation !== pod.name && (
                <span className="ml-2 text-sm text-slate-400">({pod.abbreviation})</span>
              )}
            </button>
          ))}
        </div>
        {entries.length === 0 && (
          <p className="text-slate-400 text-sm">No pods configured yet.</p>
        )}
      </div>
    </div>
  )
}
