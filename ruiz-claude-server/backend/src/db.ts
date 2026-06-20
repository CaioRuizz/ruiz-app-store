import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR || '/data'
const WORKSPACES_DIR = process.env.WORKSPACES_DIR || '/workspaces'

// Ensure both directories exist (important for Umbrel bind mounts)
fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(WORKSPACES_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'claude-server.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    workspace   TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    last_active INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active'
  );
`)

export { db }
