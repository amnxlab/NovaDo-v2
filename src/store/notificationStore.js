import { create } from 'zustand'

// Notification store — intentionally NOT persisted; notifications are ephemeral
const useNotificationStore = create(
  (set) => ({
    notifications: [],
    addNotification: (message, type = 'info', duration = 5000) => {
      const id = Date.now() + Math.random()
      set((state) => ({
        // Keep at most 5 at a time
        notifications: [...state.notifications.slice(-4), { id, message, type }],
      }))
      // Auto-dismiss after duration
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }))
      }, duration)
    },
    clearNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
    clearAll: () => set({ notifications: [] }),
  })
)

export default useNotificationStore