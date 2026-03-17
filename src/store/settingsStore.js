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
      timerAlertTone: 'chime',
      timerAlertRepeat: true,
      timerAlertIntervalSec: 5,
      timerAlertVolume: 0.12,
      doNotDisturb: false,       // mute all notifications except deadline alerts
      autopilotEnabled: false,   // ADHD Autopilot mode
      timelineDockVisible: true, // show timeline dock when tasks have due dates
      activeView: 'list',        // 'list' | 'planner' | 'focus'
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleConfetti: () => set((s) => ({ confettiEnabled: !s.confettiEnabled })),
      toggleGamification: () => set((s) => ({ gamificationEnabled: !s.gamificationEnabled })),
      toggleTimer: () => set((s) => ({ timerVisible: !s.timerVisible })),
      toggleDoNotDisturb: () => set((s) => ({ doNotDisturb: !s.doNotDisturb })),
      toggleAutopilot: () => set((s) => ({ autopilotEnabled: !s.autopilotEnabled })),
      toggleTimelineDock: () => set((s) => ({ timelineDockVisible: !s.timelineDockVisible })),
      setTimerAlertTone: (timerAlertTone) => set({ timerAlertTone }),
      setTimerAlertRepeat: (timerAlertRepeat) => set({ timerAlertRepeat }),
      setTimerAlertIntervalSec: (timerAlertIntervalSec) => set({ timerAlertIntervalSec }),
      setTimerAlertVolume: (timerAlertVolume) => set({ timerAlertVolume }),
      setActiveView: (view) => set({ activeView: view }),
    }),
    {
      name: 'settings-storage',
      storage: createFileStorage(),
      version: 3,
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, ...rest } = state
        return rest
      },
      migrate: (persisted, version) => {
        if (version < 2) {
          persisted = { ...persisted, timerVisible: false }
        }
        if (version < 3) {
          return {
            ...persisted,
            timerAlertTone: 'chime',
            timerAlertRepeat: true,
            timerAlertIntervalSec: 5,
            timerAlertVolume: 0.12,
          }
        }
        return persisted
      },
    }
  )
)

export default useSettingsStore