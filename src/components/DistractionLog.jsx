import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useDistractionStore from '../store/distractionStore'

const CATEGORY_META = {
  'social-media': { emoji: '📱', label: 'Social Media', color: 'bg-blue-700/40' },
  'phone':        { emoji: '📞', label: 'Phone',        color: 'bg-green-700/40' },
  'people':       { emoji: '🗣️', label: 'People',       color: 'bg-yellow-700/40' },
  'thought':      { emoji: '💭', label: 'Thought',      color: 'bg-purple-700/40' },
  'hunger':       { emoji: '🍔', label: 'Hunger',       color: 'bg-orange-700/40' },
  'noise':        { emoji: '🔊', label: 'Noise',        color: 'bg-red-700/40' },
  'other':        { emoji: '❓', label: 'Other',        color: 'bg-gray-700/40' },
}

const DistractionLog = () => {
  const { logs, addLog, removeLog, daySummary } = useDistractionStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('other')
  const [view, setView] = useState('log') // 'log' | 'summary'
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Global shortcut: press 'd' to open distraction log
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'd') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleAdd = () => {
    if (!text.trim()) return
    addLog(text, category)
    setText('')
    setCategory('other')
    inputRef.current?.focus()
  }

  const today = new Date().toISOString().slice(0, 10)
  const todaySummary = daySummary(today)
  const todayLogs = logs.filter((l) => l.timestamp.startsWith(today))

  const formatTime = (iso) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Distraction Log (d)"
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg flex items-center justify-center text-xl transition-colors"
      >
        🚨
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-20 right-4 z-50 w-80 max-h-[32rem] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <h3 className="text-sm font-bold text-rose-400">🚨 Distraction Log</h3>
                <p className="text-[10px] text-gray-500">Notice it, name it, move on</p>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex bg-gray-800 rounded-lg overflow-hidden text-[10px]">
                  <button
                    onClick={() => setView('log')}
                    className={`px-2 py-1 transition-colors ${view === 'log' ? 'bg-rose-700 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Log
                  </button>
                  <button
                    onClick={() => setView('summary')}
                    className={`px-2 py-1 transition-colors ${view === 'summary' ? 'bg-rose-700 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Summary
                  </button>
                </div>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg">×</button>
              </div>
            </div>

            {view === 'log' ? (
              <>
                {/* Category quick-pick */}
                <div className="flex gap-1 px-3 pt-3 pb-1 flex-wrap">
                  {Object.entries(CATEGORY_META).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setCategory(key)}
                      title={meta.label}
                      className={`px-2 py-1 rounded-lg text-xs transition-all border ${
                        category === key
                          ? 'border-rose-500 bg-rose-700/30 text-white'
                          : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:text-white'
                      }`}
                    >
                      {meta.emoji}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="flex gap-2 px-3 py-2 border-b border-gray-800">
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="What distracted you?"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-600"
                  />
                  <button
                    onClick={handleAdd}
                    className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Today's logs */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                  {todayLogs.length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-6">
                      No distractions logged today. 🎯<br />
                      Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 text-[10px]">d</kbd> anytime to log one.
                    </p>
                  ) : (
                    todayLogs.map((log) => {
                      const meta = CATEGORY_META[log.category] || CATEGORY_META.other
                      return (
                        <motion.div
                          key={log.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700/40 group"
                        >
                          <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm ${meta.color}`}>
                            {meta.emoji}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-200 break-words leading-snug">{log.description}</p>
                            <span className="text-[10px] text-gray-600">{formatTime(log.timestamp)}</span>
                          </div>
                          <button
                            onClick={() => removeLog(log.id)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-opacity"
                          >
                            ×
                          </button>
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              /* Summary view */
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                <div className="text-center py-2">
                  <span className="text-3xl font-bold text-white">{todaySummary.total}</span>
                  <p className="text-xs text-gray-500 mt-1">distractions today</p>
                </div>

                {todaySummary.total > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(todaySummary.counts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, count]) => {
                        const meta = CATEGORY_META[cat] || CATEGORY_META.other
                        const pct = Math.round((count / todaySummary.total) * 100)
                        return (
                          <div key={cat} className="flex items-center gap-2">
                            <span className="text-sm w-6 text-center">{meta.emoji}</span>
                            <span className="text-xs text-gray-400 w-20 truncate">{meta.label}</span>
                            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                className="h-full bg-rose-600 rounded-full"
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center">No data yet for today.</p>
                )}

                {/* Tip */}
                {todaySummary.total >= 5 && (
                  <div className="mt-3 p-3 rounded-lg bg-rose-900/20 border border-rose-800/30 text-xs text-rose-300">
                    💡 You've logged {todaySummary.total} distractions. Consider a short break or changing your environment.
                  </div>
                )}
              </div>
            )}

            {/* Footer count */}
            {view === 'log' && todayLogs.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-800 text-center">
                <span className="text-[10px] text-gray-600">{todayLogs.length} today</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default DistractionLog
