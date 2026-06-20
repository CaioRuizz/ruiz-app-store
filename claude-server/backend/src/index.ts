import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { db } from './db'
import { setupRoutes } from './routes/setup'
import { authRoutes, getJwtSecret } from './routes/auth'
import { sessionRoutes } from './routes/sessions'
import { fileRoutes } from './routes/files'
import { SessionManager } from './sessions'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

app.use(cors())
app.use(express.json())

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    jwt.verify(token, getJwtSecret())
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

const manager = new SessionManager()

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/setup', setupRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/sessions', requireAuth, sessionRoutes(manager))
app.use('/api/files', requireAuth, fileRoutes)

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined
  if (!token) return next(new Error('Unauthorized'))
  try {
    jwt.verify(token, getJwtSecret())
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

io.on('connection', (socket) => {
  let cleanupFn: (() => void) | null = null

  socket.on('join', (sessionId: string) => {
    // Clean up previous session listeners
    cleanupFn?.()

    const session = manager.get(sessionId)
    if (!session) {
      socket.emit('session:error', 'Session not found or stopped')
      return
    }

    // Replay buffered output so late joiners see history
    if (session.buffer) socket.emit('output', session.buffer)

    const dataHandler = (data: string) => socket.emit('output', data)
    session.emitter.on('data', dataHandler)

    cleanupFn = () => session.emitter.off('data', dataHandler)
  })

  socket.on('input', (data: string, sessionId: string) => {
    const session = manager.get(sessionId)
    if (session) {
      session.pty.write(data)
      manager.touchActive(sessionId)
    }
  })

  socket.on('resize', ({ sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    const session = manager.get(sessionId)
    if (session) session.pty.resize(cols, rows)
  })

  socket.on('disconnect', () => {
    cleanupFn?.()
  })
})

const PORT = parseInt(process.env.PORT ?? '3001')
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on :${PORT}`)
})
