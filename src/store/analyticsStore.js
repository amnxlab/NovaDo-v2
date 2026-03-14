import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'

// Analytics store
const useAnalyticsStore = create(
  persist(
    (set) => ({
      focusSessions: [], // { start, end, duration, tasksCompleted }
      dailyStats: [], // { date, tasksCompleted, focusTime, tasksCreated }
      weeklyStreaks: [],
      addFocusSession: (duration, tasksCompleted) => {
        set((state) => ({
          focusSessions: [...state.focusSessions, { start: new Date().toISOString(), duration, tasksCompleted }],
        }))
      },
      addDailyStat: (tasksCompleted, focusTime, tasksCreated) => {
        set((state) => ({
          dailyStats: [...state.dailyStats, { date: new Date().toISOString(), tasksCompleted, focusTime, tasksCreated }],
        }))
      },
      addWeeklyStreak: (days) => {
        set((state) => ({
          weeklyStreaks: [...state.weeklyStreaks, { weeks: state.weeklyStreaks.length + 1, days }],
        }))
      },
    }),
    { name: 'analytics-storage', storage: createFileStorage() }
  )
)

export default useAnalyticsStore