import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const USERS_FILE = join(DATA_DIR, '_users.json')
const app = express()
const PORT = 3001
const STORAGE_META_KEY = '__storageMeta'
const COOKIE_NAME = 'novado_token'

// IMPORTANT: Set a strong secret in production via environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'novado-dev-secret-change-in-production'
const JWT_EXPIRES_IN = '30d'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days in ms

// Ensure data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// Allow cookies from the frontend origin (same-site port-forward scenario)
app.use(cors({
  origin: true,           // reflect the request origin
  credentials: true,      // allow cookies
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// ─── User storage helpers ────────────────────────────────────────────────────

function loadUsers() {
  if (!existsSync(USERS_FILE)) return {}
  try {
    return JSON.parse(readFileSync(USERS_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,           // not accessible to JS — prevents XSS theft
    sameSite: 'lax',          // safe for same-origin port-forward scenarios
    secure: false,            // set to true if you add HTTPS in future
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

// ─── JWT middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  // Accept token from cookie (primary) or Authorization header (legacy fallback)
  let token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
  }
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub
    req.username = payload.username
    next()
  } catch {
    clearAuthCookie(res)
    return res.status(401).json({ error: 'Token expired or invalid' })
  }
}

// ─── Auth endpoints ──────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }
  if (username.length < 2 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 2–30 characters' })
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain letters, numbers, _ . -' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const users = loadUsers()
  const existing = Object.values(users).find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  )
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const user = { id, username, passwordHash, createdAt: new Date().toISOString() }
  users[id] = user

  // Create user data directory
  const userDir = join(DATA_DIR, 'users', id)
  if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })

  saveUsers(users)

  const token = jwt.sign({ sub: id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  setAuthCookie(res, token)
  res.status(201).json({ user: { id, username, createdAt: user.createdAt } })
})

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  const users = loadUsers()
  const user = Object.values(users).find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  )
  if (!user) {
    // Constant-time response to prevent user enumeration
    await bcrypt.compare(password, '$2a$12$invalidhashfortimingnormalization000000000000000000000')
    return res.status(401).json({ error: 'Invalid username or password' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }

  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  setAuthCookie(res, token)
  res.json({ user: { id: user.id, username: user.username, createdAt: user.createdAt } })
})

// POST /api/auth/logout — clears the auth cookie
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

// GET /api/auth/me — verify token (via cookie) and return user info
app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = loadUsers()
  const user = users[req.userId]
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ id: user.id, username: user.username, createdAt: user.createdAt })
})

// ─── Store name whitelist ─────────────────────────────────────────────────────

const VALID_STORES = new Set([
  'tasks-storage',
  'xp-storage',
  'settings-storage',
  'analytics-storage',
  'customization-storage',
  'emotion-storage',
  'ai-coach-storage',
  'tags-storage',
  'routines-storage',
  'roadmaps-storage',
  'parking-lot-storage',
  'distraction-storage',
])

function sanitizeStoreName(name) {
  if (!VALID_STORES.has(name)) return null
  return name
}

function getUserFilePath(userId, storeName) {
  // userId is generated by us, sanitize defensively
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '')
  const userDir = join(DATA_DIR, 'users', safeUserId)
  if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
  return join(userDir, `${storeName}.json`)
}

function getServerRevision(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 0
  const revision = payload?.[STORAGE_META_KEY]?.serverRevision
  return Number.isInteger(revision) ? revision : 0
}

// ─── Store endpoints (all auth-protected) ────────────────────────────────────

// GET /api/store/:name — read store data for authenticated user
app.get('/api/store/:name', requireAuth, (req, res) => {
  const name = sanitizeStoreName(req.params.name)
  if (!name) return res.status(400).json({ error: 'Invalid store name' })

  const filePath = getUserFilePath(req.userId, name)
  if (!existsSync(filePath)) return res.json(null)

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const revision = getServerRevision(parsed)
    res.setHeader('X-Server-Revision', String(revision))
    res.json(parsed)
  } catch {
    res.json(null)
  }
})

// PUT /api/store/:name — write store data for authenticated user
app.put('/api/store/:name', requireAuth, (req, res) => {
  const name = sanitizeStoreName(req.params.name)
  if (!name) return res.status(400).json({ error: 'Invalid store name' })

  // Validate that the body is a Zustand StorageValue ({ state: {...}, version: N })
  // Reject plain strings or other malformed payloads from old/stale clients
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Invalid store data format' })
  }

  const filePath = getUserFilePath(req.userId, name)
  try {
    let currentValue = null
    if (existsSync(filePath)) {
      try {
        currentValue = JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch {
        currentValue = null
      }
    }

    const currentRevision = getServerRevision(currentValue)
    const expectedRaw = req.headers['x-expected-revision']
    const expectedRevision = Number.isInteger(Number(expectedRaw)) ? Number(expectedRaw) : null
    const forceWrite = req.headers['x-force-write'] === '1'

    if (!forceWrite && expectedRevision !== null && expectedRevision !== currentRevision) {
      return res.status(409).json({
        error: 'Revision conflict',
        conflict: true,
        store: name,
        expectedRevision,
        currentRevision,
        serverValue: currentValue,
      })
    }

    const nextRevision = currentRevision + 1
    const incomingMeta = req.body?.[STORAGE_META_KEY]
    const nextValue = {
      ...req.body,
      [STORAGE_META_KEY]: {
        ...(incomingMeta && typeof incomingMeta === 'object' ? incomingMeta : {}),
        serverRevision: nextRevision,
        serverUpdatedAt: new Date().toISOString(),
      },
    }

    writeFileSync(filePath, JSON.stringify(nextValue, null, 2), 'utf-8')
    res.json({ ok: true, serverRevision: nextRevision })
  } catch {
    res.status(500).json({ error: 'Failed to write data' })
  }
})

// DELETE /api/store/:name — clear store data for authenticated user
app.delete('/api/store/:name', requireAuth, (req, res) => {
  const name = sanitizeStoreName(req.params.name)
  if (!name) return res.status(400).json({ error: 'Invalid store name' })

  const filePath = getUserFilePath(req.userId, name)
  try {
    if (existsSync(filePath)) {
      writeFileSync(filePath, JSON.stringify(null), 'utf-8')
    }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete data' })
  }
})

// GET /api/stores — list all stores for authenticated user
app.get('/api/stores', requireAuth, (req, res) => {
  const stores = {}
  for (const name of VALID_STORES) {
    const filePath = getUserFilePath(req.userId, name)
    if (existsSync(filePath)) {
      try {
        stores[name] = JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch {
        stores[name] = null
      }
    }
  }
  res.json(stores)
})

// Handle JSON parse errors from body-parser (e.g. stale '[object Object]' from old clients)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  next(err)
})

app.listen(PORT, () => {
  console.log(`💾 NovaDo data server running on http://localhost:${PORT}`)
  console.log(`📁 Data stored in: ${DATA_DIR}`)
  console.log(`🍪 Auth: HTTP-only cookie (novado_token) — sessions persist across devices`)
})
