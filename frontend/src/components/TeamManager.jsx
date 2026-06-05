import { useState } from 'react'


export default function TeamManager({ people: initialPeople, pods, onClose, teamApi: api }) {
  const [people, setPeople] = useState(initialPeople)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState(null) // original name being edited
  const [editValues, setEditValues] = useState({ name: '', pod_ids: [] })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const podEntries = Object.entries(pods)

  async function refresh() {
    setPeople(await api.getPeople())
  }

  async function addPerson() {
    if (!newName.trim()) return
    setSaving(true)
    setErr(null)
    try {
      await api.createPerson({ name: newName.trim(), pod_ids: [] })
      setNewName('')
      await refresh()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deletePerson(name) {
    if (!confirm(`Remove "${name}" from the team?`)) return
    setSaving(true)
    try {
      await api.deletePerson(name)
      await refresh()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  function startEdit(name) {
    setEditingName(name)
    setEditValues({ name, pod_ids: [...(people[name] ?? [])] })
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await api.updatePerson(editingName, {
        new_name: editValues.name !== editingName ? editValues.name : undefined,
        pod_ids: editValues.pod_ids,
      })
      setEditingName(null)
      await refresh()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  function togglePod(podId) {
    setEditValues(v => ({
      ...v,
      pod_ids: v.pod_ids.includes(podId)
        ? v.pod_ids.filter(id => id !== podId)
        : [...v.pod_ids, podId],
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">👥 Manage Team Members</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* People list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {Object.keys(people).length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">No team members yet. Add one below.</p>
          )}

          {Object.entries(people).map(([name, podIds]) => (
            <div key={name} className="bg-slate-700 rounded-lg">
              {editingName === name ? (
                <div className="p-3 space-y-2">
                  <input
                    className="w-full bg-slate-600 text-white text-sm rounded px-3 py-1.5"
                    value={editValues.name}
                    onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))}
                    placeholder="Name"
                  />
                  {podEntries.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400">Pod assignments:</p>
                      {podEntries.map(([id, pod]) => (
                        <label key={id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-blue-500"
                            checked={editValues.pod_ids.includes(id)}
                            onChange={() => togglePod(id)}
                          />
                          {pod.name}
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded disabled:opacity-50"
                    >Save</button>
                    <button
                      onClick={() => setEditingName(null)}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-white text-sm font-medium">{name}</span>
                    {podIds.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {podIds.map(id => (
                          <span key={id} className="text-xs bg-blue-800/50 text-blue-300 px-1.5 py-0.5 rounded">
                            {pods[id]?.abbreviation ?? id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(name)}
                      className="text-slate-400 hover:text-white text-sm"
                    >✏️</button>
                    <button
                      onClick={() => deletePerson(name)}
                      className="text-slate-400 hover:text-red-400 text-sm"
                    >🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add person */}
        <div className="border-t border-slate-700 px-4 py-3 flex gap-2">
          <input
            className="flex-1 bg-slate-700 text-white text-sm rounded px-3 py-2 placeholder-slate-400"
            placeholder="New team member name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPerson()}
          />
          <button
            onClick={addPerson}
            disabled={saving || !newName.trim()}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded"
          >
            Add
          </button>
        </div>

        {err && (
          <div className="px-4 py-2 bg-red-900/40 text-red-300 text-sm">{err}</div>
        )}

        <div className="px-6 py-3 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
