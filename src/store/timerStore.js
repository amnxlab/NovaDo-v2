import { create } from 'zustand'

// Timer store
const useTimerStore = create((set) => ({
  mode: 'work',
  remaining: 1500, // 25 minutes
  running: false,
  sessions: 0,
  toggle: () => {
    set((state) => ({
      running: !state.running,
    }))
  },
  reset: () => {
    set((state) => {
      const nextMode = state.mode === 'work' ? 'break' : 'work'
      return {
        mode: nextMode,
        remaining: nextMode === 'work' ? 1500 : 300,
        running: false,
        sessions: state.mode === 'work' ? state.sessions + 1 : state.sessions,
      }
    })
  },
  fullReset: () => {
    set({
      mode: 'work',
      remaining: 1500,
      running: false,
      sessions: 0,
    })
  },
  tick: () => {
    set((state) => ({
      remaining: state.remaining - 1,
    }))
  },
}))

export default useTimerStore