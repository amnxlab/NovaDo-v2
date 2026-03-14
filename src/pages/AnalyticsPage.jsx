import { motion } from 'framer-motion'
import useAnalyticsStore from '../store/analyticsStore'
import useXPStore, { ACHIEVEMENTS } from '../store/xpStore'
import useTasksStore from '../store/tasksStore'
import useSettingsStore from '../store/settingsStore'

const isSameDay = (iso) => {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export default function AnalyticsPage() {
  const { focusSessions } = useAnalyticsStore()
  const { points, level, streakDays, todayCount, achievements } = useXPStore()
  const { gamificationEnabled } = useSettingsStore()
  const { tasks } = useTasksStore()

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

  // Last 30 days for extended view
  const last30 = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    d.setHours(0, 0, 0, 0)
    const count = tasks.filter((t) => {
      if (!t.completedAt) return false
      const cd = new Date(t.completedAt)
      cd.setHours(0, 0, 0, 0)
      return cd.getTime() === d.getTime()
    }).length
    return { day: d.getDate(), count }
  })
  const max30 = Math.max(...last30.map((d) => d.count), 1)

  if (!gamificationEnabled) {
    return (
      <>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Analytics</h2>
          <p className="text-sm text-gray-500">Your productivity insights and stats.</p>
        </div>
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📊</p>
          <p>Analytics require gamification to be enabled.</p>
          <p className="text-xs mt-1 text-gray-600">Turn it on in Settings → Gamification.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Analytics</h2>
        <p className="text-sm text-gray-500">Your productivity insights and stats.</p>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { value: totalTasksCompleted, label: 'Total Done', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { value: todayCompleted, label: 'Today', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { value: Math.floor(totalFocusTime / 60), label: 'Min Focused', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
          { value: streakDays, label: '🔥 Streak', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
        ].map(({ value, label, color, bg }) => (
          <div key={label} className={`rounded-xl p-4 text-center border ${bg}`}>
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* XP Progress */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Level {level} · {points} XP</span>
          <span>{xpToNextLevel} XP to next level</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
            animate={{ width: `${(points % 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 7-day bar chart */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-sm font-semibold text-gray-300 mb-4">Last 7 Days</p>
          <div className="flex items-end gap-2 h-32">
            {last7.map(({ label, count }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500 font-medium">{count}</span>
                <motion.div
                  className="w-full bg-purple-500 rounded-md"
                  initial={{ height: 0 }}
                  animate={{ height: `${(count / maxBar) * 96}px` }}
                  transition={{ duration: 0.4 }}
                  style={{ minHeight: count > 0 ? 8 : 0 }}
                />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 30-day heat strip */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-sm font-semibold text-gray-300 mb-4">Last 30 Days</p>
          <div className="grid grid-cols-10 gap-1">
            {last30.map(({ day, count }, idx) => (
              <div
                key={idx}
                title={`Day ${day}: ${count} tasks`}
                className="aspect-square rounded-sm"
                style={{
                  backgroundColor: count === 0
                    ? 'rgba(107,114,128,0.2)'
                    : `rgba(168,85,247,${0.2 + (count / max30) * 0.8})`,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p className="text-sm font-semibold text-gray-300 mb-4">
          🏆 Achievements ({unlockedAchievements.length}/{Object.keys(ACHIEVEMENTS).length})
        </p>
        {unlockedAchievements.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">Complete tasks to earn achievements!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {unlockedAchievements.map(([key]) => {
              const ach = ACHIEVEMENTS[key]
              return (
                <div key={key} className="flex items-center gap-2 bg-gray-700/50 rounded-lg p-2.5">
                  <span className="text-2xl">{ach.emoji}</span>
                  <div>
                    <p className="text-sm text-white font-medium">{ach.label}</p>
                    <p className="text-xs text-gray-500">{ach.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
