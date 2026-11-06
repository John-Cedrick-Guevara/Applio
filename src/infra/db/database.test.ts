// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, transaction } from './database';
import { MIGRATIONS } from './schema';

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});
const tempPath = () => {
  dir = mkdtempSync(join(tmpdir(), 'applio-db-'));
  return join(dir, 'nested', 'applio.db');
};

const names = (db: ReturnType<typeof openDatabase>, type: 'table' | 'index') =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all(type)
    .map((r) => r.name);

describe('openDatabase', () => {
  it('creates the file and its folder on first open and applies every migration', () => {
    const path = tempPath();
    const db = openDatabase(path);
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(MIGRATIONS.length);
    db.close();
  });

  it('reopens an existing database without reapplying migrations', () => {
    const path = tempPath();
    openDatabase(path).close();
    const db = openDatabase(path);
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(MIGRATIONS.length);
    db.close();
  });

  it('runs in WAL mode with foreign keys enforced', () => {
    const db = openDatabase(tempPath());
    expect(db.prepare('PRAGMA journal_mode').get()?.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1);
    db.close();
  });

  it('stores every entity the app keeps', () => {
    const db = openDatabase(':memory:');
    expect(names(db, 'table')).toEqual([
      'answers', 'drafts', 'fact_groups', 'facts', 'jobs', 'run_summaries', 'settings', 'source_polls', 'sources', 'status_events', 'usage_records',
    ]);
  });

  it('indexes the dedup key, status and created time', () => {
    const db = openDatabase(':memory:');
    expect(names(db, 'index')).toEqual(
      expect.arrayContaining(['jobs_created_at', 'jobs_dedup_key', 'jobs_status', 'status_events_job', 'usage_records_at']),
    );
  });

  it('has no column that could hold a secret', () => {
    const db = openDatabase(':memory:');
    const columns = names(db, 'table').flatMap((t) =>
      db.prepare(`SELECT name FROM pragma_table_info(?)`).all(t).map((c) => String(c.name)),
    );
    expect(columns.filter((c) => /password|secret|api_?key|(^|_)token($|_)/i.test(c))).toEqual([]);
  });
});

describe('transaction', () => {
  it('joins an outer transaction, so the whole outer one rolls back together', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE t (n INTEGER)');
    expect(() =>
      transaction(db, () => {
        transaction(db, () => db.exec('INSERT INTO t VALUES (1)'));
        throw new Error('later step failed');
      }),
    ).toThrow('later step failed');
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 0 });
  });
});
