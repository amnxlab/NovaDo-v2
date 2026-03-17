import { isAuthStoreHydrated } from '../store/authStore'

const API_BASE = '/api/store'
const STORAGE_META_KEY = '__storageMeta'
const OFFLINE_QUEUE_PREFIX = '__novado_offline_snapshot__'
const CONFLICT_SNAPSHOT_PREFIX = '__novado_conflict_snapshot__'

// Keep a lightweight per-tab client id (no localStorage dependency)
let storageClientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const getStorageClientId = () => storageClientId

// All requests use credentials:'include' so the browser sends the auth cookie.
// No Authorization header needed — the server reads the HTTP-only cookie.
const FETCH_DEFAULTS = { credentials: 'include' }

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForAuthReady = async (timeoutMs = 800) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (isAuthStoreHydrated()) return
    await wait(20)
  }
}

const queueKey = (name) => `${OFFLINE_QUEUE_PREFIX}:${name}`
const conflictKey = (name) => `${CONFLICT_SNAPSHOT_PREFIX}:${name}`
const latestServerRevisions = new Map()
const syncStateByStore = new Map()
const syncSubscribers = new Set()
let syncStatusUpdatedAt = Date.now()

const setSyncState = (name, status, detail = '') => {
  syncStateByStore.set(name, { status, detail, updatedAt: Date.now() })
  syncStatusUpdatedAt = Date.now()
  const summary = getPersistenceSyncSummary()
  syncSubscribers.forEach((cb) => {
    try {
      cb(summary)
    } catch {
      // ignore subscriber errors
    }
  })
}

const inferOverallStatus = () => {
  const statuses = [...syncStateByStore.values()].map((entry) => entry.status)
  if (statuses.includes('conflict')) return 'conflict'
  if (statuses.includes('offline')) return 'offline'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.includes('error')) return 'error'
  return 'synced'
}

export function getPersistenceSyncSummary() {
  const stores = [...syncStateByStore.entries()].map(([name, value]) => ({ name, ...value }))
  return {
    overall: inferOverallStatus(),
    stores,
    counts: {
      pending: stores.filter((s) => s.status === 'pending').length,
      offline: stores.filter((s) => s.status === 'offline').length,
      conflict: stores.filter((s) => s.status === 'conflict').length,
      error: stores.filter((s) => s.status === 'error').length,
      synced: stores.filter((s) => s.status === 'synced').length,
    },
    lastUpdatedAt: syncStatusUpdatedAt,
  }
}

export function subscribePersistenceSync(listener) {
  if (typeof listener !== 'function') return () => { }
  syncSubscribers.add(listener)
  listener(getPersistenceSyncSummary())
  return () => {
    syncSubscribers.delete(listener)
  }
}

const writeOfflineSnapshot = (name, serialized) => {
  try {
    localStorage.setItem(queueKey(name), serialized)
    setSyncState(name, 'offline', 'Queued locally until connection is restored')
  } catch {
    // ignore
  }
}

const readOfflineSnapshot = (name) => {
  try {
    return localStorage.getItem(queueKey(name))
  } catch {
    return null
  }
}

const clearOfflineSnapshot = (name) => {
  try {
    localStorage.removeItem(queueKey(name))
  } catch {
    // ignore
  }
}

const writeConflictSnapshot = (name, conflictPayload) => {
  try {
    localStorage.setItem(conflictKey(name), JSON.stringify(conflictPayload))
    setSyncState(name, 'conflict', 'Manual conflict resolution required')
  } catch {
    // ignore
  }
}

const clearConflictSnapshot = (name) => {
  try {
    localStorage.removeItem(conflictKey(name))
  } catch {
    // ignore
  }
}

const readConflictSnapshot = (name) => {
  try {
    const raw = localStorage.getItem(conflictKey(name))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const getKnownRevision = (name) => {
  const revision = latestServerRevisions.get(name)
  return Number.isInteger(revision) ? revision : null
}

const rememberRevision = (name, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
  const revision = payload?.[STORAGE_META_KEY]?.serverRevision
  if (Number.isInteger(revision)) {
    latestServerRevisions.set(name, revision)
  }
}

const writeHeaders = (name) => {
  const headers = { 'Content-Type': 'application/json' }
  const expectedRevision = getKnownRevision(name)
  if (Number.isInteger(expectedRevision)) {
    headers['X-Expected-Revision'] = String(expectedRevision)
  }
  return headers
}

const fetchWithTimeout = async (url, options = {}, timeoutMs = 5000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...FETCH_DEFAULTS, ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const flushOfflineSnapshot = async (name) => {
  const queued = readOfflineSnapshot(name)
  if (!queued) return false

  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        headers: writeHeaders(name),
        body: queued,
      },
      5000
    )
    if (res.status === 409) {
      const serverConflict = await res.json().catch(() => ({}))
      writeConflictSnapshot(name, {
        at: Date.now(),
        name,
        localSnapshot: JSON.parse(queued),
        server: serverConflict,
      })
      return false
    }
    if (!res.ok) {
      setSyncState(name, 'error', `Server rejected queued write (${res.status})`)
      return false
    }
    const payload = await res.json().catch(() => null)
    if (payload && Number.isInteger(payload.serverRevision)) {
      latestServerRevisions.set(name, payload.serverRevision)
    }
    clearConflictSnapshot(name)
    clearOfflineSnapshot(name)
    setSyncState(name, 'synced', 'Queued changes synced to server')
    return true
  } catch {
    setSyncState(name, 'offline', 'Still offline; queued changes retained')
    return false
  }
}

const withStorageMeta = (name, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const existingMeta = value[STORAGE_META_KEY]
  const expectedRevision = getKnownRevision(name)
  return {
    ...value,
    [STORAGE_META_KEY]: {
      ...(existingMeta && typeof existingMeta === 'object' ? existingMeta : {}),
      updatedAt: Date.now(),
      clientId: getStorageClientId(),
      ...(Number.isInteger(expectedRevision) ? { serverRevision: expectedRevision } : {}),
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
 * createFileStorage - server-first persistence.
 * Auth is handled via HTTP-only cookie (auto-sent by browser).
 * No Authorization headers needed.
 */
export function createFileStorage() {
  return {
    /**
     * Async getItem - fetches from server. Cookie is sent automatically.
     */
    getItem: async (name) => {
      await waitForAuthReady()
      const legacyLocal = readLocalForMigration(name)
      let serverValue = null
      let serverReadSucceeded = false

      try {
        const res = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(name)}`)
        if (res.ok) {
          serverReadSucceeded = true
          serverValue = await res.json()
        } else if (res.status === 401) {
          // Not authenticated yet — use offline snapshot if available
          setSyncState(name, 'offline', 'Waiting for authentication')
        } else {
          setSyncState(name, 'error', `Read failed (${res.status})`)
        }
      } catch {
        // server unreachable — fall through
        setSyncState(name, 'offline', 'Server unreachable while reading')
      }

      const appliedQueuedSnapshot = await flushOfflineSnapshot(name)
      if (appliedQueuedSnapshot) {
        const queued = readOfflineSnapshot(name)
        if (!queued) {
          const latest = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(name)}`)
            .then((res) => (res.ok ? res.json() : null)).catch(() => null)
          if (latest !== null && latest !== undefined) return stripStorageMeta(latest)
        }
      }

      if (serverValue !== null && serverValue !== undefined) {
        rememberRevision(name, serverValue)
        clearConflictSnapshot(name)
        clearLocal(name)
        setSyncState(name, 'synced', 'Loaded from server')
        return stripStorageMeta(serverValue)
      }

      if (!serverReadSucceeded && legacyLocal) {
        // Server fetch failed: keep legacy local data as temporary fallback.
        setSyncState(name, 'offline', 'Using local fallback while server is unavailable')
        return stripStorageMeta(legacyLocal)
      }

      setSyncState(name, serverReadSucceeded ? 'synced' : 'offline',
        serverReadSucceeded ? 'No server value yet' : 'Waiting for server')
      return null
    },

    /**
     * setItem — write to server only (debounced). Cookie sent automatically.
     */
    setItem: (name, value) => {
      clearLocal(name)
      const serialized = JSON.stringify(withStorageMeta(name, value))
      setSyncState(name, 'pending', 'Save queued')
      debouncedSave(name, serialized)
    },

    /**
     * removeItem — delete from server and clear any legacy local copy.
     */
    removeItem: (name) => {
      clearLocal(name)
      clearOfflineSnapshot(name)
      clearConflictSnapshot(name)
      latestServerRevisions.delete(name)
      setSyncState(name, 'synced', 'Store reset')
      fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
        ...FETCH_DEFAULTS,
        method: 'DELETE',
      }).catch(() => { })
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
    setSyncState(name, 'pending', 'Saving to server')
    fetchWithTimeout(`${API_BASE}/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: writeHeaders(name),
      body: serialized,
    }, 5000).then(async (res) => {
      if (res.status === 409) {
        const serverConflict = await res.json().catch(() => ({}))
        writeConflictSnapshot(name, {
          at: Date.now(),
          name,
          localSnapshot: JSON.parse(serialized),
          server: serverConflict,
        })
        writeOfflineSnapshot(name, serialized)
        return
      }
      if (!res.ok) {
        setSyncState(name, 'error', `Save failed (${res.status})`)
        writeOfflineSnapshot(name, serialized)
        return
      }
      const payload = await res.json().catch(() => null)
      if (payload && Number.isInteger(payload.serverRevision)) {
        latestServerRevisions.set(name, payload.serverRevision)
      }
      clearConflictSnapshot(name)
      clearOfflineSnapshot(name)
      setSyncState(name, 'synced', 'Saved to server')
    }).catch(() => {
      setSyncState(name, 'offline', 'Save failed while offline; queued')
      writeOfflineSnapshot(name, serialized)
    })
  }, 300)

  pendingWrites.set(name, timer)
}

export function listPersistenceConflicts() {
  try {
    const conflicts = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(`${CONFLICT_SNAPSHOT_PREFIX}:`)) continue
      const name = key.slice(`${CONFLICT_SNAPSHOT_PREFIX}:`.length)
      const payload = readConflictSnapshot(name)
      conflicts.push({ name, payload })
    }
    return conflicts.sort((a, b) => (b.payload?.at ?? 0) - (a.payload?.at ?? 0))
  } catch {
    return []
  }
}

export async function resolvePersistenceConflict(name, strategy = 'server') {
  if (!name) return { ok: false, error: 'Missing store name' }

  if (strategy === 'server') {
    clearConflictSnapshot(name)
    clearOfflineSnapshot(name)
    setSyncState(name, 'synced', 'Conflict resolved using server data')
    return { ok: true }
  }

  if (strategy !== 'local') {
    return { ok: false, error: 'Unknown conflict strategy' }
  }

  await waitForAuthReady()

  const conflict = readConflictSnapshot(name)
  const queued = readOfflineSnapshot(name)
  const candidate = conflict?.localSnapshot || (queued ? JSON.parse(queued) : null)
  if (!candidate) {
    return { ok: false, error: 'No local snapshot found for this conflict' }
  }

  const body = JSON.stringify(candidate)
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        headers: { ...writeHeaders(name), 'X-Force-Write': '1' },
        body,
      },
      5000
    )
    if (!res.ok) {
      setSyncState(name, 'error', `Failed to apply local snapshot (${res.status})`)
      return { ok: false, error: `Failed to apply local snapshot (${res.status})` }
    }
    const payload = await res.json().catch(() => null)
    if (payload && Number.isInteger(payload.serverRevision)) {
      latestServerRevisions.set(name, payload.serverRevision)
    }
    clearConflictSnapshot(name)
    clearOfflineSnapshot(name)
    setSyncState(name, 'synced', 'Conflict resolved using local data')
    return { ok: true }
  } catch {
    setSyncState(name, 'offline', 'Network error while resolving conflict')
    return { ok: false, error: 'Network error while resolving conflict' }
  }
}
