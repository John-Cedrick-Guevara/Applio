import { describe, expect, it, vi } from 'vitest';
import { createAi, type AiPorts, type UsageEntry } from './ai-service';
import type { AiEngine } from './engine';

const NOW = new Date(2026, 10, 15, 10, 0);

/** Usage so far today and this month, as the usage table would total them. */
const setup = ({ today = 0, month = 0, recent = undefined as number | undefined } = {}) => {
  const recorded: UsageEntry[] = [];
  const engine: AiEngine = {
    complete: vi.fn(async () => ({ text: 'ok', inputTokens: 300, outputTokens: 100 })),
    check: async () => ({ ready: true, message: 'Ready' }),
  };
  const ports: AiPorts = {
    engine: () => engine,
    budgets: () => ({ daily: 10_000, monthly: 100_000 }),
    tokensSince: (since) => (since === new Date(2026, 10, 15).toISOString() ? today : month) + recorded.reduce((n, r) => n + r.tokens, 0),
    recentCost: () => recent,
    record: (entry) => void recorded.push(entry),
    now: () => NOW,
    warn: vi.fn(),
  };
  return { ai: createAi(ports), engine, recorded, ports };
};

const request = { step: 'score' as const, prompt: 'Score these jobs', jobIds: ['j1', 'j2'] };

describe('AI service', () => {
  it('passes the call\'s jobs to the engine as the tools\' scope', async () => {
    const { ai, engine } = setup();
    await ai.run(request);
    expect(engine.complete).toHaveBeenCalledWith({ system: undefined, prompt: 'Score these jobs', jobIds: ['j1', 'j2'] });
  });

  it('records a batched call against its run only', async () => {
    const { ai, recorded } = setup();
    await ai.run({ ...request, runId: 7 });
    expect(recorded[0]).not.toHaveProperty('jobId');
  });

  it('returns the reply and records its tokens against the run, job and step', async () => {
    const { ai, recorded } = setup();
    expect(await ai.run({ ...request, runId: 7, jobIds: ['j1'] })).toEqual({ text: 'ok', inputTokens: 300, outputTokens: 100 });
    expect(recorded).toEqual([{ at: NOW.toISOString(), step: 'score', inputTokens: 300, outputTokens: 100, cacheReadTokens: 0, tokens: 400, runId: 7, jobId: 'j1' }]);
  });

  it('warns once when a call takes today past 80% of the daily budget', async () => {
    const { ai, ports } = setup({ today: 7_900, month: 7_900 });
    await ai.run(request);
    expect(ports.warn).toHaveBeenCalledWith('Claude tokens: 83% of the daily budget used. AI stops at 100%.');
    await ai.run(request);
    expect(ports.warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn below 80%', async () => {
    const { ai, ports } = setup({ today: 7_500, month: 7_500 });
    await ai.run(request);
    expect(ports.warn).not.toHaveBeenCalled();
  });

  it('warns on the monthly budget too', async () => {
    const { ai, ports } = setup({ today: 0, month: 79_900 });
    await ai.run(request);
    expect(ports.warn).toHaveBeenCalledWith('Claude tokens: 80% of the monthly budget used. AI stops at 100%.');
  });

  it('refuses every call once today reaches the daily budget, without contacting the engine', async () => {
    const { ai, engine } = setup({ today: 10_000, month: 10_000 });
    await expect(ai.run(request)).rejects.toThrow(
      "Today's Claude token budget is used up (10,000 of 10,000). AI resumes tomorrow, or raise the budget in Settings.",
    );
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it('refuses every call once the month reaches the monthly budget', async () => {
    const { ai, engine } = setup({ today: 0, month: 100_000 });
    await expect(ai.run(request)).rejects.toThrow("This month's Claude token budget is used up (100,000 of 100,000). AI resumes next month, or raise the budget in Settings.");
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it('records nothing when the engine fails', async () => {
    const { ai, engine, recorded } = setup();
    vi.mocked(engine.complete).mockRejectedValueOnce(new Error('Claude Code exited with code 1'));
    await expect(ai.run(request)).rejects.toThrow('Claude Code exited with code 1');
    expect(recorded).toEqual([]);
  });

  it('reports a reached hard stop without making a call, so other work can wait on it', () => {
    expect(setup({ today: 9_000, month: 9_000 }).ai.budgetStop()).toBeUndefined();
    expect(setup({ today: 10_000, month: 10_000 }).ai.budgetStop()).toBe("Today's Claude token budget is used up (10,000 of 10,000). AI resumes tomorrow, or raise the budget in Settings.");
  });

  it('counts cache reads at a tenth against the budget, and records every part', async () => {
    const { ai, engine, recorded } = setup();
    vi.mocked(engine.complete).mockResolvedValueOnce({ text: 'ok', inputTokens: 1000, outputTokens: 500, cacheReadTokens: 20_000 });
    await ai.run(request);
    expect(recorded[0]).toMatchObject({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 20_000, tokens: 3500 });
  });

  it('refuses a call that would take today past the budget, by its recent cost, before running it', async () => {
    const { ai, engine } = setup({ today: 8_000, month: 8_000, recent: 2_500 });
    await expect(ai.run(request)).rejects.toThrow(
      'This call would go over today\'s Claude token budget: about 2,500 tokens, with 2,000 of 10,000 left. AI resumes tomorrow, or raise the budget in Settings.',
    );
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it('refuses a call that would take the month past its budget', async () => {
    const { ai } = setup({ today: 0, month: 99_000, recent: 2_500 });
    await expect(ai.run(request)).rejects.toThrow(/would go over this month's Claude token budget/);
  });

  it('runs a call whose recent cost fits, and one with no history yet', async () => {
    expect((await setup({ today: 5_000, month: 5_000, recent: 2_500 }).ai.run(request)).text).toBe('ok');
    expect((await setup({ today: 9_900, month: 9_900 }).ai.run(request)).text).toBe('ok');
  });
});
