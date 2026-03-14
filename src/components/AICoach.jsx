import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAICoachStore, { generateSuggestion, selectNextTask } from '../store/aiCoachStore'
import useTasksStore from '../store/tasksStore'
import useXPStore from '../store/xpStore'
import useEmotionStore from '../store/emotionStore'
import useSettingsStore from '../store/settingsStore'
import useRoadmapsStore from '../store/roadmapsStore'
import useRoutinesStore from '../store/routinesStore'

const typeColors = {
  celebrate: 'border-green-500 text-green-300',
  warning:   'border-yellow-500 text-yellow-300',
  calm:      'border-blue-500 text-blue-300',
  energy:    'border-cyan-500 text-cyan-300',
  momentum:  'border-purple-500 text-purple-300',
  roadmap:   'border-indigo-500 text-indigo-300',
  nudge:     'border-gray-500 text-gray-300',
}

const AICoach = () => {
  const { suggestions, addSuggestion, autopilotEnabled, setAutopilot, dismissLatest } = useAICoachStore()
  const { tasks } = useTasksStore()
  const { focusStreak, taskChains } = useXPStore()
  const { currentMood, currentEnergy } = useEmotionStore()
  const { autopilotEnabled: settingsAutopilot } = useSettingsStore()
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const routines = useRoutinesStore((s) => s.routines)
  const [showHistory, setShowHistory] = useState(false)

  const context = { focusStreak, taskChains, currentMood, currentEnergy, roadmaps, routines }

  const handleSuggest = () => {
    const result = generateSuggestion(tasks, context)
    addSuggestion(result.text, result.type)
  }

  const handleAutopilot = () => {
    const next = selectNextTask(tasks, context)
    if (!next) {
      addSuggestion('🤖 No tasks to autopilot — add tasks or schedule roadmap modules for today!', 'nudge')
      return
    }

    // Check if it's a roadmap module task
    const todayStr = new Date().toISOString().slice(0, 10)
    const linkedModule = roadmaps
      .flatMap((r) => r.courses.flatMap((c) => c.modules.map((m) => ({ m, c, r }))))
      .find(({ m }) => m.taskId === next.id && m.scheduledDate === todayStr)

    if (linkedModule) {
      addSuggestion(
        `🧭 Autopilot → 📚 "${linkedModule.m.title}" from ${linkedModule.c.name}. Open Roadmaps to start the learning session.`,
        'roadmap'
      )
    } else {
      addSuggestion(
        `🧭 Autopilot → "${next.text}" (${next.priority} priority). Lock in and start!`,
        'nudge'
      )
    }
    setAutopilot(true, next.id)
  }

  const latest = suggestions.length > 0 ? suggestions[suggestions.length - 1] : null
  const latestColor = latest ? (typeColors[latest.type] ?? typeColors.nudge) : typeColors.nudge

  return (
    <>
    <div className="fixed bottom-52 right-4 z-50 w-72">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleSuggest}
          className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center text-sm"
        >
          <span className="mr-1">🤖</span>
          Coach
        </button>
        <button
          onClick={handleAutopilot}
          className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg transition-colors text-sm"
          title="ADHD Autopilot — pick the best next task"
        >
          🧭 Autopilot
        </button>
      </div>

      <AnimatePresence mode="wait">
        {latest && (
          <motion.div
            key={latest.suggestion + latest.type}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className={`mt-2 bg-gray-900 border-l-2 p-3 pr-7 rounded-lg relative ${latestColor}`}
          >
            <button
              onClick={dismissLatest}
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-300 text-base leading-none transition-colors"
              aria-label="Dismiss"
            >×</button>
            <p className="text-sm leading-snug">{latest.suggestion}</p>
            {suggestions.length > 1 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-gray-500 hover:text-gray-300 mt-1 transition-colors"
              >
                {showHistory ? 'Hide' : `+${suggestions.length - 1} more`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && suggestions.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1 bg-gray-900 border border-gray-700 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
              {[...suggestions].reverse().slice(1).map((s, i) => (
                <p key={i} className="text-xs text-gray-500">{s.suggestion}</p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  )
}

export default AICoach
