import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { DEFAULT_TAGS } from '../utils/autoTagger'

const useTagsStore = create(
  persist(
    (set) => ({
      tags: { ...DEFAULT_TAGS },
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      addTag: (key, def) =>
        set((s) => ({ tags: { ...s.tags, [key]: def } })),

      removeTag: (key) =>
        set((s) => {
          const next = { ...s.tags }
          delete next[key]
          return { tags: next }
        }),

      resetTags: () => set({ tags: { ...DEFAULT_TAGS } }),
    }),
    {
      name: 'tags-storage',
      storage: createFileStorage(),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, ...rest } = state
        return rest
      },
    }
  )
)

export default useTagsStore
