import { useState } from 'react'

export default function AddBackModal({ removedNames, onRestore, onClose }) {
  const [selected, setSelected] = useState(new Set())

  function toggle(name) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(removedNames))
  }

  function restore() {
    if (selected.size === 0) return
    onRestore([...selected])
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">↩️ Add Back to Session</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-2">
          {removedNames.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No one has been removed.</p>
          ) : (
            <>
              <button
                onClick={selectAll}
                className="text-xs text-blue-400 hover:text-blue-300 mb-1"
              >
                Select all
              </button>
              {removedNames.map(name => (
                <label
                  key={name}
                  className="flex items-center gap-3 px-3 py-2.5 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600"
                >
                  <input
                    type="checkbox"
                    className="accent-blue-500 w-4 h-4"
                    checked={selected.has(name)}
                    onChange={() => toggle(name)}
                  />
                  <span className="text-white text-sm font-medium">{name}</span>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={restore}
            disabled={selected.size === 0}
            className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium"
          >
            Add Back ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
