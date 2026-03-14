import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'

const MAX_WINS = 3

export default function DailyWinsGate({ onComplete }) {
  const { tasks } = useTasksStore()
  const [selected, setSelected] = useState([])

  // Only show incomplete tasks, sorted by priority weight
  const PRIO_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }
  const candidates = useMemo(() =>
    tasks
      .filter((t) => !t.completedAt)
      .sort((a, b) => (PRIO_ORDER[a.priority] ?? 2) - (PRIO_ORDER[b.priority] ?? 2)),
    [tasks]
  )

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_WINS
        ? [...prev, id]
        : prev // already at cap
    )
  }

  const handleConfirm = () => {
    if (selected.length === 0) return
    onComplete(selected)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] bg-gray-950/98 backdrop-blur-xl flex flex-col items-center justify-center px-6"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full bg-yellow-900/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-lg flex flex-col gap-6"
      >
        {/* Header */}
        <div className="text-center">
          <span className="text-5xl mb-4 block">🌅</span>
          <h2 className="text-2xl font-bold text-white mb-2">Good morning! Let's set your 3 Wins.</h2>
          <p className="text-gray-400 text-sm">
            Pick exactly 3 tasks to focus on today. The rest can wait.
          </p>
        </div>

        {/* Selection counter */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all ${
                selected.length >= n
                  ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                  : 'border-gray-700 text-gray-600'
              }`}
            >
              {selected.length >= n ? '✓' : n}
            </div>
          ))}
        </div>

        {/* Task list */}
        {candidates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No pending tasks! Add some tasks first.</p>
            <button
              onClick={() => onComplete([])}
              className="mt-4 text-sm text-gray-400 hover:text-white underline"
            >
              Skip for today
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            <AnimatePresence>
              {candidates.map((task) => {
                const isSelected = selected.includes(task.id)
                const isDisabled = !isSelected && selected.length >= MAX_WINS
                const prioMeta = PRIORITIES[task.priority] ?? PRIORITIES.medium
                return (
                  <motion.button
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: isDisabled ? 0.35 : 1, y: 0 }}
                    onClick={() => toggle(task.id)}
                    disabled={isDisabled}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                    } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isSelected ? 'border-yellow-500 bg-yellow-500' : 'border-gray-600'
                      }`}>
                        {isSelected && <span className="text-[10px] text-gray-900 font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{task.text}</p>
                        <span className={`text-xs ${prioMeta.color}`}>{prioMeta.emoji} {prioMeta.label}</span>
                        {task.dueDate && (
                          <span className="text-xs text-gray-500 ml-2">· 📅 {task.dueDate.slice(0, 10)}</span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              selected.length > 0
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-lg shadow-yellow-900/30 hover:scale-[1.02]'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {selected.length === 0
              ? 'Select your 3 Wins'
              : selected.length < MAX_WINS
              ? `Confirm ${selected.length} Win${selected.length > 1 ? 's' : ''} (pick ${MAX_WINS - selected.length} more)`
              : "🏆 Let's conquer these 3!"}
          </button>
          <button
            onClick={() => onComplete([])}
            className="text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors"
          >
            Skip for today
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
