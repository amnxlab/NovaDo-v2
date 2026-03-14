import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import useXPStore, { calcTaskXP } from '../store/xpStore'
import useSettingsStore from '../store/settingsStore'
import useNotificationStore from '../store/notificationStore'
import useAnalyticsStore from '../store/analyticsStore'
import { audioPlayer } from '../utils/audio'
import { isPastDue } from '../utils/autoTagger'
import confetti from 'canvas-confetti'

function formatSeconds(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function FocusMode({ task, onClose }) {
  const { completeTask, lockIn, lockOut, addSubtask, completeSubtask } = useTasksStore()
  const { awardXP, unlockAchievement, increment, markDailyComposite } = useXPStore()
  const { soundEnabled, confettiEnabled } = useSettingsStore()
  const { addNotification } = useNotificationStore()
  const { addDailyStat } = useAnalyticsStore()

  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const [note, setNote] = useState('')
  const intervalRef = useRef(null)

  // Lock in immediately when focus mode opens
  useEffect(() => {
    lockIn(task.id)
    return () => lockOut()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  // Live timer
  useEffect(() => {
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  // Keyboard shortcut: Escape to exit
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleComplete = () => {
    lockOut()
    clearInterval(intervalRef.current)
    completeTask(task.id)

    const earlyBonus = task.dueDate ? !isPastDue(task.dueDate) : false
    const completedSubtaskCount = (task.subtasks ?? []).filter((s) => s.completedAt).length
    const xp = calcTaskXP({ priority: task.priority, earlyBonus, subtaskCount: completedSubtaskCount })
    awardXP(xp, task.id)
    addDailyStat(1, 0, 0)

    // ── Achievement checks ─────────────────────────────────────────────────
    const sessions = increment('totalFocusSessions')
    unlockAchievement('first_focus')
    unlockAchievement('one_thing_mode')
    if (sessions >= 10)  unlockAchievement('focus_sessions_10')
    if (sessions >= 50)  unlockAchievement('focus_sessions_50')
    if (sessions >= 100) unlockAchievement('focus_sessions_100')

    const totalDone = increment('totalTasksDone')
    if (totalDone >= 5)    unlockAchievement('tasks_5')
    if (totalDone >= 10)   unlockAchievement('tasks_10')
    if (totalDone >= 25)   unlockAchievement('tasks_25')
    if (totalDone >= 50)   unlockAchievement('tasks_50')
    if (totalDone >= 100)  unlockAchievement('tasks_100')
    if (totalDone >= 250)  unlockAchievement('tasks_250')
    if (totalDone >= 500)  unlockAchievement('tasks_500')
    if (totalDone >= 1000) unlockAchievement('tasks_1000')
    if (totalDone === 1)   unlockAchievement('first_task')

    const newFocusStreak = useXPStore.getState().focusStreak
    if (newFocusStreak >= 5)  unlockAchievement('focus_chain_5')
    if (newFocusStreak >= 10) unlockAchievement('focus_chain_10')
    if (newFocusStreak >= 25) unlockAchievement('focus_chain_25')

    const newStreak = useXPStore.getState().streakDays
    if (newStreak >= 3)  unlockAchievement('streak_3')
    if (newStreak >= 7)  unlockAchievement('streak_7')
    if (newStreak >= 14) unlockAchievement('streak_14')
    if (newStreak >= 30) unlockAchievement('streak_30')

    if (earlyBonus) {
      const early = increment('earlyCompletions')
      unlockAchievement('deadline_dodger')
      if (early >= 5)  unlockAchievement('early_5')
      if (early >= 25) unlockAchievement('early_25')
    }

    const hour = new Date().getHours()
    if (hour < 8)   unlockAchievement('early_bird')
    if (hour >= 22) unlockAchievement('night_owl')

    const composite = markDailyComposite('task')
    if (composite.task && composite.routine && composite.module) unlockAchievement('triple_category')

    if (soundEnabled) audioPlayer.playPop()
    if (confettiEnabled) {
      confetti({ particleCount: 160, spread: 120, origin: { x: 0.5, y: 0.4 } })
    }
    addNotification(`+${xp} XP${earlyBonus ? ' ⚡ Early bonus!' : ''} 🎉`, 'success')
    setDone(true)
  }

  const prioMeta = PRIORITIES[task.priority] ?? PRIORITIES.medium
  const subtasks = task.subtasks ?? []
  const completedCount = subtasks.filter((s) => s.completedAt).length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-gray-950 flex flex-col items-center justify-center"
    >
      {/* Ambient glow behind the card */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-900/20 blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 border-b border-gray-800/60">
        <span className="text-xs font-bold tracking-widest uppercase text-purple-400">🎯 The One Thing</span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg text-white tabular-nums">{formatSeconds(elapsed)}</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-all"
          >
            Esc · Exit
          </button>
        </div>
      </div>

      {/* Main card */}
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-6 text-center px-8 max-w-xl"
          >
            <span className="text-7xl">🏆</span>
            <h2 className="text-3xl font-bold text-white">Crushed it!</h2>
            <p className="text-gray-400 text-lg">You stayed locked in for {formatSeconds(elapsed)}.</p>
            <button
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-lg transition-all"
            >
              Back to tasks
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="focus"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col items-center gap-8 px-8 w-full max-w-2xl"
          >
            {/* Priority badge */}
            <span className={`text-sm font-semibold ${prioMeta.color}`}>
              {prioMeta.emoji} {prioMeta.label} priority
            </span>

            {/* Task text — the hero */}
            <h2 className="text-3xl sm:text-4xl font-bold text-white text-center leading-tight">
              {task.text}
            </h2>

            {/* Due date */}
            {task.dueDate && (
              <span className="text-sm text-gray-400">
                📅 Due {task.dueDate.slice(0, 10)}
              </span>
            )}

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <div className="w-full bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Subtasks · {completedCount}/{subtasks.length}
                </p>
                {subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <button
                      onClick={() => completeSubtask(task.id, s.id)}
                      disabled={!!s.completedAt}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${
                        s.completedAt ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-purple-400'
                      }`}
                    >
                      {s.completedAt && <span className="text-[10px] text-white flex items-center justify-center w-full h-full">✓</span>}
                    </button>
                    <span className={`text-sm ${s.completedAt ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                      {s.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Note scratch pad */}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Quick notes while you work… (not saved)"
              rows={2}
              className="w-full bg-gray-900/70 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
            />

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleComplete}
                className="px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-purple-900/40 transition-all hover:scale-105"
              >
                ✓ Done!
              </button>
              <button
                onClick={onClose}
                className="px-6 py-4 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-2xl font-medium transition-all"
              >
                Pause
              </button>
            </div>

            <p className="text-xs text-gray-600">Nothing else exists right now. Just this.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
