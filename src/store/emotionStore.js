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
      // Persistent checkpoint — prevents check-in from replaying on reload
      checkpointCount: 0,
      checkpointDate: null,
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
      setCheckpoint: (count, dateStr) => set({ checkpointCount: count, checkpointDate: dateStr }),
    }),
    { name: 'emotion-storage', storage: createFileStorage() }
  )
)

export default useEmotionStore