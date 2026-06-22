import { Router } from 'express'
import { db } from '../db'

const router = Router()

router.get('/status', (_req, res) => {
  const count = (db.prepare('SELECT COUNT(*) as n FROM runners').get() as { n: number }).n
  res.json({ configured: count > 0 })
})

export { router as setupRoutes }
