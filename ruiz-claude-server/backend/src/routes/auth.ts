import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db'

const router = Router()

function getJwtSecret(): string {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('jwt_secret') as { value: string } | undefined
  return row?.value ?? 'temp-secret'
}

router.post('/login', async (req, res) => {
  const { password } = req.body as { password?: string }
  if (!password) return res.status(400).json({ error: 'password required' })

  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('password') as { value: string } | undefined
  if (!row) return res.status(400).json({ error: 'Server not configured yet' })

  const valid = await bcrypt.compare(password, row.value)
  if (!valid) return res.status(401).json({ error: 'Invalid password' })

  const token = jwt.sign({ ok: true }, getJwtSecret(), { expiresIn: '30d' })
  res.json({ token })
})

export { router as authRoutes, getJwtSecret }
