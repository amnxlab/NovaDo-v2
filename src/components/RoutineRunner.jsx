import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useRoutinesStore from '../store/routinesStore'
import useXPStore from '../store/xpStore'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function RoutineRunner({ routine, onClose }) {
  const completeRoutine = useRoutinesStore((s) => s.completeRoutine)
  const { awardXP, unlockAchievement, increment, markDailyComposite } = useXPStore()

  const [stepIndex, setStepIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(routine.steps[0]?.durationMins * 60 || 300)
  const [skipped, setSkipped] = useState([])
  const [done, setDone] = useState(false)
  const [totalXP, setTotalXP] = useState(0)
  const [timerActive, setTimerActive] = useState(true)
  const [finalStreak, setFinalStreak] = useState(0)

  const currentStep = routine.steps[stepIndex]

  // Countdown
  useEffect(() => {
    if (!timerActive || done) return
    if (secondsLeft <= 0) { setTimerActive(false); return }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, timerActive, done])

  const advance = useCallback((skipping = false) => {
    const xpEarned = skipping ? 0 : currentStep.xp
    if (!skipping) awardXP(xpEarned)
    setTotalXP((t) => t + xpEarned)
    if (skipping) setSkipped((arr) => [...arr, currentStep.id])

    const next = stepIndex + 1
    if (next >= routine.steps.length) {
      completeRoutine(routine.id)
      const updatedRoutine = useRoutinesStore.getState().routines.find((r) => r.id === routine.id)
      const newStreak = updatedRoutine?.streak || 1
      setFinalStreak(newStreak)
      setDone(true)

      // ── Achievement checks ───────────────────────────────────────────────
      const totalDone = increment('totalRoutinesDone')
      unlockAchievement('first_routine')
      if (totalDone >= 10)  unlockAchievement('routines_10')
      if (totalDone >= 50)  unlockAchievement('routines_50')
      if (totalDone >= 100) unlockAchievement('routines_100')

      // Routine streak achievements
      if (newStreak >= 7)  unlockAchievement('routine_streak_7')
      if (newStreak >= 14) unlockAchievement('routine_streak_14')
      if (newStreak >= 30) unlockAchievement('routine_streak_30')
      if (newStreak >= 60) unlockAchievement('routine_streak_60')

      // Daily composite (task + routine + module on same day)
      const composite = markDailyComposite('routine')
      if (composite.task && composite.routine && composite.module) unlockAchievement('triple_category')

    } else {
      setStepIndex(next)
      setSecondsLeft(routine.steps[next].durationMins * 60)
      setTimerActive(true)
    }
  }, [currentStep, stepIndex, routine, completeRoutine, awardXP, unlockAchievement, increment, markDailyComposite])


  const stepProgress = (stepIndex / routine.steps.length) * 100
  const timeProgress = currentStep
    ? (1 - secondsLeft / (currentStep.durationMins * 60)) * 100
    : 100
  const circumference = 2 * Math.PI * 60

  if (done) {
    const completedCount = routine.steps.length - skipped.length
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      >
        <div className="text-center p-8 max-w-md">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="text-7xl mb-4"
          >
            {routine.emoji}
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-2">Routine Complete!</h2>
          <p className="text-gray-400 mb-6">
            {completedCount} of {routine.steps.length} steps completed
          </p>
          {totalXP > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-yellow-400 text-2xl font-semibold mb-4"
            >
              +{totalXP} XP ✨
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-orange-400 text-lg font-semibold mb-8"
          >
            🔥 {finalStreak}-day streak!
          </motion.div>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition-colors text-lg"
          >
            Done 🎉
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-gray-950"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{routine.emoji}</span>
          <div>
            <div className="text-white font-semibold">{routine.name}</div>
            <div className="text-gray-500 text-sm">
              Step {stepIndex + 1} of {routine.steps.length}
            </div>
            {routine.repeatPattern !== 'daily' && (
              <div className="text-xs text-gray-600 mt-0.5">
                Repeat: {routine.repeatPattern === 'every2' ? 'Every 2 days' : routine.repeatPattern === 'every3' ? 'Every 3 days' : 'Every week'}
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors">
          ✕
        </button>
      </div>

      {/* Overall progress bar */}
      <div className="h-1 bg-gray-800 shrink-0">
        <motion.div
          className="h-full bg-blue-500"
          animate={{ width: `${stepProgress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Main step area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="text-center max-w-lg w-full"
          >
            {/* Circular timer */}
            <div className="relative w-44 h-44 mx-auto mb-8">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 144 144">
                <circle cx="72" cy="72" r="60" fill="none" stroke="#1f2937" strokeWidth="10" />
                <motion.circle
                  cx="72" cy="72" r="60" fill="none"
                  stroke={secondsLeft < 30 ? '#ef4444' : '#3b82f6'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - timeProgress / 100)}
                  transition={{ duration: 0.8 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-mono font-bold tabular-nums ${secondsLeft < 30 ? 'text-red-400' : 'text-white'}`}>
                  {fmt(secondsLeft)}
                </span>
                <span className="text-gray-500 text-xs mt-1">{currentStep.durationMins}m step</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 leading-snug">
              {currentStep.text}
            </h2>
            <div className="text-yellow-500 text-sm mb-10">+{currentStep.xp} XP on complete</div>

            {/* Action buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => advance(false)}
                className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition-colors text-lg shadow-lg"
              >
                ✓ Done
              </button>
              <button
                onClick={() => advance(true)}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-xl transition-colors"
              >
                Skip →
              </button>
            </div>

            <button
              onClick={() => setTimerActive((v) => !v)}
              className="mt-5 text-gray-600 hover:text-gray-400 text-sm transition-colors"
            >
              {timerActive ? '⏸ Pause timer' : '▶ Resume timer'}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step indicator dots */}
      <div className="flex justify-center gap-2 py-5 shrink-0">
        {routine.steps.map((s, i) => (
          <motion.div
            key={s.id}
            animate={{
              scale: i === stepIndex ? 1.4 : 1,
              backgroundColor: i < stepIndex ? '#22c55e' : i === stepIndex ? '#60a5fa' : '#374151',
            }}
            className="w-2 h-2 rounded-full"
          />
        ))}
      </div>
    </motion.div>
  )
}
