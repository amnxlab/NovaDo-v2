import { useEffect } from 'react'
import { motion } from 'framer-motion'
import useAICoachStore, { generateSuggestion, selectNextTask } from '../store/aiCoachStore'
import useTasksStore from '../store/tasksStore'
import useXPStore from '../store/xpStore'
import useEmotionStore from '../store/emotionStore'
import useRoadmapsStore from '../store/roadmapsStore'
import useRoutinesStore from '../store/routinesStore'
import useNotificationStore from '../store/notificationStore'

const AICoach = () => {
  const { suggestions, addSuggestion, setAutopilot, dismissLatest } = useAICoachStore()
  const { tasks } = useTasksStore()
  const { focusStreak, taskChains } = useXPStore()
  const { currentMood, currentEnergy } = useEmotionStore()
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const routines = useRoutinesStore((s) => s.routines)
  const { addNotification } = useNotificationStore()

  const context = { focusStreak, taskChains, currentMood, currentEnergy, roadmaps, routines }

  // Route new suggestions to the notification center as top-right toasts
  const latestSuggestion = suggestions[suggestions.length - 1]
  useEffect(() => {
    if (!latestSuggestion) return
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

  return (
    <>
      {/* 🤖 Coach circular button */}
      <motion.button
        onClick={handleSuggest}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="AI Coach — get a suggestion"
        className="fixed bottom-[14.5rem] right-4 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center justify-center text-xl transition-colors"
      >
        🤖
      </motion.button>

      {/* 🧭 Autopilot circular button */}
      <motion.button
        onClick={handleAutopilot}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="ADHD Autopilot — pick best next task"
        className="fixed bottom-[19rem] right-4 z-50 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center text-xl transition-colors"
      >
        🧭
      </motion.button>
    </>
  )
}

export default AICoach
