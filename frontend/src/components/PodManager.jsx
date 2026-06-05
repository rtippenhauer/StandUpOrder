import { useState } from 'react'


export default function PodManager({ pods: initialPods, people: initialPeople, onClose, teamApi: api }) {
  const [pods, setPods] = useState(initialPods)
  const [people, setPeople] = useState(initialPeople)
  const [newPodName, setNewPodName] = useState('')
  const [newPodAbbr, setNewPodAbbr] = useState('')
  const [editingPod, setEditingPod] = useState(null) // { id, name, abbreviation }
  const [selectedPod, setSelectedPod] = useState(Object.keys(initialPods)[0] ?? null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function createPod() {
    if (!newPodName.trim()) return
    setSaving(true)
    try {
      const result = await api.createPod({ name: newPodName.trim(), abbreviation: newPodAbbr.trim() || null })
      const updated = await api.getPods()
      setPods(updated)
      setNewPodName('')
      setNewPodAbbr('')
      setSelectedPod(result.pod_id)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function savePodEdit() {
    setSaving(true)
    try {
      await api.updatePod(editingPod.id, { name: editingPod.name, abbreviation: editingPod.abbreviation })
      setPods(await api.getPods())
      setEditingPod(null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deletePod(id) {
    if (!confirm(`Delete pod "${pods[id]?.name}"? People are kept, assignments removed.`)) return
    setSaving(true)
    try {
      await api.deletePod(id)
      const updated = await api.getPods()
      setPods(updated)
      if (selectedPod === id) setSelectedPod(Object.keys(updated)[0] ?? null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function toggleAssignment(personName, podId) {
    const current = people[personName] ?? []
    const newIds = current.includes(podId)
      ? current.filter(id => id !== podId)
      : [...current, podId]
    try {
      await api.updatePerson(personName, { pod_ids: newIds })
      setPeople(await api.getPeople())
    } catch (e) { setErr(e.message) }
  }

  const podEntries = Object.entries(pods)
  const peopleInPod = selectedPod
    ? Object.entries(people).filter(([, ids]) => ids.includes(selectedPod)).map(([n]) => n)
    : []

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">🏷️ Manage Pods</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Pod list */}
          <div className="w-56 border-r border-slate-700 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {podEntries.map(([id, pod]) => (
                <div
                  key={id}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm
                    ${selectedPod === id ? 'bg-blue-800 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                  onClick={() => setSelectedPod(id)}
                >
                  {editingPod?.id === id ? (
                    <div className="flex flex-col gap-1 flex-1" onClick={e => e.stopPropagation()}>
                      <input
                        className="bg-slate-600 text-white text-xs rounded px-2 py-1 w-full"
                        value={editingPod.name}
                        onChange={e => setEditingPod(p => ({ ...p, name: e.target.value }))}
                        placeholder="Pod name"
                      />
                      <input
                        className="bg-slate-600 text-white text-xs rounded px-2 py-1 w-full"
                        value={editingPod.abbreviation}
                        onChange={e => setEditingPod(p => ({ ...p, abbreviation: e.target.value }))}
                        placeholder="Abbreviation"
                      />
                      <div className="flex gap-1">
                        <button onClick={savePodEdit} className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-0.5 rounded">Save</button>
                        <button onClick={() => setEditingPod(null)} className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-0.5 rounded">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="font-medium">{pod.name}</div>
                        <div className="text-xs text-slate-400">{pod.abbreviation}</div>
                      </div>
                      <div className="flex gap-1 ml-1">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingPod({ id, name: pod.name, abbreviation: pod.abbreviation }) }}
                          className="text-slate-400 hover:text-white text-xs"
                        >✏️</button>
                        <button
                          onClick={e => { e.stopPropagation(); deletePod(id) }}
                          className="text-slate-400 hover:text-red-400 text-xs"
                        >🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* New pod form */}
            <div className="border-t border-slate-700 p-3 space-y-2">
              <input
                className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 placeholder-slate-400"
                placeholder="Pod name"
                value={newPodName}
                onChange={e => setNewPodName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createPod()}
              />
              <input
                className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1.5 placeholder-slate-400"
                placeholder="Abbreviation (optional)"
                value={newPodAbbr}
                onChange={e => setNewPodAbbr(e.target.value)}
              />
              <button
                onClick={createPod}
                disabled={saving || !newPodName.trim()}
                className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs rounded py-1.5"
              >
                + Add Pod
              </button>
            </div>
          </div>

          {/* Right: Member assignments for selected pod */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedPod ? (
              <>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  Members of "{pods[selectedPod]?.name}"
                </h3>
                {Object.keys(people).length === 0 ? (
                  <p className="text-slate-400 text-sm">No team members yet. Add some in Team Members.</p>
                ) : (
                  <div className="space-y-1">
                    {Object.keys(people).map(name => (
                      <label key={name} className="flex items-center gap-3 text-sm text-slate-200 cursor-pointer hover:bg-slate-700 px-2 py-1.5 rounded">
                        <input
                          type="checkbox"
                          className="accent-blue-500"
                          checked={(people[name] ?? []).includes(selectedPod)}
                          onChange={() => toggleAssignment(name, selectedPod)}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-400 text-sm">Select a pod to manage members.</p>
            )}
          </div>
        </div>

        {err && (
          <div className="px-6 py-2 bg-red-900/50 text-red-300 text-sm border-t border-slate-700">{err}</div>
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
