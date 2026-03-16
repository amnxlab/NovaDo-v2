import { getTokenFromStore } from '../store/authStore'

const API_BASE = '/api/store'
const STORAGE_META_KEY = '__storageMeta'

// Keep a lightweight per-tab client id (no localStorage dependency)
let storageClientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const getStorageClientId = () => storageClientId

const authHeaders = () => {
  const token = getTokenFromStore()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const withStorageMeta = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return {
    ...value,
    [STORAGE_META_KEY]: {
      updatedAt: Date.now(),
      clientId: getStorageClientId(),
    },
  }
}

const stripStorageMeta = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const { [STORAGE_META_KEY]: _storageMeta, ...rest } = value
  return rest
}

const readLocalForMigration = (name) => {
  try {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const clearLocal = (name) => {
  try {
    localStorage.removeItem(name)
  } catch {
    // ignore
  }
}

/**
 * createFileStorage - server-first persistence with optional one-time migration
 * from old localStorage entries. No new data is written to localStorage.
 */
export function createFileStorage() {
  return {
    /**
    * Async getItem - fetches from server; if missing but a legacy local copy
    * exists, uploads it once to the server (when authenticated) and returns it.
     */
    getItem: async (name) => {
      const token = getTokenFromStore()
      const legacyLocal = readLocalForMigration(name)
      let serverValue = null

      if (token) {
        try {
          const res = await fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
            headers: authHeaders(),
          })
          if (res.ok) {
            serverValue = await res.json()
          }
        } catch {
          // server unreachable — fall through
        }
      }

      if (serverValue !== null && serverValue !== undefined) {
        clearLocal(name)
        return stripStorageMeta(serverValue)
      }

      if (token && legacyLocal) {
        // One-time migrate legacy local data to server, then stop using local
        const payload = JSON.stringify(withStorageMeta(legacyLocal))
        debouncedSave(name, payload)
        clearLocal(name)
        return stripStorageMeta(legacyLocal)
      }

      // If not authenticated or nothing to fetch
      clearLocal(name)
      return null
    },

    /**
     * setItem — write to server only (debounced). Requires an auth token.
     */
    setItem: (name, value) => {
      clearLocal(name)
      const token = getTokenFromStore()
      if (!token) {
        console.warn('Persist skipped: no auth token available')
        return
      }
      const serialized = JSON.stringify(withStorageMeta(value))
      debouncedSave(name, serialized)
    },

    /**
     * removeItem — delete from server and clear any legacy local copy.
     */
    removeItem: (name) => {
      clearLocal(name)
      const token = getTokenFromStore()
      if (!token) return
      fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => {})
    },
  }
}

// Debounce writes to server to avoid hammering on rapid state changes
const pendingWrites = new Map()

function debouncedSave(name, serialized) {
  if (pendingWrites.has(name)) {
    clearTimeout(pendingWrites.get(name))
  }

  const timer = setTimeout(() => {
    pendingWrites.delete(name)
    const token = getTokenFromStore()
    if (token) {
      fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: serialized,
      }).catch(() => {
        // ignore; will try again on next state change
      })
    }
  }, 300)

  pendingWrites.set(name, timer)
}
