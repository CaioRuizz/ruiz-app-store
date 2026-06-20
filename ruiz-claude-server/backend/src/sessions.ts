import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { db } from './db'

const BUFFER_MAX = 50_000

export interface ActiveSession {
  id: string
  name: string
  workspace: string
  pty: pty.IPty
  buffer: string
  emitter: EventEmitter
}

export class SessionManager {
  private sessions = new Map<string, ActiveSession>()

  create(name: string, workspace: string, apiKey: string): string {
    const id = uuidv4()

    const ptyProcess = pty.spawn('claude', [], {
      name: 'xterm-256color',
      cols: 220,
      rows: 50,
      cwd: workspace,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: apiKey,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        HOME: process.env.HOME || '/root',
      } as Record<string, string>,
    })

    const emitter = new EventEmitter()
    const session: ActiveSession = { id, name, workspace, pty: ptyProcess, buffer: '', emitter }

    ptyProcess.onData((data) => {
      session.buffer += data
      if (session.buffer.length > BUFFER_MAX) {
        session.buffer = session.buffer.slice(-BUFFER_MAX)
      }
      emitter.emit('data', data)
    })

    ptyProcess.onExit(() => {
      db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('stopped', id)
      this.sessions.delete(id)
    })

    this.sessions.set(id, session)
    db.prepare(
      'INSERT INTO sessions (id, name, workspace, created_at, last_active, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, workspace, Date.now(), Date.now(), 'active')

    return id
  }

  get(id: string): ActiveSession | undefined {
    return this.sessions.get(id)
  }

  list(): unknown[] {
    return db.prepare('SELECT * FROM sessions ORDER BY last_active DESC').all()
  }

  getOne(id: string): unknown {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      try { session.pty.kill() } catch {}
      this.sessions.delete(id)
    }
    db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('stopped', id)
  }

  touchActive(id: string): void {
    db.prepare('UPDATE sessions SET last_active = ? WHERE id = ?').run(Date.now(), id)
  }
}
