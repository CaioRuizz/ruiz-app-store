import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import * as pty from 'node-pty'
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

// SSE stream that starts `claude` with a PTY, sends /login, and streams output
router.get('/claude-login', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  const proc = pty.spawn('claude', [], {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    env: {
      ...process.env,
      HOME: process.env.HOME || '/root',
      TERM: 'xterm-256color',
    } as Record<string, string>,
  })

  // Send /login once claude starts up
  setTimeout(() => proc.write('/login\r'), 1500)

  let loggedIn = false

  proc.onData((data) => {
    send({ text: data })
    if (!loggedIn && (data.includes('Logged in') || data.includes('logged in as') || data.includes('Successfully authenticated'))) {
      loggedIn = true
      // Give it a moment to finish writing credentials, then exit
      setTimeout(() => { try { proc.write('/exit\r') } catch {} }, 500)
    }
  })

  proc.onExit(({ exitCode }) => {
    send({ done: true, success: loggedIn || exitCode === 0 })
    res.end()
  })

  req.on('close', () => {
    try { proc.kill() } catch {}
  })
})

export { router as setupRoutes }
