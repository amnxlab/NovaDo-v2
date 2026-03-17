import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { nanoid } from 'nanoid'

const useParkingLotStore = create(
  persist(
    (set, get) => ({
      items: [],
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      addItem: (text) => {
        if (!text.trim()) return
        set((state) => ({
          items: [
            { id: nanoid(), text: text.trim(), createdAt: new Date().toISOString(), promoted: false },
            ...state.items,
          ],
        }))
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      markPromoted: (id) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, promoted: true } : i)),
        })),

      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'parking-lot-storage',
      storage: createFileStorage(),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, ...rest } = state
        return rest
      },
    }
  )
)

export default useParkingLotStore
