import { motion } from 'framer-motion'
import { FOREST_STAGES, getForestStage } from '../store/xpStore'

export default function ForestWidget({ xp }) {
  const stage = getForestStage(xp)
  const stageIdx = FOREST_STAGES.findIndex((s) => s === stage)
  const nextStage = FOREST_STAGES[stageIdx + 1] ?? null

  const progressToNext = nextStage
    ? Math.round(((xp - stage.minXP) / (nextStage.minXP - stage.minXP)) * 100)
    : 100

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-gray-800 p-6 text-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: stageIdx >= 4 ? '#22c55e' : stageIdx >= 2 ? '#84cc16' : '#a3a3a3' }}
        />
      </div>

      {/* Stage progression dots */}
      <div className="flex justify-center gap-1.5 mb-4 relative z-10">
        {FOREST_STAGES.map((s, i) => (
          <div
            key={i}
            title={s.label}
            className={`w-2 h-2 rounded-full transition-all ${
              i < stageIdx ? 'bg-green-500' : i === stageIdx ? 'bg-green-400 scale-125' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Main tree emoji with pulse animation */}
      <motion.div
        key={stageIdx}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-7xl mb-3 relative z-10 select-none"
      >
        {stage.emoji}
      </motion.div>

      {/* Floating particles for higher stages */}
      {stageIdx >= 4 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-green-400/60"
              style={{ left: `${15 + i * 14}%`, top: '70%' }}
              animate={{ y: [-10, -40, -10], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4 }}
            />
          ))}
        </div>
      )}

      {/* Stage name & description */}
      <h3 className="text-white font-bold text-lg mb-1 relative z-10">{stage.label}</h3>
      <p className="text-gray-400 text-sm mb-4 relative z-10">{stage.desc}</p>

      {/* Progress to next stage */}
      {nextStage ? (
        <div className="relative z-10">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{xp} XP</span>
            <span>Next: {nextStage.label} {nextStage.emoji} at {nextStage.minXP} XP</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-400"
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      ) : (
        <p className="text-yellow-400 text-xs font-semibold relative z-10">✨ Maximum stage reached — you are a legend.</p>
      )}
    </div>
  )
}
