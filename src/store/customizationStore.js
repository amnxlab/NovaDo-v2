import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'

// Customization store
const useCustomizationStore = create(
  persist(
    (set) => ({
      colorScheme: 'dark',
      animationIntensity: 'medium',
      fontSize: 'medium',
      backgroundPattern: 'none',
      highContrast: false,
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
      toggleColorScheme: () => {
        set((state) => ({ colorScheme: state.colorScheme === 'dark' ? 'light' : 'dark' }))
      },
      setAnimationIntensity: (intensity) => {
        set({ animationIntensity: intensity })
      },
      setFontSize: (size) => {
        set({ fontSize: size })
      },
      setBackgroundPattern: (pattern) => {
        set({ backgroundPattern: pattern })
      },
      toggleHighContrast: () => {
        set((state) => ({ highContrast: !state.highContrast }))
      },
    }),
    {
      name: 'customization-storage',
      storage: createFileStorage(),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, ...rest } = state
        return rest
      },
    }
  )
)

export default useCustomizationStore