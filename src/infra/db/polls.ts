import type { DatabaseSync } from 'node:sqlite';

export interface PollsRepo {
  count(sourceId: string, day: string): number;
  record(sourceId: string, day: string): void;
}

/** SQLite-backed poll counts per source per local day ("2026-11-05"). */
export function createPollsRepo(db: DatabaseSync): PollsRepo {
  const select = db.prepare('SELECT count FROM source_polls WHERE source_id = ? AND day = ?');
  const bump = db.prepare(`
    INSERT INTO source_polls (source_id, day, count) VALUES (?, ?, 1)
    ON CONFLICT (source_id, day) DO UPDATE SET count = count + 1`);
  return {
    count: (sourceId, day) => Number(select.get(sourceId, day)?.count ?? 0),
    record: (sourceId, day) => void bump.run(sourceId, day),
  };
}
