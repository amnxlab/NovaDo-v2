/**
 * TimelineDock — Live metro/subway route for today's tasks.
 *
 * Visual metaphor: a city subway map.
 *  🟢 Past stations   → green dot, strikethrough, ↩ undo button
 *  🟡 Current station → triple-ring pulsing node, "CURRENT STOP" badge
 *  ⬜ Upcoming        → numbered hollow stops with priority colour
 *  ⬛ End of line     → grey terminus
 */
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTasksStore, { PRIORITIES } from '../store/tasksStore'
import useSettingsStore from '../store/settingsStore'
import useXPStore from '../store/xpStore'
import { compareDateKeys, diffCalendarDays, getDateKeyFromDate, getTodayDateKey } from '../utils/localDate'

// ─── helpers ────────────────────────────────────────────────────────────────
const todayStr = () => getTodayDateKey()
const isToday  = (iso) => iso && getDateKeyFromDate(iso) === todayStr()
const PRIORITY_ORDER = { urgent: 4, high: 3, medium: 2, low: 1 }

const PRIO_DOT   = { urgent: '#a78bfa', high: '#f87171', medium: '#fbbf24', low: '#4ade80' }
const PRIO_LABEL = { urgent: 'text-purple-400', high: 'text-red-400', medium: 'text-yellow-400', low: 'text-green-400' }

function dueBadge(dueDate) {
  if (!dueDate) return null
  const days = diffCalendarDays(dueDate, new Date())
  if (days < 0)   return { text: `${Math.abs(days)}d overdue`, cls: 'text-red-400' }
  if (days === 0) return { text: 'due today',  cls: 'text-orange-400' }
  if (days === 1) return { text: 'tomorrow',   cls: 'text-yellow-400' }
  return { text: `in ${days}d`, cls: 'text-gray-500' }
}

// ─── Track line ──────────────────────────────────────────────────────────────
function TrackLine({ status }) {
  return (
    <div className="flex justify-center" style={{ width: 20, flexShrink: 0 }}>
      <div
        className="w-0.5"
        style={{
          height: 14,
          background: status === 'done'
            ? '#22c55e'
            : status === 'active'
            ? 'linear-gradient(to bottom, #eab308, #6b7280)'
            : '#374151',
          opacity: status === 'future' ? 0.45 : 1,
        }}
      />
    </div>
  )
}

// ─── Past station (completed today) ──────────────────────────────────────────
function PastStation({ task, onUndo }) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="flex gap-0 items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Station dot */}
      <div className="flex flex-col items-center" style={{ width: 20, flexShrink: 0 }}>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_5px_rgba(34,197,94,0.4)]">
          <div className="w-0.5 h-0.5 rounded-full bg-white/80" />
        </div>
      </div>
      {/* Text row */}
      <div className="flex-1 min-w-0 flex items-center gap-1 pl-1.5 py-0.5">
        <p className="text-[11px] text-gray-500 line-through truncate flex-1 leading-tight">{task.text}</p>
        <span className="text-emerald-600 text-[10px] flex-shrink-0">✓</span>
        <AnimatePresence>
          {hover && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              onClick={(e) => { e.stopPropagation(); onUndo(task.id) }}
              title="Mark as incomplete"
              className="flex-shrink-0 text-[10px] text-gray-600 hover:text-orange-400 transition-colors px-1 py-0.5 rounded hover:bg-orange-400/10"
            >↩</motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Current / Active station ─────────────────────────────────────────────────
function CurrentStation({ task }) {
  const meta  = PRIORITIES[task.priority] ?? PRIORITIES.medium
  const badge = dueBadge(task.dueDate)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="flex gap-0 items-start"
    >
      {/* Triple-ring node */}
      <div className="flex flex-col items-center" style={{ width: 20, flexShrink: 0, paddingTop: 3 }}>
        <div className="relative w-5 h-5 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full animate-ping bg-yellow-400/20" />
          <span className="absolute rounded-full animate-ping bg-yellow-500/30"
                style={{ inset: 3, animationDelay: '0.25s' }} />
          <span className="relative z-10 w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]" />
        </div>
      </div>
      {/* Card */}
      <div className="flex-1 min-w-0 ml-1.5 bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-2.5 py-2"
           style={{ boxShadow: '0 0 12px rgba(234,179,8,0.06)' }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[8px] font-black tracking-widest uppercase text-yellow-400 bg-yellow-400/15 px-1 py-0.5 rounded">
            Current Stop
          </span>
        </div>
        <p className="text-xs font-semibold text-white leading-tight truncate">{task.text}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`text-[9px] font-medium ${PRIO_LABEL[task.priority] ?? 'text-gray-400'} capitalize`}>
            {meta.emoji} {task.priority}
          </span>
          {task.durationMins && (
            <span className="text-[9px] text-gray-500">{task.durationMins}m</span>
          )}
          {badge && <span className={`text-[9px] font-medium ${badge.cls}`}>{badge.text}</span>}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Upcoming station ─────────────────────────────────────────────────────────
function UpcomingStation({ task, index }) {
  const meta  = PRIORITIES[task.priority] ?? PRIORITIES.medium
  const badge = dueBadge(task.dueDate)
  const dotClr = PRIO_DOT[task.priority] ?? '#9ca3af'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="flex gap-0 items-start"
    >
      {/* Hollow node */}
      <div className="flex flex-col items-center" style={{ width: 20, flexShrink: 0, paddingTop: 4 }}>
        <div className="w-2.5 h-2.5 rounded-full border-2 bg-gray-900"
             style={{ borderColor: dotClr, opacity: 0.65 }} />
      </div>
      {/* Card */}
      <div className="flex-1 min-w-0 ml-1.5 bg-gray-800/50 rounded-lg px-2.5 py-1.5"
           style={{ borderLeft: `2px solid ${dotClr}50` }}>
        <p className="text-[11px] font-medium text-gray-200 leading-tight truncate">{task.text}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-[9px] ${PRIO_LABEL[task.priority] ?? 'text-gray-500'}`}>{meta.emoji}</span>
          {task.durationMins && (
            <span className="text-[9px] text-gray-600">{task.durationMins}m</span>
          )}
          {badge && <span className={`text-[9px] font-medium ${badge.cls}`}>{badge.text}</span>}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Terminus ─────────────────────────────────────────────────────────────────
function Terminus() {
  return (
    <div className="flex gap-0 items-center">
      <div className="flex justify-center" style={{ width: 20, flexShrink: 0 }}>
        <div className="w-3 h-3 rounded-full border-2 border-gray-700 bg-gray-900 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-gray-700" />
        </div>
      </div>
      <p className="ml-1.5 text-[9px] text-gray-700 tracking-widest uppercase font-semibold">end of route</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
const TimelineDock = () => {
  const { tasks, lockedTaskId, uncompleteTask } = useTasksStore()
  const { timelineDockVisible } = useSettingsStore()
  const deductXP = useXPStore((s) => s.deductXP)
  const today = todayStr()

  // Wrap undo to also reverse XP
  const handleUndo = (taskId) => {
    const t = tasks.find((x) => x.id === taskId)
    uncompleteTask(taskId)
    if (t?._xpGranted > 0) deductXP(t._xpGranted)
  }

  const { completed, active, upcoming } = useMemo(() => {
    const complList = tasks
      .filter((t) => t.completedAt && isToday(t.completedAt))
      .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))

    const activeTask = lockedTaskId
      ? (tasks.find((t) => t.id === lockedTaskId) ?? null)
      : null

    const hasOverdue = tasks.some(
      (t) => !t.completedAt && t.dueDate && compareDateKeys(t.dueDate, today) < 0
    )

    const pendingList = tasks
      .filter((t) => {
        if (t.completedAt) return false
        if (t.id === lockedTaskId) return false
        if (!t.dueDate) return false
        const diff = compareDateKeys(t.dueDate, today)
        if (diff > 0) return false
        if (diff === 0 && hasOverdue) return false
        return true
      })
      .sort((a, b) => {
        const dd = compareDateKeys(a.dueDate, b.dueDate)
        return dd !== 0 ? dd : (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0)
      })

    return { completed: complList, active: activeTask, upcoming: pendingList }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, lockedTaskId, today])

  if (!timelineDockVisible) return null
  if (completed.length === 0 && !active && upcoming.length === 0) return null

  const totalStops = completed.length + (active ? 1 : 0) + upcoming.length
  const doneCount  = completed.length

  return (
    <AnimatePresence>
      <motion.div
        key="metro-dock"
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="fixed top-16 right-4 z-30 w-56 rounded-xl shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(7,10,14,0.96)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Header ── */}
        <div className="px-3 py-2 flex items-center justify-between"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[10px] font-black tracking-widest uppercase text-gray-400">Today's Route</span>
          <span className="text-[10px] font-bold tabular-nums"
                style={{ color: doneCount > 0 ? '#4ade80' : '#6b7280' }}>
            {doneCount} <span className="text-gray-600">/</span> {totalStops}
            <span className="text-gray-600 font-normal"> stops</span>
          </span>
        </div>

        {/* ── Route ── */}
        <div className="px-2.5 py-2 flex flex-col gap-0 max-h-[65vh] overflow-y-auto"
             style={{ scrollbarWidth: 'none' }}>
          <AnimatePresence mode="popLayout">
            {/* Past stations */}
            {completed.map((task, i) => (
              <div key={task.id + '-wrap'}>
                <PastStation task={task} onUndo={handleUndo} />
                {(i < completed.length - 1 || active || upcoming.length > 0) && (
                  <TrackLine status="done" />
                )}
              </div>
            ))}

            {/* Connector into current */}
            {active && completed.length > 0 && <TrackLine key="conn-active" status="active" />}

            {/* Current station */}
            {active && (
              <div key="active-station">
                <CurrentStation task={active} />
                {upcoming.length > 0 && <TrackLine status="active" />}
              </div>
            )}

            {/* Upcoming stations */}
            {upcoming.map((task, i) => (
              <div key={task.id + '-wrap'}>
                <UpcomingStation task={task} index={i} />
                {i < upcoming.length - 1 && <TrackLine status="future" />}
              </div>
            ))}
          </AnimatePresence>

          {/* Terminus */}
          <div className="mt-2">
            {upcoming.length > 0 && <TrackLine status="future" />}
            <Terminus />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default TimelineDock
