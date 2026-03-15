import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import useXPStore, { calcTaskXP, ACHIEVEMENTS } from '../store/xpStore'
import useAnalyticsStore from '../store/analyticsStore'
import useNotificationStore from '../store/notificationStore'
import useSettingsStore from '../store/settingsStore'
import useEmotionStore from '../store/emotionStore'
import { isPastDue } from '../utils/autoTagger'
import { audioPlayer } from '../utils/audio'
import confetti from 'canvas-confetti'

const fmt = (s) => {
  const abs = Math.abs(s)
  const sign = s < 0 ? '+' : ''
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

const BASE_MINS = { urgent: 25, high: 25, medium: 20, low: 15 }

const FOCUS_MODES = {
  sprint:  { emoji: '⚡', label: 'Sprint',    desc: '×0.75 time · ×1.2 XP',  timeMult: 0.75, xpMult: 1.2  },
  normal:  { emoji: '🎯', label: 'Normal',    desc: '×1 time · ×1 XP',       timeMult: 1.0,  xpMult: 1.0  },
  deep:    { emoji: '🌊', label: 'Deep Work', desc: '×1.5 time · ×1.5 XP',   timeMult: 1.5,  xpMult: 1.5  },
}

export default function TaskRunner({ task, onClose }) {
  const { completeTask, lockedTaskId, lockIn, lockOut } = useTasksStore()
  const { awardXP, unlockAchievement, todayCount, focusStreak, streakDays } = useXPStore()
  const { addFocusSession, addDailyStat } = useAnalyticsStore()
  const { addNotification } = useNotificationStore()
  const {
    soundEnabled,
    confettiEnabled,
    timerAlertTone,
    timerAlertRepeat,
    timerAlertIntervalSec,
    timerAlertVolume,
  } = useSettingsStore()
  const { currentEnergy } = useEmotionStore()

  const [mode, setMode] = useState('normal')
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [timerActive, setTimerActive] = useState(false)
  const [overtime, setOvertime] = useState(false)
  const [earnedXP, setEarnedXP] = useState(0)
  const [unlockedAchievements, setUnlockedAchievements] = useState([])

  const isLockedIn = lockedTaskId === task.id
  const prioMeta = PRIORITIES[task.priority] ?? PRIORITIES.medium
  const subtasks = task.subtasks ?? []
  const completedSubtaskCount = subtasks.filter((s) => s.completedAt).length

  // Use explicit durationMins from roadmap modules when set, otherwise fall back to priority defaults
  const baseMins = task.durationMins ?? (BASE_MINS[task.priority] ?? 20)
  const allocatedMins = Math.round(baseMins * FOCUS_MODES[mode].timeMult)
  const totalSeconds = allocatedMins * 60
  const accumulatedTrackedSeconds = Math.max(0, task.timeSpent || 0)
  const initialRemainingSeconds = Math.max(0, totalSeconds - accumulatedTrackedSeconds)
  const [secondsLeft, setSecondsLeft] = useState(initialRemainingSeconds)
  const currentSessionElapsed = Math.max(0, initialRemainingSeconds - secondsLeft)

  // Recalculate timer when mode changes (before start)
  useEffect(() => {
    if (!started) {
      const nextTotalSeconds = Math.round(baseMins * FOCUS_MODES[mode].timeMult) * 60
      setSecondsLeft(Math.max(0, nextTotalSeconds - accumulatedTrackedSeconds))
      setOvertime(false)
    }
  }, [mode, baseMins, started, accumulatedTrackedSeconds])

  // Countdown
  useEffect(() => {
    if (!timerActive || done) return
    if (!overtime && secondsLeft <= 0) {
      setTimerActive(false)
      setOvertime(true)
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, timerActive, done, overtime])

  useEffect(() => {
    if (!soundEnabled) {
      audioPlayer.stopTimerAlert()
      return
    }

    if (started && !done && overtime && !timerActive) {
      audioPlayer.startTimerAlert({
        tone: timerAlertTone,
        volume: timerAlertVolume,
        repeat: timerAlertRepeat,
        intervalMs: timerAlertIntervalSec * 1000,
      })
      return
    }

    audioPlayer.stopTimerAlert()
  }, [started, done, secondsLeft, timerActive, soundEnabled, timerAlertTone, timerAlertRepeat, timerAlertIntervalSec, timerAlertVolume])

  useEffect(() => () => {
    audioPlayer.stopTimerAlert()
  }, [])

  // XP preview (for pre-start screen)
  const earlyBonus = task.dueDate ? !isPastDue(task.dueDate) : false
  const baseXP = calcTaskXP({
    priority: task.priority,
    earlyBonus,
    subtaskCount: completedSubtaskCount,
  })
  const previewXP = Math.round(baseXP * FOCUS_MODES[mode].xpMult)

  const handleStart = () => {
    if (!isLockedIn) lockIn(task.id)
    setStarted(true)
    setOvertime(false)
    setTimerActive(true)
  }

  const handlePauseToggle = () => {
    if (!started) return

    if (timerActive) {
      setTimerActive(false)
      if (isLockedIn) lockOut()
      return
    }

    audioPlayer.stopTimerAlert()
    if (!isLockedIn) lockIn(task.id)
    if (secondsLeft <= 0) setOvertime(true)
    setTimerActive(true)
  }

  const handleComplete = useCallback(() => {
    audioPlayer.stopTimerAlert()
    setTimerActive(false)
    const xp = Math.round(
      calcTaskXP({ priority: task.priority, earlyBonus, subtaskCount: completedSubtaskCount })
      * FOCUS_MODES[mode].xpMult
    )
    setEarnedXP(xp)

    if (isLockedIn) lockOut()
    completeTask(task.id)
    awardXP(xp, task.id)
    addDailyStat(1, 0, 0)

    // Track focus session
    const elapsed = currentSessionElapsed
    if (elapsed > 0) addFocusSession(elapsed / 60)

    // Achievements
    const unlocked = []
    if (todayCount === 0) { unlockAchievement('first_task'); unlocked.push('first_task') }
    if (earlyBonus)       { if (unlockAchievement('deadline_dodger')) unlocked.push('deadline_dodger') }
    if (focusStreak + 1 >= 5) { if (unlockAchievement('focus_chain_5')) unlocked.push('focus_chain_5') }
    if (streakDays + 1 >= 3)  unlockAchievement('streak_3')
    if (streakDays + 1 >= 7)  { if (unlockAchievement('streak_7')) unlocked.push('streak_7') }
    setUnlockedAchievements(unlocked)

    if (soundEnabled) audioPlayer.playPop()
    if (confettiEnabled) {
      confetti({ particleCount: 80 + xp, spread: 90, origin: { x: 0.5, y: 0.4 } })
    }

    setDone(true)
  }, [
    task, mode, earlyBonus, completedSubtaskCount,
    isLockedIn, lockOut, completeTask, awardXP, addDailyStat, addFocusSession,
    todayCount, focusStreak, streakDays, unlockAchievement,
    soundEnabled, confettiEnabled, currentSessionElapsed,
  ])

  const handleSkip = () => {
    audioPlayer.stopTimerAlert()
    setTimerActive(false)
    if (isLockedIn) lockOut()
    setSkipped(true)
    setDone(true)
  }

  const elapsedSeconds = accumulatedTrackedSeconds + currentSessionElapsed
  const timeProgress = totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0
  const circumference = 2 * Math.PI * 60

  const modeInfo = FOCUS_MODES[mode]

  // Low energy banner
  const showEnergyBanner = currentEnergy !== null && currentEnergy <= 3 && !started

  // ── Completion screen ──────────────────────────────────────────────────────
  if (done) {
    const achievementMap = {
      first_task:      { emoji: '🌟', label: 'First Task!' },
      deadline_dodger: { emoji: '⚡', label: 'Deadline Dodger' },
      focus_chain_5:   { emoji: '🔥', label: 'In The Zone' },
      streak_7:        { emoji: '🗓️', label: 'Week Warrior' },
    }
    return (
      <motion.div
        key="done"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          className="text-center px-8 max-w-sm mx-auto"
        >
          <div className="text-6xl mb-4">{skipped ? '⏭️' : '🎉'}</div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {skipped ? 'Session Skipped' : 'Task Complete!'}
          </h2>
          <p className="text-gray-400 text-sm mb-6 truncate max-w-xs mx-auto">{task.text}</p>

          {!skipped && (
            <>
              <div className="text-4xl font-bold text-yellow-400 mb-1">+{earnedXP} XP</div>
              {earlyBonus && <p className="text-green-400 text-xs mb-2">⚡ Early completion bonus!</p>}
              {mode !== 'normal' && (
                <p className="text-blue-400 text-xs mb-2">{modeInfo.emoji} {modeInfo.label} mode ×{modeInfo.xpMult} XP</p>
              )}
              {unlockedAchievements.length > 0 && (
                <div className="flex gap-2 justify-center flex-wrap mt-3 mb-4">
                  {unlockedAchievements.map((key) => {
                    const a = achievementMap[key]
                    if (!a) return null
                    return (
                      <span key={key} className="px-3 py-1 bg-yellow-900/50 text-yellow-300 rounded-full text-xs font-medium border border-yellow-700/50">
                        {a.emoji} {a.label}
                      </span>
                    )
                  })}
                </div>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-base transition-colors"
          >
            Done
          </button>
        </motion.div>
      </motion.div>
    )
  }

  // ── Main runner ────────────────────────────────────────────────────────────
  return (
    <motion.div
      key="runner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${prioMeta.color} border-gray-700`}>
          {prioMeta.emoji} {prioMeta.label}
        </span>
        <button
            onClick={() => { audioPlayer.stopTimerAlert(); if (isLockedIn) lockOut(); onClose() }}
          className="text-gray-600 hover:text-gray-300 text-xl leading-none transition-colors"
          aria-label="Close task runner"
        >
          ✕
        </button>
      </div>

      {/* Energy banner (pre-start, low energy) */}
      <AnimatePresence>
        {showEnergyBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mx-5 mb-2 px-3 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs"
          >
            🔋 Low energy detected — consider <strong>Sprint</strong> mode for a shorter session.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">

        {/* Mode selector (pre-start) */}
        {!started && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <p className="text-gray-500 text-sm mb-3 text-center">Select focus mode</p>
            <div className="flex gap-2 justify-center">
              {Object.entries(FOCUS_MODES).map(([key, m]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    mode === key
                      ? 'bg-blue-600 border-blue-500 text-white scale-105'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <div>{m.emoji} {m.label}</div>
                  <div className="text-xs font-normal opacity-70 mt-0.5">{m.desc}</div>
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
              stroke={secondsLeft < 60 ? '#ef4444' : mode === 'sprint' ? '#f59e0b' : mode === 'deep' ? '#8b5cf6' : '#3b82f6'}
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
            {overtime && <span className="text-red-400 text-xs mt-0.5">Overtime</span>}
          </div>
        </div>

        {/* Task info */}
        <h2 className="text-xl font-bold text-white mb-1 leading-snug text-center max-w-sm">{task.text}</h2>
        <p className="text-gray-500 text-sm mb-1">
          {allocatedMins}m · +{previewXP} XP
          {earlyBonus && <span className="text-green-400 ml-1">⚡</span>}
        </p>
        {subtasks.length > 0 && (
          <p className="text-gray-600 text-xs mb-4">
            📋 {completedSubtaskCount}/{subtasks.length} subtasks
          </p>
        )}

        {/* Action buttons */}
        {!started ? (
          <button
            onClick={handleStart}
            className="mt-4 px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg"
          >
            {accumulatedTrackedSeconds > 0 ? '▶ Resume Session' : '▶ Start Session'}
          </button>
        ) : (
          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={handleComplete}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg"
            >
              ✓ Done
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
            onClick={handlePauseToggle}
            className="mt-4 text-gray-600 hover:text-gray-400 text-sm transition-colors"
          >
            {timerActive ? '⏸ Pause' : overtime ? '▶ Continue' : '▶ Resume'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
