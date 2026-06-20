import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { spawn } from 'child_process'
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

// SSE stream that runs `claude login` and forwards output to the client
router.get('/claude-login', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const proc = spawn('claude', ['login'], {
    env: { ...process.env, HOME: process.env.HOME || '/root' },
  })

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  proc.stdout.on('data', (chunk: Buffer) => send({ text: chunk.toString() }))
  proc.stderr.on('data', (chunk: Buffer) => send({ text: chunk.toString() }))

  proc.on('close', (code) => {
    send({ done: true, success: code === 0 })
    res.end()
  })

  req.on('close', () => {
    try { proc.kill() } catch {}
  })
})

export { router as setupRoutes }
