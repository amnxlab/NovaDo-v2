import { getTokenFromStore } from '../store/authStore'

const API_BASE = '/api/store'
const STORAGE_META_KEY = '__storageMeta'
const STORAGE_CLIENT_ID_KEY = '__novado_storage_client_id'

function getStorageClientId() {
  let clientId = localStorage.getItem(STORAGE_CLIENT_ID_KEY)
  if (!clientId) {
    clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(STORAGE_CLIENT_ID_KEY, clientId)
  }
  return clientId
}

function withStorageMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value

  return {
    ...value,
    [STORAGE_META_KEY]: {
      updatedAt: Date.now(),
      clientId: getStorageClientId(),
    },
  }
}

function stripStorageMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const { [STORAGE_META_KEY]: _storageMeta, ...rest } = value
  return rest
}

function getUpdatedAt(value) {
  return value?.[STORAGE_META_KEY]?.updatedAt ?? 0
}

function parseStoredValue(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function chooseNewestValue(localValue, serverValue) {
  if (!localValue) return serverValue
  if (!serverValue) return localValue

  const localUpdatedAt = getUpdatedAt(localValue)
  const serverUpdatedAt = getUpdatedAt(serverValue)

  if (localUpdatedAt === 0 && serverUpdatedAt === 0) {
    return serverValue
  }

  return localUpdatedAt >= serverUpdatedAt ? localValue : serverValue
}

function authHeaders() {
  const token = getTokenFromStore()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * createFileStorage — returns a Zustand PersistStorage-compatible adapter.
 *
 * Zustand's persist middleware uses the PersistStorage interface where:
 *   - getItem(name)          → returns StorageValue { state, version } | null  (or Promise thereof)
 *   - setItem(name, value)   → receives StorageValue { state, version } (an object, NOT a string)
 *   - removeItem(name)       → removes the stored data
 *
 * We store data as JSON strings on both localStorage (fast cache) and the
 * Express server (durable). We must JSON.stringify/parse at our layer.
 */
export function createFileStorage() {
  return {
    /**
     * Async getItem — Zustand awaits this Promise before hydrating the store.
     * Server is always preferred over localStorage when the user is logged in.
     * Falls back to localStorage cache if the server is unreachable.
     * Returns a parsed StorageValue object (or null), NOT a raw JSON string.
     */
    getItem: async (name) => {
      const token = getTokenFromStore()
      const localValue = parseStoredValue(localStorage.getItem(name))
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
          // Server unreachable — fall through to localStorage cache
        }
      }

      const chosenValue = chooseNewestValue(localValue, serverValue)
      if (chosenValue !== null) {
        localStorage.setItem(name, JSON.stringify(chosenValue))
        if (token && chosenValue === localValue && localValue !== serverValue) {
          debouncedSave(name, JSON.stringify(localValue))
        }
        return stripStorageMeta(chosenValue)
      }

      return null
    },

    /**
     * setItem — Zustand calls this with a StorageValue { state, version } object.
     * We must JSON.stringify it before storing in localStorage or sending to server.
     */
    setItem: (name, value) => {
      const valueWithMeta = withStorageMeta(value)
      const serialized = JSON.stringify(valueWithMeta)

      // 1. Write to localStorage immediately (fast, synchronous)
      localStorage.setItem(name, serialized)

      // 2. Persist to server (durable) — debounced to avoid hammering on rapid changes
      debouncedSave(name, serialized)
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
        body: serialized, // JSON string of the StorageValue { state, version } object
      }).catch(() => {
        // Server down — data is still in localStorage cache
      })
    }
  }, 500)

  pendingWrites.set(name, timer)
}
