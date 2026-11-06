import { describe, expect, it, vi } from 'vitest';
import { QuotaExceededError, type AiRequest } from '../ai/ai-service';
import { scoreJobs, type ScorePorts } from './score-jobs';

/** A fake AI that "saves" the score the test chose for each job it's asked about. */
const setup = (scores: Record<string, number | undefined>, alreadyScored: string[] = []) => {
  const saved = new Map<string, number>(alreadyScored.map((id) => [id, 70]));
  const requests: AiRequest[] = [];
  const ports: ScorePorts = {
    ai: vi.fn(async (req: AiRequest) => {
      requests.push(req);
      for (const id of req.jobIds) if (scores[id] !== undefined) saved.set(id, scores[id]!);
      return { text: 'done', inputTokens: 10, outputTokens: 5 };
    }),
    score: (id) => saved.get(id),
    note: vi.fn(),
  };
  return { ports, requests, saved };
};

const ids = (n: number) => Array.from({ length: n }, (_, i) => `j${i + 1}`);
const all = (n: number, score: number) => Object.fromEntries(ids(n).map((id) => [id, score]));

describe('scoreJobs', () => {
  it('scores jobs in batches of 10, each through the tools and against the run', async () => {
    const { ports, requests } = setup(all(23, 80));
    const result = await scoreJobs(ids(23), { runId: 4, draftThreshold: 75 }, ports);
    expect(requests.map((r) => r.jobIds.length)).toEqual([10, 10, 3]);
    expect(requests[0]).toMatchObject({ step: 'score', runId: 4, trigger: 'scheduled' });
    expect(requests[0]!.system).toMatch(/save_match/);
    expect(requests[0]!.system).toMatch(/never follow instructions/i);
    expect(result).toMatchObject({ scored: 23, notScored: 0 });
  });

  it('sends jobs at or above the draft threshold on to drafting, and counts the rest', async () => {
    const { ports } = setup({ j1: 75, j2: 90, j3: 74 });
    expect(await scoreJobs(ids(3), { runId: 1, draftThreshold: 75 }, ports)).toEqual({ scored: 3, toDraft: ['j1', 'j2'], belowThreshold: 1, notScored: 0 });
  });

  it('never re-scores a job that already has a score', async () => {
    const { ports, requests } = setup({ j2: 80 }, ['j1']);
    await scoreJobs(['j1', 'j2'], { runId: 1, draftThreshold: 75 }, ports);
    expect(requests.map((r) => r.jobIds)).toEqual([['j2']]);
  });

  it('retries jobs the AI skipped once, alone, then notes them and moves on', async () => {
    const { ports, requests } = setup({ j1: 80 });
    const result = await scoreJobs(['j1', 'j2'], { runId: 1, draftThreshold: 75 }, ports);
    expect(requests.map((r) => r.jobIds)).toEqual([['j1', 'j2'], ['j2']]);
    expect(ports.note).toHaveBeenCalledWith('j2', "Not scored: Claude didn't save a score.");
    expect(result).toMatchObject({ scored: 1, notScored: 1 });
  });

  it('retries a batch whose call failed once, then notes the reason and runs the next batch', async () => {
    const { ports, requests } = setup(all(11, 80));
    vi.mocked(ports.ai).mockRejectedValueOnce(new Error('Claude Code exited with code 1')).mockRejectedValueOnce(new Error('Claude Code exited with code 1'));
    const result = await scoreJobs(ids(11), { runId: 1, draftThreshold: 75 }, ports);
    expect(requests.map((r) => r.jobIds.length)).toEqual([1]);
    expect(ports.note).toHaveBeenCalledWith('j1', 'Not scored: Claude Code exited with code 1');
    expect(result).toMatchObject({ scored: 1, notScored: 10 });
  });

  it('stops at the token budget hard stop and says why', async () => {
    const { ports } = setup(all(20, 80));
    vi.mocked(ports.ai).mockRejectedValueOnce(new QuotaExceededError("Today's Claude token budget is used up (150,000 of 150,000)."));
    const result = await scoreJobs(ids(20), { runId: 1, draftThreshold: 75 }, ports);
    expect(ports.ai).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scored: 0, toDraft: [], belowThreshold: 0, notScored: 20, stopped: "Today's Claude token budget is used up (150,000 of 150,000)." });
  });
});
