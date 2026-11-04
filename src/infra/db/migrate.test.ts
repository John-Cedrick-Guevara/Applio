// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrate, type Migration } from './migrate';

const ONE: Migration = { version: 1, name: 'create a', sql: 'CREATE TABLE a (id TEXT PRIMARY KEY);' };
const TWO: Migration = { version: 2, name: 'create b', sql: 'CREATE TABLE b (id TEXT PRIMARY KEY);' };

const tables = (db: DatabaseSync) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);

describe('migrate', () => {
  it('applies every migration in order on a fresh database', () => {
    const db = new DatabaseSync(':memory:');
    const applied = migrate(db, [ONE, TWO]);
    expect(applied).toEqual([1, 2]);
    expect(tables(db)).toEqual(['a', 'b']);
  });

  it('applies nothing on a database that is already current', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, [ONE, TWO]);
    expect(migrate(db, [ONE, TWO])).toEqual([]);
  });

  it('applies only a newly added migration, once', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, [ONE]);
    expect(migrate(db, [ONE, TWO])).toEqual([2]);
    expect(migrate(db, [ONE, TWO])).toEqual([]);
  });

  it('stops with a readable error and leaves the previous schema intact when a migration fails', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db, [ONE]);
    const broken: Migration = { version: 2, name: 'broken', sql: 'CREATE TABLE b (id TEXT); CREATE TABLE nope (' };
    expect(() => migrate(db, [ONE, broken])).toThrow(/Database update 2 \(broken\) failed/);
    expect(tables(db)).toEqual(['a']);
    expect(migrate(db, [ONE])).toEqual([]);
  });

  it('refuses migrations listed out of order', () => {
    const db = new DatabaseSync(':memory:');
    expect(() => migrate(db, [TWO, ONE])).toThrow(/out of order/);
  });
});
