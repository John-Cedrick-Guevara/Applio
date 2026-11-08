import { z } from 'zod';
import { QuotaExceededError, type AiRequest } from '../ai/ai-service';
import type { AiReply } from '../ai/engine';

/** Ten per call (spec Decisions); one turn each, so a batch costs about one prompt and one answer. */
const BATCH_SIZE = 10;

/** A scoring result as stored on the job (SPEC F3.3). */
export interface ScoredMatch {
  score: number;
  roleSummary: string;
  descriptionSummary: string;
  strengths: string[];
  gaps: string[];
}

const text = (max: number) => z.string().trim().min(1).max(max);
/** One job in Claude's answer, checked as `save_match` checks its input. */
const AnswerSchema = z.object({
  jobId: z.string(),
  score: z.number().int().min(0).max(100),
  roleSummary: text(400),
  descriptionSummary: text(600),
  strengths: z.array(z.object({ text: text(300), factId: z.string() })).max(5),
  gaps: z.array(text(300)).max(5),
});

export interface ScorePorts {
  /** The guarded AI call (budget, pause, usage). */
  ai: (request: AiRequest) => Promise<AiReply>;
  /** The fixed, cacheable start of every call: instructions, fact bank, preferences. */
  prefix: () => string;
  /** Compact cards for these jobs, sent as the message. */
  cards: (jobIds: readonly string[]) => object[];
  /** Ids in the fact bank, so a strength can't cite a fact that isn't there. */
  factIds: () => ReadonlySet<string>;
  save: (jobId: string, match: ScoredMatch) => void;
  /** The job's stored score, if it has one. */
  score: (jobId: string) => number | undefined;
  /** A note on the job's timeline. */
  note: (jobId: string, text: string) => void;
}

export interface ScoreResult {
  scored: number;
  /** At or above the draft threshold, for drafting (SPEC F3.4). */
  toDraft: string[];
  belowThreshold: number;
  notScored: number;
  /** Why scoring stopped early: the budget hard stop or a pause. */
  stopped?: string;
}

const chunks = <T>(items: readonly T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** The first JSON array in Claude's answer, bare or in a code fence; empty when there's none. */
const firstArray = (answer: string): unknown[] => {
  const start = answer.indexOf('[');
  const end = answer.lastIndexOf(']');
  try {
    const parsed: unknown = start >= 0 && end > start ? JSON.parse(answer.slice(start, end + 1)) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Scores a run's new jobs (SPEC F3.3), one tool-free call per batch: the cached
 * prefix (instructions, fact bank) as the system prompt and the jobs' cards as the
 * message; Claude answers with JSON. Each answer is checked (score range, facts in
 * the bank, jobs from this batch) before it's saved. Jobs missing from the answer,
 * or a failed call, get one retry; then a note. A budget stop ends scoring.
 */
export async function scoreJobs(jobIds: readonly string[], { runId, draftThreshold }: { runId?: number; draftThreshold: number }, ports: ScorePorts): Promise<ScoreResult> {
  const todo = jobIds.filter((id) => ports.score(id) === undefined);
  let stopped: string | undefined;
  const noted = new Set<string>();
  const noteOnce = (id: string, note: string) => {
    if (noted.has(id)) return;
    noted.add(id);
    ports.note(id, note);
  };

  /** Saves every valid answer for this batch. */
  const saveAnswers = (answer: string, batch: readonly string[]) => {
    const facts = ports.factIds();
    for (const item of firstArray(answer)) {
      const parsed = AnswerSchema.safeParse(item);
      if (!parsed.success || !batch.includes(parsed.data.jobId)) continue;
      const { jobId, strengths, ...rest } = parsed.data;
      if (strengths.some((s) => !facts.has(s.factId))) continue;
      ports.save(jobId, { ...rest, strengths: strengths.map((s) => s.text) });
    }
  };

  /** @returns The reason a batch can't be scored, or undefined once the call came back. */
  const attempt = async (batch: readonly string[]): Promise<string | undefined> => {
    try {
      const reply = await ports.ai({
        step: 'score', system: ports.prefix(), prompt: `Score these jobs:\n${JSON.stringify(ports.cards(batch))}`, jobIds: batch, tools: false,
        ...(runId !== undefined ? { runId } : {}),
      });
      saveAnswers(reply.text, batch);
      return undefined;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        stopped = err.message;
        return err.message;
      }
      return err instanceof Error ? err.message : String(err);
    }
  };

  for (const batch of chunks(todo, BATCH_SIZE)) {
    if (stopped) break;
    let failure = await attempt(batch);
    const missing = () => batch.filter((id) => ports.score(id) === undefined);
    if (!stopped && missing().length > 0) failure = await attempt(missing());
    if (stopped) break;
    for (const id of missing()) noteOnce(id, `Not scored: ${failure ?? "Claude didn't return a usable score."}`);
  }
  // A stop leaves the rest unscored for good (they aren't retried), so they get the reason too.
  if (stopped) for (const id of todo) if (ports.score(id) === undefined) noteOnce(id, `Not scored: ${stopped}`);

  const scores = todo.flatMap((id) => {
    const s = ports.score(id);
    return s === undefined ? [] : [{ id, s }];
  });
  return {
    scored: scores.length,
    toDraft: scores.filter((x) => x.s >= draftThreshold).map((x) => x.id),
    belowThreshold: scores.filter((x) => x.s < draftThreshold).length,
    notScored: todo.length - scores.length,
    ...(stopped ? { stopped } : {}),
  };
}
