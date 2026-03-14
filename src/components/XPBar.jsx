import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useXPStore, { ACHIEVEMENTS, MEDAL_TIERS, getForestStage, getPlayerTitle } from '../store/xpStore'
import useSettingsStore from '../store/settingsStore'

const XPBar = () => {
  const { points, level, streakDays, todayCount, focusStreak, recentXPGain, achievements, lastUnlockedAchievement } = useXPStore()
  const { gamificationEnabled } = useSettingsStore()
  const navigate = useNavigate()
  const [showXPPop, setShowXPPop] = useState(false)
  const [lastXP, setLastXP] = useState(0)
  const [showAchToast, setShowAchToast] = useState(false)
  // Initialise from sessionStorage so the persisted xpStore value never
  // triggers the toast again on reload within the same browser session.
  const [toastKey, setToastKey] = useState(() => sessionStorage.getItem('lastShownAch') ?? null)

  useEffect(() => {
    if (recentXPGain && recentXPGain !== lastXP) {
      setLastXP(recentXPGain)
      setShowXPPop(true)
      const t = setTimeout(() => setShowXPPop(false), 2000)
      return () => clearTimeout(t)
    }
  }, [recentXPGain])

  useEffect(() => {
    if (lastUnlockedAchievement && lastUnlockedAchievement !== toastKey) {
      setToastKey(lastUnlockedAchievement)
      sessionStorage.setItem('lastShownAch', lastUnlockedAchievement)
      setShowAchToast(true)
      const t = setTimeout(() => setShowAchToast(false), 4500)
      return () => clearTimeout(t)
    }
  }, [lastUnlockedAchievement])

  if (!gamificationEnabled) return null

  const xpPct = points % 100
  const unlockedCount = Object.keys(achievements).length
  const totalAchievements = Object.keys(ACHIEVEMENTS).length
  const stage = getForestStage(points)
  const title = getPlayerTitle(level)

  const toastAch = toastKey ? ACHIEVEMENTS[toastKey] : null
  const toastMedal = toastAch ? MEDAL_TIERS[toastAch.medal] : null

  return (
    <>
      {/* Achievement unlock toast — top right */}
      <AnimatePresence>
        {showAchToast && toastAch && (
          <motion.div
            key={toastKey}
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="fixed top-20 right-4 z-[400] w-72 rounded-2xl p-4 bg-gray-900 border shadow-2xl cursor-pointer"
            style={{ borderColor: `${toastMedal.color}60`, boxShadow: `0 0 24px ${toastMedal.color}30` }}
            onClick={() => { setShowAchToast(false); navigate('/achievements') }}
          >
            {/* Glow bar at top */}
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, ${toastMedal.color}, transparent)` }} />

            <div className="flex items-start gap-3">
              <span className="text-3xl">{toastAch.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-0.5" style={{ color: toastMedal.color }}>
                  {toastMedal.icon} {toastMedal.label} Achievement Unlocked!
                </p>
                <p className="text-white font-bold text-sm">{toastAch.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{toastAch.desc}</p>
              </div>
              <span className="text-yellow-400 text-xs font-mono font-bold">+{toastAch.xpBonus} XP</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 text-right">Click to view all achievements</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP bar at bottom */}
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
              initial={{ y: 0, opacity: 1, scale: 1 }}
              animate={{ y: -50, opacity: 0, scale: 1.2 }}
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
            <div className="flex items-center gap-2 flex-wrap">
              {/* Forest stage + level */}
              <button
                onClick={() => navigate('/achievements')}
                title="View Achievements"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="text-base">{stage.emoji.split(' ')[0]}</span>
                <span className="text-white font-bold">Lv {level}</span>
                <span className="text-gray-500 text-xs">· {title}</span>
              </button>
              <span className="text-gray-500 text-xs">{points} XP</span>
              {streakDays > 0 && <span className="text-orange-400 text-xs">🔥 {streakDays}d</span>}
              <span className="text-green-400 text-xs">✅ {todayCount}</span>
              {focusStreak > 1 && <span className="text-purple-400 text-xs">⚡ ×{focusStreak}</span>}
            </div>
            {/* Recent unlocked badges */}
            {unlockedCount > 0 && (
              <button
                onClick={() => navigate('/achievements')}
                className="flex items-center gap-1 hover:opacity-80"
                title={`${unlockedCount}/${totalAchievements} achievements`}
              >
                {Object.keys(achievements).slice(-3).map((k) => (
                  <span key={k} className="text-base" title={ACHIEVEMENTS[k]?.label}>{ACHIEVEMENTS[k]?.emoji}</span>
                ))}
                {unlockedCount > 3 && <span className="text-xs text-gray-400">+{unlockedCount - 3}</span>}
              </button>
            )}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <motion.div
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-400 h-1.5 rounded-full"
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default XPBar
