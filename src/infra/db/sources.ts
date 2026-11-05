import type { DatabaseSync } from 'node:sqlite';
import type { Autonomy, Source, SourceKind } from '../../shared/types';
import { nullable, optText, type Row } from './rows';

export interface SourcesRepo {
  /** In the order first saved. */
  list(): Source[];
  get(id: string): Source | undefined;
  /** Inserts, or updates in place by id; new sources go last. */
  save(source: Source): void;
}

const toSource = (r: Row): Source => ({
  id: String(r.id),
  name: String(r.name),
  kind: String(r.kind) as SourceKind,
  enabled: r.enabled === 1,
  autonomy: String(r.autonomy) as Autonomy,
  via: String(r.via),
  maxAutonomy: optText(r.max_autonomy) as Autonomy | undefined,
  lastPolledAt: optText(r.last_polled_at),
});

/** SQLite-backed job sources and their operator-chosen autonomy (SPEC F2, F6). */
export function createSourcesRepo(db: DatabaseSync): SourcesRepo {
  const upsert = db.prepare(`
    INSERT INTO sources (id, name, kind, enabled, autonomy, via, max_autonomy, last_polled_at, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM sources))
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, kind = excluded.kind, enabled = excluded.enabled,
      autonomy = excluded.autonomy, via = excluded.via, max_autonomy = excluded.max_autonomy,
      last_polled_at = excluded.last_polled_at`);
  const select = db.prepare('SELECT * FROM sources WHERE id = ?');

  return {
    list: () => db.prepare('SELECT * FROM sources ORDER BY position').all().map(toSource),
    get: (id) => {
      const row = select.get(id);
      return row ? toSource(row) : undefined;
    },
    save: (s) =>
      void upsert.run(s.id, s.name, s.kind, s.enabled ? 1 : 0, s.autonomy, s.via, nullable(s.maxAutonomy), nullable(s.lastPolledAt)),
  };
}
