import { motion, AnimatePresence } from 'framer-motion'
import useAnalyticsStore from '../store/analyticsStore'
import useXPStore, { ACHIEVEMENTS } from '../store/xpStore'
import useSettingsStore from '../store/settingsStore'
import useTasksStore from '../store/tasksStore'

const isSameDay = (iso) => {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

const AnalyticsDashboard = () => {
  const { focusSessions, dailyStats } = useAnalyticsStore()
  const { points, level, streakDays, todayCount, focusStreak, achievements } = useXPStore()
  const { analyticsVisible, gamificationEnabled } = useSettingsStore()
  const { tasks } = useTasksStore()

  if (!analyticsVisible || !gamificationEnabled) return null

  const totalFocusTime = focusSessions.reduce((sum, s) => sum + s.duration, 0)
  const totalTasksCompleted = tasks.filter((t) => t.completedAt).length
  const todayCompleted = tasks.filter((t) => t.completedAt && isSameDay(t.completedAt)).length
  const xpToNextLevel = 100 - (points % 100)
  const unlockedAchievements = Object.entries(achievements)

  // Last 7 days bars
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const count = tasks.filter((t) => {
      if (!t.completedAt) return false
      const cd = new Date(t.completedAt)
      cd.setHours(0, 0, 0, 0)
      return cd.getTime() === d.getTime()
    }).length
    return { label: ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()], count }
  })
  const maxBar = Math.max(...last7.map((d) => d.count), 1)

  return (
    <motion.div
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      className="fixed bottom-16 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 p-4 z-30"
    >
      <div className="max-w-lg mx-auto">
        <h3 className="text-base font-bold text-white mb-3">📊 Your NeuroOS Stats</h3>

        {/* Core metrics */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { value: totalTasksCompleted, label: 'Total Done', color: 'text-green-400' },
            { value: todayCompleted, label: 'Today', color: 'text-blue-400' },
            { value: Math.floor(totalFocusTime / 60), label: 'Min Focused', color: 'text-purple-400' },
            { value: streakDays, label: '🔥 Streak', color: 'text-orange-400' },
          ].map(({ value, label, color }) => (
            <div key={label} className="bg-gray-800 rounded-lg p-2 text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>

        {/* 7-day bar chart */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Last 7 days</p>
          <div className="flex items-end gap-1 h-12">
            {last7.map(({ label, count }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-0.5">
                <motion.div
                  className="w-full bg-purple-500 rounded-sm"
                  initial={{ height: 0 }}
                  animate={{ height: `${(count / maxBar) * 40}px` }}
                  transition={{ duration: 0.4 }}
                  style={{ minHeight: count > 0 ? 4 : 0 }}
                />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* XP bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Level {level} · {points} XP</span>
            <span>{xpToNextLevel} XP to next level</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-blue-500 h-2 rounded-full"
              animate={{ width: `${(points % 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Achievements */}
        {unlockedAchievements.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">🏆 Achievements ({unlockedAchievements.length}/{Object.keys(ACHIEVEMENTS).length})</p>
            <div className="flex flex-wrap gap-2">
              {unlockedAchievements.map(([key]) => {
                const ach = ACHIEVEMENTS[key]
                return (
                  <span key={key} title={ach.desc} className="text-lg cursor-default" aria-label={ach.label}>
                    {ach.emoji}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default AnalyticsDashboard