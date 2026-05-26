import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'app.db');

function openDatabase(): Database.Database {
  if (DB_PATH !== ':memory:') {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  const db = new Database(DB_PATH);

  // WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      source_event_id TEXT    NOT NULL UNIQUE,
      source          TEXT    NOT NULL,
      event_type      TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending',
      payload         TEXT    NOT NULL DEFAULT '{}',
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TRIGGER IF NOT EXISTS events_set_updated_at
    AFTER UPDATE ON events
    BEGIN
      UPDATE events
      SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS actions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id   INTEGER NOT NULL REFERENCES events(id),
      type       TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'pending',
      payload    TEXT    NOT NULL DEFAULT '{}',
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS review_queue_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id    INTEGER REFERENCES events(id),
      status      TEXT    NOT NULL DEFAULT 'pending',
      reason      TEXT    NOT NULL,
      payload     TEXT    NOT NULL DEFAULT '{}',
      resolved_at TEXT,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id   INTEGER REFERENCES events(id),
      message    TEXT    NOT NULL,
      metadata   TEXT    NOT NULL DEFAULT '{}',
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
}

// Singleton with dev hot-reload guard (same pattern as Prisma recommends for Next.js)
const globalForDb = global as unknown as { db: Database.Database };

export const db = globalForDb.db ?? openDatabase();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}
