import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Auth store — stores only the user profile object (not the token).
// The JWT token lives in an HTTP-only cookie managed by the server,
// so it is invisible to JavaScript and persists across devices automatically.
const useAuthStore = create(
  persist(
    (set) => ({
      user: null,   // { id, username, createdAt }
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      setAuth: (user) => set({ user }),

      clearAuth: async () => {
        // Tell the server to clear the cookie, then wipe local state.
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        } catch {
          // ignore network errors — cookie will expire on its own
        }
        // Purge this user's queued offline writes and conflict snapshots from
        // localStorage so they are never accidentally flushed by a future login.
        // Reset all in-memory storage state (revisions, pending timers, etc.)
        // so the next session starts completely clean.
        // Lazy import to avoid circular dependency (fileStorage imports authStore).
        const userId = useAuthStore.getState().user?.id
        try {
          const { clearAllOfflineSnapshots, resetFileStorage } = await import('../utils/fileStorage')
          if (userId) clearAllOfflineSnapshots(userId)
          resetFileStorage()
        } catch { /* ignore — page reload will clear in-memory state anyway */ }
        set({ user: null })
        // Reload to flush all in-memory Zustand state between sessions
        window.location.replace('/')
      },
    }),
    {
      name: 'auth-storage',
      // Use sessionStorage so the profile is gone when the tab/browser closes,
      // but the HTTP-only cookie keeps the user logged in across devices.
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, clearAuth, ...rest } = state
        return rest
      },
    }
  )
)

// The token is now in an HTTP-only cookie — not accessible to JS.
// These functions return null/false so fileStorage doesn't try to add Bearer headers.
export function getAuthToken() {
  return null
}

export function getTokenFromStore() {
  return null
}

// Auth is considered hydrated once the store has rehydrated from sessionStorage.
// We also consider it ready if there's already a user in the store.
export function isAuthStoreHydrated() {
  return !!useAuthStore.getState()._hasHydrated
}

export default useAuthStore
