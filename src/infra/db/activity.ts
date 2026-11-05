import type { DatabaseSync } from 'node:sqlite';
import type { RunSummary, UsageStep } from '../../shared/types';
import { nullable } from './rows';

/** One AI call's token spend; feeds the quota guard and usage page (SPEC F10). */
export interface UsageRecord {
  at: string;
  step: UsageStep;
  tokens: number;
  jobId?: string;
  runId?: number;
}

export interface ActivityRepo {
  /** @returns The new run's id, so usage can point at it. */
  addRun(run: RunSummary): number;
  latestRun(): RunSummary | undefined;
  recordUsage(record: UsageRecord): void;
  /** Token totals per step at or after `since` (ISO time), steps in name order. */
  tokensByStep(since: string): { step: UsageStep; tokens: number }[];
}

/** SQLite-backed discovery run summaries and per-call token usage. */
export function createActivityRepo(db: DatabaseSync): ActivityRepo {
  const insertRun = db.prepare('INSERT INTO run_summaries (at, found, new_after_dedup, passed_filters, drafted) VALUES (?, ?, ?, ?, ?)');
  const selectLatest = db.prepare('SELECT * FROM run_summaries ORDER BY at DESC, id DESC LIMIT 1');
  const insertUsage = db.prepare('INSERT INTO usage_records (at, step, tokens, job_id, run_id) VALUES (?, ?, ?, ?, ?)');
  const sumByStep = db.prepare('SELECT step, SUM(tokens) AS tokens FROM usage_records WHERE at >= ? GROUP BY step ORDER BY step');

  return {
    addRun: (r) => Number(insertRun.run(r.at, r.found, r.newAfterDedup, r.passedFilters, r.drafted).lastInsertRowid),
    latestRun: () => {
      const r = selectLatest.get();
      return r
        ? { at: String(r.at), found: Number(r.found), newAfterDedup: Number(r.new_after_dedup), passedFilters: Number(r.passed_filters), drafted: Number(r.drafted) }
        : undefined;
    },
    recordUsage: (u) => void insertUsage.run(u.at, u.step, u.tokens, nullable(u.jobId), nullable(u.runId)),
    tokensByStep: (since) => sumByStep.all(since).map((r) => ({ step: String(r.step) as UsageStep, tokens: Number(r.tokens) })),
  };
}
