import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useXPStore, { ACHIEVEMENTS } from '../store/xpStore'
import useSettingsStore from '../store/settingsStore'

const XPBar = () => {
  const { points, level, streakDays, todayCount, focusStreak, taskChains, recentXPGain, achievements } = useXPStore()
  const { gamificationEnabled } = useSettingsStore()
  const [showXPPop, setShowXPPop] = useState(false)
  const [lastXP, setLastXP] = useState(0)

  useEffect(() => {
    if (recentXPGain && recentXPGain !== lastXP) {
      setLastXP(recentXPGain)
      setShowXPPop(true)
      const t = setTimeout(() => setShowXPPop(false), 2000)
      return () => clearTimeout(t)
    }
  }, [recentXPGain])

  if (!gamificationEnabled) return null

  const xpPct = (points % 100)
  const unlockedCount = Object.keys(achievements).length
  const totalAchievements = Object.keys(ACHIEVEMENTS).length

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100 }}
      className="fixed bottom-0 left-56 right-0 bg-gray-900/90 backdrop-blur-sm border-t border-gray-800 p-3 z-20"
    >
      {/* XP gain popup */}
      <AnimatePresence>
        {showXPPop && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -40, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-16 text-yellow-300 font-bold text-lg pointer-events-none select-none"
          >
            +{lastXP} XP ✨
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1.5 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold">Lv {level}</span>
            <span className="text-gray-400">{points} XP</span>
            {streakDays > 0 && <span className="text-orange-400">🔥 {streakDays}d</span>}
            <span className="text-green-400">✅ {todayCount}</span>
            {focusStreak > 1 && <span className="text-purple-400">⚡ ×{focusStreak}</span>}
          </div>
          {unlockedCount > 0 && (
            <div className="flex items-center gap-1" title={`${unlockedCount}/${totalAchievements} achievements`}>
              {Object.keys(achievements).slice(-3).map((k) => (
                <span key={k} className="text-base" title={ACHIEVEMENTS[k]?.label}>{ACHIEVEMENTS[k]?.emoji}</span>
              ))}
              {unlockedCount > 3 && <span className="text-xs text-gray-400">+{unlockedCount - 3}</span>}
            </div>
          )}
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
            animate={{ width: `${xpPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export default XPBar
