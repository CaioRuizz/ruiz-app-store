import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { db, RunnerRow } from '../db'
import { runnerManager } from '../runner-manager'

const router = Router()

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM runners ORDER BY created_at ASC').all() as RunnerRow[]
  const result = rows.map(r => ({
    ...r,
    running: runnerManager.isRunning(r.id),
  }))
  res.json(result)
})

router.post('/', async (req: Request, res: Response) => {
  const { gitea_url, token, name, labels } = req.body as {
    gitea_url?: string
    token?: string
    name?: string
    labels?: string
  }

  if (!gitea_url?.trim()) return void res.status(400).json({ error: 'gitea_url is required' })
  if (!token?.trim()) return void res.status(400).json({ error: 'token is required' })

  const id = uuid()
  const runnerName = name?.trim() || 'umbrel-runner'
  const runnerLabels = labels?.trim() || ''

  // Normalize URL — strip trailing slash
  const url = gitea_url.trim().replace(/\/+$/, '')

  db.prepare(
    'INSERT INTO runners (id, name, gitea_url, token, labels, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, runnerName, url, token.trim(), runnerLabels, 'pending')

  try {
    await runnerManager.register(id, url, token.trim(), runnerName, runnerLabels)
    runnerManager.start(id)
    res.status(201).json({ id })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed' })
  }
})

router.delete('/:id', (req, res) => {
  const { id } = req.params
  runnerManager.stop(id)
  db.prepare('DELETE FROM runners WHERE id = ?').run(id)
  res.json({ ok: true })
})

router.post('/:id/start', (req, res) => {
  const { id } = req.params
  const row = db.prepare('SELECT * FROM runners WHERE id = ?').get(id) as RunnerRow | undefined
  if (!row) return void res.status(404).json({ error: 'Runner not found' })
  if (runnerManager.isRunning(id)) return void res.json({ ok: true })
  runnerManager.start(id)
  res.json({ ok: true })
})

router.post('/:id/stop', (req, res) => {
  const { id } = req.params
  runnerManager.stop(id)
  res.json({ ok: true })
})

// SSE endpoint: streams logs for a running runner
router.get('/:id/logs', (req, res) => {
  const { id } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (line: string) => {
    // Escape newlines inside the data value
    const escaped = line.replace(/\n/g, '\ndata: ')
    res.write(`data: ${escaped}\n\n`)
  }

  // Replay buffered logs
  for (const line of runnerManager.getLogs(id)) send(line)

  const emitter = runnerManager.getEmitter(id)
  if (!emitter) {
    res.write('data: [runner is not running]\n\n')
    res.end()
    return
  }

  const onLog = (line: string) => send(line)
  const onClose = () => res.end()

  emitter.on('log', onLog)
  emitter.on('close', onClose)

  req.on('close', () => {
    emitter.off('log', onLog)
    emitter.off('close', onClose)
  })
})

export { router as runnerRoutes }
