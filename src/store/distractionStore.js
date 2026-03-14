import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { nanoid } from 'nanoid'

const CATEGORIES = ['social-media', 'phone', 'people', 'thought', 'hunger', 'noise', 'other']

const useDistractionStore = create(
  persist(
    (set, get) => ({
      logs: [],
      categories: CATEGORIES,

      addLog: (description, category = 'other') => {
        set((state) => ({
          logs: [
            { id: nanoid(), description: description.trim(), category, timestamp: new Date().toISOString() },
            ...state.logs,
          ],
        }))
      },

      removeLog: (id) =>
        set((state) => ({ logs: state.logs.filter((l) => l.id !== id) })),

      clearAll: () => set({ logs: [] }),

      // Summary: count per category for a given day (ISO date string like '2026-03-14')
      daySummary: (dateStr) => {
        const logs = get().logs.filter((l) => l.timestamp.startsWith(dateStr))
        const counts = {}
        logs.forEach((l) => {
          counts[l.category] = (counts[l.category] || 0) + 1
        })
        return { total: logs.length, counts }
      },
    }),
    {
      name: 'distraction-storage',
      storage: createFileStorage(),
    }
  )
)

export default useDistractionStore
