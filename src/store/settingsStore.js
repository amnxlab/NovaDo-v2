import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'

// Settings store
const useSettingsStore = create(
  persist(
    (set) => ({
      soundEnabled: true,
      confettiEnabled: true,
      gamificationEnabled: true,
      timerVisible: false,
      doNotDisturb: false,       // mute all notifications except deadline alerts
      autopilotEnabled: false,   // ADHD Autopilot mode
      timelineDockVisible: true, // show timeline dock when tasks have due dates
      activeView: 'list',        // 'list' | 'planner' | 'focus'
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleConfetti: () => set((s) => ({ confettiEnabled: !s.confettiEnabled })),
      toggleGamification: () => set((s) => ({ gamificationEnabled: !s.gamificationEnabled })),
      toggleTimer: () => set((s) => ({ timerVisible: !s.timerVisible })),
      toggleDoNotDisturb: () => set((s) => ({ doNotDisturb: !s.doNotDisturb })),
      toggleAutopilot: () => set((s) => ({ autopilotEnabled: !s.autopilotEnabled })),
      toggleTimelineDock: () => set((s) => ({ timelineDockVisible: !s.timelineDockVisible })),
      setActiveView: (view) => set({ activeView: view }),
    }),
    {
      name: 'settings-storage',
      storage: createFileStorage(),
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          return { ...persisted, timerVisible: false }
        }
        return persisted
      },
    }
  )
)

export default useSettingsStore