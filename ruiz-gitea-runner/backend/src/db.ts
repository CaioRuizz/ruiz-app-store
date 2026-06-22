import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR || '/data'
fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'gitea-runner.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS runners (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    gitea_url  TEXT NOT NULL,
    token      TEXT NOT NULL,
    labels     TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'pending',
    error      TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`)

export { db }

export interface RunnerRow {
  id: string
  name: string
  gitea_url: string
  token: string
  labels: string
  status: string
  error: string | null
  created_at: number
}
