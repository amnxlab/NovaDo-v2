import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { PRIORITIES } from './tasksStore'

const isSameDay = (d1, d2) => {
  const a = new Date(d1)
  const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const isYesterday = (d1, d2) => {
  const a = new Date(d1)
  const b = new Date(d2)
  a.setDate(a.getDate() + 1)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// XP achievements — unlocked once, stored by key
export const ACHIEVEMENTS = {
  first_task:       { label: 'First Step',       desc: 'Complete your first task',                 emoji: '🌱', xpBonus: 25 },
  streak_3:         { label: 'Habit Starting',   desc: '3-day streak',                             emoji: '🔥', xpBonus: 50 },
  streak_7:         { label: 'Week Warrior',     desc: '7-day streak',                             emoji: '🏆', xpBonus: 100 },
  deadline_dodger:  { label: 'Deadline Dodger',  desc: 'Complete a task before its due date',      emoji: '⏱️', xpBonus: 30 },
  focus_chain_5:    { label: 'In The Zone',      desc: '5 tasks in a row without breaking focus',  emoji: '⚡', xpBonus: 60 },
  tag_organizer:    { label: 'Tag Organizer',    desc: 'Use 3 different tags in a session',        emoji: '🏷️', xpBonus: 20 },
  // Roadmap achievements
  roadmap_first:    { label: 'First Lecture',    desc: 'Complete your first roadmap module',        emoji: '🎓', xpBonus: 30 },
  roadmap_streak_3: { label: 'Study Habit',      desc: '3-day roadmap streak',                     emoji: '📚', xpBonus: 50 },
  roadmap_streak_7: { label: 'Scholar',          desc: '7-day roadmap streak',                     emoji: '🏛️', xpBonus: 100 },
  fast_chain_3:     { label: 'Speed Runner',     desc: '3 consecutive days of fast-mode modules',  emoji: '⚡', xpBonus: 75 },
  mode_mastery_10:  { label: 'Mode Master',      desc: 'Complete 10 modules in fast mode',          emoji: '🌟', xpBonus: 150 },
  course_complete:  { label: 'Course Cleared',   desc: 'Complete all modules in a course',          emoji: '🎯', xpBonus: 200 },
  roadmap_complete: { label: 'Path Conquered',   desc: 'Complete an entire learning roadmap',       emoji: '🗺️', xpBonus: 500 },
}

/**
 * Calculate XP for a completed task with all multipliers applied.
 * baseXP comes from priority; multipliers stack multiplicatively.
 */
export const calcTaskXP = ({ priority = 'medium', earlyBonus = false, subtaskCount = 0 }) => {
  const base = PRIORITIES[priority]?.xp ?? 20
  let multiplier = 1
  if (earlyBonus) multiplier *= 1.2   // +20% for beating deadline
  const subtaskBonus = subtaskCount * 5
  return Math.round(base * multiplier) + subtaskBonus
}

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
      recentXPGain: 0,  // last award amount — for XP popup display

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
        })
        return true
      },

      resetFocusStreak: () => {
        set({ focusStreak: 0, focusStreakStart: null })
      },
    }),
    { name: 'xp-storage', storage: createFileStorage() }
  )
)

export default useXPStore