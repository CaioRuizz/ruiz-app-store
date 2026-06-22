import express from 'express'
import cors from 'cors'
import { setupRoutes } from './routes/setup'
import { runnerRoutes } from './routes/runners'
import { runnerManager } from './runner-manager'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/setup', setupRoutes)
app.use('/api/runners', runnerRoutes)

const PORT = parseInt(process.env.PORT ?? '3001')
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on :${PORT}`)
  runnerManager.resumeAll()
})
