import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { DEFAULT_TAGS } from '../utils/autoTagger'

const useTagsStore = create(
  persist(
    (set) => ({
      tags: { ...DEFAULT_TAGS },

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
    { name: 'tags-storage', storage: createFileStorage() }
  )
)

export default useTagsStore
