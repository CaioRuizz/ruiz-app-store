import { Router } from 'express'
import { SessionManager } from '../sessions'
import { db } from '../db'

export function sessionRoutes(manager: SessionManager) {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json(manager.list())
  })

  router.get('/:id', (req, res) => {
    const session = manager.getOne(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    res.json(session)
  })

  router.post('/', (req, res) => {
    const { name, workspace } = req.body as { name?: string; workspace?: string }
    if (!name || !workspace) return res.status(400).json({ error: 'name and workspace required' })

    const authModeRow = db.prepare('SELECT value FROM config WHERE key = ?').get('auth_mode') as { value: string } | undefined
    const authMode = authModeRow?.value ?? 'api_key'

    let apiKey: string | undefined
    if (authMode === 'api_key') {
      const apiKeyRow = db.prepare('SELECT value FROM config WHERE key = ?').get('api_key') as { value: string } | undefined
      if (!apiKeyRow) return res.status(500).json({ error: 'API key not configured' })
      apiKey = apiKeyRow.value
    }

    const id = manager.create(name, workspace, apiKey)
    res.json({ id })
  })

  router.post('/:id/start', (req, res) => {
    const row = db.prepare('SELECT status FROM sessions WHERE id = ?').get(req.params.id) as { status: string } | undefined
    if (!row) return res.status(404).json({ error: 'Session not found' })
    if (row.status === 'active') return res.status(400).json({ error: 'Session is already active' })

    const authModeRow = db.prepare('SELECT value FROM config WHERE key = ?').get('auth_mode') as { value: string } | undefined
    const authMode = authModeRow?.value ?? 'api_key'

    let apiKey: string | undefined
    if (authMode === 'api_key') {
      const apiKeyRow = db.prepare('SELECT value FROM config WHERE key = ?').get('api_key') as { value: string } | undefined
      if (!apiKeyRow) return res.status(500).json({ error: 'API key not configured' })
      apiKey = apiKeyRow.value
    }

    try {
      manager.restart(req.params.id, apiKey)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start session' })
    }
  })

  router.delete('/:id', (req, res) => {
    manager.kill(req.params.id)
    res.json({ ok: true })
  })

  return router
}
