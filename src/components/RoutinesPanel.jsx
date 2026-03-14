import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useRoutinesStore, { ROUTINE_PRESETS } from '../store/routinesStore'
import EmojiPicker from './EmojiPicker'

const streakColor = (n) =>
  n >= 7 ? 'text-orange-400' : n >= 3 ? 'text-yellow-400' : 'text-gray-400'

const todayStr = () => new Date().toISOString().slice(0, 10)

function RoutineCard({ routine, onStart }) {
  const deleteRoutine = useRoutinesStore((s) => s.deleteRoutine)
  const isDone = routine.lastCompletedDate === todayStr()
  const [confirm, setConfirm] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-gray-800 rounded-xl p-4 flex items-center gap-4 border transition-colors ${
        isDone ? 'border-green-700/50' : 'border-gray-700'
      }`}
    >
      <span className="text-3xl select-none">{routine.emoji}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold truncate ${isDone ? 'text-gray-400' : 'text-white'}`}>
            {routine.name}
          </span>
          {isDone && (
            <span className="text-green-400 text-xs font-semibold bg-green-900/30 px-1.5 py-0.5 rounded">
              ✓ Done today
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center flex-wrap gap-x-2 gap-y-0.5">
          <span>{routine.scheduledLabel}</span>
          <span>·</span>
          <span>{routine.steps.length} steps</span>
          {routine.streak > 0 && (
            <>
              <span>·</span>
              <span className={`font-semibold ${streakColor(routine.streak)}`}>
                🔥 {routine.streak}-day streak
              </span>
            </>
          )}
          {routine.longestStreak > 1 && (
            <span className="text-gray-600">best: {routine.longestStreak}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onStart(routine)}
          className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-colors ${
            isDone
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-400'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {isDone ? 'Redo' : 'Start'}
        </button>
        {confirm ? (
          <button
            onClick={() => deleteRoutine(routine.id)}
            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-900/20 rounded"
          >
            Delete?
          </button>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            onBlur={() => setTimeout(() => setConfirm(false), 150)}
            className="text-gray-600 hover:text-gray-400 w-6 h-6 flex items-center justify-center text-lg transition-colors rounded"
          >
            ×
          </button>
        )}
      </div>
    </motion.div>
  )
}

function AddRoutineForm({ onDone }) {
  const addCustomRoutine = useRoutinesStore((s) => s.addCustomRoutine)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📋')
  const [label, setLabel] = useState('Anytime')
  const [steps, setSteps] = useState([{ text: '', durationMins: 5 }])
  const [repeatPattern, setRepeatPattern] = useState('daily')

  const updateStep = (i, field, val) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, [field]: val } : st)))

  const save = () => {
    if (!name.trim()) return
    const validSteps = steps
      .filter((s) => s.text.trim())
      .map((s) => ({ text: s.text.trim(), durationMins: Number(s.durationMins) || 5, xp: 10 }))
    if (validSteps.length === 0) return
    addCustomRoutine(name.trim(), emoji, label, validSteps, repeatPattern)
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-xl p-4 border border-gray-600"
    >
      <h3 className="text-white font-semibold mb-3">New Routine</h3>

      <div className="flex gap-2 mb-3">
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Routine name"
          className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-500"
        />
      </div>

      <select
        value={label} onChange={(e) => setLabel(e.target.value)}
        className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 mb-3 focus:outline-none focus:border-blue-500"
      >
        {['Morning', 'Midday', 'Evening', 'Before work', 'After work', 'Anytime'].map((l) => (
          <option key={l}>{l}</option>
        ))}
      </select>

      <div className="mb-3">
        <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
          Repeat Pattern
        </label>
        <select
          value={repeatPattern} onChange={(e) => setRepeatPattern(e.target.value)}
          className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="daily">Every day</option>
          <option value="every2">Every 2 days</option>
          <option value="every3">Every 3 days</option>
          <option value="every7">Every week (7 days)</option>
        </select>
      </div>

      <div className="space-y-2 mb-3">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              value={step.text}
              onChange={(e) => updateStep(i, 'text', e.target.value)}
              placeholder={`Step ${i + 1}`}
              className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />
            <input
              type="number" min="1" max="60" value={step.durationMins}
              onChange={(e) => updateStep(i, 'durationMins', e.target.value)}
              title="Duration in minutes"
              className="w-14 bg-gray-700 text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 text-center focus:outline-none focus:border-blue-500"
            />
            <span className="text-gray-600 text-xs w-6">min</span>
            {steps.length > 1 && (
              <button
                onClick={() => setSteps((s) => s.filter((_, idx) => idx !== i))}
                className="text-gray-600 hover:text-red-400 text-lg w-5 text-center"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setSteps((s) => [...s, { text: '', durationMins: 5 }])}
        className="text-blue-400 hover:text-blue-300 text-sm mb-4 block"
      >
        + Add step
      </button>

      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="px-4 py-2 text-gray-500 hover:text-white text-sm transition-colors">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!name.trim()}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors font-semibold"
        >
          Save Routine
        </button>
      </div>
    </motion.div>
  )
}

export default function RoutinesPanel({ onStart, expanded = false }) {
  const routines = useRoutinesStore((s) => s.routines)
  const addRoutineFromPreset = useRoutinesStore((s) => s.addRoutineFromPreset)
  const [open, setOpen] = useState(expanded)
  const [adding, setAdding] = useState(false)

  const td = todayStr()
  const doneToday = routines.filter((r) => r.lastCompletedDate === td).length
  const existingNames = new Set(routines.map((r) => r.name))
  const availablePresets = Object.entries(ROUTINE_PRESETS).filter(
    ([, p]) => !existingNames.has(p.name)
  )

  return (
    <div className="mb-6">
      {!expanded && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between py-2 px-1 text-left group"
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
              Routines
            </span>
            {routines.length > 0 && (
              <span className="text-xs bg-gray-800 text-gray-500 rounded-full px-2 py-0.5 border border-gray-700">
                {doneToday}/{routines.length} today
              </span>
            )}
          </div>
          <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs">
            {open ? '▲' : '▼'}
          </span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1 pb-2">
              {routines.length === 0 && !adding && (
                <p className="text-gray-600 text-sm py-4 text-center">
                  No routines yet — add a preset or create your own.
                </p>
              )}

              <AnimatePresence>
                {routines.map((r) => (
                  <RoutineCard key={r.id} routine={r} onStart={onStart} />
                ))}
              </AnimatePresence>

              {adding && <AddRoutineForm onDone={() => setAdding(false)} />}

              {!adding && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setAdding(true)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-sm rounded-lg border border-gray-700 transition-colors"
                  >
                    + Custom
                  </button>
                  {availablePresets.map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => addRoutineFromPreset(key)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-sm rounded-lg border border-gray-700 transition-colors"
                    >
                      {preset.emoji} {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
