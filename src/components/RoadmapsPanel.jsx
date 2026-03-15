import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useRoadmapsStore, { LEARNING_MODES } from '../store/roadmapsStore'
import RoadmapDetail from './RoadmapDetail'
import EmojiPicker from './EmojiPicker'
import { compareDateKeys, diffCalendarDays, getTodayDateKey } from '../utils/localDate'

const todayStr = () => getTodayDateKey()

// Path level: every 200 XP = 1 level
const pathLevel = (xp = 0) => ({ level: Math.floor(xp / 200) + 1, progress: xp % 200, next: 200 })

// Milestone thresholds
const MILESTONES = [
  { pct: 25,  emoji: '🥉', label: '25%'  },
  { pct: 50,  emoji: '🥈', label: '50%'  },
  { pct: 75,  emoji: '🥇', label: '75%'  },
  { pct: 100, emoji: '🏆', label: '100%' },
]

const COLOR_TAGS = {
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  green:  'bg-green-500',
  orange: 'bg-orange-500',
  pink:   'bg-pink-500',
  cyan:   'bg-cyan-500',
}

const PRIORITIES = [
  { value: 'low',    emoji: '🟢', label: 'Low'    },
  { value: 'medium', emoji: '🟡', label: 'Medium' },
  { value: 'high',   emoji: '🔴', label: 'High'   },
  { value: 'urgent', emoji: '⚡', label: 'Urgent' },
]

function PrioritySelector({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
            value === p.value
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'
          }`}
        >
          {p.emoji} {p.label}
        </button>
      ))}
    </div>
  )
}

function AddRoadmapForm({ onDone }) {
  const addRoadmap = useRoadmapsStore((s) => s.addRoadmap)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🗺️')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [dailyCapMins, setDailyCapMins] = useState(120)
  const [defaultMode, setDefaultMode] = useState('normal')
  const [colorTag, setColorTag] = useState('blue')
  const [priority, setPriority] = useState('medium')

  const save = () => {
    if (!name.trim()) return
    addRoadmap({
      name: name.trim(),
      emoji,
      description: description.trim(),
      deadline: deadline || null,
      dailyCapMins: Number(dailyCapMins) || 120,
      defaultMode,
      colorTag,
      priority,
    })
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-xl p-4 border border-gray-600 space-y-3"
    >
      <h3 className="text-white font-semibold">New Roadmap</h3>

      <div className="flex gap-2">
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Roadmap name (e.g. RF Engineering Path)"
          className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600 text-sm"
        />
      </div>

      <input
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600 text-sm"
      />

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <label className="text-gray-500 text-xs mb-1 block">Deadline</label>
          <input
            type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-gray-500 text-xs mb-1 block">Daily cap (min)</label>
          <input
            type="number" min="15" max="480" value={dailyCapMins}
            onChange={(e) => setDailyCapMins(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-gray-500 text-xs mb-1 block">Default Learning Mode</label>
        <div className="flex gap-2">
          {Object.entries(LEARNING_MODES).map(([key, mode]) => (
            <button
              key={key}
              onClick={() => setDefaultMode(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                defaultMode === key
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'
              }`}
            >
              {mode.emoji} {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-gray-500 text-xs mb-1 block">Task Priority (applied to auto-injected tasks)</label>
        <PrioritySelector value={priority} onChange={setPriority} />
      </div>

      <div>
        <label className="text-gray-500 text-xs mb-1 block">Color</label>
        <div className="flex gap-2">
          {Object.entries(COLOR_TAGS).map(([key, cls]) => (
            <button
              key={key}
              onClick={() => setColorTag(key)}
              className={`w-7 h-7 rounded-full ${cls} transition-transform ${colorTag === key ? 'scale-125 ring-2 ring-white' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onDone} className="px-4 py-2 text-gray-500 hover:text-white text-sm transition-colors">Cancel</button>
        <button
          onClick={save}
          disabled={!name.trim()}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg font-semibold transition-colors"
        >
          Create Roadmap
        </button>
      </div>
    </motion.div>
  )
}

function RoadmapCard({ roadmap, onOpen }) {
  const deleteRoadmap = useRoadmapsStore((s) => s.deleteRoadmap)
  const getRoadmapProgress = useRoadmapsStore((s) => s.getRoadmapProgress)
  const [confirm, setConfirm] = useState(false)

  const { total, done, pct } = getRoadmapProgress(roadmap.id)
  const td = todayStr()
  const isOverdue = roadmap.deadline && compareDateKeys(roadmap.deadline, td) < 0 && pct < 100
  const daysLeft = roadmap.deadline
    ? diffCalendarDays(roadmap.deadline, td)
    : null

  // Pace check: are we on schedule?
  let paceStatus = null // 'ahead' | 'behind' | 'on'
  if (roadmap.deadline && total > 0 && pct < 100) {
    const totalDays = Math.max(1, diffCalendarDays(roadmap.deadline, roadmap.createdAt))
    const daysPassed = Math.max(0, totalDays - (daysLeft ?? 0))
    const expectedPct = Math.min(100, Math.round((daysPassed / totalDays) * 100))
    if (pct >= expectedPct + 5) paceStatus = 'ahead'
    else if (pct < expectedPct - 5) paceStatus = 'behind'
    else paceStatus = 'on'
  }

  const { level, progress, next } = pathLevel(roadmap.xpEarned || 0)
  const colorDot = COLOR_TAGS[roadmap.colorTag] || 'bg-blue-500'
  const earnedMilestones = MILESTONES.filter((m) => pct >= m.pct)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
    >
      {/* Color accent strip */}
      <div className={`h-1 ${colorDot}`} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">{roadmap.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold truncate">{roadmap.name}</span>
              {/* Path level badge */}
              <span className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded font-bold">
                Lv.{level}
              </span>
              {roadmap.momentumMultiplier > 1 && (
                <span className="text-xs bg-orange-900/40 text-orange-300 border border-orange-700/50 px-1.5 py-0.5 rounded font-semibold">
                  🔥 ×{roadmap.momentumMultiplier}
                </span>
              )}
              {roadmap.fastMasteryActive && (
                <span className="text-xs bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded">🌟 Mastery</span>
              )}
              {/* Milestone badges */}
              {earnedMilestones.map((m) => (
                <span key={m.pct} title={`${m.label} complete`} className="text-sm">{m.emoji}</span>
              ))}
            </div>

            {/* Meta line */}
            <div className="flex items-center gap-3 flex-wrap mt-0.5 text-xs text-gray-500">
              <span>{roadmap.courses.length} course{roadmap.courses.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{done}/{total} modules</span>
              {roadmap.streak > 0 && (
                <>
                  <span>·</span>
                  <span className={roadmap.streak >= 7 ? 'text-orange-400 font-semibold' : roadmap.streak >= 3 ? 'text-yellow-400' : 'text-gray-400'}>
                    🔥 {roadmap.streak}d
                  </span>
                </>
              )}
              {daysLeft !== null && (
                <>
                  <span>·</span>
                  <span className={isOverdue ? 'text-red-400 font-semibold' : daysLeft <= 7 ? 'text-orange-400' : 'text-gray-400'}>
                    {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                  </span>
                </>
              )}
              {/* Pace indicator */}
              {paceStatus && (
                <>
                  <span>·</span>
                  <span className={
                    paceStatus === 'ahead' ? 'text-green-400' :
                    paceStatus === 'behind' ? 'text-red-400' : 'text-blue-400'
                  }>
                    {paceStatus === 'ahead' ? '✓ On pace' : paceStatus === 'behind' ? '⚠ Behind' : '→ On track'}
                  </span>
                </>
              )}
            </div>

            {/* Module progress bar */}
            {total > 0 && (
              <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${pct === 100 ? 'bg-green-500' : colorDot}`}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            {/* XP / level progress bar */}
            {(roadmap.xpEarned || 0) > 0 && (
              <div className="mt-1.5">
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span>Path XP: {roadmap.xpEarned}</span>
                  <span>{progress}/{next} → Lv.{level + 1}</span>
                </div>
                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-indigo-500"
                    animate={{ width: `${(progress / next) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {total > 0 && pct < 100 && (
              <div className="text-xs text-gray-600 mt-1">{pct}% complete · {total - done} remaining</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onOpen(roadmap)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-semibold transition-colors"
            >
              Open
            </button>
            {confirm ? (
              <button
                onClick={() => deleteRoadmap(roadmap.id)}
                className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-900/20 rounded"
              >
                Delete?
              </button>
            ) : (
              <button
                onClick={() => setConfirm(true)}
                onBlur={() => setTimeout(() => setConfirm(false), 150)}
                className="text-gray-600 hover:text-gray-400 w-6 h-6 flex items-center justify-center rounded text-lg"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function RoadmapsPanel({ onStartModule, expanded = false }) {
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const getTodayModules = useRoadmapsStore((s) => s.getTodayModules)
  const [open, setOpen] = useState(expanded)
  const [adding, setAdding] = useState(false)
  const [openRoadmap, setOpenRoadmap] = useState(null)

  const todayModules = getTodayModules()

  // Keep openRoadmap in sync with store updates
  const liveRoadmap = openRoadmap
    ? roadmaps.find((r) => r.id === openRoadmap.id) || null
    : null

  return (
    <>
      <div className="mb-6">
        {!expanded && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between py-2 px-1 text-left group"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                Roadmaps
              </span>
              {roadmaps.length > 0 && (
                <span className="text-xs bg-gray-800 text-gray-500 rounded-full px-2 py-0.5 border border-gray-700">
                  {roadmaps.length} active
                </span>
              )}
              {todayModules.length > 0 && (
                <span className="text-xs bg-blue-900/40 text-blue-400 rounded-full px-2 py-0.5 border border-blue-800/50">
                  {todayModules.length} due today
                </span>
              )}
            </div>
            <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs">
              {open ? '▲' : '▼'}
            </span>
          </button>
        )}

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-1 pb-2">
                {roadmaps.length === 0 && !adding && (
                  <p className="text-gray-600 text-sm py-4 text-center">
                    No roadmaps yet — build your learning path.
                  </p>
                )}

                <AnimatePresence>
                  {roadmaps.map((r) => (
                    <RoadmapCard key={r.id} roadmap={r} onOpen={setOpenRoadmap} />
                  ))}
                </AnimatePresence>

                {adding && <AddRoadmapForm onDone={() => setAdding(false)} />}

                {!adding && (
                  <button
                    onClick={() => setAdding(true)}
                    className="w-full py-2 border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 text-sm rounded-xl transition-colors"
                  >
                    + New Roadmap
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Roadmap Detail Overlay */}
      <AnimatePresence>
        {liveRoadmap && (
          <RoadmapDetail
            roadmap={liveRoadmap}
            onClose={() => setOpenRoadmap(null)}
            onStartModule={onStartModule}
          />
        )}
      </AnimatePresence>
    </>
  )
}
