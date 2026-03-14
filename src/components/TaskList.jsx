import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import useSettingsStore from '../store/settingsStore'
import useAICoachStore from '../store/aiCoachStore'
import useXPStore from '../store/xpStore'
import useEmotionStore from '../store/emotionStore'
import TaskCard from './TaskCard'
import useTagsStore from '../store/tagsStore'
import { generateSuggestion } from '../store/aiCoachStore'

const SORT_OPTIONS = [
  { value: 'priority', label: '⚡ Priority' },
  { value: 'due',      label: '📅 Due date' },
  { value: 'created',  label: '🕐 Added'    },
]

const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }

const TaskList = ({ onRunTask }) => {
  const { tasks } = useTasksStore()
  const { autopilotEnabled } = useSettingsStore()
  const { addSuggestion } = useAICoachStore()
  const { focusStreak, taskChains } = useXPStore()
  const { currentMood, currentEnergy } = useEmotionStore()
  const { tags: TAG_DEFINITIONS } = useTagsStore()

  const [sortBy, setSortBy] = useState('priority')
  const [filterPriority, setFilterPriority] = useState(null) // null = all
  const [filterTag, setFilterTag] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const activeTasks = useMemo(() => {
    let list = tasks.filter((t) => !t.completedAt)
    if (filterPriority) list = list.filter((t) => t.priority === filterPriority)
    if (filterTag) list = list.filter((t) => (t.tags ?? []).includes(filterTag))
    if (sortBy === 'priority') {
      list = [...list].sort((a, b) => (priorityOrder[b.priority] ?? 2) - (priorityOrder[a.priority] ?? 2))
    } else if (sortBy === 'due') {
      list = [...list].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate) - new Date(b.dueDate)
      })
    } else {
      list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return list
  }, [tasks, sortBy, filterPriority, filterTag])

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.completedAt).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)),
    [tasks]
  )

  // Tags that currently have tasks
  const activeTags = useMemo(() => {
    const tagSet = new Set()
    tasks.filter((t) => !t.completedAt).forEach((t) => (t.tags ?? []).forEach((tag) => tagSet.add(tag)))
    return [...tagSet]
  }, [tasks])

  const handleCoachSuggest = () => {
    const { text, type } = generateSuggestion(tasks, { focusStreak, taskChains, currentMood, currentEnergy })
    addSuggestion(text, type)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`text-xs px-2 py-1 rounded-md transition-all ${
                sortBy === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          {/* Priority filters */}
          {Object.entries(PRIORITIES).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setFilterPriority(filterPriority === key ? null : key)}
              title={meta.label}
              className={`text-sm px-2 py-1 rounded-md transition-all ${
                filterPriority === key ? 'bg-gray-600 scale-110' : 'bg-gray-800 opacity-50 hover:opacity-80'
              }`}
            >
              {meta.emoji}
            </button>
          ))}
          {/* Tag filters */}
          {activeTags.map((tag) => {
            const def = TAG_DEFINITIONS[tag]
            if (!def) return null
            return (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`text-xs px-2 py-1 rounded-full transition-all ${
                  filterTag === tag ? def.color + ' text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {def.emoji}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active tasks */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">
          Active
          {activeTasks.length > 0 && (
            <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{activeTasks.length}</span>
          )}
        </h2>
        {activeTasks.length > 0 && (
          <button onClick={handleCoachSuggest} className="text-xs text-blue-400 hover:text-blue-300">🤖 What next?</button>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {activeTasks.length > 0 ? (
          activeTasks.map((task) => <TaskCard key={task.id} task={task} onRun={onRunTask} />)
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-10"
          >
            <div className="text-4xl mb-2">{filterPriority || filterTag ? '🔍' : '✨'}</div>
            <p className="text-gray-400 text-sm">
              {filterPriority || filterTag
                ? 'No tasks match this filter.'
                : "All clear! Add a task above to get started."}
            </p>
            {(filterPriority || filterTag) && (
              <button
                onClick={() => { setFilterPriority(null); setFilterTag(null) }}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completed section */}
      {completedTasks.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1 mb-2"
          >
            {showCompleted ? '▾' : '▸'} Done ({completedTasks.length})
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {completedTasks.map((task) => <TaskCard key={task.id} task={task} />)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default TaskList