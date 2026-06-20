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

    const apiKeyRow = db.prepare('SELECT value FROM config WHERE key = ?').get('api_key') as { value: string } | undefined
    if (!apiKeyRow) return res.status(500).json({ error: 'API key not configured' })

    const id = manager.create(name, workspace, apiKeyRow.value)
    res.json({ id })
  })

  router.delete('/:id', (req, res) => {
    manager.kill(req.params.id)
    res.json({ ok: true })
  })

  return router
}
