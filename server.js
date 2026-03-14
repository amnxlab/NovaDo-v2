import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const app = express()
const PORT = 3001

// Ensure data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Valid store names (whitelist to prevent path traversal)
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
])

function sanitizeStoreName(name) {
  if (!VALID_STORES.has(name)) return null
  return name
}

function getFilePath(storeName) {
  return join(DATA_DIR, `${storeName}.json`)
}

// GET /api/store/:name — read store data
app.get('/api/store/:name', (req, res) => {
  const name = sanitizeStoreName(req.params.name)
  if (!name) return res.status(400).json({ error: 'Invalid store name' })

  const filePath = getFilePath(name)
  if (!existsSync(filePath)) return res.json(null)

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    res.json(data)
  } catch {
    res.json(null)
  }
})

// PUT /api/store/:name — write store data
app.put('/api/store/:name', (req, res) => {
  const name = sanitizeStoreName(req.params.name)
  if (!name) return res.status(400).json({ error: 'Invalid store name' })

  const filePath = getFilePath(name)
  try {
    writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf-8')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to write data' })
  }
})

// DELETE /api/store/:name — delete store data
app.delete('/api/store/:name', (req, res) => {
  const name = sanitizeStoreName(req.params.name)
  if (!name) return res.status(400).json({ error: 'Invalid store name' })

  const filePath = getFilePath(name)
  try {
    if (existsSync(filePath)) {
      writeFileSync(filePath, JSON.stringify(null), 'utf-8')
    }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete data' })
  }
})

// GET /api/stores — list all stores with data
app.get('/api/stores', (_req, res) => {
  const stores = {}
  for (const name of VALID_STORES) {
    const filePath = getFilePath(name)
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

app.listen(PORT, () => {
  console.log(`💾 NovaDo data server running on http://localhost:${PORT}`)
  console.log(`📁 Data stored in: ${DATA_DIR}`)
})
