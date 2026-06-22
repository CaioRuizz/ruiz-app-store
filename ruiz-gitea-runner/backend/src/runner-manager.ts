import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { db, RunnerRow } from './db'

const DATA_DIR = process.env.DATA_DIR || '/data'
const ACT_RUNNER = process.env.ACT_RUNNER_BIN || 'act_runner'
const LOG_BUFFER_SIZE = 500

interface RunnerProcess {
  proc: ChildProcess
  logs: string[]
  emitter: EventEmitter
}

class RunnerManager {
  private active = new Map<string, RunnerProcess>()

  runnerDir(id: string): string {
    const dir = path.join(DATA_DIR, 'runners', id)
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  async register(id: string, gitea_url: string, token: string, name: string, labels: string): Promise<void> {
    const dir = this.runnerDir(id)

    db.prepare("UPDATE runners SET status = 'registering', error = NULL WHERE id = ?").run(id)

    const args = [
      'register',
      '--instance', gitea_url,
      '--token', token,
      '--name', name,
      '--no-interactive',
    ]
    if (labels) args.push('--labels', labels)

    return new Promise((resolve, reject) => {
      const proc = spawn(ACT_RUNNER, args, { cwd: dir })
      let output = ''

      proc.stdout?.on('data', (d: Buffer) => { output += d.toString() })
      proc.stderr?.on('data', (d: Buffer) => { output += d.toString() })

      proc.on('close', (code) => {
        if (code === 0) {
          db.prepare("UPDATE runners SET status = 'registered' WHERE id = ?").run(id)
          resolve()
        } else {
          const errMsg = output.trim() || `exited with code ${code}`
          db.prepare("UPDATE runners SET status = 'error', error = ? WHERE id = ?").run(errMsg, id)
          reject(new Error(errMsg))
        }
      })

      proc.on('error', (err) => {
        db.prepare("UPDATE runners SET status = 'error', error = ? WHERE id = ?").run(err.message, id)
        reject(err)
      })
    })
  }

  start(id: string): void {
    if (this.active.has(id)) return

    const dir = this.runnerDir(id)
    const dotRunner = path.join(dir, '.runner')
    if (!fs.existsSync(dotRunner)) {
      db.prepare("UPDATE runners SET status = 'error', error = ? WHERE id = ?")
        .run('Runner not registered — .runner file missing', id)
      return
    }

    const emitter = new EventEmitter()
    const logs: string[] = []

    const proc = spawn(ACT_RUNNER, ['daemon'], { cwd: dir })

    const onData = (data: Buffer) => {
      const line = data.toString()
      logs.push(line)
      if (logs.length > LOG_BUFFER_SIZE) logs.shift()
      emitter.emit('log', line)
    }

    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)

    proc.on('close', (code) => {
      this.active.delete(id)
      const row = db.prepare('SELECT status FROM runners WHERE id = ?').get(id) as { status: string } | undefined
      if (row?.status === 'running') {
        db.prepare("UPDATE runners SET status = 'stopped' WHERE id = ?").run(id)
      }
      emitter.emit('close', code)
    })

    proc.on('error', (err) => {
      this.active.delete(id)
      db.prepare("UPDATE runners SET status = 'error', error = ? WHERE id = ?").run(err.message, id)
      emitter.emit('close', -1)
    })

    this.active.set(id, { proc, logs, emitter })
    db.prepare("UPDATE runners SET status = 'running', error = NULL WHERE id = ?").run(id)
  }

  stop(id: string): void {
    const info = this.active.get(id)
    if (!info) return
    info.proc.kill('SIGTERM')
    this.active.delete(id)
    db.prepare("UPDATE runners SET status = 'stopped' WHERE id = ?").run(id)
  }

  getLogs(id: string): string[] {
    return this.active.get(id)?.logs ?? []
  }

  getEmitter(id: string): EventEmitter | null {
    return this.active.get(id)?.emitter ?? null
  }

  isRunning(id: string): boolean {
    return this.active.has(id)
  }

  // Called on backend startup — resume any runner that was running before restart
  resumeAll(): void {
    const rows = db.prepare(
      "SELECT * FROM runners WHERE status IN ('running', 'registered')"
    ).all() as RunnerRow[]

    for (const r of rows) {
      try {
        this.start(r.id)
      } catch (e) {
        console.error(`Failed to resume runner ${r.id}:`, e)
      }
    }
  }
}

export const runnerManager = new RunnerManager()
