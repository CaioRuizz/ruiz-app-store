import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '../db'

const router = Router()

router.get('/status', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[]
  const map = new Map(rows.map(r => [r.key, r.value]))
  const hasPassword = map.has('password')
  const authMode = map.get('auth_mode')
  const hasAuth = authMode === 'subscription' || map.has('api_key')
  res.json({ configured: hasPassword && hasAuth })
})

router.post('/complete', async (req, res) => {
  const { password, apiKey, authMode } = req.body as {
    password?: string
    apiKey?: string
    authMode?: 'api_key' | 'subscription'
  }

  if (!password) return res.status(400).json({ error: 'password is required' })
  const mode = authMode ?? 'api_key'
  if (mode === 'api_key' && !apiKey) return res.status(400).json({ error: 'apiKey is required' })

  const existing = db.prepare('SELECT value FROM config WHERE key = ?').get('password')
  if (existing) return res.status(400).json({ error: 'Server is already configured' })

  const hash = await bcrypt.hash(password, 12)
  const jwtSecret = crypto.randomBytes(32).toString('hex')

  const insert = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)')
  db.transaction(() => {
    insert.run('password', hash)
    insert.run('jwt_secret', jwtSecret)
    insert.run('auth_mode', mode)
    if (mode === 'api_key' && apiKey) insert.run('api_key', apiKey)
  })()

  res.json({ ok: true })
})


export { router as setupRoutes }
