import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Auth store — persisted to plain localStorage only (not file server)
// Token is used to authenticate all API requests
const useAuthStore = create(
  persist(
    (set) => ({
      user: null,   // { id, username, createdAt }
      token: null,  // JWT string

      setAuth: (user, token) => set({ user, token }),

      clearAuth: () => {
        set({ user: null, token: null })
        // Clear all store caches from localStorage on logout
        const storeKeys = [
          'tasks-storage', 'xp-storage', 'settings-storage', 'analytics-storage',
          'customization-storage', 'emotion-storage', 'ai-coach-storage',
          'tags-storage', 'routines-storage', 'roadmaps-storage',
          'parking-lot-storage', 'distraction-storage',
        ]
        storeKeys.forEach((k) => localStorage.removeItem(k))
      },
    }),
    {
      name: 'auth-storage',
      // Intentionally uses default localStorage — no file server for auth
    }
  )
)

// Read token without subscribing (for use in fileStorage.js)
export function getAuthToken() {
  try {
    const raw = localStorage.getItem('auth-storage')
    if (!raw) return null
    return JSON.parse(raw)?.state?.token ?? null
  } catch {
    return null
  }
}

// Alternative: get token from the store itself (works in browser)
export function getTokenFromStore() {
  return useAuthStore.getState().token
}

export default useAuthStore
