import type { DatabaseSync } from 'node:sqlite';
import type { Draft } from '../../shared/types';
import { json, type Row } from './rows';

export interface DraftsRepo {
  /** One draft per job; saving again replaces it. Throws if the job doesn't exist. */
  save(draft: Draft): void;
  get(jobId: string): Draft | undefined;
}

const toDraft = (r: Row): Draft => ({
  jobId: String(r.job_id),
  kind: String(r.kind) as Draft['kind'],
  headline: String(r.headline),
  summary: String(r.summary),
  resume: json<Draft['resume']>(r.resume),
  coverLetter: String(r.cover_letter),
  edited: r.edited === 1,
  answers: json<Draft['answers']>(r.answers),
  createdAt: String(r.created_at),
});

/** SQLite-backed application drafts (SPEC F4). */
export function createDraftsRepo(db: DatabaseSync): DraftsRepo {
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO drafts (job_id, kind, headline, summary, resume, cover_letter, edited, answers, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const select = db.prepare('SELECT * FROM drafts WHERE job_id = ?');

  return {
    save: (d) =>
      void upsert.run(d.jobId, d.kind, d.headline, d.summary, JSON.stringify(d.resume), d.coverLetter,
        d.edited ? 1 : 0, JSON.stringify(d.answers), d.createdAt),
    get: (jobId) => {
      const row = select.get(jobId);
      return row ? toDraft(row) : undefined;
    },
  };
}
