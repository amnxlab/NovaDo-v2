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
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
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
    {
      name: 'analytics-storage',
      storage: createFileStorage(),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, ...rest } = state
        return rest
      },
    }
  )
)

export default useAnalyticsStore