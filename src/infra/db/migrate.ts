import type { DatabaseSync } from 'node:sqlite';
import { AppError } from '../../shared/errors';

/** One schema step. Versions start at 1 and increase by one; never edit a shipped migration. */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** A migration failed; the database is left at the last version that succeeded. */
export class MigrationError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super('MIGRATION_FAILED', message, options);
  }
}

/**
 * Brings the schema up to date by applying, in order, each migration newer than
 * the database's `user_version`. Each one runs in its own transaction with the
 * version bump, so a failure rolls back that step completely.
 * @returns The versions applied by this call (empty when already current).
 * @throws MigrationError when the list is out of order or a migration fails.
 */
export function migrate(db: DatabaseSync, migrations: readonly Migration[]): number[] {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new MigrationError(`Database updates are out of order at ${m.name}`);
  });

  const current = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
  const applied: number[] = [];
  for (const m of migrations.slice(current)) {
    try {
      db.exec('BEGIN');
      db.exec(m.sql);
      // PRAGMA can't take bound parameters; version is a number from our own list.
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec('COMMIT');
    } catch (err) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw new MigrationError(`Database update ${m.version} (${m.name}) failed. Applio didn't change your data.`, { cause: err });
    }
    applied.push(m.version);
  }
  return applied;
}
