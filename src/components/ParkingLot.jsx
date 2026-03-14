import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useParkingLotStore from '../store/parkingLotStore'
import useTasksStore from '../store/tasksStore'

const ParkingLot = ({ open, onClose }) => {
  const { items, addItem, removeItem, markPromoted } = useParkingLotStore()
  const { addTask } = useTasksStore()
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleAdd = () => {
    if (!text.trim()) return
    addItem(text)
    setText('')
    inputRef.current?.focus()
  }

  const handlePromote = (item) => {
    addTask(item.text, { priority: 'medium' })
    markPromoted(item.id)
  }

  const unpromoted = items.filter((i) => !i.promoted)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-32 left-300 z-50 w-80 max-h-[28rem] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-amber-400">💡 Parking Lot</h3>
              <p className="text-[10px] text-gray-500">Dump it here, sort it later</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">×</button>
          </div>

          {/* Quick input */}
          <div className="flex gap-2 px-3 py-3 border-b border-gray-800">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Random thought..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600"
            />
            <button
              onClick={handleAdd}
              className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
            >
              +
            </button>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {unpromoted.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">
                No captured thoughts yet.<br />Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 text-[10px]">i</kbd> anytime to capture.
              </p>
            ) : (
              unpromoted.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-start gap-2 p-2 rounded-lg bg-gray-800/60 border border-gray-700/50 group"
                >
                  <span className="flex-1 text-sm text-gray-200 break-words leading-snug">{item.text}</span>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handlePromote(item)}
                      title="Promote to task"
                      className="w-6 h-6 flex items-center justify-center rounded bg-purple-700/50 hover:bg-purple-600 text-xs transition-colors"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      title="Discard"
                      className="w-6 h-6 flex items-center justify-center rounded bg-red-700/30 hover:bg-red-600 text-xs transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Footer */}
          {unpromoted.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-800 text-center">
              <span className="text-[10px] text-gray-600">{unpromoted.length} thought{unpromoted.length !== 1 ? 's' : ''} parked</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ParkingLot
