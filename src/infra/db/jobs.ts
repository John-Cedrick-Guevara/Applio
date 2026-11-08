import type { DatabaseSync } from 'node:sqlite';
import { suspiciousReason } from '../../core/jobs/suspicious';
import type { ApplyChannel, EmploymentType, Job, JobStatus, SentBy, StatusEvent } from '../../shared/types';
import { transaction } from './database';
import { json, nullable, optNum, optText, type Row } from './rows';

/** Stored alongside a job but not part of what the UI sees. */
export interface JobMeta {
  /** Normalised identity used to drop reposts (PR-12 decides the formula). */
  dedupKey: string;
  createdAt: string;
}

export interface JobsRepo {
  /** Inserts a job and its history in one transaction. Throws on a duplicate id or dedup key. */
  insert(job: Job, meta: JobMeta): void;
  get(id: string): Job | undefined;
  findByDedupKey(dedupKey: string): Job | undefined;
  /** Sets the given counters and folder; fields left out keep their values. */
  update(id: string, patch: Partial<Pick<Job, 'factsUsed' | 'tokensUsed' | 'folderPath' | 'sentBy'>>): void;
  /** Stores a scoring result (SPEC F3.3); the status move is the caller's. */
  saveMatch(id: string, match: Pick<Job, 'roleSummary' | 'descriptionSummary' | 'strengths' | 'gaps'> & { score: number }): void;
  /** Every stored job's dedup key, sent ones included, for triage. */
  dedupKeys(): Set<string>;
  /** Newest first; all jobs when no statuses are given. */
  list(filter?: { statuses?: readonly JobStatus[] }): Job[];
  /**
   * Sets the job's status and appends the event, together.
   * Status rules live in the caller; this only records the move.
   * @throws Error when the job doesn't exist.
   */
  transition(id: string, event: StatusEvent): Job;
  /** Grows with every status event from any process (MCP drafts included); open pages reload when it moves. */
  version(): number;
}

const toJob = (r: Row, history: StatusEvent[]): Job => ({
  id: String(r.id),
  sourceId: String(r.source_id),
  sourceName: String(r.source_name),
  company: String(r.company),
  title: String(r.title),
  url: String(r.url),
  location: String(r.location),
  salary: optText(r.salary),
  employmentType: String(r.employment_type) as EmploymentType,
  postedAt: String(r.posted_at),
  status: String(r.status) as JobStatus,
  channel: String(r.channel) as ApplyChannel,
  description: String(r.description),
  score: optNum(r.score),
  roleSummary: optText(r.role_summary),
  descriptionSummary: optText(r.description_summary),
  tags: json<string[]>(r.tags),
  strengths: json<string[]>(r.strengths),
  gaps: json<string[]>(r.gaps),
  applyTarget: String(r.apply_target),
  ...(r.apply_url == null ? {} : { applyUrl: String(r.apply_url) }),
  // Derived on read, not stored, so every job (old ones too) gets the current check for free.
  ...withSuspicious(String(r.description), String(r.apply_target)),
  platform: optText(r.platform),
  factsUsed: Number(r.facts_used),
  tokensUsed: Number(r.tokens_used),
  folderPath: optText(r.folder_path),
  sentBy: optText(r.sent_by) as SentBy | undefined,
  history,
});

const toEvent = (r: Row): StatusEvent => ({ status: String(r.status) as JobStatus, at: String(r.at), note: optText(r.note) });

/** SQLite-backed job store: jobs plus their append-only status history. */
const withSuspicious = (description: string, applyTarget: string) => {
  const suspicious = suspiciousReason(description, applyTarget);
  return suspicious ? { suspicious } : {};
};

export function createJobsRepo(db: DatabaseSync): JobsRepo {
  const insertJob = db.prepare(`
    INSERT INTO jobs (id, dedup_key, source_id, source_name, company, title, url, location, salary, employment_type,
      posted_at, status, channel, description, score, role_summary, description_summary, tags, strengths, gaps,
      apply_target, platform, facts_used, tokens_used, folder_path, sent_by, created_at, apply_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertEvent = db.prepare('INSERT INTO status_events (job_id, status, at, note) VALUES (?, ?, ?, ?)');
  const selectEvents = db.prepare('SELECT status, at, note FROM status_events WHERE job_id = ? ORDER BY id');
  const selectById = db.prepare('SELECT * FROM jobs WHERE id = ?');
  const selectVersion = db.prepare('SELECT COALESCE(MAX(id), 0) AS v FROM status_events');
  const selectByKey = db.prepare('SELECT * FROM jobs WHERE dedup_key = ?');
  const updateCounts = db.prepare(
    'UPDATE jobs SET facts_used = COALESCE(?, facts_used), tokens_used = COALESCE(?, tokens_used), folder_path = COALESCE(?, folder_path), sent_by = COALESCE(?, sent_by) WHERE id = ?',
  );
  const updateMatch = db.prepare('UPDATE jobs SET score = ?, role_summary = ?, description_summary = ?, strengths = ?, gaps = ? WHERE id = ?');
  const selectKeys = db.prepare('SELECT dedup_key FROM jobs');
  const updateStatus = db.prepare('UPDATE jobs SET status = ? WHERE id = ?');

  // perf: one history query per job (N+1); fine for the review list's few dozen jobs — join and group if lists grow.
  const hydrate = (r: Row | undefined) => (r ? toJob(r, selectEvents.all(String(r.id)).map(toEvent)) : undefined);

  const addEvent = (id: string, e: StatusEvent) => insertEvent.run(id, e.status, e.at, nullable(e.note));

  const get = (id: string) => hydrate(selectById.get(id));

  return {
    insert: (job, meta) =>
      transaction(db, () => {
        insertJob.run(
          job.id, meta.dedupKey, job.sourceId, job.sourceName, job.company, job.title, job.url, job.location,
          nullable(job.salary), job.employmentType, job.postedAt, job.status, job.channel, job.description,
          nullable(job.score), nullable(job.roleSummary), nullable(job.descriptionSummary), JSON.stringify(job.tags),
          JSON.stringify(job.strengths), JSON.stringify(job.gaps), job.applyTarget, nullable(job.platform),
          job.factsUsed, job.tokensUsed, nullable(job.folderPath), nullable(job.sentBy), meta.createdAt, nullable(job.applyUrl),
        );
        for (const e of job.history) addEvent(job.id, e);
      }),

    get,
    update: (id, p) => void updateCounts.run(nullable(p.factsUsed), nullable(p.tokensUsed), nullable(p.folderPath), nullable(p.sentBy), id),
    saveMatch: (id, m) => void updateMatch.run(m.score, nullable(m.roleSummary), nullable(m.descriptionSummary), JSON.stringify(m.strengths), JSON.stringify(m.gaps), id),
    dedupKeys: () => new Set(selectKeys.all().map((r) => String(r.dedup_key))),

    findByDedupKey: (key) => hydrate(selectByKey.get(key)),

    list: (filter = {}) => {
      const statuses = filter.statuses ?? [];
      const where = statuses.length ? `WHERE status IN (${statuses.map(() => '?').join(', ')})` : '';
      const rows = db.prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC, id`).all(...statuses);
      return rows.map((r) => hydrate(r) as Job);
    },

    version: () => Number(selectVersion.get()?.v ?? 0),
    transition: (id, event) =>
      transaction(db, () => {
        if (updateStatus.run(event.status, id).changes === 0) throw new Error(`Job ${id} not found`);
        addEvent(id, event);
        return get(id) as Job;
      }),
  };
}
