import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '../db'

const router = Router()

router.get('/status', (_req, res) => {
  const rows = db.prepare('SELECT key FROM config').all() as { key: string }[]
  const keys = new Set(rows.map(r => r.key))
  res.json({ configured: keys.has('password') && keys.has('api_key') })
})

router.post('/complete', async (req, res) => {
  const { password, apiKey } = req.body as { password?: string; apiKey?: string }

  if (!password || !apiKey) {
    return res.status(400).json({ error: 'password and apiKey are required' })
  }

  const existing = db.prepare('SELECT value FROM config WHERE key = ?').get('password')
  if (existing) {
    return res.status(400).json({ error: 'Server is already configured' })
  }

  const hash = await bcrypt.hash(password, 12)
  const jwtSecret = crypto.randomBytes(32).toString('hex')

  const insert = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)')
  db.transaction(() => {
    insert.run('password', hash)
    insert.run('api_key', apiKey)
    insert.run('jwt_secret', jwtSecret)
  })()

  res.json({ ok: true })
})

export { router as setupRoutes }
