import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import useXPStore from '../store/xpStore'

// Breathing phases
const PHASES = [
  { label: 'Breathe in…', duration: 4000, scale: 1.4, color: 'from-blue-600 to-purple-600' },
  { label: 'Hold…',       duration: 2000, scale: 1.4, color: 'from-purple-600 to-indigo-600' },
  { label: 'Breathe out…',duration: 6000, scale: 1.0, color: 'from-indigo-600 to-blue-800'  },
]

function BreathingCircle({ onDone }) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [cycles, setCycles] = useState(0)
  const total = 4 // breathing cycles before auto-closing
  const timerRef = useRef(null)

  useEffect(() => {
    const phase = PHASES[phaseIdx]
    timerRef.current = setTimeout(() => {
      const next = (phaseIdx + 1) % PHASES.length
      if (next === 0) {
        const newCycles = cycles + 1
        setCycles(newCycles)
        if (newCycles >= total) { onDone(); return }
      }
      setPhaseIdx(next)
    }, phase.duration)
    return () => clearTimeout(timerRef.current)
  }, [phaseIdx, cycles, onDone])

  const phase = PHASES[phaseIdx]

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        animate={{ scale: phase.scale }}
        transition={{ duration: phase.duration / 1000, ease: 'easeInOut' }}
        className={`w-40 h-40 rounded-full bg-gradient-to-br ${phase.color} shadow-2xl shadow-blue-900/50 flex items-center justify-center`}
      >
        <span className="text-white font-light text-sm text-center px-4">{phase.label}</span>
      </motion.div>
      <p className="text-gray-500 text-xs">Cycle {cycles + 1} of {total}</p>
    </div>
  )
}

export default function OverwhelmModal({ onClose }) {
  const { tasks } = useTasksStore()
  const { unlockAchievement } = useXPStore()
  const [mode, setMode] = useState('main') // 'main' | 'breathe' | 'done'

  // Pick the top 1 task: first urgent or high priority incomplete, else just first incomplete
  const pending = tasks.filter((t) => !t.completedAt)
  const top = pending.find((t) => t.priority === 'urgent' || t.priority === 'high') ?? pending[0]
  const prioMeta = top ? (PRIORITIES[top.priority] ?? PRIORITIES.medium) : null

  // Fire overwhelm_reset immediately (user pressed the big button)
  useEffect(() => { unlockAchievement('overwhelm_reset') }, [])

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-gray-950/95 backdrop-blur-xl flex flex-col items-center justify-center px-6"
    >
      {/* Calm ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-950/50 blur-3xl" />
      </div>

      <AnimatePresence mode="wait">
        {mode === 'main' ? (
          <motion.div
            key="main"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex flex-col items-center gap-8 text-center max-w-md"
          >
            <span className="text-5xl">😮‍💨</span>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Hey, it's okay.</h2>
              <p className="text-gray-400">
                You don't have to do everything right now. Let's slow down for a moment.
              </p>
            </div>

            {/* The single most important task */}
            {top ? (
              <div className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5">
                <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-3">
                  The only thing that matters right now
                </p>
                <p className={`text-lg font-semibold text-white`}>{top.text}</p>
                <span className={`text-xs mt-2 inline-block ${prioMeta.color}`}>
                  {prioMeta.emoji} {prioMeta.label}
                </span>
              </div>
            ) : (
              <div className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5">
                <p className="text-gray-500 text-sm">No tasks right now. You're free. 🌿</p>
              </div>
            )}

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => setMode('breathe')}
                className="w-full py-3.5 bg-gradient-to-r from-blue-700 to-purple-700 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all"
              >
                🌬️ Guide me through breathing
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-xl transition-all"
              >
                I'm okay now — back to work
              </button>
            </div>
            <p className="text-xs text-gray-600">Press Esc to dismiss</p>
          </motion.div>
        ) : (
          <motion.div
            key="breathe"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex flex-col items-center gap-8 text-center"
          >
            <h2 className="text-xl font-bold text-white">Follow the circle</h2>
            <BreathingCircle onDone={() => { setMode('done'); unlockAchievement('zen_master') }} />
            <button
              onClick={onClose}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Skip
            </button>
          </motion.div>
        )}

        {mode === 'done' && (
          <motion.div
            key="done"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-6 text-center max-w-sm"
          >
            <span className="text-5xl">🌿</span>
            <h2 className="text-2xl font-bold text-white">Better?</h2>
            <p className="text-gray-400">Your nervous system just got a reset. You've got this.</p>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all"
            >
              Let's go
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
