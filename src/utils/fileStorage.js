import { isAuthStoreHydrated } from '../store/authStore'

const API_BASE = '/api/store'
const STORAGE_META_KEY = '__storageMeta'
const OFFLINE_QUEUE_PREFIX = '__novado_offline_snapshot__'
const CONFLICT_SNAPSHOT_PREFIX = '__novado_conflict_snapshot__'

// All requests carry the auth cookie automatically — no auth headers needed.
const FETCH_DEFAULTS = { credentials: 'include' }

// Per-store guard: setItem is blocked until getItem has completed at least once.
// This prevents Zustand's default empty state from overwriting server data.
const serverLoadAttempted = new Set()

let storageClientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const getStorageClientId = () => storageClientId

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForAuthReady = async (timeoutMs = 2000) => {
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
    try { cb(summary) } catch { /* ignore */ }
  })
}

const inferOverallStatus = () => {
  const statuses = [...syncStateByStore.values()].map((e) => e.status)
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
  if (typeof listener !== 'function') return () => {}
  syncSubscribers.add(listener)
  listener(getPersistenceSyncSummary())
  return () => { syncSubscribers.delete(listener) }
}

// ── localStorage helpers (only used for offline queue & conflict snapshots) ──

const writeOfflineSnapshot = (name, serialized) => {
  try {
    localStorage.setItem(queueKey(name), serialized)
    setSyncState(name, 'offline', 'Queued locally until connection is restored')
  } catch { /* ignore */ }
}

const readOfflineSnapshot = (name) => {
  try { return localStorage.getItem(queueKey(name)) } catch { return null }
}

const clearOfflineSnapshot = (name) => {
  try { localStorage.removeItem(queueKey(name)) } catch { /* ignore */ }
}

const writeConflictSnapshot = (name, conflictPayload) => {
  try {
    localStorage.setItem(conflictKey(name), JSON.stringify(conflictPayload))
    setSyncState(name, 'conflict', 'Manual conflict resolution required')
  } catch { /* ignore */ }
}

const clearConflictSnapshot = (name) => {
  try { localStorage.removeItem(conflictKey(name)) } catch { /* ignore */ }
}

const readConflictSnapshot = (name) => {
  try {
    const raw = localStorage.getItem(conflictKey(name))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── Revision tracking ─────────────────────────────────────────────────────────

const getKnownRevision = (name) => {
  const r = latestServerRevisions.get(name)
  return Number.isInteger(r) ? r : null
}

const rememberRevision = (name, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
  const r = payload?.[STORAGE_META_KEY]?.serverRevision
  if (Number.isInteger(r)) latestServerRevisions.set(name, r)
}

const writeHeaders = (name) => {
  const headers = { 'Content-Type': 'application/json' }
  const rev = getKnownRevision(name)
  if (Number.isInteger(rev)) headers['X-Expected-Revision'] = String(rev)
  return headers
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
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
      { method: 'PUT', headers: writeHeaders(name), body: queued },
      8000
    )
    if (res.status === 409) {
      const serverConflict = await res.json().catch(() => ({}))
      writeConflictSnapshot(name, { at: Date.now(), name, localSnapshot: JSON.parse(queued), server: serverConflict })
      return false
    }
    if (!res.ok) {
      setSyncState(name, 'error', `Server rejected queued write (${res.status})`)
      return false
    }
    const payload = await res.json().catch(() => null)
    if (payload && Number.isInteger(payload.serverRevision)) latestServerRevisions.set(name, payload.serverRevision)
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
  const { [STORAGE_META_KEY]: _, ...rest } = value
  return rest
}

// ── Main storage factory ──────────────────────────────────────────────────────

/**
 * createFileStorage — server-first persistence.
 *
 * KEY SAFETY RULE: setItem is blocked until getItem has completed for that store.
 * This prevents Zustand's initial default empty state from overwriting server data.
 */
export function createFileStorage() {
  return {
    /**
     * getItem — fetch from server.
     * Cookie is sent automatically by the browser (httpOnly cookie).
     *
     * IMPORTANT: serverLoadAttempted.add(name) is called synchronously at the
     * very start, before the first await. Zustand calls setItem() inside its
     * .then() chain right as getItem() resolves — so the guard must be in place
     * before any async suspension point, otherwise the initial empty-state write
     * slips through.
     */
    getItem: async (name) => {
      // ← guard enabled FIRST, synchronously, before any await
      serverLoadAttempted.add(name)

      await waitForAuthReady()

      let serverValue = null
      let serverReadSucceeded = false

      try {
        const res = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(name)}`)
        if (res.ok) {
          serverReadSucceeded = true
          serverValue = await res.json()
        } else if (res.status === 401) {
          // Cookie missing — user not logged in yet.
          // Remove from attempted so stores can re-try after login.
          serverLoadAttempted.delete(name)
          setSyncState(name, 'offline', 'Not authenticated — waiting for login')
        } else {
          setSyncState(name, 'error', `Read failed (${res.status})`)
        }
      } catch {
        setSyncState(name, 'offline', 'Server unreachable')
      }

      // Flush any queued offline writes now that server is reachable
      if (serverReadSucceeded) {
        const flushed = await flushOfflineSnapshot(name)
        if (flushed) {
          // Re-read fresh server state after flushing queue
          const latest = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(name)}`)
            .then((r) => (r.ok ? r.json() : null)).catch(() => null)
          if (latest !== null && latest !== undefined) {
            rememberRevision(name, latest)
            clearConflictSnapshot(name)
            setSyncState(name, 'synced', 'Loaded from server (after flush)')
            return stripStorageMeta(latest)
          }
        }
      }

      if (serverValue !== null && serverValue !== undefined) {
        rememberRevision(name, serverValue)
        clearConflictSnapshot(name)
        setSyncState(name, 'synced', 'Loaded from server')
        return stripStorageMeta(serverValue)
      }

      setSyncState(
        name,
        serverReadSucceeded ? 'synced' : 'offline',
        serverReadSucceeded ? 'No data on server yet' : 'Server unavailable'
      )
      return null
    },

    /**
     * setItem — write to server.
     *
     * BLOCKED until getItem has completed for this store (serverLoadAttempted).
     * This is the critical guard that prevents empty default state from overwriting
     * real server data during the initial hydration race window.
     */
    setItem: (name, value) => {
      // Drop writes that arrive before getItem has finished for this store.
      // Zustand calls setItem with the initial default state during hydration —
      // we must ignore those until we know what the server actually has.
      if (!serverLoadAttempted.has(name)) return

      const serialized = JSON.stringify(withStorageMeta(name, value))
      setSyncState(name, 'pending', 'Save queued')
      debouncedSave(name, serialized)
    },

    /**
     * removeItem — clear from server.
     */
    removeItem: (name) => {
      serverLoadAttempted.delete(name)
      clearOfflineSnapshot(name)
      clearConflictSnapshot(name)
      latestServerRevisions.delete(name)
      setSyncState(name, 'synced', 'Store reset')
      fetch(`${API_BASE}/${encodeURIComponent(name)}`, { ...FETCH_DEFAULTS, method: 'DELETE' }).catch(() => {})
    },
  }
}

// ── Debounced server writes ───────────────────────────────────────────────────

const pendingWrites = new Map()

function debouncedSave(name, serialized) {
  if (pendingWrites.has(name)) clearTimeout(pendingWrites.get(name))

  const timer = setTimeout(() => {
    pendingWrites.delete(name)
    setSyncState(name, 'pending', 'Saving to server')
    fetchWithTimeout(
      `${API_BASE}/${encodeURIComponent(name)}`,
      { method: 'PUT', headers: writeHeaders(name), body: serialized },
      8000
    ).then(async (res) => {
      if (res.status === 409) {
        const serverConflict = await res.json().catch(() => ({}))
        writeConflictSnapshot(name, { at: Date.now(), name, localSnapshot: JSON.parse(serialized), server: serverConflict })
        writeOfflineSnapshot(name, serialized)
        return
      }
      if (!res.ok) {
        setSyncState(name, 'error', `Save failed (${res.status})`)
        writeOfflineSnapshot(name, serialized)
        return
      }
      const payload = await res.json().catch(() => null)
      if (payload && Number.isInteger(payload.serverRevision)) latestServerRevisions.set(name, payload.serverRevision)
      clearConflictSnapshot(name)
      clearOfflineSnapshot(name)
      setSyncState(name, 'synced', 'Saved to server')
    }).catch(() => {
      setSyncState(name, 'offline', 'Save failed while offline; queued')
      writeOfflineSnapshot(name, serialized)
    })
  }, 400)

  pendingWrites.set(name, timer)
}

// ── Conflict resolution utilities ─────────────────────────────────────────────

export function listPersistenceConflicts() {
  try {
    const conflicts = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(`${CONFLICT_SNAPSHOT_PREFIX}:`)) continue
      const name = key.slice(`${CONFLICT_SNAPSHOT_PREFIX}:`.length)
      const payload = readConflictSnapshot(name)
      conflicts.push({ name, payload })
    }
    return conflicts.sort((a, b) => (b.payload?.at ?? 0) - (a.payload?.at ?? 0))
  } catch { return [] }
}

export async function resolvePersistenceConflict(name, strategy = 'server') {
  if (!name) return { ok: false, error: 'Missing store name' }

  if (strategy === 'server') {
    clearConflictSnapshot(name)
    clearOfflineSnapshot(name)
    setSyncState(name, 'synced', 'Conflict resolved using server data')
    return { ok: true }
  }

  if (strategy !== 'local') return { ok: false, error: 'Unknown conflict strategy' }

  await waitForAuthReady()
  const conflict = readConflictSnapshot(name)
  const queued = readOfflineSnapshot(name)
  const candidate = conflict?.localSnapshot || (queued ? JSON.parse(queued) : null)
  if (!candidate) return { ok: false, error: 'No local snapshot found for this conflict' }

  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/${encodeURIComponent(name)}`,
      { method: 'PUT', headers: { ...writeHeaders(name), 'X-Force-Write': '1' }, body: JSON.stringify(candidate) },
      8000
    )
    if (!res.ok) {
      setSyncState(name, 'error', `Failed to apply local snapshot (${res.status})`)
      return { ok: false, error: `Failed to apply local snapshot (${res.status})` }
    }
    const payload = await res.json().catch(() => null)
    if (payload && Number.isInteger(payload.serverRevision)) latestServerRevisions.set(name, payload.serverRevision)
    clearConflictSnapshot(name)
    clearOfflineSnapshot(name)
    setSyncState(name, 'synced', 'Conflict resolved using local data')
    return { ok: true }
  } catch {
    setSyncState(name, 'offline', 'Network error while resolving conflict')
    return { ok: false, error: 'Network error while resolving conflict' }
  }
}
