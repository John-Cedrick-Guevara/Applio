import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { createProfileService } from '../core/profile/profile-service';
import { createDraftsRepo, createJobsRepo, createProfileRepo, createSettingsRepo, transaction } from '../infra/db';
import type { JobStatus } from '../shared/types';
import type { ToolPorts } from './tools';

/**
 * The tools' ports over the Applio database: used by the MCP server process
 * (Claude Code) and by the API-key engine in main, so both write the same way.
 * Each write and its status move land together.
 */
export function createToolPorts(db: DatabaseSync, jobIds: readonly string[], now: () => Date): ToolPorts {
  const jobs = createJobsRepo(db);
  const drafts = createDraftsRepo(db);
  const store = createProfileRepo(db);
  const profile = createProfileService({ store, kv: createSettingsRepo(db), newId: randomUUID, now });

  /** Moves a job forward only from the step before, so a re-score never pulls a sent application back. */
  const advance = (id: string, from: readonly JobStatus[], to: JobStatus) => {
    const status = jobs.get(id)?.status;
    if (status && from.includes(status)) jobs.transition(id, { status: to, at: now().toISOString() });
  };

  return {
    scope: new Set(jobIds),
    profile: () => profile.getProfile(),
    answers: () => store.listAnswers(),
    job: (id) => jobs.get(id),
    saveMatch: (id, match) =>
      transaction(db, () => {
        jobs.saveMatch(id, match);
        advance(id, ['found'], 'scored');
      }),
    saveDraft: (draft, reusedAnswerIds) =>
      transaction(db, () => {
        drafts.save(draft);
        const cited = new Set(draft.resume.flatMap((s) => s.items.map((i) => i.factId)));
        for (const fact of store.listFacts()) if (cited.has(fact.id)) store.saveFact({ ...fact, timesUsed: fact.timesUsed + 1 });
        for (const answer of store.listAnswers()) if (reusedAnswerIds.includes(answer.id)) store.saveAnswer({ ...answer, timesReused: answer.timesReused + 1 });
        jobs.update(draft.jobId, { factsUsed: cited.size });
        advance(draft.jobId, ['found', 'scored'], 'drafted');
      }),
    logEvent: (id, note) => {
      const job = jobs.get(id);
      if (job) jobs.transition(id, { status: job.status, at: now().toISOString(), note });
    },
    now,
  };
}
