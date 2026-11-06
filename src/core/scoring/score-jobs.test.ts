import { describe, expect, it, vi } from 'vitest';
import { QuotaExceededError, type AiRequest } from '../ai/ai-service';
import { scoreJobs, type ScorePorts } from './score-jobs';

type Answer = { jobId: string; score: number; factId?: string } | string;

/**
 * A fake AI that answers each call with JSON for the jobs the test chose, read
 * from the cards in the message, like Claude would.
 */
const setup = (scores: Record<string, number | undefined>, alreadyScored: string[] = []) => {
  const saved = new Map<string, number>(alreadyScored.map((id) => [id, 70]));
  const requests: AiRequest[] = [];
  const answer = (req: AiRequest): Answer[] =>
    (JSON.parse(req.prompt.slice(req.prompt.indexOf('['))) as { id: string }[]).flatMap((card) =>
      scores[card.id] === undefined ? [] : [{ jobId: card.id, score: scores[card.id]! }]);
  const ports: ScorePorts = {
    ai: vi.fn(async (req: AiRequest) => {
      requests.push(req);
      const text = JSON.stringify(answer(req).map((a) => (typeof a === 'string' ? a : { ...a, roleSummary: 'r', descriptionSummary: 'd', strengths: a.factId ? [{ text: 's', factId: a.factId }] : [], gaps: [] })));
      return { text, inputTokens: 10, outputTokens: 5 };
    }),
    prefix: () => 'PREFIX',
    cards: (ids) => ids.map((id) => ({ id, title: `Job ${id}` })),
    factIds: () => new Set(['f1']),
    save: vi.fn((id, m) => void saved.set(id, m.score)),
    score: (id) => saved.get(id),
    note: vi.fn(),
  };
  return { ports, requests, saved };
};

const ids = (n: number) => Array.from({ length: n }, (_, i) => `j${i + 1}`);
const all = (n: number, score: number) => Object.fromEntries(ids(n).map((id) => [id, score]));
const opts = { runId: 4, draftThreshold: 75 };

describe('scoreJobs', () => {
  it('scores each batch of 10 in one call, with no tools, the cached prefix as system and the cards as the message', async () => {
    const { ports, requests } = setup(all(23, 80));
    const result = await scoreJobs(ids(23), opts, ports);
    expect(requests.map((r) => r.jobIds.length)).toEqual([10, 10, 3]);
    expect(requests[0]).toMatchObject({ step: 'score', runId: 4, trigger: 'scheduled', tools: false, system: 'PREFIX' });
    expect(requests[0]!.prompt).toContain('"title":"Job j1"');
    expect(result).toMatchObject({ scored: 23, notScored: 0 });
  });

  it('saves the summaries, strengths and gaps it read from the JSON', async () => {
    const { ports } = setup({ j1: 82 });
    await scoreJobs(['j1'], opts, ports);
    expect(ports.save).toHaveBeenCalledWith('j1', { score: 82, roleSummary: 'r', descriptionSummary: 'd', strengths: [], gaps: [] });
  });

  it('sends jobs at or above the draft threshold on to drafting, and counts the rest', async () => {
    const { ports } = setup({ j1: 75, j2: 90, j3: 74 });
    expect(await scoreJobs(ids(3), opts, ports)).toEqual({ scored: 3, toDraft: ['j1', 'j2'], belowThreshold: 1, notScored: 0 });
  });

  it('never re-scores a job that already has a score', async () => {
    const { ports, requests } = setup({ j2: 80 }, ['j1']);
    await scoreJobs(['j1', 'j2'], opts, ports);
    expect(requests.map((r) => r.jobIds)).toEqual([['j2']]);
  });

  it('retries jobs missing from the answer once, alone, then notes them and moves on', async () => {
    const { ports, requests } = setup({ j1: 80 });
    const result = await scoreJobs(['j1', 'j2'], opts, ports);
    expect(requests.map((r) => r.jobIds)).toEqual([['j1', 'j2'], ['j2']]);
    expect(ports.note).toHaveBeenCalledWith('j2', "Not scored: Claude didn't return a usable score.");
    expect(result).toMatchObject({ scored: 1, notScored: 1 });
  });

  it('rejects a score citing a fact not in the bank, and a job from outside the batch', async () => {
    const { ports } = setup({});
    vi.mocked(ports.ai).mockResolvedValue({
      text: JSON.stringify([
        { jobId: 'j1', score: 90, roleSummary: 'r', descriptionSummary: 'd', strengths: [{ text: 'Led 50 people', factId: 'f9' }], gaps: [] },
        { jobId: 'zzz', score: 90, roleSummary: 'r', descriptionSummary: 'd', strengths: [], gaps: [] },
      ]),
      inputTokens: 1, outputTokens: 1,
    });
    await scoreJobs(['j1'], opts, ports);
    expect(ports.save).not.toHaveBeenCalled();
  });

  it('reads the JSON even when Claude wraps it in a code fence or prose', async () => {
    const { ports } = setup({});
    vi.mocked(ports.ai).mockResolvedValue({ text: 'Here you go:\n```json\n[{"jobId":"j1","score":64,"roleSummary":"r","descriptionSummary":"d","strengths":[],"gaps":[]}]\n```', inputTokens: 1, outputTokens: 1 });
    expect((await scoreJobs(['j1'], opts, ports)).scored).toBe(1);
  });

  it('retries a batch whose call failed once, then notes the reason and runs the next batch', async () => {
    const { ports } = setup(all(11, 80));
    vi.mocked(ports.ai).mockRejectedValueOnce(new Error('Claude Code exited with code 1')).mockRejectedValueOnce(new Error('Claude Code exited with code 1'));
    const result = await scoreJobs(ids(11), opts, ports);
    expect(ports.note).toHaveBeenCalledWith('j1', 'Not scored: Claude Code exited with code 1');
    expect(result).toMatchObject({ scored: 1, notScored: 10 });
  });

  it('stops at the token budget hard stop, says why, and notes each job left once', async () => {
    const { ports } = setup(all(20, 80));
    vi.mocked(ports.ai).mockRejectedValueOnce(new QuotaExceededError('Budget used up.'));
    const result = await scoreJobs(ids(20), opts, ports);
    expect(ports.ai).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ scored: 0, toDraft: [], belowThreshold: 0, notScored: 20, stopped: 'Budget used up.' });
    expect(vi.mocked(ports.note).mock.calls).toHaveLength(20);
  });
});
