import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useXPStore, {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  MEDAL_TIERS,
  RARITY,
  getForestStage,
  getPlayerTitle,
} from '../store/xpStore'
import { useSkills, makeDynamicAchievements, SKILL_TIERS } from '../store/skillsStore'
import ForestWidget from '../components/ForestWidget'
import MindForest from '../components/MindForest'

// Count achievements per category
const CATEGORY_COUNTS = {}
Object.values(ACHIEVEMENTS).forEach(({ category }) => {
  CATEGORY_COUNTS[category] = (CATEGORY_COUNTS[category] ?? 0) + 1
})

// Tiered achievements — ones where progress toward a count matters
const TIERED_GROUPS = {
  tasks: ['tasks_5', 'tasks_10', 'tasks_25', 'tasks_50', 'tasks_100', 'tasks_250', 'tasks_500', 'tasks_1000'],
  routines: ['routines_10', 'routines_50', 'routines_100'],
  modules: ['modules_10', 'modules_50', 'modules_100'],
  focus: ['focus_sessions_10', 'focus_sessions_50', 'focus_sessions_100'],
  early: ['early_5', 'early_25', 'early_100'],
  streak: ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_60', 'streak_100'],
}

// Map achievement key → which counter drives its progress, and what threshold
const PROGRESS_MAP = {
  tasks_5: { counter: 'totalTasksDone', max: 5 },
  tasks_10: { counter: 'totalTasksDone', max: 10 },
  tasks_25: { counter: 'totalTasksDone', max: 25 },
  tasks_50: { counter: 'totalTasksDone', max: 50 },
  tasks_100: { counter: 'totalTasksDone', max: 100 },
  tasks_250: { counter: 'totalTasksDone', max: 250 },
  tasks_500: { counter: 'totalTasksDone', max: 500 },
  tasks_1000: { counter: 'totalTasksDone', max: 1000 },
  routines_10: { counter: 'totalRoutinesDone', max: 10 },
  routines_50: { counter: 'totalRoutinesDone', max: 50 },
  routines_100: { counter: 'totalRoutinesDone', max: 100 },
  modules_10: { counter: 'totalModulesDone', max: 10 },
  modules_50: { counter: 'totalModulesDone', max: 50 },
  modules_100: { counter: 'totalModulesDone', max: 100 },
  focus_sessions_10: { counter: 'totalFocusSessions', max: 10 },
  focus_sessions_50: { counter: 'totalFocusSessions', max: 50 },
  focus_sessions_100: { counter: 'totalFocusSessions', max: 100 },
  early_5: { counter: 'earlyCompletions', max: 5 },
  early_25: { counter: 'earlyCompletions', max: 25 },
  early_100: { counter: 'earlyCompletions', max: 100 },
  streak_3: { counter: 'streakDays', max: 3 },
  streak_7: { counter: 'streakDays', max: 7 },
  streak_14: { counter: 'streakDays', max: 14 },
  streak_30: { counter: 'streakDays', max: 30 },
  streak_60: { counter: 'streakDays', max: 60 },
  streak_100: { counter: 'streakDays', max: 100 },
}

function MedalBadge({ medal, size = 'sm' }) {
  const tier = MEDAL_TIERS[medal]
  return (
    <span className={`inline-flex items-center gap-1 text-${size === 'sm' ? 'xs' : 'sm'} font-semibold px-2 py-0.5 rounded-full`}
      style={{ color: tier.color, backgroundColor: `${tier.color}15`, border: `1px solid ${tier.color}40` }}>
      {tier.icon} {tier.label}
    </span>
  )
}

function AchievementCard({ achKey, ach, unlocked, unlockedAt, progress, total }) {
  const rarityMeta = RARITY[ach.rarity]
  const medalMeta = MEDAL_TIERS[ach.medal]
  const pct = progress != null ? Math.min(100, Math.round((progress / total) * 100)) : null
  const isSecret = ach.category === 'surprise' && !unlocked

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative rounded-xl p-4 border transition-all ${
        unlocked
          ? `${rarityMeta.bg} border-opacity-60`
          : 'bg-gray-900/60 border-gray-800 opacity-60'
      }`}
      style={unlocked ? { borderColor: `${medalMeta.color}40`, boxShadow: `0 0 12px ${medalMeta.color}18` } : {}}
    >
      {/* Glow for unlocked */}
      {unlocked && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top, ${medalMeta.color}08, transparent 70%)` }}
        />
      )}

      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className={`text-3xl ${unlocked ? '' : 'grayscale opacity-30'} ${isSecret ? 'filter blur-sm' : ''}`}>
          {isSecret ? '❓' : ach.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-bold text-white">{isSecret ? '???  Hidden Achievement' : ach.label}</p>
            {unlocked && <MedalBadge medal={ach.medal} />}
          </div>
          <p className="text-xs text-gray-400">{isSecret ? 'Complete special actions to reveal…' : ach.desc}</p>
        </div>
      </div>

      {/* Rarity + XP bonus */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs font-semibold ${rarityMeta.color}`}>{isSecret ? '✨ Secret' : rarityMeta.label}</span>
        <span className="text-xs text-yellow-400 font-mono">+{ach.xpBonus} XP</span>
      </div>

      {/* Progress bar for tiered achievements */}
      {!unlocked && pct != null && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{progress}/{total}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Unlock date */}
      {unlocked && unlockedAt && (
        <p className="text-[10px] text-gray-600 mt-2">
          Unlocked {new Date(unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      )}
    </motion.div>
  )
}

export default function AchievementsPage() {
  const { points, level, streakDays, achievements, totalTasksDone, totalRoutinesDone,
    totalModulesDone, totalFocusSessions, earlyCompletions } = useXPStore()
  const [activeTab, setActiveTab] = useState('achievements') // 'achievements' | 'skills'
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeMedal, setActiveMedal] = useState(null)
  const [hoveredSkill, setHoveredSkill] = useState(null)

  const skills = useSkills()
  const dynamicAchievements = makeDynamicAchievements(skills)

  const title = getPlayerTitle(level)
  const stage = getForestStage(points)

  const unlockedCount = Object.keys(achievements).length
  const totalCount = Object.keys(ACHIEVEMENTS).length
  const xpFromAchievements = Object.keys(achievements).reduce(
    (sum, k) => sum + (ACHIEVEMENTS[k]?.xpBonus ?? 0), 0
  )

  // Filter achievements
  const counters = { totalTasksDone, totalRoutinesDone, totalModulesDone, totalFocusSessions, earlyCompletions, streakDays }

  const filteredKeys = Object.keys(ACHIEVEMENTS).filter((key) => {
    const ach = ACHIEVEMENTS[key]
    if (activeCategory !== 'all' && ach.category !== activeCategory) return false
    if (activeMedal && ach.medal !== activeMedal) return false
    return true
  })

  // Sort: unlocked first, then by rarity weight
  const rarityWeight = { legendary: 0, epic: 1, rare: 2, common: 3 }
  const sortedKeys = [...filteredKeys].sort((a, b) => {
    const aUnlocked = !!achievements[a]
    const bUnlocked = !!achievements[b]
    if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1
    return (rarityWeight[ACHIEVEMENTS[a].rarity] ?? 3) - (rarityWeight[ACHIEVEMENTS[b].rarity] ?? 3)
  })

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Achievements</h2>
        <p className="text-sm text-gray-500">Your journey, milestones, and medals.</p>
      </div>

      {/* Stats banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Unlocked', value: `${unlockedCount}/${totalCount}`, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'XP from Badges', value: `${xpFromAchievements}`, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
          { label: 'Title', value: title, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Skills Mapped', value: skills.filter(s => s.totalCourses > 0).length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl p-3 text-center border ${bg}`}>
            <div className={`text-lg font-bold ${color} leading-tight`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
            activeTab === 'achievements'
              ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
              : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          🏆 Achievements
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
            activeTab === 'skills'
              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
              : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          🌲 Mind Forest{skills.filter(s => s.treeStage > 0).length > 0 && (
            <span className="ml-1.5 text-[10px] bg-emerald-700/40 text-emerald-300 px-1.5 py-0.5 rounded-full">
              {skills.filter(s => s.treeStage > 0).length}
            </span>
          )}
        </button>
      </div>

      {/* ── SKILLS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'skills' && (
        <AnimatePresence mode="wait">
          <motion.div key="skills" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Mind Forest */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white">🌲 Your Mind Forest</h3>
                <p className="text-xs text-gray-500">Tag skills on courses in your roadmaps to grow trees</p>
              </div>
              <MindForest
                skills={skills}
                onSkillClick={(skill) => setHoveredSkill(hoveredSkill?.key === skill.key ? null : skill)}
              />
            </div>

            {/* Skill cards */}
            {skills.filter(s => s.totalCourses > 0).length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <p className="text-3xl mb-3">🌱</p>
                <p className="font-medium text-gray-400 mb-1">No skills mapped yet</p>
                <p className="text-sm">Open a roadmap, edit a course, and add skills you'll gain from it.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {skills.filter(s => s.totalCourses > 0).map((skill) => {
                  const tierMeta = SKILL_TIERS[skill.tier]
                  const medalMeta = skill.medal ? MEDAL_TIERS[skill.medal] : null
                  const icons = { unexplored: '🌫️', initiate: '🌱', practitioner: '🌿', master: '🌳', legend: '🌲' }
                  return (
                    <motion.div
                      key={skill.key}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-xl p-4 border transition-all"
                      style={{
                        borderColor: `${skill.color}30`,
                        backgroundColor: `${skill.color}08`,
                        boxShadow: skill.treeStage >= 4 ? `0 0 16px ${skill.glowColor}18` : 'none',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{icons[skill.tier]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white">{skill.name}</p>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: skill.color, backgroundColor: `${skill.color}15`, border: `1px solid ${skill.color}30` }}>
                              {tierMeta.label}
                            </span>
                            {medalMeta && (
                              <span className="text-xs font-semibold" style={{ color: medalMeta.color }}>
                                {medalMeta.icon} {medalMeta.label}
                              </span>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                              <span>{skill.completedCourses}/{skill.totalCourses} courses</span>
                              <span>{skill.pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${skill.pct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: skill.color }}
                              />
                            </div>
                          </div>
                          {/* Roadmaps */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.values(skill.roadmapNames).map((name) => (
                              <span key={name} className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">📍 {name}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* Medal Wall */}
            {Object.keys(dynamicAchievements).length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-white mb-3">🏅 Skill Medals Earned</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(dynamicAchievements).map(([key, ach]) => {
                    const medalMeta = MEDAL_TIERS[ach.medal]
                    const rarityMeta = RARITY[ach.rarity]
                    return (
                      <motion.div
                        key={key}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`relative rounded-xl p-3 border ${rarityMeta.bg}`}
                        style={{ borderColor: `${medalMeta.color}40`, boxShadow: `0 0 10px ${medalMeta.color}15` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{ach.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white leading-tight">{ach.label}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-semibold" style={{ color: medalMeta.color }}>{medalMeta.icon} {medalMeta.label}</span>
                              <span className="text-[10px] text-yellow-400">+{ach.xpBonus} XP</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── ACHIEVEMENTS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'achievements' && (
        <div className="flex gap-6 items-start">
          {/* Left: Forest Widget */}
          <div className="w-64 shrink-0 sticky top-4">
            <ForestWidget xp={points} />
          </div>

          {/* Right: filters + achievement grid */}
          <div className="flex-1 min-w-0">
            {/* Category tabs */}
            <div className="flex gap-2 flex-wrap mb-4">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeCategory === 'all' ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                All ({totalCount})
              </button>
              {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => {
                const catUnlocked = Object.keys(achievements).filter((k) => ACHIEVEMENTS[k]?.category === key).length
                const catTotal = CATEGORY_COUNTS[key] ?? 0
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(activeCategory === key ? 'all' : key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                      activeCategory === key ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                    <span className={`ml-1 ${activeCategory === key ? 'text-purple-200' : 'text-gray-600'}`}>
                      {catUnlocked}/{catTotal}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Medal tier filter */}
            <div className="flex gap-2 flex-wrap mb-6">
              {Object.entries(MEDAL_TIERS).map(([key, tier]) => (
                <button
                  key={key}
                  onClick={() => setActiveMedal(activeMedal === key ? null : key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                    activeMedal === key
                      ? 'text-white'
                      : 'bg-gray-900 text-gray-500 hover:text-gray-300 border-gray-800'
                  }`}
                  style={activeMedal === key ? { borderColor: tier.color, color: tier.color, backgroundColor: `${tier.color}15` } : {}}
                >
                  {tier.icon} {tier.label}
                </button>
              ))}
              {activeMedal && (
                <button onClick={() => setActiveMedal(null)} className="text-xs text-gray-500 hover:text-gray-300 px-2">
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Achievement grid */}
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedKeys.map((key) => {
                  const ach = ACHIEVEMENTS[key]
                  const pm = PROGRESS_MAP[key]
                  const progress = pm ? (counters[pm.counter] ?? 0) : null
                  return (
                    <AchievementCard
                      key={key}
                      achKey={key}
                      ach={ach}
                      unlocked={!!achievements[key]}
                      unlockedAt={achievements[key]?.unlockedAt}
                      progress={progress}
                      total={pm?.max ?? null}
                    />
                  )
                })}
              </div>
            </AnimatePresence>

            {sortedKeys.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                <p className="text-2xl mb-2">🔍</p>
                <p>No achievements match this filter.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
