import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import { analyseTask } from '../utils/autoTagger'
import useTagsStore from '../store/tagsStore'

const prompts = [
  "What's the one thing right now?",
  "Drop it here…",
  "What needs to happen?",
  "Let's get this done!",
  "What would make today a win?",
]

const DATE_SHORTCUTS = [
  { label: 'Today',     offset: 0 },
  { label: 'Tomorrow',  offset: 1 },
  { label: 'This week', offset: 6 },
  { label: 'Next week', offset: 13 },
]

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}

function formatDateDisplay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const TaskInput = () => {
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState(null)
  const [deadlineType, setDeadlineType] = useState('soft')
  const [tags, setTags] = useState([])
  const [suggestions, setSuggestions] = useState({ tags: [], priority: null, dueDate: null })
  const [currentPrompt, setCurrentPrompt] = useState(0)
  const inputRef = useRef(null)
  const { addTask } = useTasksStore()
  const { tags: TAG_DEFINITIONS } = useTagsStore()

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Rotate placeholder
  useEffect(() => {
    const id = setInterval(() => setCurrentPrompt((p) => (p + 1) % prompts.length), 5000)
    return () => clearInterval(id)
  }, [])

  // Live auto-tag analysis as user types
  useEffect(() => {
    if (text.length < 3) { setSuggestions({ tags: [], priority: null, dueDate: null }); return }
    const result = analyseTask(text, TAG_DEFINITIONS)
    setSuggestions(result)
    // Auto-apply if nothing manually set
    if (result.priority && priority === 'medium') setPriority(result.priority)
    if (result.dueDate && !dueDate) setDueDate(result.dueDate)
  }, [text])

  const toggleTag = (tag) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  const applySuggestedTags = () => {
    setTags((prev) => [...new Set([...prev, ...suggestions.tags])])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const finalTags = tags.length ? tags : suggestions.tags
    addTask(text.trim(), { priority, dueDate, deadlineType, tags: finalTags })
    setText('')
    setPriority('medium')
    setDueDate(null)
    setDeadlineType('soft')
    setTags([])
    setSuggestions({ tags: [], priority: null, dueDate: null })
    setExpanded(false)
    inputRef.current?.focus()
  }

  const prioMeta = PRIORITIES[priority]

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ scale: 1 }}
      animate={{ scale: text ? 1.01 : 1 }}
      transition={{ type: 'spring', stiffness: 500 }}
      className="mb-6"
    >
      {/* Main input row */}
      <div className="flex gap-2 items-center">
        <label htmlFor="task-input" className="sr-only">Add a new task</label>
        <motion.input
          id="task-input"
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); if (!expanded && e.target.value) setExpanded(true) }}
          onFocus={() => text && setExpanded(true)}
          placeholder={prompts[currentPrompt]}
          aria-label="Add a new task"
          className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-all"
          whileFocus={{ scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 500 }}
        />
        {/* Priority quick-selector */}
        <div className="flex gap-1">
          {Object.entries(PRIORITIES).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              title={meta.label}
              onClick={() => setPriority(key)}
              className={`text-lg px-2 py-2 rounded-lg transition-all ${priority === key ? 'bg-gray-600 scale-110' : 'bg-gray-800 opacity-50 hover:opacity-80'}`}
            >
              {meta.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded options */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-3 rounded-lg bg-gray-800/60 border border-gray-700 space-y-3">
              {/* Auto-tag suggestions */}
              {suggestions.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-400">Suggested:</span>
                  {suggestions.tags.map((tag) => {
                    const def = TAG_DEFINITIONS[tag]
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-all ${tags.includes(tag) ? def.color + ' text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        {def.emoji} {def.label}
                      </button>
                    )
                  })}
                  {suggestions.tags.length > 0 && !suggestions.tags.every((t) => tags.includes(t)) && (
                    <button type="button" onClick={applySuggestedTags} className="text-xs text-blue-400 hover:text-blue-300">Apply all</button>
                  )}
                </div>
              )}

              {/* Manual tag picker */}
              <div className="flex flex-wrap gap-1">
                {Object.entries(TAG_DEFINITIONS).map(([key, def]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTag(key)}
                    className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-all ${tags.includes(key) ? def.color + ' text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {def.emoji} {def.label}
                  </button>
                ))}
              </div>

              {/* Due date shortcuts */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-xs text-gray-400">Due:</span>
                {DATE_SHORTCUTS.map(({ label, offset }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDueDate(dueDate === offsetDate(offset) ? null : offsetDate(offset))}
                    className={`text-xs px-2 py-1 rounded-md transition-all ${dueDate === offsetDate(offset) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="date"
                  aria-label="Custom due date"
                  value={dueDate ? new Date(dueDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => {
                    if (!e.target.value) { setDueDate(null); return }
                    const d = new Date(e.target.value)
                    d.setHours(23, 59, 0, 0)
                    setDueDate(d.toISOString())
                  }}
                  className="text-xs px-2 py-1 rounded-md bg-gray-700 text-gray-300 border border-gray-600 focus:outline-none focus:border-blue-500"
                />
                {dueDate && (
                  <div className="flex gap-1">
                    {['soft', 'hard'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setDeadlineType(type)}
                        className={`text-xs px-2 py-1 rounded-md capitalize transition-all ${deadlineType === type ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-400'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary + submit */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  {prioMeta.emoji} {prioMeta.label}
                  {dueDate ? ` · 📅 ${formatDateDisplay(dueDate)} (${deadlineType})` : ''}
                  {tags.length ? ` · ${tags.map((t) => TAG_DEFINITIONS[t]?.emoji).join(' ')}` : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setExpanded(false); setText(''); setSuggestions({ tags: [], priority: null, dueDate: null }) }}
                    className="text-xs px-3 py-1 rounded-md bg-gray-700 text-gray-400 hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-500 font-medium"
                  >
                    Add task
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  )
}

export default TaskInput