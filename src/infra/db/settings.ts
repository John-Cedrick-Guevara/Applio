import type { DatabaseSync } from 'node:sqlite';
import { json } from './rows';

/**
 * Key/value store for non-secret settings and profile singletons (preferences, skills).
 * Values come back as `unknown`: the service that owns a key validates its shape.
 * Never store secrets here — they go to the OS keychain (CLAUDE.md §3).
 */
export interface SettingsRepo {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  all(): Record<string, unknown>;
  delete(key: string): void;
}

/** SQLite-backed settings, one JSON value per key. */
export function createSettingsRepo(db: DatabaseSync): SettingsRepo {
  const select = db.prepare('SELECT value FROM settings WHERE key = ?');
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  return {
    get: (key) => {
      const row = select.get(key);
      return row ? json<unknown>(row.value) : undefined;
    },
    set: (key, value) => void upsert.run(key, JSON.stringify(value)),
    delete: (key) => void db.prepare('DELETE FROM settings WHERE key = ?').run(key),
    all: () => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [String(r.key), json<unknown>(r.value)])),
  };
}
