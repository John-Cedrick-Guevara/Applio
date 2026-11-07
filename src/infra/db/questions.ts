import type { OpenQuestions } from '../../shared/types';
import type { SettingsRepo } from './settings';

export interface QuestionsRepo {
  get(jobId: string): OpenQuestions | undefined;
  save(jobId: string, questions: string[], askedAt: string): void;
  clear(jobId: string): void;
  /** Every job waiting on answers, oldest question first. */
  list(): OpenQuestions[];
}

const PREFIX = 'questions:';

/**
 * Claude's open questions per job (SPEC F4), kept in the settings table under
 * `questions:<jobId>`; there are only ever a handful at a time.
 */
export function createQuestionsRepo(kv: SettingsRepo): QuestionsRepo {
  return {
    get: (jobId) => kv.get(PREFIX + jobId) as OpenQuestions | undefined,
    save: (jobId, questions, askedAt) => kv.set(PREFIX + jobId, { jobId, questions, askedAt } satisfies OpenQuestions),
    clear: (jobId) => kv.delete(PREFIX + jobId),
    list: () =>
      Object.entries(kv.all())
        .filter(([key, value]) => key.startsWith(PREFIX) && value)
        .map(([, value]) => value as OpenQuestions)
        .sort((a, b) => a.askedAt.localeCompare(b.askedAt)),
  };
}
