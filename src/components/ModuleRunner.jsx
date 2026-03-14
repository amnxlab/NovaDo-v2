import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useRoadmapsStore, { LEARNING_MODES, allocatedMins, resolveMode } from '../store/roadmapsStore'
import useXPStore from '../store/xpStore'
import useTasksStore from '../store/tasksStore'
import useEmotionStore from '../store/emotionStore'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const BASE_MODULE_XP = 25

export default function ModuleRunner({ item, onClose }) {
  // item: { module, course, roadmap }
  const { module, course, roadmap } = item

  const completeModule = useRoadmapsStore((s) => s.completeModule)
  const updateModule = useRoadmapsStore((s) => s.updateModule)
  const unlockAchievement = useXPStore((s) => s.unlockAchievement)
  const awardXP = useXPStore((s) => s.awardXP)
  const addTask = useTasksStore((s) => s.addTask)
  const completeTask = useTasksStore((s) => s.completeTask)
  const currentEnergy = useEmotionStore((s) => s.currentEnergy)

  const [effectiveMode, setEffectiveMode] = useState(() => resolveMode(module, course, roadmap))
  const [showEnergyBanner, setShowEnergyBanner] = useState(() => currentEnergy !== null && currentEnergy <= 3)
  const [timerActive, setTimerActive] = useState(false)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [earnedXP, setEarnedXP] = useState(0)
  const [courseCompleted, setCourseCompleted] = useState(false)

  const allocated = allocatedMins({ ...module, mode: effectiveMode === resolveMode(module, course, roadmap) ? module.mode : effectiveMode }, course, roadmap)
  const totalSeconds = allocated * 60
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)

  // Recalculate timer if mode changes before start
  useEffect(() => {
    if (!started) {
      const newAllocated = (() => {
        const mode = LEARNING_MODES[effectiveMode] || LEARNING_MODES.normal
        return Math.ceil(module.durationMins * mode.multiplier * (1 + mode.buffer))
      })()
      setSecondsLeft(newAllocated * 60)
    }
  }, [effectiveMode, module.durationMins, started])

  // Countdown
  useEffect(() => {
    if (!timerActive || done) return
    if (secondsLeft <= 0) { setTimerActive(false); return }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, timerActive, done])

  const handleStart = () => {
    setStarted(true)
    setTimerActive(true)
  }

  const handleComplete = useCallback(() => {
    setTimerActive(false)
    const modeInfo = LEARNING_MODES[effectiveMode] || LEARNING_MODES.normal
    const momentumBonus = roadmap.momentumMultiplier || 1.0
    const xp = Math.round(BASE_MODULE_XP * modeInfo.xpMultiplier * momentumBonus)
    setEarnedXP(xp)
    awardXP(xp)

    let taskId = null
    if (roadmap.autoInjectTasks) {
      taskId = addTask(`${course.name} › ${module.title} [${modeInfo.emoji} ${modeInfo.label}]`, {
        priority: 'medium',
        tags: ['roadmap', roadmap.name],
      })
      completeTask(taskId)
    }

    completeModule(roadmap.id, course.id, module.id, taskId, xp)

    // Check achievements via the updated store state
    const updatedRoadmap = useRoadmapsStore.getState().roadmaps.find((r) => r.id === roadmap.id)
    if (updatedRoadmap) {
      const allMods = updatedRoadmap.courses.flatMap((c) => c.modules)
      const firstComplete = allMods.filter((m) => m.completedAt).length === 1
      if (firstComplete) unlockAchievement('roadmap_first')
      if (updatedRoadmap.streak >= 3) unlockAchievement('roadmap_streak_3')
      if (updatedRoadmap.streak >= 7) unlockAchievement('roadmap_streak_7')
      if (updatedRoadmap.fastModeStreak >= 3) unlockAchievement('fast_chain_3')
      if (updatedRoadmap.fastMasteryActive) unlockAchievement('mode_mastery_10')
      if (updatedRoadmap._justCompletedCourse) { unlockAchievement('course_complete'); setCourseCompleted(true) }
      if (updatedRoadmap._justCompletedRoadmap) unlockAchievement('roadmap_complete')
    }

    setDone(true)
  }, [effectiveMode, roadmap, course, module, awardXP, addTask, completeTask, completeModule, unlockAchievement])

  const handleSkip = () => {
    setTimerActive(false)
    setSkipped(true)
    setDone(true)
  }

  const timeProgress = ((totalSeconds - secondsLeft) / totalSeconds) * 100
  const circumference = 2 * Math.PI * 60
  const modeInfo = LEARNING_MODES[effectiveMode] || LEARNING_MODES.normal

  // Completion screen
  if (done) {
    const updatedRoadmap = useRoadmapsStore.getState().roadmaps.find((r) => r.id === roadmap.id)
    const streak = updatedRoadmap?.streak || 0
    const roadmapComplete = updatedRoadmap?._justCompletedRoadmap || false
    const allMods = updatedRoadmap?.courses.flatMap((c) => c.modules) || []
    const totalMods = allMods.length
    const doneMods = allMods.filter((m) => m.completedAt).length
    const pct = totalMods ? Math.round((doneMods / totalMods) * 100) : 0

    const bigEmoji = roadmapComplete ? '🏆' : courseCompleted ? '🎯' : skipped ? '⏭️' : '✅'
    const bigTitle = roadmapComplete ? 'Path Conquered!' : courseCompleted ? 'Course Complete!' : skipped ? 'Module Skipped' : 'Module Complete!'

    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      >
        <div className="text-center p-8 max-w-md w-full">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="text-6xl mb-4"
          >
            {bigEmoji}
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-1">{bigTitle}</h2>
          {courseCompleted && !roadmapComplete && (
            <p className="text-green-400 text-sm mb-1">🎓 {course.name} fully completed!</p>
          )}
          {roadmapComplete && (
            <p className="text-yellow-300 text-sm mb-1">🗺️ You completed the entire <strong>{roadmap.name}</strong> path!</p>
          )}
          <p className="text-gray-500 text-sm mb-4">{module.title}</p>

          {!skipped && earnedXP > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-yellow-400 text-2xl font-bold mb-2"
            >
              +{earnedXP} XP {roadmap.momentumMultiplier > 1 && <span className="text-base text-orange-400">×{roadmap.momentumMultiplier} 🔥</span>}
            </motion.div>
          )}

          {/* Path progress mini-bar */}
          {!skipped && totalMods > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{roadmap.name}</span>
                <span>{doneMods}/{totalMods} modules · {pct}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${roadmapComplete ? 'bg-yellow-400' : 'bg-blue-500'}`}
                  initial={{ width: `${pct - 1}%` }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                />
              </div>
            </motion.div>
          )}

          {!skipped && streak > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-orange-400 font-semibold mb-3"
            >
              🔥 {streak}-day streak!{streak >= 7 ? ' 🏛️ Scholar!' : streak >= 3 ? ' 📚' : ''}
            </motion.div>
          )}
          {updatedRoadmap?.fastMasteryActive && !skipped && effectiveMode === 'fast' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              className="text-yellow-300 text-sm mb-4"
            >
              🌟 Mode Mastery active — you're in the zone!
            </motion.div>
          )}
          <button onClick={onClose} className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold">
            {roadmapComplete ? '🏆 Celebrate!' : skipped ? 'Back' : 'Done 🎉'}
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
          <span className="text-2xl">{course.emoji}</span>
          <div>
            <div className="text-white font-semibold text-sm">{course.name}</div>
            <div className="text-gray-500 text-xs">{roadmap.name}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800">✕</button>
      </div>

      {/* Energy banner */}
      <AnimatePresence>
        {showEnergyBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-yellow-900/30 border-b border-yellow-700/50 px-5 py-2.5 flex items-center gap-3 text-sm shrink-0"
          >
            <span>😴</span>
            <span className="text-yellow-300 flex-1">Low energy detected — switch to 🐢 Slow mode for a gentler pace?</span>
            <button
              onClick={() => { setEffectiveMode('slow'); setShowEnergyBanner(false) }}
              className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 text-white text-xs rounded-lg font-semibold"
            >
              Switch
            </button>
            <button onClick={() => setShowEnergyBanner(false)} className="text-yellow-600 hover:text-yellow-400 text-lg">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 overflow-hidden">
        <div className="text-center max-w-lg w-full">
          {/* Mode selector (pre-start) */}
          {!started && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <p className="text-gray-500 text-sm mb-3">Select learning mode for this session</p>
              <div className="flex gap-2 justify-center">
                {Object.entries(LEARNING_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    onClick={() => setEffectiveMode(key)}
                    className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      effectiveMode === key
                        ? 'bg-blue-600 border-blue-500 text-white scale-105'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div>{mode.emoji} {mode.label}</div>
                    <div className="text-xs font-normal opacity-70 mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Timer ring */}
          <div className="relative w-44 h-44 mx-auto mb-6">
            <svg className="w-44 h-44 -rotate-90" viewBox="0 0 144 144">
              <circle cx="72" cy="72" r="60" fill="none" stroke="#1f2937" strokeWidth="10" />
              <motion.circle
                cx="72" cy="72" r="60" fill="none"
                stroke={secondsLeft < 60 ? '#ef4444' : modeInfo.emoji === '⚡' ? '#f59e0b' : '#3b82f6'}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - timeProgress / 100)}
                transition={{ duration: 0.8 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-mono font-bold tabular-nums ${secondsLeft < 60 ? 'text-red-400' : 'text-white'}`}>
                {fmt(secondsLeft)}
              </span>
              <span className="text-gray-500 text-xs mt-1">{modeInfo.emoji} {modeInfo.label}</span>
              {roadmap.momentumMultiplier > 1 && (
                <span className="text-orange-400 text-xs mt-0.5">🔥 ×{roadmap.momentumMultiplier}</span>
              )}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1 leading-snug">{module.title}</h2>
          <p className="text-gray-500 text-sm mb-6">
            {module.durationMins}m raw → {Math.ceil(module.durationMins * (LEARNING_MODES[effectiveMode]?.multiplier || 5) * (1 + (LEARNING_MODES[effectiveMode]?.buffer || 0.15)))}m allocated
            &nbsp;·&nbsp; +{Math.round(BASE_MODULE_XP * (LEARNING_MODES[effectiveMode]?.xpMultiplier || 1) * (roadmap.momentumMultiplier || 1))} XP
          </p>

          {/* Action buttons */}
          {!started ? (
            <button
              onClick={handleStart}
              className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg"
            >
              ▶ Start Session
            </button>
          ) : (
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg"
              >
                ✓ Complete
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-xl transition-colors"
              >
                Skip →
              </button>
            </div>
          )}

          {started && (
            <button
              onClick={() => setTimerActive((v) => !v)}
              className="mt-4 text-gray-600 hover:text-gray-400 text-sm transition-colors"
            >
              {timerActive ? '⏸ Pause' : '▶ Resume'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
