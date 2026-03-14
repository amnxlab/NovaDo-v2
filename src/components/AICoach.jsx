import { useEffect, useRef } from 'react'
import useAICoachStore, { generateSuggestion, selectNextTask } from '../store/aiCoachStore'
import useTasksStore from '../store/tasksStore'
import useXPStore from '../store/xpStore'
import useEmotionStore from '../store/emotionStore'
import useRoadmapsStore from '../store/roadmapsStore'
import useRoutinesStore from '../store/routinesStore'
import useNotificationStore from '../store/notificationStore'

/**
 * AICoach — headless logic component.
 * Buttons are rendered by the unified FAB dock in Layout.jsx.
 * Exposes `onSuggest` / `onAutopilot` callbacks via props so Layout can wire them up.
 */
const AICoach = ({ onRegisterActions }) => {
  const { suggestions, addSuggestion, setAutopilot } = useAICoachStore()
  const { tasks } = useTasksStore()
  const { focusStreak, taskChains } = useXPStore()
  const { currentMood, currentEnergy } = useEmotionStore()
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const routines = useRoutinesStore((s) => s.routines)
  const { addNotification } = useNotificationStore()

  const context = { focusStreak, taskChains, currentMood, currentEnergy, roadmaps, routines }

  // Route new suggestions to the notification center as top-right toasts.
  // sessionStorage tracks the last suggestion text that was already shown so
  // Zustand rehydration on reload never re-fires a stale notification.
  const latestSuggestion = suggestions[suggestions.length - 1]
  const lastNotifiedRef = useRef(sessionStorage.getItem('lastCoachNotif') ?? null)
  useEffect(() => {
    if (!latestSuggestion) return
    if (latestSuggestion.suggestion === lastNotifiedRef.current) return
    lastNotifiedRef.current = latestSuggestion.suggestion
    sessionStorage.setItem('lastCoachNotif', latestSuggestion.suggestion)
    addNotification(latestSuggestion.suggestion, 'info', 8000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestSuggestion?.suggestion])

  const handleSuggest = () => {
    const result = generateSuggestion(tasks, context)
    addSuggestion(result.text, result.type)
  }

  const handleAutopilot = () => {
    const next = selectNextTask(tasks, context)
    if (!next) {
      addNotification('🤖 No tasks to autopilot — add tasks or schedule roadmap modules for today!', 'info', 6000)
      return
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const linkedModule = roadmaps
      .flatMap((r) => r.courses.flatMap((c) => c.modules.map((m) => ({ m, c, r }))))
      .find(({ m }) => m.taskId === next.id && m.scheduledDate === todayStr)

    if (linkedModule) {
      addNotification(
        `🧭 Autopilot → 📚 "${linkedModule.m.title}" from ${linkedModule.c.name}. Open Roadmaps to start!`,
        'info', 8000
      )
    } else {
      addNotification(
        `🧭 Autopilot → "${next.text}" (${next.priority} priority). Lock in and start!`,
        'info', 8000
      )
    }
    setAutopilot(true, next.id)
  }

  // Register action handlers with Layout's FAB dock
  useEffect(() => {
    onRegisterActions?.({ suggest: handleSuggest, autopilot: handleAutopilot })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, focusStreak, taskChains, currentMood, currentEnergy, roadmaps, routines])

  return null
}

export default AICoach
