import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import useXPStore, { calcTaskXP, ACHIEVEMENTS } from '../store/xpStore'
import useSettingsStore from '../store/settingsStore'
import useAnalyticsStore from '../store/analyticsStore'
import useNotificationStore from '../store/notificationStore'
import { audioPlayer } from '../utils/audio'
import { suggestSubtasks, isPastDue } from '../utils/autoTagger'
import useTagsStore from '../store/tagsStore'
import confetti from 'canvas-confetti'

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function formatDueDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due - now) / 86400000)
  if (diffDays < 0)  return { label: `${Math.abs(diffDays)}d overdue`, urgent: true }
  if (diffDays === 0) return { label: 'Due today', urgent: true }
  if (diffDays === 1) return { label: 'Due tomorrow', urgent: false }
  return { label: `Due in ${diffDays}d`, urgent: false }
}

const TaskCard = ({ task, onRun, onFocus, dailyWins }) => {
  const { completeTask, deleteTask, addSubtask, completeSubtask, updateTask, lockedTaskId, lockIn, lockOut, uncompleteTask } = useTasksStore()
  const { awardXP, unlockAchievement, todayCount, focusStreak, streakDays, deductXP } = useXPStore()
  const { soundEnabled, confettiEnabled } = useSettingsStore()
  const { tags: TAG_DEFINITIONS } = useTagsStore()
  const { addFocusSession, addDailyStat } = useAnalyticsStore()
  const { addNotification } = useNotificationStore()
  const [showSubtasks, setShowSubtasks] = useState(false)
  const [showEmotionPrompt, setShowEmotionPrompt] = useState(false)

  const isLockedIn = lockedTaskId === task.id
  const totalSeconds = task.timeSpent || 0

  const prioMeta = PRIORITIES[task.priority] ?? PRIORITIES.medium
  const dueInfo = formatDueDate(task.dueDate)
  const isOverdue = task.dueDate && isPastDue(task.dueDate) && !task.completedAt
  const subtasks = task.subtasks ?? []
  const completedSubtaskCount = subtasks.filter((s) => s.completedAt).length

  const handleComplete = (e) => {
    e.stopPropagation()
    if (task.completedAt) return
    if (isLockedIn) lockOut()
    completeTask(task.id)

    // Calculate XP
    const earlyBonus = task.dueDate ? !isPastDue(task.dueDate) : false
    const xp = calcTaskXP({ priority: task.priority, earlyBonus, subtaskCount: completedSubtaskCount })
    awardXP(xp, task.id)
    // Persist XP amount on the task so it can be reversed on uncomplete
    updateTask(task.id, { _xpGranted: xp })
    addDailyStat(1, 0, 0)

    // ── Achievement checks ─────────────────────────────────────────────────
    const { increment, markDailyComposite, streakDays } = useXPStore.getState()

    // Task count milestones
    const totalDone = increment('totalTasksDone')
    if (totalDone === 1)   unlockAchievement('first_task')
    if (totalDone >= 5)    unlockAchievement('tasks_5')
    if (totalDone >= 10)   unlockAchievement('tasks_10')
    if (totalDone >= 25)   unlockAchievement('tasks_25')
    if (totalDone >= 50)   unlockAchievement('tasks_50')
    if (totalDone >= 100)  unlockAchievement('tasks_100')
    if (totalDone >= 250)  unlockAchievement('tasks_250')
    if (totalDone >= 500)  unlockAchievement('tasks_500')
    if (totalDone >= 1000) unlockAchievement('tasks_1000')

    // Day streak achievements
    const newStreak = useXPStore.getState().streakDays
    if (newStreak >= 3)   unlockAchievement('streak_3')
    if (newStreak >= 7)   unlockAchievement('streak_7')
    if (newStreak >= 14)  unlockAchievement('streak_14')
    if (newStreak >= 30)  unlockAchievement('streak_30')
    if (newStreak >= 60)  unlockAchievement('streak_60')
    if (newStreak >= 100) unlockAchievement('streak_100')

    // Early + focus chain achievements
    if (earlyBonus) {
      const early = increment('earlyCompletions')
      unlockAchievement('deadline_dodger')
      if (early >= 5)   unlockAchievement('early_5')
      if (early >= 25)  unlockAchievement('early_25')
      if (early >= 100) unlockAchievement('early_100')
    }
    if (task.deadlineType === 'hard' && earlyBonus) unlockAchievement('hard_deadline')

    // Focus chain
    const { focusStreak: newFocusStreak } = useXPStore.getState()
    if (newFocusStreak >= 5)  unlockAchievement('focus_chain_5')
    if (newFocusStreak >= 10) unlockAchievement('focus_chain_10')
    if (newFocusStreak >= 25) unlockAchievement('focus_chain_25')

    // Time-of-day surprise achievements
    const hour = new Date().getHours()
    if (hour < 8)  unlockAchievement('early_bird')
    if (hour >= 22) unlockAchievement('night_owl')

    // Weekend warrior
    const dow = new Date().getDay()
    if (dow === 0 || dow === 6) {
      // count weekend tasks today
      const todayDow = new Date(); todayDow.setHours(0,0,0,0)
      const weekendToday = useXPStore.getState().todayCount
      if (weekendToday >= 5) unlockAchievement('weekend_warrior')
    }

    // Daily composite (task + routine + module same day)
    const composite = markDailyComposite('task')
    if (composite.task && composite.routine && composite.module) unlockAchievement('triple_category')

    // Tags
    const tagSet = new Set((task.tags ?? []))
    if (tagSet.size >= 3) unlockAchievement('tag_organizer')

    if (todayCount === 0) unlockAchievement('first_task')

    if (soundEnabled) audioPlayer.playPop()
    if (confettiEnabled) {
      confetti({
        particleCount: 80 + xp,
        spread: 90,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
      })
    }
    addNotification(`+${xp} XP${earlyBonus ? ' ⚡ Early bonus!' : ''}`, 'success')
  }


  const handleSplit = (e) => {
    e.stopPropagation()
    const suggested = suggestSubtasks(task.text)
    suggested.forEach((text) => addSubtask(task.id, text))
    setShowSubtasks(true)
    addNotification(`Split into ${suggested.length} subtasks 🧩`, 'info')
  }

  const handleSubtaskComplete = (e, subtaskId) => {
    e.stopPropagation()
    completeSubtask(task.id, subtaskId)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteTask(task.id)
  }

  const handlePriorityChange = (e, newPriority) => {
    e.stopPropagation()
    updateTask(task.id, { priority: newPriority })
  }

  const borderClass = isOverdue
    ? 'border-l-4 border-red-500 animate-pulse'
    : task.dueDate
    ? `border-l-4 ${prioMeta.border}`
    : ''

  // ── Compact "past station" view for completed tasks ───────────────────────
  if (task.completedAt) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.22 }}
        className="group flex items-center gap-2 px-3 py-1.5 mb-1 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 overflow-hidden"
        role="article"
        aria-label={`Completed: ${task.text}`}
      >
        {/* Green checkmark dot */}
        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_6px_rgba(34,197,94,0.4)]">
          <span className="text-[9px] text-white font-bold leading-none">✓</span>
        </div>
        {/* Task text */}
        <p className="flex-1 min-w-0 text-xs text-gray-500 line-through truncate">{task.text}</p>
        {/* Time spent */}
        {(task.timeSpent || 0) > 0 && (
          <span className="flex-shrink-0 text-[10px] text-gray-600 font-mono">{formatTime(task.timeSpent)}</span>
        )}
        {/* Undo button — revealed on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            uncompleteTask(task.id)
            if (task._xpGranted > 0) deductXP(task._xpGranted)
          }}
          title="Mark as incomplete"
          className="flex-shrink-0 text-[10px] text-gray-600 hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-all px-1.5 py-0.5 rounded hover:bg-orange-400/10"
        >
          ↩
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2 }}
      layout
      role="article"
      aria-label={task.text}
      className={`p-4 mb-3 rounded-lg bg-gray-800 ${borderClass}`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Completion checkbox */}
        <button
          onClick={handleComplete}
          aria-label="Mark as complete"
          className="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all border-gray-500 hover:border-blue-400"
        />

        {/* Task text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium break-words">
            {task.text}
          </p>

          {/* Meta row: priority, tags, due date */}
          <div className="flex flex-wrap gap-1 mt-1 items-center">
            <span className={`text-xs font-medium ${prioMeta.color}`}>{prioMeta.emoji} {prioMeta.label}</span>

            {(task.tags ?? []).map((tag) => {
              const def = TAG_DEFINITIONS[tag]
              if (!def) return null
              return (
                <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${def.color} text-white`}>
                  {def.emoji}
                </span>
              )
            })}

            {/* Daily Win badge */}
            {dailyWins?.taskIds?.includes(task.id) && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-800/60 text-yellow-300 font-semibold">
                🏆 Win
              </span>
            )}

            {dueInfo && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                dueInfo.urgent ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-300'
              }`}>
                📅 {dueInfo.label} {task.deadlineType === 'hard' ? '🔒' : ''}
              </span>
            )}

            {subtasks.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowSubtasks((p) => !p) }}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                📋 {completedSubtaskCount}/{subtasks.length}
              </button>
            )}

            {totalSeconds > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-mono bg-gray-700 text-gray-400">
                ⏱ {formatTime(totalSeconds)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Subtask list */}
      <AnimatePresence>
        {showSubtasks && subtasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 ml-8 space-y-1 overflow-hidden"
          >
            {subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={(e) => handleSubtaskComplete(e, s.id)}
                  disabled={!!s.completedAt}
                  className={`w-4 h-4 rounded-full border flex-shrink-0 transition-all ${
                    s.completedAt ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-blue-400'
                  }`}
                />
                <span className={`text-sm ${s.completedAt ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                  {s.text}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {!task.completedAt && (
        <div className="flex gap-2 mt-3 ml-8">
          <button
            onClick={(e) => { e.stopPropagation(); onRun?.(task) }}
            className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-medium transition-all"
          >
            ▶ Run
          </button>
          {onFocus && (
            <button
              onClick={(e) => { e.stopPropagation(); onFocus(task) }}
              className="px-2 py-1 bg-purple-800 hover:bg-purple-700 text-white rounded text-xs font-medium transition-all"
            >
              🎯 Focus
            </button>
          )}
          {subtasks.length === 0 && (
            <button
              onClick={handleSplit}
              className="px-2 py-1 bg-purple-700 text-white rounded text-xs hover:bg-purple-600 transition-colors"
            >
              🧩 Split
            </button>
          )}
          {subtasks.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowSubtasks((p) => !p) }}
              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors"
            >
              {showSubtasks ? 'Hide' : 'Subtasks'}
            </button>
          )}
          {/* Priority quick-change */}
          {Object.entries(PRIORITIES).map(([key, meta]) => (
            <button
              key={key}
              onClick={(e) => handlePriorityChange(e, key)}
              title={`Set ${meta.label}`}
              className={`text-sm transition-opacity ${task.priority === key ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}
            >
              {meta.emoji}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="ml-auto px-2 py-1 bg-red-800 text-white rounded text-xs hover:bg-red-700 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </motion.div>
  )
}

export default TaskCard