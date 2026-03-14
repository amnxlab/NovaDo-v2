import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import useSettingsStore from '../store/settingsStore'

const getDaysUntil = (dueDateISO) => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDateISO)
  due.setHours(0, 0, 0, 0)
  return Math.round((due - now) / 86400000)
}

const DueBadge = ({ days, deadlineType }) => {
  if (days < 0)
    return <span className="text-xs font-bold text-red-400 animate-pulse">{Math.abs(days)}d overdue</span>
  if (days === 0)
    return <span className="text-xs font-bold text-orange-400">Due today</span>
  if (days === 1)
    return <span className="text-xs font-bold text-yellow-400">Tomorrow</span>
  return (
    <span className={`text-xs ${deadlineType === 'hard' ? 'text-red-300' : 'text-gray-400'}`}>
      {days}d left
    </span>
  )
}

const TimelineDock = () => {
  const { tasks } = useTasksStore()
  const { timelineDockVisible } = useSettingsStore()

  if (!timelineDockVisible) return null

  const upcoming = tasks
    .filter((t) => !t.completedAt && t.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6)

  if (upcoming.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="fixed top-16 right-4 z-30 w-60 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-3"
      >
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
          📅 Timeline
        </h3>
        <ul className="space-y-1">
          {upcoming.map((task) => {
            const days = getDaysUntil(task.dueDate)
            const prioMeta = PRIORITIES[task.priority] ?? PRIORITIES.medium
            const isOverdue = days < 0
            return (
              <motion.li
                key={task.id}
                layout
                className={`flex items-start gap-2 p-2 rounded-lg cursor-default transition-colors ${
                  isOverdue
                    ? 'bg-red-900/30 border border-red-700/50'
                    : 'bg-gray-800/60 hover:bg-gray-800'
                }`}
              >
                <span className="mt-0.5 text-sm">{prioMeta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium text-white truncate ${isOverdue ? 'line-through opacity-70' : ''}`}>
                    {task.text}
                  </p>
                  <DueBadge days={days} deadlineType={task.deadlineType} />
                </div>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>
    </AnimatePresence>
  )
}

export default TimelineDock
