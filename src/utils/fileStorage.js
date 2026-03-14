/**
 * Custom Zustand storage adapter that persists to JSON files on the backend
 * while keeping localStorage as a fast synchronous cache.
 */

import { getAuthToken } from '../store/authStore'

const API_BASE = '/api/store'

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function createFileStorage() {
  return {
    getItem: (name) => {
      // 1. Return localStorage immediately for fast hydration
      const cached = localStorage.getItem(name)

      // 2. Async-fetch from server and update localStorage if server has newer data
      const token = getAuthToken()
      if (token) {
        fetch(`${API_BASE}/${encodeURIComponent(name)}`, { headers: authHeaders() })
          .then((res) => res.json())
          .then((serverData) => {
            if (serverData !== null) {
              const serverStr = JSON.stringify(serverData)
              const localStr = localStorage.getItem(name)
              if (serverStr !== localStr) {
                localStorage.setItem(name, serverStr)
                // Trigger a page-level event so stores can rehydrate if needed
                window.dispatchEvent(new CustomEvent('novado-sync', { detail: { name } }))
              }
            }
          })
          .catch(() => {
            // Server down — localStorage cache is fine
          })
      }

      return cached
    },

    setItem: (name, value) => {
      // 1. Write to localStorage immediately (fast)
      localStorage.setItem(name, value)

      // 2. Write to server (durable) — debounced
      debouncedSave(name, value)
    },

    removeItem: (name) => {
      localStorage.removeItem(name)
      fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => {})
    },
  }
}

// Debounce writes to server to avoid hammering on rapid state changes
const pendingWrites = new Map()

function debouncedSave(name, value) {
  if (pendingWrites.has(name)) {
    clearTimeout(pendingWrites.get(name))
  }

  const timer = setTimeout(() => {
    pendingWrites.delete(name)
    fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: value, // Already JSON-stringified by Zustand
    }).catch(() => {
      // Server down — data is still in localStorage
    })
  }, 500)

  pendingWrites.set(name, timer)
}

// On app startup, sync any localStorage data to server in case server files are empty
export async function initialSync() {
  const storeNames = [
    'tasks-storage', 'xp-storage', 'settings-storage', 'analytics-storage',
    'customization-storage', 'emotion-storage', 'ai-coach-storage',
    'tags-storage', 'routines-storage', 'roadmaps-storage',
  ]

  for (const name of storeNames) {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(name)}`)
      const serverData = await res.json()

      if (serverData !== null) {
        // Server has data — use it as source of truth
        localStorage.setItem(name, JSON.stringify(serverData))
      } else {
        // Server empty — push localStorage to server
        const local = localStorage.getItem(name)
        if (local) {
          await fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: local,
          })
        }
      }
    } catch {
      // Server not reachable — continue with localStorage only
    }
  }
}
