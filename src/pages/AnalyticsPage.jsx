import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import useAnalyticsStore from '../store/analyticsStore'
import useXPStore, { ACHIEVEMENTS } from '../store/xpStore'
import useTasksStore from '../store/tasksStore'
import useRoadmapsStore from '../store/roadmapsStore'
import useSettingsStore from '../store/settingsStore'
import useDistractionStore from '../store/distractionStore'

// ─── Constants ────────────────────────────────────────────────────────────────
const RANGES = [
  { key: '7d',  label: '7 Days',   days: 7  },
  { key: '30d', label: '30 Days',  days: 30 },
  { key: '90d', label: '3 Months', days: 90 },
]

const STAGES = [
  { label: 'Seed',    emoji: '🌫️', color: '#4b5563' },
  { label: 'Sprout',  emoji: '🌱', color: '#4ade80' },
  { label: 'Growing', emoji: '🌿', color: '#22c55e' },
  { label: 'Mature',  emoji: '🌳', color: '#16a34a' },
  { label: 'Ancient', emoji: '🌲', color: '#a78bfa' },
]

const DIST_META = {
  'social-media': { emoji: '📱', label: 'Social Media' },
  'phone':        { emoji: '📞', label: 'Phone'        },
  'people':       { emoji: '🗣️', label: 'People'       },
  'thought':      { emoji: '💭', label: 'Thought'      },
  'hunger':       { emoji: '🍔', label: 'Hunger'       },
  'noise':        { emoji: '🔊', label: 'Noise'        },
  'other':        { emoji: '❓', label: 'Other'        },
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function getRangeStart(days) {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function isToday(iso) {
  const d = new Date(iso); const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

// ─── Reusable UI ───────────────────────────────────────────────────────────────
function StatCard({ value, label, sub, color, bg }) {
  return (
    <div className={`rounded-xl p-4 border ${bg}`}>
      <div className={`text-xl font-bold tabular-nums leading-tight ${color}`}>{value}</div>
      <div className="text-xs font-medium text-gray-300 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function SectionHeader({ emoji, title, sub }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{emoji}</span>
      <div>
        <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
        {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { focusSessions } = useAnalyticsStore()
  const { points, level, streakDays, achievements } = useXPStore()
  const { gamificationEnabled } = useSettingsStore()
  const { tasks } = useTasksStore()
  const { roadmaps } = useRoadmapsStore()
  const { logs: distrLogs } = useDistractionStore()

  const [timeRange, setTimeRange] = useState('30d')
  const rangeDays  = RANGES.find((r) => r.key === timeRange)?.days ?? 30
  const rangeStart = useMemo(() => getRangeStart(rangeDays), [rangeDays])

  // ── Filtered subsets ──────────────────────────────────────────────────────
  const allCompleted   = useMemo(() => tasks.filter((t) => t.completedAt), [tasks])
  const rangeCompleted = useMemo(() => allCompleted.filter((t) => new Date(t.completedAt) >= rangeStart), [allCompleted, rangeStart])
  const distrInRange   = useMemo(() => distrLogs.filter((l) => new Date(l.timestamp) >= rangeStart), [distrLogs, rangeStart])

  // ── Core numbers ─────────────────────────────────────────────────────────
  const todayDone     = allCompleted.filter((t) => isToday(t.completedAt)).length
  const xpToNextLevel = 100 - (points % 100)
  const unlockedAchievements = Object.entries(achievements)

  // ── Productivity metrics ──────────────────────────────────────────────────
  const focusSecsInRange = rangeCompleted.reduce((s, t) => s + (t.timeSpent || 0), 0)
  const focusHrs         = focusSecsInRange / 3600
  const prodRate         = focusHrs > 0.1 ? (rangeCompleted.length / focusHrs).toFixed(1) : null
  const avgTaskMins      = rangeCompleted.length > 0 ? Math.round((focusSecsInRange / rangeCompleted.length) / 60) : null
  const legacyFocusMins  = Math.floor(focusSessions.reduce((s, f) => s + (f.duration || 0), 0) / 60)

  // ── Daily buckets ─────────────────────────────────────────────────────────
  const dailyBuckets = useMemo(() =>
    Array.from({ length: rangeDays }).map((_, i) => {
      const d = new Date(rangeStart); d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayTasks = allCompleted.filter((t) => t.completedAt?.startsWith(dateStr))
      const distrDay = distrLogs.filter((l) => l.timestamp.startsWith(dateStr)).length
      return {
        dateStr, label: `${d.getMonth()+1}/${d.getDate()}`,
        dow: ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()],
        count: dayTasks.length,
        focusSecs: dayTasks.reduce((s, t) => s + (t.timeSpent || 0), 0),
        distrCount: distrDay,
      }
    }),
  [rangeDays, rangeStart, allCompleted, distrLogs])

  // For 7d: show per day; for 30d: show per day (smaller); for 90d: group into 13 weeks
  const chartData = useMemo(() => {
    if (timeRange !== '90d') return dailyBuckets.map((b) => ({ ...b, label: timeRange === '7d' ? b.dow : (parseInt(b.label.split('/')[1]) % 5 === 1 ? b.label : '') }))
    return Array.from({ length: Math.ceil(dailyBuckets.length / 7) }).map((_, w) => {
      const sl = dailyBuckets.slice(w * 7, (w + 1) * 7)
      return { label: `W${w+1}`, count: sl.reduce((s,b)=>s+b.count,0), focusSecs: sl.reduce((s,b)=>s+b.focusSecs,0), distrCount: sl.reduce((s,b)=>s+b.distrCount,0) }
    })
  }, [dailyBuckets, timeRange])

  const maxChart = Math.max(...chartData.map((b) => b.count), 1)

  // ── Productivity trend & acceleration ─────────────────────────────────────
  const numPeriods  = timeRange === '7d' ? 7 : timeRange === '30d' ? 4 : 6
  const periodSize  = Math.ceil(dailyBuckets.length / numPeriods)
  const prodTrend   = useMemo(() =>
    Array.from({ length: numPeriods }).map((_, p) => {
      const sl    = dailyBuckets.slice(p * periodSize, (p + 1) * periodSize)
      const tasks  = sl.reduce((s, b) => s + b.count, 0)
      const hrs    = sl.reduce((s, b) => s + b.focusSecs, 0) / 3600
      const rate   = hrs > 0.05 ? tasks / hrs : null
      return { label: `P${p+1}`, tasks, hrs, rate }
    }),
  [dailyBuckets, numPeriods, periodSize])

  const firstRate    = prodTrend.find((p) => p.rate !== null)?.rate ?? 0
  const lastRate     = [...prodTrend].reverse().find((p) => p.rate !== null)?.rate ?? 0
  const acceleration = firstRate > 0 ? ((lastRate - firstRate) / firstRate * 100).toFixed(1) : null
  const accelUp      = acceleration !== null && parseFloat(acceleration) >= 0
  const maxTrendRate = Math.max(...prodTrend.map((p) => p.rate || 0), 0.01)

  // ── Distraction analysis ──────────────────────────────────────────────────
  const distrByCat = {}
  distrInRange.forEach((l) => { distrByCat[l.category] = (distrByCat[l.category] || 0) + 1 })
  const avgDistrDay  = (distrInRange.length / rangeDays).toFixed(1)
  const topDistCat   = Object.entries(distrByCat).sort(([,a],[,b]) => b-a)[0]?.[0] ?? null
  const focusQuality = (rangeCompleted.length + distrInRange.length) > 0
    ? Math.round((rangeCompleted.length / (rangeCompleted.length + distrInRange.length / 2)) * 100)
    : null

  // ── Skill forest (all time) ───────────────────────────────────────────────
  const { stageCounts, allTrees, categoryData, skillsInRange } = useMemo(() => {
    const trees = roadmaps.flatMap((rm) =>
      rm.courses.map((c) => {
        const total = c.modules?.length ?? 0
        const done  = c.modules?.filter((m) => m.completedAt).length ?? 0
        const pct   = total > 0 ? done / total : (c.completed ? 1 : 0)
        const stage = c.completed ? 4 : pct >= 0.75 ? 3 : pct >= 0.40 ? 2 : pct >= 0.05 ? 1 : 0
        return { name: c.name, roadmap: rm.name, stage, pct, total, done }
      })
    )
    const counts = [0,1,2,3,4].map((s) => trees.filter((t) => t.stage === s).length)
    const cats = roadmaps.map((rm) => {
      const mods = rm.courses.flatMap((c) => c.modules || [])
      const done = mods.filter((m) => m.completedAt).length
      const courseDone = rm.courses.filter((c) => c.completed).length
      return { name: rm.name, emoji: rm.emoji || '📚', total: mods.length, done, courses: rm.courses.length, courseDone, pct: mods.length > 0 ? done / mods.length : 0 }
    })
    const inRange = roadmaps.flatMap((rm) =>
      rm.courses.flatMap((c) => (c.modules || []).filter((m) => m.completedAt && new Date(m.completedAt) >= rangeStart))
    ).length
    return { stageCounts: counts, allTrees: trees, categoryData: cats, skillsInRange: inRange }
  }, [roadmaps, rangeStart])

  const weakPoints = useMemo(() =>
    roadmaps.flatMap((rm) =>
      rm.courses.map((c) => {
        const total = c.modules?.length ?? 0
        const done  = c.modules?.filter((m) => m.completedAt).length ?? 0
        const pct   = total > 0 ? done / total : (c.completed ? 1 : 0)
        return { name: c.name, roadmap: rm.name, emoji: c.emoji || '📚', total, done, pct, isWeak: total > 2 && pct > 0.05 && pct < 0.75 && !c.completed }
      })
    ).filter((c) => c.isWeak).slice(0, 5),
  [roadmaps])

  if (!gamificationEnabled) {
    return (
      <>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Analytics</h2>
          <p className="text-sm text-gray-500">Your productivity insights and learning trends.</p>
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
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white mb-1">Analytics</h2>
        <p className="text-sm text-gray-500">Productivity trends, skill growth, and focus quality insights.</p>
      </div>

      {/* ── Time Range Selector ── */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 mr-1">View:</span>
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setTimeRange(r.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeRange === r.key
                ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Core metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard value={rangeCompleted.length} label="Tasks Done" sub={`last ${rangeDays} days`}   color="text-green-400"  bg="bg-green-500/8 border-green-500/20" />
        <StatCard value={todayDone}              label="Today"      sub="tasks completed"            color="text-blue-400"   bg="bg-blue-500/8 border-blue-500/20" />
        <StatCard value={`${streakDays}🔥`}       label="Streak"    sub="consecutive days"           color="text-orange-400" bg="bg-orange-500/8 border-orange-500/20" />
        <StatCard value={`Lv ${level}`}           label={`${points} XP`} sub={`${xpToNextLevel} to next`} color="text-purple-400" bg="bg-purple-500/8 border-purple-500/20" />
      </div>

      {/* XP bar */}
      <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60 mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span className="font-medium">Level {level}</span>
          <span className="tabular-nums">{points % 100} / 100 XP</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <motion.div
            className="h-2 rounded-full"
            style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
            animate={{ width: `${points % 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ── Productivity Intelligence ── */}
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-5 mb-6">
        <SectionHeader emoji="⚡" title="Productivity Intelligence" sub={`Output metrics · last ${rangeDays} days`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard value={prodRate ? `${prodRate}/hr` : '—'}    label="Tasks / Hour"    sub={prodRate ? 'active rate' : 'no time data'}          color={prodRate ? 'text-yellow-400' : 'text-gray-500'} bg="bg-yellow-500/8 border-yellow-500/20" />
          <StatCard value={focusHrs > 0 ? `${focusHrs.toFixed(1)}h` : '—'} label="Focus Time" sub="from completed tasks" color="text-cyan-400"   bg="bg-cyan-500/8 border-cyan-500/20" />
          <StatCard value={avgTaskMins ? `${avgTaskMins}m` : '—'} label="Avg Task"       sub="time per task"                                     color="text-pink-400"   bg="bg-pink-500/8 border-pink-500/20" />
          <StatCard
            value={acceleration !== null ? `${accelUp ? '+' : ''}${acceleration}%` : '—'}
            label="Acceleration"
            sub={acceleration !== null ? (accelUp ? '↑ improving' : '↓ slowing') : 'not enough data'}
            color={acceleration !== null ? (accelUp ? 'text-emerald-400' : 'text-rose-400') : 'text-gray-500'}
            bg={acceleration !== null ? (accelUp ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-rose-500/8 border-rose-500/20') : 'bg-gray-700/30 border-gray-700/40'}
          />
        </div>

        {/* Productivity trend micro-chart */}
        {prodTrend.some((p) => p.rate !== null) && (
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Rate over time</p>
            <div className="flex items-end gap-1 h-14">
              {prodTrend.map((p, i) => {
                const h = p.rate ? Math.max(3, (p.rate / maxTrendRate) * 50) : 3
                const opacity = p.rate ? 0.4 + (p.rate / maxTrendRate) * 0.6 : 0.15
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={p.rate ? `${p.rate.toFixed(1)} tasks/hr` : 'No data'}>
                    <motion.div
                      className="w-full rounded-t-sm"
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      style={{ background: `rgba(168,85,247,${opacity})` }}
                    />
                    <span className="text-[9px] text-gray-600">{p.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Activity + Focus Quality (2-col) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Activity chart */}
        <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700/50">
          <SectionHeader emoji="📅" title={`Activity — ${rangeDays} Days`} />
          <div className="flex items-end gap-0.5" style={{ height: 72 }}>
            {chartData.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${b.label || ''}: ${b.count} tasks`}>
                <motion.div
                  className="w-full rounded-t-sm"
                  initial={{ height: 0 }}
                  animate={{ height: b.count > 0 ? Math.max(3, (b.count / maxChart) * 62) : 3 }}
                  transition={{ duration: 0.3, delay: i * 0.01 }}
                  style={{ background: b.count > 0 ? 'linear-gradient(0deg,#6366f1,#a855f7)' : 'rgba(55,65,81,0.4)' }}
                />
                {b.label ? <span className="text-[8px] text-gray-600 truncate w-full text-center">{b.label}</span> : <span className="text-[8px]">&nbsp;</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Focus quality */}
        <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700/50">
          <SectionHeader emoji="🚦" title="Focus Quality" sub="Tasks vs Distractions" />
          <div className="flex items-center justify-center gap-6 py-1 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 tabular-nums">{rangeCompleted.length}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">tasks done</div>
            </div>
            <div className="text-xl text-gray-700">vs</div>
            <div className="text-center">
              <div className="text-2xl font-bold text-rose-400 tabular-nums">{distrInRange.length}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">distractions</div>
            </div>
          </div>
          {focusQuality !== null ? (
            <>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Focus score</span>
                <span className="font-bold tabular-nums" style={{ color: focusQuality >= 70 ? '#4ade80' : focusQuality >= 40 ? '#fbbf24' : '#f87171' }}>{focusQuality}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" animate={{ width: `${focusQuality}%` }} transition={{ duration: 0.7 }}
                  style={{ background: focusQuality >= 70 ? '#4ade80' : focusQuality >= 40 ? '#fbbf24' : '#f87171' }} />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">{avgDistrDay} avg distractions/day</p>
            </>
          ) : (
            <p className="text-xs text-gray-600 text-center mt-2">Log tasks and distractions to unlock</p>
          )}
        </div>
      </div>

      {/* ── Distraction Breakdown ── */}
      {distrInRange.length > 0 && (
        <div className="bg-gray-900/60 border border-rose-900/20 rounded-2xl p-5 mb-6">
          <SectionHeader emoji="🚨" title="Distraction Analysis" sub={`${distrInRange.length} interruptions logged · last ${rangeDays} days`} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard value={distrInRange.length}   label="Total"         sub="logged"             color="text-rose-400"   bg="bg-rose-500/8 border-rose-500/20" />
            <StatCard value={avgDistrDay}            label="Per Day"       sub="daily average"      color="text-orange-400" bg="bg-orange-500/8 border-orange-500/20" />
            <StatCard value={topDistCat ? `${DIST_META[topDistCat]?.emoji} ${DIST_META[topDistCat]?.label}` : '—'} label="Top Trigger" sub="most logged category" color="text-yellow-400" bg="bg-yellow-500/8 border-yellow-500/20" />
            <StatCard value={focusQuality ? `${focusQuality}%` : '—'} label="Focus Score" sub="tasks vs distractions"
              color={focusQuality >= 70 ? 'text-emerald-400' : focusQuality >= 40 ? 'text-yellow-400' : 'text-rose-400'}
              bg="bg-gray-700/30 border-gray-700/50" />
          </div>
          <div className="space-y-2">
            {Object.entries(distrByCat).sort(([,a],[,b]) => b-a).map(([cat, count]) => {
              const meta = DIST_META[cat] || DIST_META.other
              const pct  = Math.round((count / distrInRange.length) * 100)
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-sm w-6 text-center">{meta.emoji}</span>
                  <span className="text-xs text-gray-400 w-24 truncate flex-shrink-0">{meta.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full bg-rose-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <span className="text-[10px] text-gray-500 w-6 text-right tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Skill Acquisition ── */}
      {(skillsInRange > 0 || allTrees.length > 0) && (
        <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-5 mb-6">
          <SectionHeader emoji="🧠" title="Skill Acquisition" sub={`Learning growth · last ${rangeDays} days`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <StatCard value={skillsInRange}                  label="Modules Done"    sub="in this period"   color="text-indigo-400" bg="bg-indigo-500/8 border-indigo-500/20" />
            <StatCard value={allTrees.filter(t=>t.stage>=3).length} label="Mature+ Skills" sub="≥75% complete"  color="text-green-400"  bg="bg-green-500/8 border-green-500/20" />
            <StatCard value={allTrees.length}                label="Total Courses"   sub="across roadmaps"  color="text-blue-400"   bg="bg-blue-500/8 border-blue-500/20" />
          </div>

          {/* Stage distribution */}
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Maturity Distribution</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {STAGES.map((stage, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700/40 rounded-lg px-2.5 py-1.5">
                <span className="text-sm leading-none">{stage.emoji}</span>
                <div>
                  <div className="text-sm font-bold tabular-nums leading-tight" style={{ color: stage.color }}>{stageCounts[i]}</div>
                  <div className="text-[9px] text-gray-500">{stage.label}</div>
                </div>
              </div>
            ))}
          </div>
          {allTrees.length > 0 && (
            <div className="flex rounded-full overflow-hidden h-1.5 gap-px">
              {STAGES.map((stage, i) =>
                stageCounts[i] > 0 ? (
                  <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${(stageCounts[i] / allTrees.length) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }} style={{ background: stage.color, minWidth: 3 }} />
                ) : null
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Category Balance ── */}
      {categoryData.length > 0 && (
        <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-5 mb-6">
          <SectionHeader emoji="⚖️" title="Category Balance" sub="Effort distribution across roadmaps" />
          <div className="flex flex-col gap-2">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <span className="text-base w-6 text-center flex-shrink-0">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-300 truncate font-medium">{cat.name}</span>
                    <span className="text-gray-500 tabular-nums ml-2 flex-shrink-0">{cat.done}/{cat.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                      animate={{ width: `${cat.pct * 100}%` }} transition={{ duration: 0.6 }}
                      style={{ background: cat.pct > 0.75 ? '#a78bfa' : cat.pct > 0.4 ? '#22c55e' : '#4ade80' }} />
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-400 tabular-nums w-10 text-right">{Math.round(cat.pct * 100)}%</span>
              </div>
            ))}
          </div>
          {categoryData.length > 1 && (() => {
            const maxPct = Math.max(...categoryData.map((c) => c.pct))
            const minPct = Math.min(...categoryData.map((c) => c.pct))
            const imbalance = maxPct - minPct
            return imbalance > 0.5 ? (
              <div className="mt-3 p-3 rounded-lg bg-amber-900/15 border border-amber-800/25 text-xs text-amber-300">
                ⚖️ Imbalance detected — some roadmaps are much further ahead. Consider investing time in lagging areas.
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* ── Weak Points ── */}
      {weakPoints.length > 0 && (
        <div className="bg-gray-900/60 border border-amber-600/20 rounded-2xl p-5 mb-6">
          <SectionHeader emoji="⚠️" title="Weak Points" sub="Stalled courses with incomplete progress — pick one to continue" />
          <div className="flex flex-col gap-2">
            {weakPoints.map((wp) => (
              <div key={wp.name + wp.roadmap} className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/15 rounded-xl px-3 py-2.5">
                <span className="text-base flex-shrink-0">{wp.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-gray-200 truncate">{wp.name}</span>
                    <span className="text-[11px] text-amber-500/70 ml-2 flex-shrink-0 tabular-nums">{wp.done}/{wp.total}</span>
                  </div>
                  <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${wp.pct * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-600">{wp.roadmap}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Achievements ── */}
      <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700/50">
        <SectionHeader emoji="🏆" title={`Achievements (${unlockedAchievements.length}/${Object.keys(ACHIEVEMENTS).length})`} />
        {unlockedAchievements.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6">Complete tasks to earn achievements!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {unlockedAchievements.map(([key]) => {
              const ach = ACHIEVEMENTS[key]
              return (
                <div key={key} className="flex items-center gap-2 bg-gray-700/40 rounded-xl p-2.5 border border-gray-700/40">
                  <span className="text-2xl">{ach.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-white">{ach.label}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{ach.desc}</p>
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
