import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const WORKSPACES_DIR = process.env.WORKSPACES_DIR || '/workspaces'
const router = Router()

router.get('/', (req, res) => {
  const reqPath = (req.query.path as string | undefined) ?? WORKSPACES_DIR

  // Prevent directory traversal outside workspaces
  const resolved = path.resolve(reqPath)
  if (!resolved.startsWith(WORKSPACES_DIR)) {
    return res.status(403).json({ error: 'Access denied' })
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: path.join(resolved, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))

    res.json({
      current: resolved,
      parent: resolved !== WORKSPACES_DIR ? path.dirname(resolved) : null,
      entries: dirs,
    })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

export { router as fileRoutes }
