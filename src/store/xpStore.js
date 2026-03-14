import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { PRIORITIES } from './tasksStore'

const isSameDay = (d1, d2) => {
  const a = new Date(d1); const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
const isYesterday = (d1, d2) => {
  const a = new Date(d1); a.setDate(a.getDate() + 1); const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ── Medal tiers ────────────────────────────────────────────────────────────────
export const MEDAL_TIERS = {
  bronze:   { label: 'Bronze',   color: '#cd7f32', glow: 'shadow-amber-700',   ring: 'ring-amber-700',   icon: '🥉' },
  silver:   { label: 'Silver',   color: '#c0c0c0', glow: 'shadow-slate-400',   ring: 'ring-slate-400',   icon: '🥈' },
  gold:     { label: 'Gold',     color: '#ffd700', glow: 'shadow-yellow-400',  ring: 'ring-yellow-400',  icon: '🥇' },
  platinum: { label: 'Platinum', color: '#e5e4e2', glow: 'shadow-cyan-300',    ring: 'ring-cyan-300',    icon: '💎' },
}

// ── Rarity ────────────────────────────────────────────────────────────────────
export const RARITY = {
  common:    { label: 'Common',    color: 'text-gray-400',   bg: 'bg-gray-700/50'     },
  rare:      { label: 'Rare',      color: 'text-blue-400',   bg: 'bg-blue-900/30'     },
  epic:      { label: 'Epic',      color: 'text-purple-400', bg: 'bg-purple-900/30'   },
  legendary: { label: 'Legendary', color: 'text-yellow-400', bg: 'bg-yellow-900/20'   },
}

// ── Player titles by level ─────────────────────────────────────────────────────
export const PLAYER_TITLES = [
  { minLevel: 1,   title: 'Seedling'      },
  { minLevel: 5,   title: 'Apprentice'    },
  { minLevel: 10,  title: 'Journeyman'    },
  { minLevel: 20,  title: 'Achiever'      },
  { minLevel: 30,  title: 'Expert'        },
  { minLevel: 50,  title: 'Specialist'    },
  { minLevel: 75,  title: 'Master'        },
  { minLevel: 100, title: 'Grandmaster'   },
  { minLevel: 150, title: 'Legend'        },
  { minLevel: 200, title: 'Mythic'        },
]
export const getPlayerTitle = (level) =>
  [...PLAYER_TITLES].reverse().find((t) => level >= t.minLevel)?.title ?? 'Seedling'

// ── Forest growth stages ───────────────────────────────────────────────────────
export const FOREST_STAGES = [
  { minXP: 0,    label: 'Barren Land',    emoji: '🌑',  desc: 'Not a single sprout yet.' },
  { minXP: 50,   label: 'Seedling',       emoji: '🌱',  desc: 'A tiny sprout appears!' },
  { minXP: 150,  label: 'Sapling',        emoji: '🪴',  desc: 'Growing with intention.' },
  { minXP: 350,  label: 'Young Tree',     emoji: '🌿',  desc: 'Roots are deepening.' },
  { minXP: 700,  label: 'Full Tree',      emoji: '🌳',  desc: 'Standing tall and strong.' },
  { minXP: 1200, label: 'Ancient Tree',   emoji: '🎋',  desc: 'Weathering every storm.' },
  { minXP: 2000, label: 'Small Grove',    emoji: '🌲🌲', desc: 'A peaceful grove forms.' },
  { minXP: 3500, label: 'Forest',         emoji: '🌲🌲🌲', desc: 'Your forest breathes with life.' },
  { minXP: 6000, label: 'Ancient Forest', emoji: '🏔️🌲🌲🌲', desc: 'A legend carved in wood.' },
]
export const getForestStage = (xp) =>
  [...FOREST_STAGES].reverse().find((s) => xp >= s.minXP) ?? FOREST_STAGES[0]

// ── Achievement catalog ────────────────────────────────────────────────────────
// category: first_steps | streaks | focus | forest | scholar | routines | sharpshooter | surprise
export const ACHIEVEMENTS = {

  // ═══════════════════ 🌱 FIRST STEPS ════════════════════════════════════════
  first_task:       { label: 'First Step',          desc: 'Complete your very first task',            emoji: '🌱', category: 'first_steps', medal: 'bronze',   rarity: 'common',    xpBonus: 25  },
  first_routine:    { label: 'Creature of Habit',   desc: 'Complete your first routine',              emoji: '🔄', category: 'first_steps', medal: 'bronze',   rarity: 'common',    xpBonus: 25  },
  first_roadmap:    { label: 'Scholar Emerges',     desc: 'Start your first roadmap',                 emoji: '🎓', category: 'first_steps', medal: 'bronze',   rarity: 'common',    xpBonus: 25  },
  first_focus:      { label: 'Into the Zone',       desc: 'Use Focus Mode for the first time',         emoji: '🎯', category: 'first_steps', medal: 'bronze',   rarity: 'common',    xpBonus: 20  },
  first_parking:    { label: 'Brain Offload',       desc: 'Add your first item to the Parking Lot',   emoji: '🅿️', category: 'first_steps', medal: 'bronze',   rarity: 'common',    xpBonus: 15  },
  first_subtask:    { label: 'Task Surgeon',        desc: 'Split a task into subtasks for the first time', emoji: '🧩', category: 'first_steps', medal: 'bronze', rarity: 'common', xpBonus: 15  },
  first_3_wins:     { label: 'Set & Conquer',       desc: 'Complete your Daily 3 Wins for the first time', emoji: '🏅', category: 'first_steps', medal: 'silver', rarity: 'rare',   xpBonus: 50  },

  // ═══════════════════ 🔥 STREAKS ════════════════════════════════════════════
  streak_3:         { label: 'Habit Forming',       desc: '3-day task completion streak',             emoji: '🔥', category: 'streaks', medal: 'bronze',   rarity: 'common',    xpBonus: 50   },
  streak_7:         { label: 'Week Warrior',        desc: '7-day streak',                             emoji: '🏆', category: 'streaks', medal: 'silver',   rarity: 'rare',      xpBonus: 100  },
  streak_14:        { label: 'Fortnight Force',     desc: '14-day streak',                            emoji: '💪', category: 'streaks', medal: 'silver',   rarity: 'rare',      xpBonus: 150  },
  streak_30:        { label: 'Month of Might',      desc: '30-day streak',                            emoji: '🌕', category: 'streaks', medal: 'gold',     rarity: 'epic',      xpBonus: 300  },
  streak_60:        { label: 'Diamond Discipline',  desc: '60-day streak',                            emoji: '💎', category: 'streaks', medal: 'gold',     rarity: 'epic',      xpBonus: 600  },
  streak_100:       { label: 'Century Streak',      desc: '100 consecutive days',                     emoji: '🌟', category: 'streaks', medal: 'platinum', rarity: 'legendary', xpBonus: 1000 },

  // ═══════════════════ ⚡ FOCUS & SPEED ═══════════════════════════════════════
  focus_chain_5:    { label: 'In The Zone',         desc: '5 tasks in a row without breaking focus',  emoji: '⚡', category: 'focus', medal: 'bronze',   rarity: 'common',    xpBonus: 60  },
  focus_chain_10:   { label: 'Locked In',           desc: '10 consecutive focused tasks',             emoji: '🔒', category: 'focus', medal: 'silver',   rarity: 'rare',      xpBonus: 120 },
  focus_chain_25:   { label: 'The Immovable',       desc: '25 consecutive focused tasks',             emoji: '🗿', category: 'focus', medal: 'gold',     rarity: 'epic',      xpBonus: 300 },
  focus_sessions_10:{ label: 'Focus Apprentice',    desc: 'Complete 10 tasks via Focus Mode',         emoji: '🎯', category: 'focus', medal: 'bronze',   rarity: 'common',    xpBonus: 80  },
  focus_sessions_50:{ label: 'Focus Expert',        desc: 'Complete 50 tasks via Focus Mode',         emoji: '🏹', category: 'focus', medal: 'silver',   rarity: 'rare',      xpBonus: 200 },
  focus_sessions_100:{ label: 'Focus Master',       desc: 'Complete 100 tasks via Focus Mode',        emoji: '🧠', category: 'focus', medal: 'gold',     rarity: 'epic',      xpBonus: 500 },
  one_thing_mode:   { label: 'The One Thing',       desc: 'Complete a task in Focus Mode with 0 distractions', emoji: '🎪', category: 'focus', medal: 'silver', rarity: 'rare', xpBonus: 75 },

  // ═══════════════════ 🌿 FOREST (task count milestones) ═════════════════════
  tasks_5:          { label: 'First Sprout',        desc: 'Complete 5 tasks',                         emoji: '🌱', category: 'forest', medal: 'bronze',   rarity: 'common',    xpBonus: 30  },
  tasks_10:         { label: 'Little Sapling',      desc: 'Complete 10 tasks',                        emoji: '🪴', category: 'forest', medal: 'bronze',   rarity: 'common',    xpBonus: 50  },
  tasks_25:         { label: 'Growing Branches',    desc: 'Complete 25 tasks',                        emoji: '🌿', category: 'forest', medal: 'bronze',   rarity: 'common',    xpBonus: 75  },
  tasks_50:         { label: 'Firm Trunk',          desc: 'Complete 50 tasks',                        emoji: '🌳', category: 'forest', medal: 'silver',   rarity: 'rare',      xpBonus: 100 },
  tasks_100:        { label: 'Forest Guardian',     desc: 'Complete 100 tasks',                       emoji: '🏕️', category: 'forest', medal: 'silver',   rarity: 'rare',      xpBonus: 200 },
  tasks_250:        { label: 'Ancient Roots',       desc: 'Complete 250 tasks',                       emoji: '🎋', category: 'forest', medal: 'gold',     rarity: 'epic',      xpBonus: 400 },
  tasks_500:        { label: 'Thousand-Year Tree',  desc: 'Complete 500 tasks',                       emoji: '🌲', category: 'forest', medal: 'gold',     rarity: 'epic',      xpBonus: 750 },
  tasks_1000:       { label: 'Living Legend',       desc: 'Complete 1000 tasks',                      emoji: '🏔️', category: 'forest', medal: 'platinum', rarity: 'legendary', xpBonus: 2000},

  // ═══════════════════ 📚 SCHOLAR (roadmaps) ══════════════════════════════════
  roadmap_first:    { label: 'First Lecture',       desc: 'Complete your first roadmap module',       emoji: '📖', category: 'scholar', medal: 'bronze',   rarity: 'common',    xpBonus: 30  },
  roadmap_streak_3: { label: 'Study Habit',         desc: '3-day learning streak',                    emoji: '📚', category: 'scholar', medal: 'bronze',   rarity: 'common',    xpBonus: 50  },
  roadmap_streak_7: { label: 'Weekly Scholar',      desc: '7-day learning streak',                    emoji: '🏛️', category: 'scholar', medal: 'silver',   rarity: 'rare',      xpBonus: 100 },
  roadmap_streak_30:{ label: 'Academic',            desc: '30-day learning streak',                   emoji: '🎓', category: 'scholar', medal: 'gold',     rarity: 'epic',      xpBonus: 400 },
  modules_10:       { label: 'Module Muncher',      desc: 'Complete 10 roadmap modules',               emoji: '📦', category: 'scholar', medal: 'bronze',   rarity: 'common',    xpBonus: 60  },
  modules_50:       { label: 'Curriculum Crusher',  desc: 'Complete 50 modules',                      emoji: '📋', category: 'scholar', medal: 'silver',   rarity: 'rare',      xpBonus: 150 },
  modules_100:      { label: 'Knowledge Hoarder',   desc: 'Complete 100 modules',                     emoji: '🧬', category: 'scholar', medal: 'gold',     rarity: 'epic',      xpBonus: 350 },
  course_complete:  { label: 'Course Cleared',      desc: 'Complete all modules in a single course',  emoji: '🎯', category: 'scholar', medal: 'gold',     rarity: 'epic',      xpBonus: 200 },
  roadmap_complete: { label: 'Path Conquered',      desc: 'Complete an entire roadmap',               emoji: '🗺️', category: 'scholar', medal: 'platinum', rarity: 'legendary', xpBonus: 500 },
  fast_chain_3:     { label: 'Speed Runner',        desc: '3 consecutive days of fast-mode modules',  emoji: '💨', category: 'scholar', medal: 'silver',   rarity: 'rare',      xpBonus: 75  },
  mode_mastery_10:  { label: 'Mode Master',         desc: 'Complete 10 modules in fast mode',         emoji: '🌟', category: 'scholar', medal: 'silver',   rarity: 'rare',      xpBonus: 150 },

  // ═══════════════════ 🏃 ROUTINE MASTER ══════════════════════════════════════
  routine_streak_7: { label: 'Routine Rookie',      desc: '7-day routine completion streak',          emoji: '📅', category: 'routines', medal: 'bronze',   rarity: 'common',    xpBonus: 75  },
  routine_streak_14:{ label: 'Consistent Creature', desc: '14-day routine streak',                    emoji: '🔁', category: 'routines', medal: 'silver',   rarity: 'rare',      xpBonus: 150 },
  routine_streak_30:{ label: 'Habit Architect',     desc: '30-day routine streak',                    emoji: '🏗️', category: 'routines', medal: 'gold',     rarity: 'epic',      xpBonus: 400 },
  routine_streak_60:{ label: 'System Builder',      desc: '60-day routine streak',                    emoji: '⚙️', category: 'routines', medal: 'gold',     rarity: 'epic',      xpBonus: 700 },
  routines_10:      { label: 'Routine Runner',      desc: 'Complete 10 full routines',                emoji: '🏃', category: 'routines', medal: 'bronze',   rarity: 'common',    xpBonus: 60  },
  routines_50:      { label: 'Ritual Keeper',       desc: 'Complete 50 full routines',                emoji: '🕯️', category: 'routines', medal: 'silver',   rarity: 'rare',      xpBonus: 200 },
  routines_100:     { label: 'Automation King',     desc: 'Complete 100 full routines',               emoji: '🤖', category: 'routines', medal: 'gold',     rarity: 'epic',      xpBonus: 500 },

  // ═══════════════════ 🎯 SHARPSHOOTER (deadlines) ═══════════════════════════
  deadline_dodger:  { label: 'Deadline Dodger',     desc: 'Complete a task before its due date',      emoji: '⏱️', category: 'sharpshooter', medal: 'bronze', rarity: 'common',   xpBonus: 30  },
  early_5:          { label: 'Always Early',        desc: 'Beat 5 deadlines early',                   emoji: '🏎️', category: 'sharpshooter', medal: 'bronze', rarity: 'common',   xpBonus: 60  },
  early_25:         { label: 'Time Wizard',         desc: 'Beat 25 deadlines early',                  emoji: '🧙', category: 'sharpshooter', medal: 'silver', rarity: 'rare',     xpBonus: 150 },
  early_100:        { label: 'Chrono Master',       desc: 'Beat 100 deadlines early',                 emoji: '⌛', category: 'sharpshooter', medal: 'gold',   rarity: 'epic',     xpBonus: 400 },
  hard_deadline:    { label: 'Steel Nerves',        desc: 'Complete a hard-deadline task before it expires', emoji: '🔩', category: 'sharpshooter', medal: 'silver', rarity: 'rare', xpBonus: 80 },
  tag_organizer:    { label: 'Tag Organizer',       desc: 'Use 3 different tags in one session',      emoji: '🏷️', category: 'sharpshooter', medal: 'bronze', rarity: 'common',   xpBonus: 20  },

  // ═══════════════════ 🌙 SURPRISE / HIDDEN ═══════════════════════════════════
  early_bird:       { label: 'Early Bird',          desc: 'Complete a task before 8 AM',              emoji: '🌅', category: 'surprise', medal: 'silver',   rarity: 'rare',      xpBonus: 60  },
  night_owl:        { label: 'Night Owl',           desc: 'Complete a task after 10 PM',              emoji: '🦉', category: 'surprise', medal: 'silver',   rarity: 'rare',      xpBonus: 60  },
  weekend_warrior:  { label: 'Weekend Warrior',     desc: 'Complete 5+ tasks on a Saturday or Sunday', emoji: '🎮', category: 'surprise', medal: 'bronze',   rarity: 'common',    xpBonus: 50  },
  comeback_kid:     { label: 'Comeback Kid',        desc: 'Return after a 7+ day break and complete a task', emoji: '💫', category: 'surprise', medal: 'silver', rarity: 'rare',   xpBonus: 100 },
  overwhelm_reset:  { label: 'Deep Breath',         desc: 'Use the Overwhelm Button and come back to work', emoji: '😮‍💨', category: 'surprise', medal: 'bronze', rarity: 'common', xpBonus: 30 },
  hat_trick:        { label: 'Hat Trick',           desc: 'Complete all 3 Daily Wins in one session', emoji: '🎩', category: 'surprise', medal: 'gold',     rarity: 'epic',      xpBonus: 150 },
  speed_demon:      { label: 'Speed Demon',         desc: 'Complete 5 tasks in under 30 minutes',     emoji: '🚀', category: 'surprise', medal: 'gold',     rarity: 'epic',      xpBonus: 120 },
  zen_master:       { label: 'Zen Master',          desc: 'Finish a breathing exercise in the Overwhelm modal', emoji: '🧘', category: 'surprise', medal: 'silver', rarity: 'rare', xpBonus: 50 },
  triple_category:  { label: 'Renaissance',         desc: 'Complete a task, routine, and module in one day', emoji: '🌈', category: 'surprise', medal: 'gold',   rarity: 'epic',  xpBonus: 200 },
}

// ── Category metadata ──────────────────────────────────────────────────────────
export const ACHIEVEMENT_CATEGORIES = {
  first_steps:   { label: 'First Steps',       emoji: '🌱', desc: 'Getting started milestones' },
  streaks:       { label: 'Streaks',           emoji: '🔥', desc: 'Consistency & habit tracking' },
  focus:         { label: 'Focus & Speed',     emoji: '⚡', desc: 'Deep work & lock-in sessions' },
  forest:        { label: 'Forest Growth',     emoji: '🌿', desc: 'Task count milestones' },
  scholar:       { label: 'Scholar',           emoji: '📚', desc: 'Roadmap & learning mastery' },
  routines:      { label: 'Routine Master',    emoji: '🏃', desc: 'Routine consistency' },
  sharpshooter:  { label: 'Sharpshooter',      emoji: '🎯', desc: 'Deadlines & organization' },
  surprise:      { label: 'Hidden & Rare',     emoji: '🌙', desc: 'Secret achievements to discover' },
}

// ── XP helpers ─────────────────────────────────────────────────────────────────
export const calcTaskXP = ({ priority = 'medium', earlyBonus = false, subtaskCount = 0 }) => {
  const base = PRIORITIES[priority]?.xp ?? 20
  let multiplier = 1
  if (earlyBonus) multiplier *= 1.2
  const subtaskBonus = subtaskCount * 5
  return Math.round(base * multiplier) + subtaskBonus
}

// ── Store ─────────────────────────────────────────────────────────────────────
const useXPStore = create(
  persist(
    (set, get) => ({
      points: 0,
      level: 1,
      streakDays: 0,
      todayCount: 0,
      lastActiveDate: null,
      focusStreak: 0,
      focusStreakStart: null,
      taskChains: 0,
      lastTaskId: null,
      achievements: {}, // { [key]: { unlockedAt: ISO } }
      recentXPGain: 0,
      lastUnlockedAchievement: null, // key — for toast display

      // ── Counters (persisted) ───────────────────────────────────────────────
      totalTasksDone: 0,
      totalRoutinesDone: 0,
      totalModulesDone: 0,
      totalFocusSessions: 0,
      earlyCompletions: 0,
      // daily composite tracker for triple_category
      dailyComposite: null, // { date, task, routine, module }

      awardXP: (amount, taskId = null) => {
        const now = new Date().toISOString()
        const { lastActiveDate, todayCount, streakDays, points, focusStreak, focusStreakStart, taskChains, lastTaskId } = get()

        let newStreak = streakDays
        let newTodayCount = todayCount + 1
        let newFocusStreak = focusStreak
        let newFocusStreakStart = focusStreakStart
        let newTaskChains = taskChains

        if (lastActiveDate) {
          if (isSameDay(lastActiveDate, now)) {
            // same day, keep streak
          } else if (isYesterday(lastActiveDate, now)) {
            newStreak = streakDays + 1
            newTodayCount = 1
          } else {
            newStreak = 1
            newTodayCount = 1
          }
        } else {
          newStreak = 1
          newTodayCount = 1
        }

        if (taskId) {
          if (lastTaskId && isSameDay(lastActiveDate, now)) {
            newFocusStreak = focusStreak + 1
            if (!focusStreakStart) newFocusStreakStart = now
          } else {
            newFocusStreak = 1
            newFocusStreakStart = now
          }
        }

        if (taskId && lastTaskId && isSameDay(lastActiveDate, now)) {
          newTaskChains = taskChains + 1
        }

        const newPoints = points + amount
        set({
          points: newPoints,
          level: Math.floor(newPoints / 100) + 1,
          todayCount: newTodayCount,
          streakDays: newStreak,
          focusStreak: newFocusStreak,
          focusStreakStart: newFocusStreakStart,
          taskChains: newTaskChains,
          lastTaskId: taskId,
          lastActiveDate: now,
          recentXPGain: amount,
        })
      },

      // Unlock an achievement if not already unlocked — returns true if newly unlocked
      unlockAchievement: (key) => {
        const { achievements, points } = get()
        if (achievements[key]) return false
        const achievement = ACHIEVEMENTS[key]
        if (!achievement) return false
        const bonus = achievement.xpBonus
        const newPoints = points + bonus
        set({
          achievements: { ...achievements, [key]: { unlockedAt: new Date().toISOString() } },
          points: newPoints,
          level: Math.floor(newPoints / 100) + 1,
          recentXPGain: bonus,
          lastUnlockedAchievement: key,
        })
        return true
      },

      // Increment a named counter and return new value
      increment: (field, by = 1) => {
        const cur = get()[field] ?? 0
        const next = cur + by
        set({ [field]: next })
        return next
      },

      // Update daily composite tracker (for triple_category achievement)
      markDailyComposite: (type) => {
        const today = new Date().toISOString().slice(0, 10)
        const cur = get().dailyComposite
        const base = cur?.date === today ? cur : { date: today, task: false, routine: false, module: false }
        set({ dailyComposite: { ...base, [type]: true } })
        return { ...base, [type]: true }
      },

      resetFocusStreak: () => set({ focusStreak: 0, focusStreakStart: null }),
    }),
    { name: 'xp-storage', storage: createFileStorage() }
  )
)

export default useXPStore