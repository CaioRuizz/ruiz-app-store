import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
let db: Database.Database;

export function initDB(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, 'vms.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS vms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      os_id       TEXT NOT NULL,
      cpus        INTEGER NOT NULL,
      ram         INTEGER NOT NULL,
      storage     INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'creating',
      vnc_display INTEGER,
      ws_port     INTEGER,
      pid         INTEGER,
      username    TEXT NOT NULL DEFAULT 'admin',
      password    TEXT NOT NULL DEFAULT 'changeme',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function getDB(): Database.Database {
  return db;
}
