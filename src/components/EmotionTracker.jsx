import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useEmotionStore from '../store/emotionStore'

const EMOTIONS = [
  { key: '😊 Happy',       label: 'Happy',       emoji: '😊', color: 'bg-green-700  hover:bg-green-600'  },
  { key: '😐 Neutral',     label: 'Neutral',     emoji: '😐', color: 'bg-gray-600   hover:bg-gray-500'   },
  { key: '😕 Anxious',     label: 'Anxious',     emoji: '😕', color: 'bg-yellow-700 hover:bg-yellow-600' },
  { key: '😖 Overwhelmed', label: 'Overwhelmed', emoji: '😖', color: 'bg-red-800    hover:bg-red-700'    },
]

const EmotionTracker = ({ taskId, onComplete }) => {
  const { addEmotion } = useEmotionStore()
  const [selectedEmotion, setSelectedEmotion] = useState(null)
  const [selectedEnergy, setSelectedEnergy] = useState(null)

  const handleSubmit = () => {
    addEmotion(taskId, selectedEmotion ?? '😐 Neutral', selectedEnergy ?? 5)
    onComplete()
  }

  const canSubmit = selectedEmotion !== null || selectedEnergy !== null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl"
      >
        <h3 className="text-base font-bold text-white mb-1">Quick check-in 🧠</h3>
        <p className="text-xs text-gray-500 mb-4">How are you feeling right now?</p>

        {/* Mood */}
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Mood</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {EMOTIONS.map(({ key, label, emoji, color }) => (
            <button
              key={key}
              onClick={() => setSelectedEmotion(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedEmotion === key
                  ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900 ' + color.split(' ')[0]
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span className={selectedEmotion === key ? 'text-white' : ''}>{label}</span>
            </button>
          ))}
        </div>

        {/* Energy */}
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Energy</p>
        <div className="grid grid-cols-5 gap-1.5 mb-5">
          {[1,2,3,4,5,6,7,8,9,10].map((level) => (
            <button
              key={level}
              onClick={() => setSelectedEnergy(level)}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedEnergy === level
                  ? 'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1 ring-offset-gray-900'
                  : level <= 3
                    ? 'bg-gray-800 text-red-400 hover:bg-gray-700'
                    : level <= 6
                      ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                      : 'bg-gray-800 text-green-400 hover:bg-gray-700'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Save
          </button>
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm rounded-lg transition-colors"
          >
            Skip
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default EmotionTracker