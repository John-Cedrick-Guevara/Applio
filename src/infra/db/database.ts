import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './migrate';
import { MIGRATIONS } from './schema';

/**
 * Opens (creating if needed) the app database, switches it to WAL mode with
 * foreign keys on, and applies pending migrations. Pass ':memory:' in tests.
 * @throws MigrationError when the schema can't be brought up to date; the file keeps its previous schema.
 */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    migrate(db, MIGRATIONS);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

/**
 * Runs `fn` in one transaction: every write in it lands, or none do.
 * @throws whatever `fn` throws, after rolling back.
 */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  // Inside an outer transaction, join it: the outer one commits or rolls back everything together.
  if (db.isTransaction) return fn();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
