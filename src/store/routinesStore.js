import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { nanoid } from 'nanoid'

const today = () => new Date().toISOString().slice(0, 10)

const makeStep = (text, durationMins = 5, xp = 10) => ({
  id: nanoid(), text, durationMins, xp,
})

export const ROUTINE_PRESETS = {
  morning: {
    name: 'Morning Routine', emoji: '🌅', scheduledLabel: 'Morning',
    steps: [
      makeStep('Drink a full glass of water', 1, 5),
      makeStep('Quick stretch or movement', 5, 10),
      makeStep('Splash face, brush teeth', 5, 10),
      makeStep("Review today's top 3 tasks", 3, 15),
      makeStep('Set an intention for the day', 2, 10),
    ],
  },
  evening: {
    name: 'Evening Wind-Down', emoji: '🌙', scheduledLabel: 'Evening',
    steps: [
      makeStep('Brain-dump — write anything still on your mind', 5, 10),
      makeStep('Review what you completed today', 3, 10),
      makeStep("Set tomorrow's top 3 tasks", 3, 15),
      makeStep('Put devices on charge + away from bed', 2, 5),
      makeStep('5-minute wind-down (stretch/breathe)', 5, 10),
    ],
  },
  work: {
    name: 'Work Session Start', emoji: '💼', scheduledLabel: 'Before work',
    steps: [
      makeStep('Clear your desk / workspace', 3, 5),
      makeStep('Close unneeded tabs and apps', 2, 5),
      makeStep('Pick ONE task to start with', 2, 15),
      makeStep('Enable Do Not Disturb', 1, 5),
      makeStep('Set a 25-min focus timer', 1, 10),
    ],
  },
  reset: {
    name: 'Midday Reset', emoji: '☀️', scheduledLabel: 'Midday',
    steps: [
      makeStep('Step away from screen for 5 min', 5, 10),
      makeStep('Drink water and eat something', 5, 10),
      makeStep('Quick 2-min breathing / body scan', 2, 10),
      makeStep('Re-prioritise remaining tasks', 3, 15),
    ],
  },
}

const makeRoutine = ({ name, emoji, scheduledLabel, steps }) => ({
  id: nanoid(), name, emoji, scheduledLabel,
  steps: steps.map((s) => ({ ...s, id: nanoid() })),
  streak: 0, longestStreak: 0, lastCompletedDate: null,
  createdAt: new Date().toISOString(),
})

const useRoutinesStore = create(
  persist(
    (set, get) => ({
      routines: [],

      addRoutineFromPreset: (presetKey) => {
        const preset = ROUTINE_PRESETS[presetKey]
        if (!preset) return
        set((s) => ({ routines: [...s.routines, makeRoutine(preset)] }))
      },

      addCustomRoutine: (name, emoji = '📋', scheduledLabel = 'Anytime', steps = []) => {
        const r = makeRoutine({ name, emoji, scheduledLabel, steps })
        set((s) => ({ routines: [...s.routines, r] }))
        return r.id
      },

      deleteRoutine: (id) =>
        set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),

      addStep: (routineId, text, durationMins = 5, xp = 10) =>
        set((s) => ({
          routines: s.routines.map((r) =>
            r.id === routineId
              ? { ...r, steps: [...r.steps, makeStep(text, durationMins, xp)] }
              : r
          ),
        })),

      removeStep: (routineId, stepId) =>
        set((s) => ({
          routines: s.routines.map((r) =>
            r.id === routineId
              ? { ...r, steps: r.steps.filter((st) => st.id !== stepId) }
              : r
          ),
        })),

      completeRoutine: (id) =>
        set((s) => ({
          routines: s.routines.map((r) => {
            if (r.id !== id) return r
            const td = today()
            if (r.lastCompletedDate === td) return r
            const diff = r.lastCompletedDate
              ? (new Date(td) - new Date(r.lastCompletedDate)) / 86400000
              : 2
            const newStreak = diff > 1 ? 1 : r.streak + 1
            return {
              ...r,
              streak: newStreak,
              longestStreak: Math.max(r.longestStreak, newStreak),
              lastCompletedDate: td,
            }
          }),
        })),

      isDoneToday: (id) =>
        get().routines.find((r) => r.id === id)?.lastCompletedDate === today(),
    }),
    { name: 'routines-storage', storage: createFileStorage() }
  )
)

export default useRoutinesStore
