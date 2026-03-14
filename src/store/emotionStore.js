import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'

// Emotion store
const useEmotionStore = create(
  persist(
    (set) => ({
      emotions: [], // { taskId, emotion, energy, timestamp }
      currentMood: null,
      currentEnergy: 5,
      addEmotion: (taskId, emotion, energy) => {
        set((state) => ({
          emotions: [...state.emotions, { taskId, emotion, energy, timestamp: new Date().toISOString() }],
          currentMood: emotion,
          currentEnergy: energy,
        }))
      },
      clearEmotion: () => {
        set({ currentMood: null, currentEnergy: 5 })
      },
    }),
    { name: 'emotion-storage', storage: createFileStorage() }
  )
)

export default useEmotionStore