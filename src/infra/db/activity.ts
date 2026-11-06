import type { DatabaseSync } from 'node:sqlite';
import type { RunDetails } from '../../core/jobs/discover';
import type { RunSummary, UsageStep } from '../../shared/types';
import { json, nullable } from './rows';

/** One AI call's token spend; feeds the quota guard and usage page (SPEC F10). */
export interface UsageRecord {
  at: string;
  step: UsageStep;
  /** Input + output; what the budget counts. */
  tokens: number;
  inputTokens?: number;
  outputTokens?: number;
  jobId?: string;
  runId?: number;
}

export interface ActivityRepo {
  /** @returns The new run's id, so usage can point at it. */
  addRun(run: RunSummary, details?: RunDetails): number;
  latestRun(): RunSummary | undefined;
  /** Stores what scoring and drafting did, and the drafted count, once the run's AI work ends. */
  updateDetails(runId: number, details: RunDetails, drafted: number): void;
  /** Undefined when there's no run yet, or the last one predates run details. */
  latestRunDetails(): RunDetails | undefined;
  recordUsage(record: UsageRecord): void;
  /** Token totals per step at or after `since` (ISO time), steps in name order. */
  tokensByStep(since: string): { step: UsageStep; tokens: number }[];
  /** Each usage row at or after `since`, oldest first, for the usage page. */
  usageSince(since: string): { at: string; step: UsageStep; tokens: number }[];
  /** Every step's tokens at or after `since` (ISO time), for "tokens today". */
  tokensSince(since: string): number;
}

/** SQLite-backed discovery run summaries and per-call token usage. */
export function createActivityRepo(db: DatabaseSync): ActivityRepo {
  const insertRun = db.prepare('INSERT INTO run_summaries (at, found, new_after_dedup, passed_filters, drafted, details) VALUES (?, ?, ?, ?, ?, ?)');
  const selectLatest = db.prepare('SELECT * FROM run_summaries ORDER BY at DESC, id DESC LIMIT 1');
  const insertUsage = db.prepare('INSERT INTO usage_records (at, step, tokens, input_tokens, output_tokens, job_id, run_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const rowsSince = db.prepare('SELECT at, step, tokens FROM usage_records WHERE at >= ? ORDER BY at, id');
  const setDetails = db.prepare('UPDATE run_summaries SET details = ?, drafted = ? WHERE id = ?');
  const sumSince = db.prepare('SELECT COALESCE(SUM(tokens), 0) AS tokens FROM usage_records WHERE at >= ?');
  const sumByStep = db.prepare('SELECT step, SUM(tokens) AS tokens FROM usage_records WHERE at >= ? GROUP BY step ORDER BY step');

  return {
    addRun: (r, details) =>
      Number(insertRun.run(r.at, r.found, r.newAfterDedup, r.passedFilters, r.drafted, details ? JSON.stringify(details) : null).lastInsertRowid),
    latestRun: () => {
      const r = selectLatest.get();
      return r
        ? { at: String(r.at), found: Number(r.found), newAfterDedup: Number(r.new_after_dedup), passedFilters: Number(r.passed_filters), drafted: Number(r.drafted) }
        : undefined;
    },
    updateDetails: (id, details, drafted) => void setDetails.run(JSON.stringify(details), drafted, id),
    latestRunDetails: () => {
      const details = selectLatest.get()?.details;
      return details == null ? undefined : json<RunDetails>(details);
    },
    recordUsage: (u) => void insertUsage.run(u.at, u.step, u.tokens, u.inputTokens ?? 0, u.outputTokens ?? 0, nullable(u.jobId), nullable(u.runId)),
    usageSince: (since) => rowsSince.all(since).map((r) => ({ at: String(r.at), step: String(r.step) as UsageStep, tokens: Number(r.tokens) })),
    tokensSince: (since) => Number(sumSince.get(since)?.tokens ?? 0),
    tokensByStep: (since) => sumByStep.all(since).map((r) => ({ step: String(r.step) as UsageStep, tokens: Number(r.tokens) })),
  };
}
